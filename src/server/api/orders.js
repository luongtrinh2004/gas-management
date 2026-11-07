// Đơn hàng, phân công, giao hàng, đối soát (Module B)
import { get, post, put, bad, forbidden, notFound, oid, list, rx, audit, notify, nextCode, num, pick } from '../core'
import { Order, Customer, Product, User, AuditLog, CashTx } from '../models'
import { getSettings, currentPrice, orderAmount, canSeeOrder, rangeFrom, startOfDay, endOfDay, debtSummary, syncCash } from '../lib'

const BACK = ['admin', 'office', 'accountant']
const EDITORS = ['admin', 'office']
const EDITABLE = ['new', 'waiting_assign', 'assigned', 'need_fix']
const POP = [{ path: 'assignees', select: 'name phone' }]
const PAY = ['cash', 'company_account', 'personal_account', 'other']

const strId = v => String(v?._id || v)
const isAssignee = (session, o) => (o.assignees || []).some(a => strId(a) === session.id)

const snap = o => ({ status: o.status, assignees: (o.assignees || []).map(strId), amount: o.amount, lines: (o.lines || []).map(l => ({ product: strId(l.product), unit: l.unit, price: l.price, plannedQty: l.plannedQty, actualQty: l.actualQty })) })

async function load(id) {
  const o = await Order.findById(oid(id))
  if (!o) throw notFound('Không tìm thấy đơn hàng')
  return o
}

async function checkAssignees(ids) {
  const list_ = [...new Set((ids || []).map(String))]
  const settings = await getSettings()
  if (list_.length > 1 && !settings.allowDriverMultiAssign) throw bad('Hệ thống chỉ cho phép phân công một nhân viên cho mỗi đơn')
  if (!list_.length) return []
  const users = await User.find({ _id: { $in: list_.map(oid) }, role: 'driver', status: 'active' }).select('_id').lean()
  if (users.length !== list_.length) throw bad('Nhân viên giao hàng không hợp lệ hoặc đã bị khóa')
  return users.map(u => u._id)
}

async function notifyBack(session, message, id) {
  for (const role of BACK) await notify({ role, type: 'order', message, link: `/orders/${id}` })
}

// Chuẩn hóa dòng sản phẩm: khóa đơn giá tại thời điểm tạo/sửa đơn
async function buildLines(rawLines, customerId, session, existing = []) {
  if (!Array.isArray(rawLines) || !rawLines.length) throw bad('Đơn hàng cần ít nhất một sản phẩm')
  const settings = await getSettings()
  const canPrice = (settings.priceEditRoles || []).includes(session.role)
  const out = []
  for (const r of rawLines) {
    const p = await Product.findById(oid(r.product))
    if (!p) throw bad('Sản phẩm không tồn tại')
    const qty = num(r.plannedQty)
    if (!(qty > 0)) throw bad(`Số lượng dự kiến của ${p.name} phải lớn hơn 0`)
    const cur = await currentPrice(customerId, p._id, new Date())
    const prev = existing.find(e => strId(e.product) === strId(p._id) && Number(e.price) === Number(r.price))
    let unit, price
    if (prev) {
      // giữ nguyên giá đã chốt trước đó
      unit = prev.unit
      price = prev.price
    } else if (cur) {
      unit = cur.unit
      price = r.price == null || r.price === '' ? cur.price : num(r.price)
      if (price !== cur.price && !canPrice) throw bad(`Bạn không có quyền sửa giá ${p.name} khác bảng giá của khách`)
    } else {
      if (!canPrice) throw bad(`Khách chưa có giá cho ${p.name}. Vui lòng thiết lập bảng giá khách hàng trước`)
      unit = r.unit || p.unit
      price = num(r.price)
      if (!(price > 0)) throw bad(`Nhập đơn giá cho ${p.name}`)
    }
    if (unit === 'kg' && !p.kgPerUnit) throw bad(`${p.name} không thể bán theo kg (chưa có quy đổi kg/bình)`)
    const old = existing.find(e => r._id && strId(e._id) === String(r._id))
    out.push({
      ...(old ? { _id: old._id, actualQty: old.actualQty, shellsCollected: old.shellsCollected, shellsLent: old.shellsLent, residualKg: old.residualKg } : {}),
      product: p._id,
      productName: p.name,
      unit,
      price,
      plannedQty: qty
    })
  }
  return out
}

