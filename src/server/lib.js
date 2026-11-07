// Hàm nghiệp vụ dùng chung (server). Nguyên tắc: nhập một lần ở nơi phát sinh, sổ/báo cáo được TỔNG HỢP từ dữ liệu gốc.
import mongoose from './db'
import { Setting, Customer, CustomerPrice, Order, CashTx, DebtAdjust, ShellEntry, ResidualEntry, Product, Import, MaterialTx } from './models'
import { nextCode, num, bad } from './core'
import { DEFAULT_SETTINGS } from './constants'

const OID = v => new mongoose.Types.ObjectId(String(v))
export const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const endOfDay = d => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }

// Khoảng thời gian từ query: ?from=YYYY-MM-DD&to=YYYY-MM-DD (mặc định: tháng hiện tại)
export function rangeFrom(query) {
  const now = new Date()
  const from = query.from ? startOfDay(query.from) : new Date(now.getFullYear(), now.getMonth(), 1)
  const to = query.to ? endOfDay(query.to) : endOfDay(now)
  return { from, to }
}

// ===== Cấu hình =====
export async function getSettings() {
  const rows = await Setting.find().lean()
  const out = { ...DEFAULT_SETTINGS }
  rows.forEach(r => (out[r.key] = r.value))
  return out
}

// ===== Giá =====
// Giá hiện hành của khách cho sản phẩm tại thời điểm `at`
export async function currentPrice(customerId, productId, at = new Date()) {
  return CustomerPrice.findOne({ customer: customerId, product: productId, effectiveFrom: { $lte: at } }).sort({ effectiveFrom: -1, createdAt: -1 }).lean()
}

// ===== Đơn hàng =====
export const lineAmount = (l, useActual) => {
  const q = useActual && l.actualQty != null ? l.actualQty : l.plannedQty
  return Math.round(num(q) * num(l.price))
}
export const orderAmount = (o, useActual = true) => (o.lines || []).reduce((s, l) => s + lineAmount(l, useActual), 0)

// Số bình/thùng quy đổi để trừ tồn: bán theo kg => kg / kgPerUnit
export function stockUnits(line, product) {
  const q = num(line.actualQty)
  if (line.unit === 'kg') return product?.kgPerUnit ? q / product.kgPerUnit : 0
  return q
}

// ===== Thu chi: một bản ghi duy nhất cho mỗi chứng từ nguồn =====
// data = null => hủy (void) phiếu đã sinh. Trả về phiếu.
export async function syncCash({ refType, refId, refCode }, data, session) {
  const existing = await CashTx.findOne({ refType, refId: String(refId), void: false })
  if (!data || !data.amount) {
    if (existing) { existing.void = true; existing.voidReason = data?.voidReason || 'Hủy chứng từ gốc'; await existing.save() }
    return null
  }
  if (existing) {
    Object.assign(existing, data)
    await existing.save()
    return existing
  }
  const code = await nextCode(data.type === 'in' ? 'PT' : 'PC')
  return CashTx.create({ ...data, code, refType, refId: String(refId), refCode, createdBy: session?.id, createdByName: session?.name })
}

// ===== Công nợ khách hàng (tổng hợp) =====
// Trả Map customerId => { opening, increase, decrease, closing } theo kỳ [from,to]
export async function debtSummary({ from, to, customerIds } = {}) {
  const cf = customerIds ? { _id: { $in: customerIds.map(OID) } } : {}
  const custs = await Customer.find(cf).select('code name phone openingDebt').lean()
  const ids = custs.map(c => c._id)
  const [ordersBefore, ordersIn, cashBefore, cashIn, adjAll] = await Promise.all([
    Order.aggregate([{ $match: { status: 'approved', customer: { $in: ids }, bookDate: { $lt: from } } }, { $group: { _id: '$customer', v: { $sum: '$amount' } } }]),
    Order.aggregate([{ $match: { status: 'approved', customer: { $in: ids }, bookDate: { $gte: from, $lte: to } } }, { $group: { _id: '$customer', v: { $sum: '$amount' } } }]),
    CashTx.aggregate([{ $match: { type: 'in', void: false, category: { $in: ['sale', 'debt_collect'] }, customer: { $in: ids }, date: { $lt: from } } }, { $group: { _id: '$customer', v: { $sum: '$amount' } } }]),
    CashTx.aggregate([{ $match: { type: 'in', void: false, category: { $in: ['sale', 'debt_collect'] }, customer: { $in: ids }, date: { $gte: from, $lte: to } } }, { $group: { _id: '$customer', v: { $sum: '$amount' } } }]),
    DebtAdjust.find({ customer: { $in: ids } }).lean()
  ])
  const m = k => new Map(k.map(x => [String(x._id), x.v]))
  const ob = m(ordersBefore), oi = m(ordersIn), cb = m(cashBefore), ci = m(cashIn)
  const out = new Map()
  for (const c of custs) {
    const id = String(c._id)
    let aBefore = 0, aInc = 0, aDec = 0
    for (const a of adjAll) {
      if (String(a.customer) !== id) continue
      const d = new Date(a.date)
      if (d < from) aBefore += a.amount
      else if (d <= to) a.amount >= 0 ? (aInc += a.amount) : (aDec += -a.amount)
    }
    const opening = num(c.openingDebt) + (ob.get(id) || 0) - (cb.get(id) || 0) + aBefore
    const increase = (oi.get(id) || 0) + aInc
    const decrease = (ci.get(id) || 0) + aDec
    out.set(id, { customer: c, opening, increase, decrease, closing: opening + increase - decrease })
  }
  return out
}

