// Module C: công nợ, vỏ bình, gas dư, thu chi. Sổ được TỔNG HỢP từ đơn đã duyệt + thu chi + điều chỉnh tay.
import { get, post, put, bad, notFound, audit, nextCode, oid, rx, num, pick, list } from '../core'
import { Customer, Product, Order, CashTx, DebtAdjust, ShellEntry, ResidualEntry, Import } from '../models'
import { debtSummary, shellHoldings, residualBalances, rangeFrom, startOfDay, endOfDay } from '../lib'

const READ = ['admin', 'office', 'accountant']
const WRITE = ['admin', 'accountant']
const CHANNELS = ['cash', 'company_account', 'personal_account', 'other']

const dateOf = v => (v ? new Date(v) : new Date())
const page = (rows, query) => {
  const p = Math.max(1, parseInt(query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10))
  return { rows: rows.slice((p - 1) * limit, p * limit), total: rows.length, page: p, limit }
}
const prodMap = async () => new Map((await Product.find().select('name code').lean()).map(p => [String(p._id), p]))

// ===================== CÔNG NỢ =====================
get('/debts', READ, async ({ query }) => {
  const { from, to } = rangeFrom(query)
  const map = await debtSummary({ from, to })
  let rows = [...map.values()].map(r => ({ customer: r.customer, opening: r.opening, increase: r.increase, decrease: r.decrease, closing: r.closing }))
  if (query.q) {
    const re = rx(query.q)
    rows = rows.filter(r => re.test(r.customer.name || '') || re.test(r.customer.code || '') || re.test(r.customer.phone || ''))
  }
  if (query.onlyDebt === '1' || query.onlyDebt === 'true') rows = rows.filter(r => Math.round(r.closing) !== 0)
  else rows = rows.filter(r => r.opening || r.increase || r.decrease || r.closing)
  rows.sort((a, b) => b.closing - a.closing)
  const totals = rows.reduce((t, r) => ({ opening: t.opening + r.opening, increase: t.increase + r.increase, decrease: t.decrease + r.decrease, closing: t.closing + r.closing }), { opening: 0, increase: 0, decrease: 0, closing: 0 })
  return { ...page(rows, query), totals }
})

