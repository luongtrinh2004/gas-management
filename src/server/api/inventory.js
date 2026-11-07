// Nhập hàng & kho, vật tư, sửa chữa/bảo trì/kiểm định
import { get, post, put, del, bad, notFound, forbidden, list, rx, audit, pick, oid, nextCode, num } from '../core'
import { Import, Product, Supplier, Material, MaterialTx, Maintenance, Customer } from '../models'
import { syncCash, getSettings, rangeFrom, stockSummary, startOfDay, endOfDay } from '../lib'

const BACK = ['admin', 'office', 'accountant']
const MONEY = ['admin', 'accountant']
const METHODS = ['cash', 'company_account', 'personal_account', 'other']
const dateRange = q => {
  const r = {}
  if (q.from) r.$gte = startOfDay(q.from)
  if (q.to) r.$lte = endOfDay(q.to)
  return Object.keys(r).length ? r : null
}

// ===== Phiếu nhập =====
const valueOf = (lines, basis) => Math.round(lines.reduce((s, l) => s + num(l.pricePerKg) * num(basis === 'document' ? l.kgDocument : l.kgActual), 0))

function decorate(imp, pm) {
  const lines = (imp.lines || []).map(l => {
    const p = pm.get(String(l.product))
    const diffKg = num(l.kgActual) - num(l.kgDocument)
    return { ...l, nominalKg: p?.kgPerUnit ? num(l.qty) * p.kgPerUnit : null, diffKg, pump: num(l.kgActual) >= num(l.kgDocument) ? 'du' : 'thieu', value: Math.round(num(l.pricePerKg) * num(imp.valueBasis === 'document' ? l.kgDocument : l.kgActual)) }
  })
  return { ...imp, lines, totalKg: lines.reduce((s, l) => s + num(l.kgActual), 0), totalQty: lines.reduce((s, l) => s + num(l.qty), 0), debtAmount: num(imp.totalValue) - num(imp.paidAmount) }
}
const prodMap = async () => new Map((await Product.find().lean()).map(p => [String(p._id), p]))

async function buildLines(rawLines) {
  if (!Array.isArray(rawLines) || !rawLines.length) throw bad('Phiếu nhập cần ít nhất một dòng sản phẩm')
  const pm = await prodMap()
  return rawLines.map(l => {
    const p = pm.get(String(l.product))
    if (!p) throw bad('Sản phẩm không hợp lệ')
    const qty = num(l.qty), kgA = num(l.kgActual), kgD = num(l.kgDocument)
    if (qty < 0 || kgA < 0 || kgD < 0 || num(l.pricePerKg) < 0 || num(l.shellsReturned) < 0) throw bad('Số liệu không được âm')
    return { product: p._id, productName: p.name, qty, kgDocument: kgD, kgActual: kgA, pricePerKg: num(l.pricePerKg), shellsReturned: num(l.shellsReturned) }
  })
}

async function syncImportCash(imp, session) {
  const paid = imp.status === 'void' ? 0 : num(imp.paidAmount)
  await syncCash(
    { refType: 'import', refId: imp._id, refCode: imp.code },
    paid > 0 ? { type: 'out', category: 'import', date: imp.date, amount: paid, channel: imp.payMethod, content: `Chi nhập gas ${imp.code} – ${imp.supplierName}` } : { voidReason: 'Phiếu nhập hủy / không còn chi' },
    session
  )
}

get('/imports', BACK, async ({ query }) => {
  const f = {}
  if (query.supplier) f.supplier = oid(query.supplier)
  if (query.status) f.status = query.status
  const d = dateRange(query)
  if (d) f.date = d
  if (query.q) f.$or = [{ code: rx(query.q) }, { supplierName: rx(query.q) }]
  const pm = await prodMap()
  return list(Import, f, query, { sort: { date: -1, createdAt: -1 }, map: i => decorate(i, pm) })
})

get('/imports/meta', BACK, async () => ({ valueBasis: (await getSettings()).importValueBasis }))

get('/imports/:id', BACK, async ({ params }) => {
  const i = await Import.findById(oid(params.id)).lean()
  if (!i) throw notFound()
  return decorate(i, await prodMap())
})