// ===== Vỏ bình đang ở khách (tổng hợp) =====
// Trả Map `${customerId}|${productId}` => { lent, collected, entries, holding }
export async function shellHoldings({ customerId, to } = {}) {
  const end = to || new Date()
  const om = { status: 'approved', bookDate: { $lte: end } }
  if (customerId) om.customer = OID(customerId)
  const orders = await Order.aggregate([
    { $match: om }, { $unwind: '$lines' },
    { $group: { _id: { c: '$customer', p: '$lines.product' }, lent: { $sum: '$lines.shellsLent' }, collected: { $sum: '$lines.shellsCollected' } } }
  ])
  const em = { customer: { $ne: null }, date: { $lte: end } }
  if (customerId) em.customer = OID(customerId)
  const entries = await ShellEntry.aggregate([{ $match: em }, { $group: { _id: { c: '$customer', p: '$product' }, v: { $sum: '$qty' } } }])
  const out = new Map()
  const get = (c, p) => { const k = `${c}|${p}`; if (!out.has(k)) out.set(k, { customer: String(c), product: String(p), lent: 0, collected: 0, entries: 0, holding: 0 }); return out.get(k) }
  orders.forEach(o => { const r = get(o._id.c, o._id.p); r.lent += o.lent; r.collected += o.collected })
  entries.forEach(e => { get(e._id.c, e._id.p).entries += e.v })
  out.forEach(r => (r.holding = r.lent - r.collected + r.entries))
  return out
}

// ===== Gas dư (kg) theo khách (tổng hợp) =====
export async function residualBalances({ customerId, to } = {}) {
  const end = to || new Date()
  const om = { status: 'approved', bookDate: { $lte: end } }
  if (customerId) om.customer = OID(customerId)
  const orders = await Order.aggregate([{ $match: om }, { $unwind: '$lines' }, { $group: { _id: { c: '$customer', p: '$lines.product' }, kg: { $sum: '$lines.residualKg' } } }])
  const em = { date: { $lte: end } }
  if (customerId) em.customer = OID(customerId)
  const entries = await ResidualEntry.aggregate([{ $match: em }, { $group: { _id: { c: '$customer', p: '$product' }, kg: { $sum: '$kg' } } }])
  const out = new Map()
  const add = (c, p, kg) => { const k = `${c}|${p || ''}`; out.set(k, { customer: String(c), product: p ? String(p) : null, kg: (out.get(k)?.kg || 0) + kg }) }
  orders.forEach(o => add(o._id.c, o._id.p, o.kg))
  entries.forEach(e => add(e._id.c, e._id.p, e.kg))
  return out
}

// ===== Tồn kho gas (đơn vị bình/thùng) =====
// Nhập: phiếu nhập đã xác nhận. Xuất: đơn đã duyệt (kg quy đổi sang bình).
export async function stockSummary({ from, to }) {
  const products = await Product.find().lean()
  const pm = new Map(products.map(p => [String(p._id), p]))
  const rows = new Map(products.map(p => [String(p._id), { product: p, opening: 0, in: 0, out: 0, closing: 0, kgIn: 0 }]))
  const imps = await Import.aggregate([{ $match: { status: 'confirmed', date: { $lte: to } } }, { $unwind: '$lines' }, { $project: { date: 1, p: '$lines.product', q: '$lines.qty', kg: '$lines.kgActual' } }])
  const ords = await Order.aggregate([{ $match: { status: 'approved', bookDate: { $lte: to } } }, { $unwind: '$lines' }, { $project: { bookDate: 1, p: '$lines.product', q: '$lines.actualQty', u: '$lines.unit' } }])
  for (const i of imps) { const r = rows.get(String(i.p)); if (!r) continue; if (i.date < from) r.opening += i.q; else { r.in += i.q; r.kgIn += i.kg } }
  for (const o of ords) {
    const p = pm.get(String(o.p)); const r = rows.get(String(o.p)); if (!r) continue
    const q = o.u === 'kg' ? (p?.kgPerUnit ? num(o.q) / p.kgPerUnit : 0) : num(o.q)
    if (o.bookDate < from) r.opening -= q; else r.out += q
  }
  rows.forEach(r => (r.closing = r.opening + r.in - r.out))
  return [...rows.values()]
}

// ===== Tiện ích =====
export const must = (v, msg) => { if (!v) throw bad(msg); return v }
export const canSeeOrder = (session, o) => session.role !== 'driver' || (o.assignees || []).some(a => String(a._id || a) === session.id)