get('/debts/customer/:id', READ, async ({ params, query }) => {
  const id = oid(params.id)
  const cust = await Customer.findById(id).lean()
  if (!cust) throw notFound('Không tìm thấy khách hàng')
  const { from, to } = rangeFrom(query)
  const summary = (await debtSummary({ from, to, customerIds: [id] })).get(String(id))
  const [orders, cash, adjs] = await Promise.all([
    Order.find({ customer: id, status: 'approved', bookDate: { $gte: from, $lte: to } }).select('code amount bookDate').lean(),
    CashTx.find({ customer: id, type: 'in', void: false, category: { $in: ['sale', 'debt_collect'] }, date: { $gte: from, $lte: to } }).lean(),
    DebtAdjust.find({ customer: id, date: { $gte: from, $lte: to } }).lean()
  ])
  const items = [
    ...orders.map(o => ({ date: o.bookDate, kind: 'sale', refType: 'order', refId: String(o._id), refCode: o.code, amount: o.amount, note: 'Bán hàng' })),
    ...cash.map(c => ({ date: c.date, kind: 'payment', refType: c.refType || 'manual', refId: String(c._id), refCode: c.code, amount: -c.amount, note: c.content || (c.category === 'sale' ? 'Thu tại điểm giao' : 'Thu nợ') })),
    ...adjs.map(a => ({ date: a.date, kind: 'adjust', refType: 'adjust', refId: String(a._id), refCode: '', amount: a.amount, note: a.reason }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date))
  let bal = summary.opening
  const rows = [{ date: from, kind: 'opening', refType: '', refId: '', refCode: '', amount: summary.opening, balance: bal, note: 'Dư đầu kỳ' }]
  for (const r of items) { bal += r.amount; rows.push({ ...r, balance: bal }) }
  return { summary: { opening: summary.opening, increase: summary.increase, decrease: summary.decrease, closing: summary.closing }, rows }
})

post('/debts/payment', WRITE, async ({ session, body }) => {
  const amount = num(body.amount)
  if (amount <= 0) throw bad('Số tiền phải lớn hơn 0')
  const cust = await Customer.findById(oid(body.customer)).lean()
  if (!cust) throw bad('Chưa chọn khách hàng')
  const channel = CHANNELS.includes(body.channel) ? body.channel : 'cash'
  const tx = await CashTx.create({
    code: await nextCode('PT'), type: 'in', category: 'debt_collect', date: dateOf(body.date), amount, channel,
    accountNote: body.accountNote, content: body.content || `Thu nợ ${cust.name}`, customer: cust._id, customerName: cust.name,
    refType: 'manual', attachments: body.attachments || [], createdBy: session.id, createdByName: session.name
  })
  await audit(session, 'debt', cust._id, 'payment', `Thu nợ ${cust.name}: ${amount}`, null, { code: tx.code, amount })
  return tx
})

post('/debts/adjust', WRITE, async ({ session, body }) => {
  const amount = num(body.amount)
  if (!amount) throw bad('Số tiền điều chỉnh phải khác 0')
  if (!String(body.reason || '').trim()) throw bad('Cần nhập lý do điều chỉnh')
  const cust = await Customer.findById(oid(body.customer)).lean()
  if (!cust) throw bad('Chưa chọn khách hàng')
  const a = await DebtAdjust.create({ customer: cust._id, date: dateOf(body.date), amount, reason: body.reason.trim(), createdBy: session.id, createdByName: session.name })
  await audit(session, 'debt', cust._id, 'adjust', `Điều chỉnh công nợ ${cust.name}: ${amount} (${a.reason})`, null, { amount })
  return a
})

// ===================== VỎ BÌNH =====================
get('/shells', READ, async ({ query }) => {
  const to = query.to ? endOfDay(query.to) : undefined
  const hold = await shellHoldings({ to })
  const [pm, supplierEntries, stocktake, impAgg] = await Promise.all([
    prodMap(),
    ShellEntry.aggregate([{ $match: { kind: 'supplier_return' } }, { $group: { _id: null, v: { $sum: '$qty' } } }]),
    ShellEntry.aggregate([{ $match: { kind: 'stocktake' } }, { $group: { _id: null, v: { $sum: '$qty' } } }]),
    Import.aggregate([{ $match: { status: 'confirmed' } }, { $unwind: '$lines' }, { $group: { _id: null, v: { $sum: '$lines.shellsReturned' } } }])
  ])
  const byCust = new Map()
  let delivered = 0, collected = 0, atCustomers = 0
  for (const h of hold.values()) {
    delivered += h.lent; collected += h.collected; atCustomers += h.holding
    if (!h.lent && !h.collected && !h.entries && !h.holding) continue
    if (!byCust.has(h.customer)) byCust.set(h.customer, [])
    byCust.get(h.customer).push({ product: pm.get(h.product) || { _id: h.product, name: '—' }, lent: h.lent, collected: h.collected, entries: h.entries, holding: h.holding })
  }
  const custs = await Customer.find({ _id: { $in: [...byCust.keys()] } }).select('code name').lean()
  let rows = custs.map(c => {
    const byProduct = byCust.get(String(c._id))
    return { customer: c, byProduct, totalHolding: byProduct.reduce((s, x) => s + x.holding, 0) }
  })
  if (query.q) { const re = rx(query.q); rows = rows.filter(r => re.test(r.customer.name || '') || re.test(r.customer.code || '')) }
  rows.sort((a, b) => b.totalHolding - a.totalHolding)
  return {
    ...page(rows, query),
    summary: { delivered, collected, atCustomers, returnedToSupplier: (supplierEntries[0]?.v || 0) + (impAgg[0]?.v || 0), stocktakeDiff: stocktake[0]?.v || 0 }
  }
})

get('/shells/customer/:id', READ, async ({ params }) => {
  const id = oid(params.id)
  const pm = await prodMap()
  const hold = await shellHoldings({ customerId: id })
  const holdings = [...hold.values()].map(h => ({ product: pm.get(h.product) || { _id: h.product, name: '—' }, lent: h.lent, collected: h.collected, entries: h.entries, holding: h.holding }))
  const [orders, entries] = await Promise.all([
    Order.find({ customer: id, status: 'approved' }).select('code bookDate lines').lean(),
    ShellEntry.find({ customer: id }).lean()
  ])
  const history = []
  for (const o of orders) for (const l of o.lines || []) {
    if (l.shellsLent) history.push({ date: o.bookDate, kind: 'lent', product: l.productName || pm.get(String(l.product))?.name, qty: l.shellsLent, orderCode: o.code, orderId: String(o._id) })
    if (l.shellsCollected) history.push({ date: o.bookDate, kind: 'collected', product: l.productName || pm.get(String(l.product))?.name, qty: -l.shellsCollected, orderCode: o.code, orderId: String(o._id) })
  }
  for (const e of entries) history.push({ date: e.date, kind: e.kind, product: pm.get(String(e.product))?.name, qty: e.qty, note: e.note })
  history.sort((a, b) => new Date(b.date) - new Date(a.date))
  return { holdings, history }
})

post('/shells/entry', WRITE, async ({ session, body }) => {
  const kinds = ['opening', 'supplier_return', 'stocktake', 'adjust']
  if (!kinds.includes(body.kind)) throw bad('Loại phát sinh không hợp lệ')
  let qty = num(body.qty)
  if (!qty) throw bad('Số lượng phải khác 0')
  const product = await Product.findById(oid(body.product)).lean()
  if (!product) throw bad('Chưa chọn loại vỏ / sản phẩm')
  const company = body.kind === 'supplier_return' || body.kind === 'stocktake'
  let customer = null
  if (!company) {
    customer = await Customer.findById(oid(body.customer)).lean()
    if (!customer) throw bad('Chưa chọn khách hàng')
  }
  if (body.kind === 'supplier_return') qty = Math.abs(qty)
  const e = await ShellEntry.create({ customer: customer?._id, product: product._id, kind: body.kind, qty, date: dateOf(body.date), note: body.note, createdBy: session.id, createdByName: session.name })
  await audit(session, 'shell', e._id, body.kind, `Vỏ ${product.name} (${body.kind}): ${qty}${customer ? ' – ' + customer.name : ''}`, null, { qty })
  return e
})

// ===================== GAS DƯ =====================
get('/residual', READ, async ({ query }) => {
  const pm = await prodMap()
  const bal = await residualBalances({})
  const byCust = new Map()
  for (const b of bal.values()) {
    if (!b.kg) continue
    if (!byCust.has(b.customer)) byCust.set(b.customer, [])
    byCust.get(b.customer).push({ product: b.product ? pm.get(b.product) || { _id: b.product, name: '—' } : null, kg: b.kg })
  }
  const custs = await Customer.find({ _id: { $in: [...byCust.keys()] } }).select('code name').lean()
  let rows = custs.map(c => { const byProduct = byCust.get(String(c._id)); return { customer: c, byProduct, totalKg: byProduct.reduce((s, x) => s + x.kg, 0) } })
  if (query.q) { const re = rx(query.q); rows = rows.filter(r => re.test(r.customer.name || '') || re.test(r.customer.code || '')) }
  rows.sort((a, b) => b.totalKg - a.totalKg)
  return { ...page(rows, query), summary: { totalKg: rows.reduce((s, r) => s + r.totalKg, 0) } }
})

get('/residual/customer/:id', READ, async ({ params }) => {
  const id = oid(params.id)
  const pm = await prodMap()
  const bal = await residualBalances({ customerId: id })
  const balances = [...bal.values()].map(b => ({ product: b.product ? pm.get(b.product) || { _id: b.product, name: '—' } : null, kg: b.kg }))
  const [orders, entries] = await Promise.all([
    Order.find({ customer: id, status: 'approved', 'lines.residualKg': { $gt: 0 } }).select('code bookDate lines').lean(),
    ResidualEntry.find({ customer: id }).lean()
  ])
  const history = []
  for (const o of orders) for (const l of o.lines || []) if (l.residualKg) history.push({ date: o.bookDate, kind: 'arise', product: l.productName || pm.get(String(l.product))?.name, kg: l.residualKg, orderCode: o.code, orderId: String(o._id) })
  for (const e of entries) history.push({ date: e.date, kind: e.kind, product: e.product ? pm.get(String(e.product))?.name : null, kg: e.kg, note: e.note })
  history.sort((a, b) => new Date(b.date) - new Date(a.date))
  return { balances, totalKg: balances.reduce((s, b) => s + b.kg, 0), history }
})

post('/residual/entry', WRITE, async ({ session, body }) => {
  if (!['offset', 'opening', 'adjust'].includes(body.kind)) throw bad('Loại phát sinh không hợp lệ')
  let kg = num(body.kg)
  if (!kg) throw bad('Số kg phải khác 0')
  if (body.kind === 'offset') kg = -Math.abs(kg)
  const cust = await Customer.findById(oid(body.customer)).lean()
  if (!cust) throw bad('Chưa chọn khách hàng')
  const e = await ResidualEntry.create({ customer: cust._id, product: body.product ? oid(body.product) : undefined, kind: body.kind, kg, date: dateOf(body.date), note: body.note, createdBy: session.id, createdByName: session.name })
  await audit(session, 'residual', e._id, body.kind, `Gas dư ${cust.name} (${body.kind}): ${kg} kg`, null, { kg })
  return e
})

// ===================== THU CHI =====================
const cashFilter = query => {
  const { from, to } = rangeFrom(query)
  const f = { date: { $gte: from, $lte: to } }
  if (!(query.includeVoid === '1')) f.void = false
  if (query.type) f.type = query.type
  if (query.category) f.category = query.category
  if (query.channel) f.channel = query.channel
  if (query.q) f.$or = [{ content: rx(query.q) }, { code: rx(query.q) }, { customerName: rx(query.q) }, { refCode: rx(query.q) }]
  return f
}

get('/cash', ['admin', 'accountant'], async ({ query }) => {
  const f = cashFilter(query)
  const live = { ...f, void: false }
  const [r, tot, ch] = await Promise.all([
    list(CashTx, f, query, { sort: { date: -1, createdAt: -1 } }),
    CashTx.aggregate([{ $match: live }, { $group: { _id: '$type', v: { $sum: '$amount' } } }]),
    CashTx.aggregate([{ $match: live }, { $group: { _id: { c: '$channel', t: '$type' }, v: { $sum: '$amount' } } }])
  ])
  const t = { in: 0, out: 0 }
  tot.forEach(x => (t[x._id] = x.v))
  const chm = {}
  ch.forEach(x => { chm[x._id.c] ??= { channel: x._id.c, in: 0, out: 0 }; chm[x._id.c][x._id.t] = x.v })
  const byChannel = Object.values(chm).map(c => ({ ...c, balance: c.in - c.out }))
  return { ...r, totals: { ...t, balance: t.in - t.out }, byChannel }
})

const cashData = (body, session) => {
  const d = pick(body, ['type', 'category', 'channel', 'accountNote', 'content', 'attachments'])
  if (!['in', 'out'].includes(d.type)) throw bad('Chọn loại thu / chi')
  if (!d.category) throw bad('Chọn danh mục')
  d.amount = num(body.amount)
  if (d.amount <= 0) throw bad('Số tiền phải lớn hơn 0')
  d.date = dateOf(body.date)
  d.channel = CHANNELS.includes(d.channel) ? d.channel : 'cash'
  return d
}

post('/cash', WRITE, async ({ session, body }) => {
  const d = cashData(body, session)
  if (body.customer) {
    const c = await Customer.findById(oid(body.customer)).lean()
    if (c) { d.customer = c._id; d.customerName = c.name }
  }
  const tx = await CashTx.create({ ...d, code: await nextCode(d.type === 'in' ? 'PT' : 'PC'), refType: 'manual', createdBy: session.id, createdByName: session.name })
  await audit(session, 'cash', tx._id, 'create', `Ghi ${d.type === 'in' ? 'thu' : 'chi'} ${tx.code}: ${d.amount}`, null, { amount: d.amount, category: d.category })
  return tx
})

const loadManual = async (id, { allowVoid } = {}) => {
  const tx = await CashTx.findById(oid(id))
  if (!tx) throw notFound()
  if (tx.refType !== 'manual') throw bad(`Phiếu này sinh tự động từ chứng từ ${tx.refCode || tx.refType}; hãy điều chỉnh chứng từ gốc`)
  if (tx.void && !allowVoid) throw bad('Phiếu đã hủy')
  return tx
}

put('/cash/:id', WRITE, async ({ session, params, body }) => {
  const tx = await loadManual(params.id)
  const before = { amount: tx.amount, category: tx.category, channel: tx.channel, date: tx.date }
  const d = cashData({ type: tx.type, ...body }, session)
  Object.assign(tx, d)
  if (body.customer !== undefined) {
    const c = body.customer ? await Customer.findById(oid(body.customer)).lean() : null
    tx.customer = c?._id; tx.customerName = c?.name
  }
  await tx.save()
  await audit(session, 'cash', tx._id, 'update', `Sửa phiếu ${tx.code}`, before, { amount: tx.amount, category: tx.category, channel: tx.channel, date: tx.date })
  return tx
})

post('/cash/:id/void', WRITE, async ({ session, params, body }) => {
  const tx = await loadManual(params.id)
  if (!String(body.reason || '').trim()) throw bad('Cần nhập lý do hủy')
  tx.void = true
  tx.voidReason = body.reason.trim()
  await tx.save()
  await audit(session, 'cash', tx._id, 'void', `Hủy phiếu ${tx.code}: ${tx.voidReason}`)
  return tx
})