// ===== Các route tĩnh (đăng ký trước /orders/:id) =====
get('/orders/mine', ['driver', 'admin'], async ({ session, query }) => {
  const f = { assignees: session.id }
  if (query.status) f.status = query.status
  if (query.q) f.$or = [{ code: rx(query.q) }, { customerName: rx(query.q) }, { deliveryAddress: rx(query.q) }]
  return list(Order, f, { ...query, limit: query.limit || 100 }, { sort: { deliveryAt: 1, createdAt: -1 }, populate: POP })
})

get('/orders/reconcile', BACK, async ({ query }) => {
  const f = { status: query.status ? query.status : { $in: ['pending_review', 'need_fix'] } }
  if (!['pending_review', 'need_fix'].includes(query.status || 'pending_review')) f.status = { $in: ['pending_review', 'need_fix'] }
  if (query.q) f.$or = [{ code: rx(query.q) }, { customerName: rx(query.q) }]
  return list(Order, f, query, { sort: { 'delivery.confirmedAt': 1, createdAt: 1 }, populate: POP })
})

get('/orders/dashboard', null, async ({ session }) => {
  const now = new Date()
  const today = { $gte: startOfDay(now), $lte: endOfDay(now) }
  if (session.role === 'driver') {
    const mine = { assignees: session.id }
    const [todayN, pending, fix, sent] = await Promise.all([
      Order.countDocuments({ ...mine, deliveryAt: today, status: { $nin: ['cancelled'] } }),
      Order.countDocuments({ ...mine, status: { $in: ['assigned', 'delivering'] } }),
      Order.countDocuments({ ...mine, status: 'need_fix' }),
      Order.countDocuments({ ...mine, status: 'pending_review' })
    ])
    return {
      role: 'driver',
      cards: [
        { label: 'Đơn giao hôm nay', value: todayN, icon: 'tabler-truck-delivery', color: 'primary' },
        { label: 'Cần giao', value: pending, icon: 'tabler-package-export', color: 'info' },
        { label: 'Cần bổ sung', value: fix, icon: 'tabler-alert-triangle', color: 'error' },
        { label: 'Đã gửi, chờ đối soát', value: sent, icon: 'tabler-clock-check', color: 'warning' }
      ]
    }
  }
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const [todayN, waiting, delivering, review, fix] = await Promise.all([
    Order.countDocuments({ deliveryAt: today, status: { $ne: 'cancelled' } }),
    Order.countDocuments({ status: { $in: ['new', 'waiting_assign'] } }),
    Order.countDocuments({ status: { $in: ['assigned', 'delivering'] } }),
    Order.countDocuments({ status: 'pending_review' }),
    Order.countDocuments({ status: 'need_fix' })
  ])
  const cards = [
    { label: 'Đơn giao hôm nay', value: todayN, icon: 'tabler-calendar-event', color: 'primary' },
    { label: 'Chờ phân công', value: waiting, icon: 'tabler-user-plus', color: 'warning' },
    { label: 'Đang thực hiện', value: delivering, icon: 'tabler-truck-delivery', color: 'info' },
    { label: 'Chờ đối soát', value: review, icon: 'tabler-checklist', color: 'warning' },
    { label: 'Cần xử lý', value: fix, icon: 'tabler-alert-triangle', color: 'error' }
  ]
  // xu hướng doanh thu 7 ngày gần nhất (theo ngày hạch toán của đơn đã duyệt)
  const from7 = startOfDay(new Date(now.getTime() - 6 * 86400000))
  const agg = await Order.aggregate([
    { $match: { status: 'approved', bookDate: { $gte: from7, $lte: endOfDay(now) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$bookDate', timezone: 'Asia/Ho_Chi_Minh' } }, v: { $sum: '$amount' }, n: { $sum: 1 } } }
  ])
  const byDay = new Map(agg.map(a => [a._id, a]))
  const trend = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    const key = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    const vnKey = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
    const a = byDay.get(vnKey) || byDay.get(key)
    trend.push({ key: vnKey, label: `${vnKey.slice(8, 10)}/${vnKey.slice(5, 7)}`, revenue: a?.v || 0, orders: a?.n || 0 })
  }
  const out = { role: session.role, cards, trend }
  if (session.role === 'admin' || session.role === 'accountant') {
    const [m] = await Order.aggregate([
      { $match: { status: 'approved', bookDate: { $gte: monthStart, $lte: now } } },
      { $group: { _id: null, amount: { $sum: '$amount' }, paid: { $sum: '$delivery.paidAmount' } } }
    ])
    const debts = await debtSummary({ from: now, to: now })
    let totalDebt = 0
    debts.forEach(d => { if (d.closing > 0) totalDebt += d.closing })
    cards.push({ label: 'Doanh thu tháng này', value: m?.amount || 0, money: true, icon: 'tabler-chart-line', color: 'success' })
    cards.push({ label: 'Chưa thu từ đơn tháng này', value: Math.max(0, (m?.amount || 0) - (m?.paid || 0)), money: true, icon: 'tabler-cash-off', color: 'warning' })
    cards.push({ label: 'Tổng công nợ phải thu', value: totalDebt, money: true, icon: 'tabler-report-money', color: 'error' })
  }
  return out
})

// ===== Danh sách / tạo =====
get('/orders', BACK, async ({ query }) => {
  const f = {}
  if (query.q) f.$or = [{ code: rx(query.q) }, { customerName: rx(query.q) }]
  if (query.status) f.status = query.status
  if (query.customer) f.customer = oid(query.customer)
  if (query.driver) f.assignees = oid(query.driver)
  if (query.from || query.to) {
    const { from, to } = rangeFrom(query)
    f.deliveryAt = { ...(query.from ? { $gte: from } : {}), ...(query.to ? { $lte: to } : {}) }
  }
  return list(Order, f, query, { sort: { createdAt: -1 }, populate: POP })
})

post('/orders', EDITORS, async ({ session, body }) => {
  const c = await Customer.findById(oid(body.customer))
  if (!c) throw bad('Chọn khách hàng')
  if (c.status !== 'active') throw bad('Khách hàng đang ngừng giao dịch')
  const lines = await buildLines(body.lines, c._id, session)
  const assignees = await checkAssignees(body.assignees)
  const o = await Order.create({
    code: await nextCode('DH'),
    customer: c._id,
    customerName: c.name,
    deliveryAddress: body.deliveryAddress || c.address,
    deliveryAt: body.deliveryAt ? new Date(body.deliveryAt) : undefined,
    note: body.note,
    lines,
    assignees,
    status: assignees.length ? 'assigned' : 'waiting_assign',
    createdBy: session.id,
    createdByName: session.name
  })
  o.amount = orderAmount(o, false)
  await o.save()
  await audit(session, 'order', o._id, 'create', `Tạo đơn ${o.code} cho ${c.name}`, null, snap(o))
  for (const u of assignees) await notify({ user: u, type: 'order', message: `Bạn được phân công đơn ${o.code} – ${c.name}`, link: `/orders/${o._id}` })
  return o
})

// ===== Chi tiết =====
get('/orders/:id', null, async ({ session, params }) => {
  const o = await Order.findById(oid(params.id)).populate(POP).lean()
  if (!o) throw notFound('Không tìm thấy đơn hàng')
  if (session.role === 'driver' && !canSeeOrder(session, o)) throw forbidden('Đơn này không được phân công cho bạn')
  const [cust, history] = await Promise.all([
    Customer.findById(o.customer).select('code phone address').lean(),
    AuditLog.find({ entity: 'order', entityId: String(o._id) }).sort({ at: -1 }).limit(50).select('at userName action summary').lean()
  ])
  return { ...o, customerInfo: { code: cust?.code, phone: cust?.phone, address: cust?.address }, history, planned: orderAmount(o, false) }
})

put('/orders/:id', EDITORS, async ({ session, params, body }) => {
  const o = await load(params.id)
  if (!EDITABLE.includes(o.status)) throw bad('Đơn ở trạng thái này không thể sửa. Đơn đã duyệt cần dùng chức năng điều chỉnh (mở lại)')
  const before = snap(o)
  if (body.customer && strId(body.customer) !== strId(o.customer)) {
    if (o.status === 'need_fix' || o.lines.some(l => l.actualQty != null)) throw bad('Không đổi khách hàng khi đơn đã có kết quả giao')
    const c = await Customer.findById(oid(body.customer))
    if (!c) throw bad('Khách hàng không tồn tại')
    o.customer = c._id
    o.customerName = c.name
    o.deliveryAddress = c.address
  }
  if (body.lines) o.lines = await buildLines(body.lines, o.customer, session, o.lines)
  if (body.deliveryAt !== undefined) o.deliveryAt = body.deliveryAt ? new Date(body.deliveryAt) : undefined
  if (body.note !== undefined) o.note = body.note
  if (body.deliveryAddress !== undefined) o.deliveryAddress = body.deliveryAddress
  o.amount = orderAmount(o, o.lines.some(l => l.actualQty != null))
  await o.save()
  await audit(session, 'order', o._id, 'update', `Sửa đơn ${o.code}`, before, snap(o))
  return o
})

// ===== Phân công =====
post('/orders/:id/assign', EDITORS, async ({ session, params, body }) => {
  const o = await load(params.id)
  if (!['new', 'waiting_assign', 'assigned', 'delivering', 'need_fix'].includes(o.status)) throw bad('Đơn ở trạng thái này không thể phân công lại')
  const ids = await checkAssignees(body.assignees)
  if (!ids.length) throw bad('Chọn ít nhất một nhân viên giao hàng')
  const before = snap(o)
  const newOnes = ids.filter(i => !o.assignees.some(a => String(a) === String(i)))
  o.assignees = ids
  if (['new', 'waiting_assign'].includes(o.status)) o.status = 'assigned'
  await o.save()
  await audit(session, 'order', o._id, 'assign', `Phân công đơn ${o.code}`, before, snap(o))
  for (const u of newOnes) await notify({ user: u, type: 'order', message: `Bạn được phân công đơn ${o.code} – ${o.customerName}`, link: `/orders/${o._id}` })
  return o
})

// ===== Giao hàng =====
post('/orders/:id/start', ['driver', 'admin'], async ({ session, params }) => {
  const o = await load(params.id)
  if (session.role === 'driver' && !isAssignee(session, o)) throw forbidden('Đơn này không được phân công cho bạn')
  if (o.status !== 'assigned') throw bad('Chỉ bắt đầu giao được đơn ở trạng thái "Đã phân công"')
  const before = snap(o)
  o.status = 'delivering'
  await o.save()
  await audit(session, 'order', o._id, 'start', `Bắt đầu giao đơn ${o.code}`, before, snap(o))
  return o
})

const nn = (v, label) => {
  const n = v === '' || v == null ? 0 : Number(v)
  if (!Number.isFinite(n) || n < 0) throw bad(`${label} không hợp lệ`)
  return n
}

post('/orders/:id/result', ['driver', 'admin'], async ({ session, params, body }) => {
  const o = await load(params.id)
  if (session.role === 'driver' && !isAssignee(session, o)) throw forbidden('Đơn này không được phân công cho bạn')
  if (!['assigned', 'delivering', 'need_fix'].includes(o.status)) throw bad('Đơn ở trạng thái này không thể gửi kết quả giao hàng')
  const before = snap(o)
  const inLines = Array.isArray(body.lines) ? body.lines : []
  for (const l of o.lines) {
    const r = inLines.find(x => String(x._id) === String(l._id))
    if (!r) throw bad(`Thiếu kết quả của ${l.productName}`)
    if (r.actualQty === '' || r.actualQty == null) throw bad(`Nhập số lượng thực giao của ${l.productName}`)
    l.actualQty = nn(r.actualQty, `Số lượng thực giao ${l.productName}`)
    l.shellsCollected = nn(r.shellsCollected, `Vỏ thu về ${l.productName}`)
    l.shellsLent = nn(r.shellsLent, `Vỏ giao/mượn ${l.productName}`)
    l.residualKg = nn(r.residualKg, `Gas dư ${l.productName}`)
  }
  const d = body.delivery || {}
  const amount = orderAmount(o, true)
  const paid = nn(d.paidAmount, 'Số tiền đã thu')
  if (paid > amount) throw bad('Số tiền đã thu không được lớn hơn thành tiền của đơn. Khoản thu công nợ cũ hãy ghi ở mục Công nợ')
  if (paid > 0 && !PAY.includes(d.payMethod)) throw bad('Chọn hình thức thu tiền')
  if (paid > 0 && d.payMethod === 'personal_account' && !String(d.payAccountNote || '').trim()) throw bad('Ghi rõ chuyển khoản vào tài khoản cá nhân của ai')
  const atts = Array.isArray(body.attachments) ? body.attachments : o.attachments
  if (!atts || !atts.length) throw bad('Cần chụp/tải ảnh hóa đơn trước khi gửi kết quả')
  o.attachments = atts
  o.delivery = {
    ...(o.delivery?.toObject?.() || {}),
    deliveredAt: d.deliveredAt ? new Date(d.deliveredAt) : new Date(),
    note: d.note,
    paidAmount: paid,
    payMethod: paid > 0 ? d.payMethod : undefined,
    payAccountNote: paid > 0 ? d.payAccountNote : undefined,
    confirmedBy: session.id,
    confirmedByName: session.name,
    confirmedAt: new Date()
  }
  o.amount = amount
  o.returnReason = undefined
  o.status = 'pending_review'
  await o.save()
  await audit(session, 'order', o._id, 'result', `Gửi kết quả giao đơn ${o.code} (${amount.toLocaleString('vi-VN')}đ, thu ${paid.toLocaleString('vi-VN')}đ)`, before, snap(o))
  await notifyBack(session, `Đơn ${o.code} – ${o.customerName} chờ đối soát`, o._id)
  return o
})

// Bổ sung ảnh chứng từ (người giao của đơn hoặc văn phòng) khi chưa duyệt
put('/orders/:id/attachments', null, async ({ session, params, body }) => {
  const o = await load(params.id)
  if (session.role === 'driver' && !isAssignee(session, o)) throw forbidden('Đơn này không được phân công cho bạn')
  if (['approved', 'cancelled'].includes(o.status)) throw bad('Đơn đã chốt, không thể đổi chứng từ')
  o.attachments = Array.isArray(body.attachments) ? body.attachments : []
  await o.save()
  await audit(session, 'order', o._id, 'attachments', `Cập nhật ảnh chứng từ đơn ${o.code} (${o.attachments.length} tệp)`)
  return o
})

// ===== Đối soát / duyệt =====
post('/orders/:id/approve', BACK, async ({ session, params, body }) => {
  const o = await load(params.id)
  if (o.status !== 'pending_review') throw bad('Chỉ duyệt được đơn ở trạng thái "Chờ đối soát"')
  if (!(o.attachments || []).length) {
    if (!(body.skipAttachment && session.role === 'admin' && String(body.skipReason || '').trim())) throw bad('Đơn chưa có ảnh hóa đơn. Chỉ Quản trị được duyệt khi thiếu ảnh và phải ghi lý do')
  }
  if (o.lines.some(l => l.actualQty == null)) throw bad('Đơn chưa có số lượng thực giao')
  const before = snap(o)
  const amount = orderAmount(o, true)
  const paid = num(o.delivery?.paidAmount)
  if (paid > amount) throw bad('Số tiền đã thu lớn hơn thành tiền của đơn')
  o.amount = amount
  o.bookDate = o.delivery?.deliveredAt || o.deliveryAt || new Date()
  o.reviewedBy = session.id
  o.reviewedByName = session.name
  o.approvedAt = new Date()
  o.returnReason = undefined
  o.status = 'approved'
  const tx = await syncCash(
    { refType: 'order', refId: o._id, refCode: o.code },
    paid > 0 ? { type: 'in', category: 'sale', date: o.bookDate, amount: paid, channel: o.delivery.payMethod || 'cash', accountNote: o.delivery.payAccountNote, customer: o.customer, customerName: o.customerName, content: `Thu tiền đơn ${o.code}` } : null,
    session
  )
  o.cashTx = tx?._id
  await o.save()
  const extra = body.skipAttachment ? ` (duyệt thiếu ảnh: ${body.skipReason})` : ''
  await audit(session, 'order', o._id, 'approve', `Duyệt đơn ${o.code}${extra}`, before, snap(o))
  for (const u of o.assignees) await notify({ user: u, type: 'order', message: `Đơn ${o.code} đã được duyệt`, link: `/orders/${o._id}` })
  return o
})

post('/orders/:id/return', BACK, async ({ session, params, body }) => {
  const o = await load(params.id)
  if (o.status !== 'pending_review') throw bad('Chỉ trả lại được đơn ở trạng thái "Chờ đối soát"')
  const reason = String(body.reason || '').trim()
  if (!reason) throw bad('Nhập lý do trả lại chỉnh sửa')
  const before = snap(o)
  o.status = 'need_fix'
  o.returnReason = reason
  await o.save()
  await audit(session, 'order', o._id, 'return', `Trả lại đơn ${o.code}: ${reason}`, before, snap(o))
  for (const u of o.assignees) await notify({ user: u, type: 'order', message: `Đơn ${o.code} cần xử lý: ${reason}`, link: `/orders/${o._id}` })
  return o
})

post('/orders/:id/cancel', EDITORS, async ({ session, params, body }) => {
  const o = await load(params.id)
  if (['approved', 'cancelled'].includes(o.status)) throw bad('Đơn đã duyệt/đã hủy không thể hủy. Đơn đã duyệt cần mở lại để điều chỉnh')
  const reason = String(body.reason || '').trim()
  if (!reason) throw bad('Nhập lý do hủy đơn')
  const before = snap(o)
  o.status = 'cancelled'
  o.cancelReason = reason
  await o.save()
  await audit(session, 'order', o._id, 'cancel', `Hủy đơn ${o.code}: ${reason}`, before, snap(o))
  for (const u of o.assignees) await notify({ user: u, type: 'order', message: `Đơn ${o.code} đã bị hủy: ${reason}`, link: `/orders/${o._id}` })
  return o
})

// Điều chỉnh đơn đã duyệt: mở lại (lưu vết), hủy phiếu thu đã sinh, đơn quay về "Cần xử lý"
post('/orders/:id/reopen', ['admin', 'accountant'], async ({ session, params, body }) => {
  const o = await load(params.id)
  if (o.status !== 'approved') throw bad('Chỉ mở lại được đơn đã duyệt')
  const reason = String(body.reason || '').trim()
  if (!reason) throw bad('Nhập lý do điều chỉnh')
  const before = snap(o)
  await syncCash({ refType: 'order', refId: o._id, refCode: o.code }, { voidReason: `Mở lại đơn: ${reason}` }, session)
  o.cashTx = undefined
  o.approvedAt = undefined
  o.bookDate = undefined
  o.reviewedBy = undefined
  o.reviewedByName = undefined
  o.status = 'need_fix'
  o.returnReason = `Điều chỉnh sau duyệt: ${reason}`
  await o.save()
  await audit(session, 'order', o._id, 'reopen', `Mở lại đơn đã duyệt ${o.code}: ${reason}`, before, snap(o))
  for (const u of o.assignees) await notify({ user: u, type: 'order', message: `Đơn ${o.code} được mở lại để điều chỉnh: ${reason}`, link: `/orders/${o._id}` })
  return o
})