async function importBody(body) {
  const sup = await Supplier.findById(oid(body.supplier)).lean()
  if (!sup) throw bad('Chọn nhà cung cấp')
  if (!body.date) throw bad('Chọn ngày nhập')
  if (!METHODS.includes(body.payMethod || 'cash')) throw bad('Hình thức thanh toán không hợp lệ')
  return { sup, lines: await buildLines(body.lines) }
}

post('/imports', BACK, async ({ session, body }) => {
  const { sup, lines } = await importBody(body)
  const basis = (await getSettings()).importValueBasis
  const imp = await Import.create({
    code: await nextCode('PN'), supplier: sup._id, supplierName: sup.name, date: new Date(body.date), lines, valueBasis: basis,
    totalValue: valueOf(lines, basis), paidAmount: Math.max(0, num(body.paidAmount)), payMethod: body.payMethod || 'cash', status: 'confirmed',
    note: body.note, attachments: body.attachments || [], createdBy: session.id, createdByName: session.name
  })
  await syncImportCash(imp, session)
  await audit(session, 'import', imp._id, 'create', `Tạo phiếu nhập ${imp.code} (${sup.name})`)
  return decorate(imp.toObject(), await prodMap())
})

put('/imports/:id', BACK, async ({ session, params, body }) => {
  const imp = await Import.findById(oid(params.id))
  if (!imp) throw notFound()
  if (imp.status !== 'confirmed') throw bad('Chỉ sửa được phiếu đã xác nhận (không sửa phiếu đã hủy)')
  const before = { supplier: imp.supplierName, date: imp.date, lines: imp.lines.toObject(), totalValue: imp.totalValue, paidAmount: imp.paidAmount }
  const { sup, lines } = await importBody(body)
  Object.assign(imp, { supplier: sup._id, supplierName: sup.name, date: new Date(body.date), lines, totalValue: valueOf(lines, imp.valueBasis), paidAmount: Math.max(0, num(body.paidAmount)), payMethod: body.payMethod || 'cash', note: body.note, attachments: body.attachments || [] })
  await imp.save()
  await syncImportCash(imp, session)
  await audit(session, 'import', imp._id, 'update', `Sửa phiếu nhập ${imp.code}`, before, { supplier: imp.supplierName, date: imp.date, lines, totalValue: imp.totalValue, paidAmount: imp.paidAmount })
  return decorate(imp.toObject(), await prodMap())
})

post('/imports/:id/void', MONEY, async ({ session, params, body }) => {
  const imp = await Import.findById(oid(params.id))
  if (!imp) throw notFound()
  if (imp.status === 'void') throw bad('Phiếu đã hủy')
  if (!String(body.reason || '').trim()) throw bad('Nhập lý do hủy')
  imp.status = 'void'
  imp.note = `${imp.note ? imp.note + ' | ' : ''}Hủy: ${body.reason}`
  await imp.save()
  await syncImportCash(imp, session)
  await audit(session, 'import', imp._id, 'void', `Hủy phiếu nhập ${imp.code}: ${body.reason}`)
})

// ===== Nhập – xuất – tồn =====
get('/stock', BACK, async ({ query }) => {
  const { from, to } = rangeFrom(query)
  const rows = await stockSummary({ from, to })
  return { rows: rows.filter(r => r.product.status !== 'inactive' || r.opening || r.in || r.out), from, to }
})

// ===== Vật tư =====
get('/materials', BACK, async ({ query }) => {
  const f = {}
  if (query.q) f.$or = [{ name: rx(query.q) }, { code: rx(query.q) }]
  if (query.status) f.status = query.status
  return list(Material, f, query, { sort: { name: 1 } })
})
get('/materials/options', BACK, async () => Material.find({ status: 'active' }).select('name unit defaultPrice').sort({ name: 1 }).lean())

