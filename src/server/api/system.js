import { get, post, put, list, rx, bad, audit } from '../core'
import { Notification, AuditLog, Setting } from '../models'
import { getSettings } from '../lib'
import { DEFAULT_SETTINGS } from '../constants'

// ===== Thông báo (chuông trên navbar) =====
get('/notifications', null, async ({ session, query }) => {
  const f = { $or: [{ user: session.id }, { role: session.role }] }
  const rows = await Notification.find(f).sort({ createdAt: -1 }).limit(Number(query.limit) || 30).lean()
  const out = rows.map(n => ({ ...n, read: (n.readBy || []).some(u => String(u) === session.id) || (!!n.user && !!n.readAt) }))
  return { rows: out, unread: out.filter(n => !n.read).length }
})

post('/notifications/read-all', null, async ({ session }) => {
  await Notification.updateMany({ $or: [{ user: session.id }, { role: session.role }], readBy: { $ne: session.id } }, { $addToSet: { readBy: session.id } })
})

// ===== Nhật ký hoạt động =====
get('/audit-logs', ['admin'], async ({ query }) => {
  const f = {}
  if (query.entity) f.entity = query.entity
  if (query.q) f.$or = [{ summary: rx(query.q) }, { userName: rx(query.q) }]
  return list(AuditLog, f, query, { sort: { at: -1 } })
})

// ===== Cấu hình hệ thống (các điểm nghiệp vụ chưa chốt với khách hàng) =====
get('/settings', null, async () => getSettings())

put('/settings', ['admin'], async ({ session, body }) => {
  const before = await getSettings()
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (body[k] === undefined) continue
    if (k === 'importValueBasis' && !['actual', 'document'].includes(body[k])) throw bad('Cách tính giá trị phiếu nhập không hợp lệ')
    await Setting.updateOne({ key: k }, { $set: { value: body[k] } }, { upsert: true })
  }
  const after = await getSettings()
  await audit(session, 'setting', 'settings', 'update', 'Cập nhật cấu hình hệ thống', before, after)
  return after
})
