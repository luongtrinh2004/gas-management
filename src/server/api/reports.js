// Báo cáo ngày/tháng + xuất Excel. Tất cả được TỔNG HỢP từ dữ liệu gốc.
import { get, bad, num } from '../core'
import { Order, Import, CashTx, MaterialTx, Material, Maintenance, Product, User, ShellEntry } from '../models'
import { rangeFrom, debtSummary, shellHoldings, residualBalances } from '../lib'
import { xlsxResponse } from '../excel'
import { ORDER_STATUS, PAY_METHODS, CASH_IN_CATEGORIES, CASH_OUT_CATEGORIES, UNITS, MAINT_KINDS, VEHICLE_TYPES } from '../constants'
import { Customer } from '../models'

const BACK = ['admin', 'office', 'accountant']
const d2s = d => (d ? new Date(d).toLocaleDateString('vi-VN') : '')
const sum = (rows, keys) => Object.fromEntries(keys.map(k => [k, rows.reduce((s, r) => s + num(r[k]), 0)]))
const C = (key, header, o = {}) => ({ key, header, ...o })
const M = (key, header) => ({ key, header, align: 'right', money: true })
const N = (key, header, dec) => ({ key, header, align: 'right', num: true, dec })

const R = {}

R.sales = async ({ from, to, query }) => {
  const byDay = query.groupBy === 'day'
  const prods = await Product.find().sort({ code: 1 }).lean()
  const orders = await Order.find({ status: 'approved', bookDate: { $gte: from, $lte: to } }).lean()
  const g = new Map()
  for (const o of orders) {
    const key = byDay ? d2s(o.bookDate) : String(o.customer)
    const r = g.get(key) || { name: byDay ? key : o.customerName, sortKey: byDay ? new Date(o.bookDate).getTime() : o.customerName, orders: 0, revenue: 0, paid: 0, debt: 0 }
    r.orders++
    r.revenue += num(o.amount)
    r.paid += num(o.delivery?.paidAmount)
    for (const l of o.lines) r['p_' + l.product] = (r['p_' + l.product] || 0) + num(l.actualQty)
    g.set(key, r)
  }
  const rows = [...g.values()].sort((a, b) => (byDay ? a.sortKey - b.sortKey : String(a.sortKey).localeCompare(String(b.sortKey), 'vi')))
  rows.forEach(r => (r.debt = r.revenue - r.paid))
  const pcols = prods.map(p => N('p_' + p._id, `${p.name} (${UNITS[p.unit] || p.unit})`, 2))
  const columns = [C('name', byDay ? 'Ngày' : 'Khách hàng'), N('orders', 'Số đơn'), ...pcols, M('revenue', 'Doanh thu'), M('paid', 'Đã thu'), M('debt', 'Còn nợ')]
  return { columns, rows, totals: { name: 'Tổng cộng', ...sum(rows, ['orders', 'revenue', 'paid', 'debt', ...pcols.map(c => c.key)]) } }
}