async function materialStock(materialIds) {
  const match = { void: false }
  if (materialIds) match.material = { $in: materialIds }
  const agg = await MaterialTx.aggregate([{ $match: match }, { $group: { _id: { m: '$material', t: '$type' }, q: { $sum: '$qty' }, a: { $sum: '$amount' } } }])
  const out = new Map()
  for (const a of agg) {
    const k = String(a._id.m)
    const r = out.get(k) || { in: 0, sale: 0, gift: 0, saleAmount: 0, stock: 0 }
    r[a._id.t] = a.q
    if (a._id.t === 'sale') r.saleAmount = a.a
    out.set(k, r)
  }
  out.forEach(r => (r.stock = r.in - r.sale - r.gift))
  return out
}

get('/materials/stock', BACK, async ({ query }) => {
  const mats = await Material.find(query.status ? { status: query.status } : {}).sort({ name: 1 }).lean()
  const st = await materialStock()
  return mats.map(m => ({ ...m, ...(st.get(String(m._id)) || { in: 0, sale: 0, gift: 0, saleAmount: 0, stock: 0 }) }))
})

post('/materials', BACK, async ({ session, body }) => {
  const m = await Material.create({ ...pick(body, ['code', 'name', 'unit', 'defaultPrice', 'status', 'note']) })
  await audit(session, 'material', m._id, 'create', `Thêm vật tư ${m.name}`)
  return m
})
put('/materials/:id', BACK, async ({ session, params, body }) => {
  const m = await Material.findById(oid(params.id))
  if (!m) throw notFound()
  Object.assign(m, pick(body, ['code', 'name', 'unit', 'defaultPrice', 'status', 'note']))
  await m.save()
  await audit(session, 'material', m._id, 'update', `Sửa vật tư ${m.name}`)
  return m
})
del('/materials/:id', ['admin'], async ({ session, params }) => {
  const id = oid(params.id)
  if (await MaterialTx.countDocuments({ material: id })) throw bad('Vật tư đã có giao dịch, chỉ có thể ngừng sử dụng')
  const m = await Material.findByIdAndDelete(id)
  if (m) await audit(session, 'material', id, 'delete', `Xóa vật tư ${m.name}`)
})

get('/material-tx', BACK, async ({ query }) => {
  const f = {}
  if (query.material) f.material = oid(query.material)
  if (query.type) f.type = query.type
  const d = dateRange(query)
  if (d) f.date = d
  if (query.q) f.$or = [{ materialName: rx(query.q) }, { customerName: rx(query.q) }, { note: rx(query.q) }]
  return list(MaterialTx, f, query, { sort: { date: -1, createdAt: -1 } })
})

async function syncMaterialCash(tx, session) {
  const paid = tx.void ? 0 : num(tx.paidAmount)
  const isIn = tx.type === 'sale'
  await syncCash(
    { refType: 'material', refId: tx._id, refCode: tx.materialName },
    paid > 0 && tx.type !== 'gift'
      ? { type: isIn ? 'in' : 'out', category: isIn ? 'material_sale' : 'supplies', date: tx.date, amount: paid, channel: tx.payMethod, customer: tx.customer, customerName: tx.customerName, content: `${isIn ? 'Bán' : 'Nhập'} vật tư ${tx.materialName} x${tx.qty}` }
      : { voidReason: 'Giao dịch vật tư hủy' },
    session
  )
}

post('/material-tx', BACK, async ({ session, body }) => {
  const m = await Material.findById(oid(body.material))
  if (!m) throw bad('Chọn vật tư')
  if (!['in', 'sale', 'gift'].includes(body.type)) throw bad('Loại giao dịch không hợp lệ')
  const qty = num(body.qty)
  if (qty <= 0) throw bad('Số lượng phải lớn hơn 0')
  if (!body.date) throw bad('Chọn ngày')
  const method = body.payMethod || 'cash'
  if (!METHODS.includes(method)) throw bad('Hình thức thanh toán không hợp lệ')
  if (body.type !== 'in') {
    const st = (await materialStock([m._id])).get(String(m._id))
    if ((st?.stock || 0) < qty) throw bad(`Tồn kho không đủ (còn ${st?.stock || 0} ${m.unit})`)
  }
  let cust = null
  if (body.customer) { cust = await Customer.findById(oid(body.customer)).select('name').lean(); if (!cust) throw bad('Khách hàng không hợp lệ') }
  const unitPrice = body.type === 'gift' ? 0 : num(body.unitPrice)
  const amount = Math.round(qty * unitPrice)
  const tx = await MaterialTx.create({
    material: m._id, materialName: m.name, type: body.type, date: new Date(body.date), qty, unitPrice, amount,
    paidAmount: body.type === 'gift' ? 0 : Math.min(Math.max(0, num(body.paidAmount)), amount || Infinity), payMethod: method,
    customer: cust?._id, customerName: cust?.name, note: body.note, createdBy: session.id, createdByName: session.name
  })
  await syncMaterialCash(tx, session)
  await audit(session, 'material_tx', tx._id, 'create', `${body.type} ${qty} ${m.unit} ${m.name}`)
  return tx
})

post('/material-tx/:id/void', MONEY, async ({ session, params, body }) => {
  const tx = await MaterialTx.findById(oid(params.id))
  if (!tx) throw notFound()
  if (tx.void) throw bad('Giao dịch đã hủy')
  if (tx.type === 'in') {
    const st = (await materialStock([tx.material])).get(String(tx.material))
    if ((st?.stock || 0) < tx.qty) throw bad('Không thể hủy phiếu nhập: tồn kho sẽ âm')
  }
  tx.void = true
  tx.note = `${tx.note ? tx.note + ' | ' : ''}Hủy: ${body?.reason || ''}`
  await tx.save()
  await syncMaterialCash(tx, session)
  await audit(session, 'material_tx', tx._id, 'void', `Hủy giao dịch vật tư ${tx.materialName}`)
})

// ===== Sửa chữa, bảo trì, kiểm định =====
get('/maintenance', BACK, async ({ query }) => {
  const f = {}
  for (const k of ['vehicleType', 'kind']) if (query[k]) f[k] = query[k]
  if (query.plate) f.plate = rx(query.plate)
  const d = dateRange(query)
  if (d) f.date = d
  if (query.q) f.$or = [{ plate: rx(query.q) }, { item: rx(query.q) }, { vendor: rx(query.q) }]
  return list(Maintenance, f, query, { sort: { date: -1 } })
})

const MFIELDS = ['vehicleType', 'plate', 'kind', 'item', 'date', 'vendor', 'cost', 'nextDue', 'note']
async function syncMaintCash(m, session, remove) {
  await syncCash(
    { refType: 'maintenance', refId: m._id, refCode: m.plate },
    !remove && num(m.cost) > 0 ? { type: 'out', category: 'repair', date: m.date, amount: num(m.cost), channel: 'cash', content: `${m.item} – ${m.plate}` } : { voidReason: 'Hủy/sửa hồ sơ bảo trì' },
    session
  )
}
post('/maintenance', BACK, async ({ session, body }) => {
  const b = pick(body, MFIELDS)
  b.plate = String(b.plate || '').trim().toUpperCase()
  if (!b.nextDue) delete b.nextDue
  b.cost = Math.max(0, num(b.cost))
  const m = await Maintenance.create({ ...b, createdBy: session.id, createdByName: session.name })
  await syncMaintCash(m, session)
  await audit(session, 'maintenance', m._id, 'create', `${m.item} – ${m.plate}`)
  return m
})
put('/maintenance/:id', BACK, async ({ session, params, body }) => {
  const m = await Maintenance.findById(oid(params.id))
  if (!m) throw notFound()
  const before = m.toObject()
  const b = pick(body, MFIELDS)
  if (b.plate) b.plate = String(b.plate).trim().toUpperCase()
  if (b.cost != null) b.cost = Math.max(0, num(b.cost))
  Object.assign(m, b)
  if (!body.nextDue) m.nextDue = undefined
  await m.save()
  await syncMaintCash(m, session)
  await audit(session, 'maintenance', m._id, 'update', `Sửa ${m.item} – ${m.plate}`, before, m.toObject())
  return m
})
del('/maintenance/:id', ['admin'], async ({ session, params }) => {
  const m = await Maintenance.findByIdAndDelete(oid(params.id))
  if (!m) throw notFound()
  await syncMaintCash(m, session, true)
  await audit(session, 'maintenance', m._id, 'delete', `Xóa ${m.item} – ${m.plate}`, m.toObject())
})