R.delivery = async ({ from, to }) => {
  const orders = await Order.find({ deliveryAt: { $gte: from, $lte: to } }).lean()
  const users = new Map((await User.find({ role: 'driver' }).select('name').lean()).map(u => [String(u._id), u.name]))
  const g = new Map()
  const add = (key, name, o) => {
    const r = g.get(key) || { name, total: 0, qty: 0, review: 0, ...Object.fromEntries(Object.keys(ORDER_STATUS).map(s => ['s_' + s, 0])) }
    r.total++
    r['s_' + o.status]++
    r.qty += (o.lines || []).reduce((s, l) => s + num(l.actualQty), 0)
    if (o.status === 'pending_review' || o.status === 'need_fix') r.review++
    g.set(key, r)
  }
  for (const o of orders) {
    if (!o.assignees?.length) add('none', 'Chưa phân công', o)
    else o.assignees.forEach(a => add(String(a), users.get(String(a)) || 'Nhân viên khác', o))
  }
  const rows = [...g.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  const scols = Object.entries(ORDER_STATUS).map(([k, v]) => N('s_' + k, v))
  const columns = [C('name', 'Nhân viên giao'), N('total', 'Tổng đơn'), ...scols, N('qty', 'Số lượng thực giao', 2), N('review', 'Cần đối soát / xử lý')]
  return { columns, rows, totals: { name: 'Tổng cộng', ...sum(rows, ['total', 'qty', 'review', ...scols.map(c => c.key)]) } }
}

R.import = async ({ from, to }) => {
  const imps = await Import.find({ status: 'confirmed', date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean()
  const rows = []
  for (const i of imps)
    for (const l of i.lines) {
      const basisKg = i.valueBasis === 'document' ? l.kgDocument : l.kgActual
      rows.push({ date: d2s(i.date), code: i.code, supplier: i.supplierName, product: l.productName, qty: l.qty, kgDocument: l.kgDocument, kgActual: l.kgActual, pricePerKg: l.pricePerKg, value: Math.round(num(l.pricePerKg) * num(basisKg)), diff: num(l.kgActual) - num(l.kgDocument), pump: num(l.kgActual) >= num(l.kgDocument) ? 'Đủ' : 'Thiếu', shells: l.shellsReturned })
    }
  const columns = [C('date', 'Ngày'), C('code', 'Số phiếu'), C('supplier', 'Nhà cung cấp'), C('product', 'Sản phẩm'), N('qty', 'SL bình/thùng'), N('kgDocument', 'Kg chứng từ', 2), N('kgActual', 'Kg thực tế', 2), M('pricePerKg', 'Đơn giá/kg'), M('value', 'Giá trị nhập'), N('diff', 'Chênh lệch kg', 2), C('pump', 'Bơm đủ/thiếu', { align: 'center' }), N('shells', 'Vỏ trả NCC')]
  return { columns, rows, totals: { date: 'Tổng cộng', ...sum(rows, ['qty', 'kgDocument', 'kgActual', 'value', 'diff', 'shells']) } }
}

R.debt = async ({ from, to }) => {
  const sm = await debtSummary({ from, to })
  const rows = [...sm.values()].filter(r => r.opening || r.increase || r.decrease || r.closing).map(r => ({ code: r.customer.code, name: r.customer.name, opening: r.opening, increase: r.increase, decrease: r.decrease, closing: r.closing })).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  const columns = [C('code', 'Mã KH'), C('name', 'Khách hàng'), M('opening', 'Dư đầu kỳ'), M('increase', 'Phát sinh tăng (bán hàng)'), M('decrease', 'Phát sinh giảm (đã thu / điều chỉnh)'), M('closing', 'Dư cuối kỳ')]
  return { columns, rows, totals: { name: 'Tổng cộng', ...sum(rows, ['opening', 'increase', 'decrease', 'closing']) } }
}

R.shells = async ({ from, to }) => {
  const prods = await Product.find().sort({ code: 1 }).lean()
  const ord = await Order.aggregate([{ $match: { status: 'approved', bookDate: { $gte: from, $lte: to } } }, { $unwind: '$lines' }, { $group: { _id: '$lines.product', lent: { $sum: '$lines.shellsLent' }, collected: { $sum: '$lines.shellsCollected' } } }])
  const imp = await Import.aggregate([{ $match: { status: 'confirmed', date: { $gte: from, $lte: to } } }, { $unwind: '$lines' }, { $group: { _id: '$lines.product', v: { $sum: '$lines.shellsReturned' } } }])
  const sr = await ShellEntry.aggregate([{ $match: { customer: null, kind: 'supplier_return', date: { $gte: from, $lte: to } } }, { $group: { _id: '$product', v: { $sum: { $abs: '$qty' } } } }])
  const hold = await shellHoldings({ to })
  const holdBy = new Map()
  hold.forEach(h => holdBy.set(h.product, (holdBy.get(h.product) || 0) + h.holding))
  const m = a => new Map(a.map(x => [String(x._id), x]))
  const om = m(ord), im = m(imp), sm = m(sr)
  const rows = prods.map(p => {
    const k = String(p._id)
    return { product: p.name, lent: om.get(k)?.lent || 0, collected: om.get(k)?.collected || 0, holding: holdBy.get(k) || 0, toSupplier: (im.get(k)?.v || 0) + (sm.get(k)?.v || 0) }
  }).filter(r => r.lent || r.collected || r.holding || r.toSupplier)
  const columns = [C('product', 'Loại vỏ / sản phẩm'), N('lent', 'Vỏ giao/mượn thêm'), N('collected', 'Vỏ thu về'), N('holding', 'Vỏ đang ở khách (cuối kỳ)'), N('toSupplier', 'Vỏ trả nhà cung cấp')]
  return { columns, rows, totals: { product: 'Tổng cộng', ...sum(rows, ['lent', 'collected', 'holding', 'toSupplier']) } }
}

R.residual = async ({ from, to }) => {
  const prev = await residualBalances({ to: new Date(from.getTime() - 1) })
  const end = await residualBalances({ to })
  const ord = await Order.aggregate([{ $match: { status: 'approved', bookDate: { $gte: from, $lte: to } } }, { $unwind: '$lines' }, { $group: { _id: '$customer', kg: { $sum: '$lines.residualKg' } } }])
  const arise = new Map(ord.map(x => [String(x._id), x.kg]))
  const tot = mp => { const o = new Map(); mp.forEach(v => o.set(v.customer, (o.get(v.customer) || 0) + v.kg)); return o }
  const pm = tot(prev), em = tot(end)
  const ids = [...new Set([...pm.keys(), ...em.keys(), ...arise.keys()])]
  const custs = new Map((await Customer.find({ _id: { $in: ids } }).select('code name').lean()).map(c => [String(c._id), c]))
  const rows = ids.map(id => {
    const opening = pm.get(id) || 0, closing = em.get(id) || 0, ar = arise.get(id) || 0
    return { code: custs.get(id)?.code, name: custs.get(id)?.name || '—', opening, arise: ar, offset: closing - opening - ar, closing }
  }).filter(r => r.opening || r.arise || r.offset || r.closing).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  const columns = [C('code', 'Mã KH'), C('name', 'Khách hàng'), N('opening', 'Gas dư đầu kỳ (kg)', 2), N('arise', 'Phát sinh trong kỳ (kg)', 2), N('offset', 'Đối trừ / điều chỉnh (kg)', 2), N('closing', 'Gas dư cuối kỳ (kg)', 2)]
  return { columns, rows, totals: { name: 'Tổng cộng', ...sum(rows, ['opening', 'arise', 'offset', 'closing']) } }
}

R.cash = async ({ from, to }) => {
  const txs = await CashTx.find({ void: false, date: { $gte: from, $lte: to } }).lean()
  const catName = { ...CASH_IN_CATEGORIES, ...CASH_OUT_CATEGORIES }
  const mk = (keyFn, nameFn, group) => {
    const g = new Map()
    for (const t of txs) {
      const k = keyFn(t)
      const r = g.get(k) || { group, name: nameFn(k), in: 0, out: 0, balance: 0 }
      t.type === 'in' ? (r.in += t.amount) : (r.out += t.amount)
      g.set(k, r)
    }
    return [...g.values()].map(r => ({ ...r, balance: r.in - r.out }))
  }
  const rows = [...mk(t => t.channel, k => PAY_METHODS[k] || k, 'Theo kênh nhận tiền'), ...mk(t => t.category, k => catName[k] || k, 'Theo loại thu/chi')]
  const columns = [C('group', 'Nhóm'), C('name', 'Chỉ tiêu'), M('in', 'Tổng thu'), M('out', 'Tổng chi'), M('balance', 'Chênh lệch')]
  const inAll = txs.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0), outAll = txs.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0)
  return { columns, rows, totals: { group: 'Tổng cộng', in: inAll, out: outAll, balance: inAll - outAll } }
}

R.materials = async ({ from, to }) => {
  const mats = await Material.find().sort({ name: 1 }).lean()
  const inRange = await MaterialTx.aggregate([{ $match: { void: false, date: { $gte: from, $lte: to } } }, { $group: { _id: { m: '$material', t: '$type' }, q: { $sum: '$qty' }, a: { $sum: '$amount' } } }])
  const upTo = await MaterialTx.aggregate([{ $match: { void: false, date: { $lte: to } } }, { $group: { _id: { m: '$material', t: '$type' }, q: { $sum: '$qty' } } }])
  const rows = mats.map(m => {
    const k = String(m._id)
    const f = t => inRange.find(x => String(x._id.m) === k && x._id.t === t)
    const u = t => upTo.find(x => String(x._id.m) === k && x._id.t === t)?.q || 0
    return { name: m.name, unit: m.unit, in: f('in')?.q || 0, sale: f('sale')?.q || 0, gift: f('gift')?.q || 0, saleAmount: f('sale')?.a || 0, stock: u('in') - u('sale') - u('gift') }
  }).filter(r => r.in || r.sale || r.gift || r.stock)
  const columns = [C('name', 'Vật tư'), C('unit', 'ĐVT'), N('in', 'Nhập', 2), N('sale', 'Xuất bán', 2), N('gift', 'Xuất tặng', 2), M('saleAmount', 'Tiền bán'), N('stock', 'Tồn cuối kỳ', 2)]
  return { columns, rows, totals: { name: 'Tổng cộng', ...sum(rows, ['in', 'sale', 'gift', 'saleAmount']) } }
}

R.maintenance = async ({ from, to }) => {
  const list = await Maintenance.find({ date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean()
  const g = new Map()
  for (const m of list) {
    const k = `${m.plate}|${m.kind}|${m.item}`
    const r = g.get(k) || { vehicle: `${VEHICLE_TYPES[m.vehicleType] || ''} ${m.plate}`, kind: MAINT_KINDS[m.kind], item: m.item, times: 0, cost: 0, last: null, vendor: '' }
    r.times++
    r.cost += num(m.cost)
    r.last = d2s(m.date)
    r.vendor = m.vendor || r.vendor
    g.set(k, r)
  }
  const rows = [...g.values()]
  const columns = [C('vehicle', 'Phương tiện'), C('kind', 'Loại'), C('item', 'Hạng mục'), N('times', 'Số lần'), M('cost', 'Chi phí'), C('last', 'Lần gần nhất'), C('vendor', 'Đơn vị thực hiện')]
  return { columns, rows, totals: { vehicle: 'Tổng cộng', ...sum(rows, ['times', 'cost']) } }
}

async function build(type, query) {
  if (!R[type]) throw bad('Loại báo cáo không tồn tại')
  const { from, to } = rangeFrom(query)
  return { ...(await R[type]({ from, to, query })), from, to }
}

get('/reports/:type', BACK, async ({ params, query }) => build(params.type, query))

get('/reports/:type/export', BACK, async ({ params, query }) => {
  const rep = await build(params.type, query)
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  const columns = rep.columns.map(c => ({ header: c.header, key: c.key, width: c.money ? 18 : c.num ? 16 : 24, numFmt: c.money ? '#,##0' : c.num ? '#,##0.##' : undefined }))
  return xlsxResponse(`Bao-cao-${params.type}-${iso(rep.from)}-${iso(rep.to)}`, { name: `Báo cáo ${params.type}`, columns, rows: rep.rows, totals: rep.totals })
})
