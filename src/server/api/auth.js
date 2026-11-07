import bcrypt from 'bcryptjs'
import { get, post, put, del, bad, notFound, list, rx, audit, pick, oid } from '../core'
import { User } from '../models'
import { signSession, setSessionCookie, clearSessionCookie } from '../auth'

post('/auth/login', 'public', async ({ body }) => {
  const email = String(body.email || '').toLowerCase().trim()
  const user = await User.findOne({ email })
  if (!user || user.status !== 'active' || !(await bcrypt.compare(String(body.password || ''), user.passwordHash))) {
    throw bad('Email hoặc mật khẩu không đúng')
  }
  user.lastLoginAt = new Date()
  await user.save()
  await setSessionCookie(await signSession(user))
  return { id: user._id, name: user.name, email: user.email, role: user.role }
})

post('/auth/logout', 'public', async () => {
  await clearSessionCookie()
})

get('/auth/me', null, async ({ session }) => {
  const u = await User.findById(session.id).select('-passwordHash').lean()
  if (!u || u.status !== 'active') throw bad('Tài khoản không còn hiệu lực')
  return u
})

post('/auth/change-password', null, async ({ session, body }) => {
  const u = await User.findById(session.id)
  if (!(await bcrypt.compare(String(body.oldPassword || ''), u.passwordHash))) throw bad('Mật khẩu cũ không đúng')
  if (String(body.newPassword || '').length < 8) throw bad('Mật khẩu mới tối thiểu 8 ký tự')
  u.passwordHash = await bcrypt.hash(body.newPassword, 10)
  await u.save()
  await audit(session, 'user', u._id, 'change_password', 'Đổi mật khẩu')
})

// ===== Quản lý người dùng (Quản trị) =====
const ADMIN = ['admin']
get('/users', ['admin'], async ({ query }) => {
  const f = {}
  if (query.q) f.$or = [{ name: rx(query.q) }, { email: rx(query.q) }]
  if (query.role) f.role = query.role
  const r = await list(User, f, query, { sort: { name: 1 } })
  r.rows.forEach(u => delete u.passwordHash)
  return r
})

// danh sách rút gọn để chọn Sale / nhân sự
get('/users/options', ['admin', 'office', 'accountant'], async ({ query }) => {
  const f = { status: 'active' }
  if (query.role) f.role = query.role
  return User.find(f).select('name role email').sort({ name: 1 }).lean()
})

post('/users', ADMIN, async ({ session, body }) => {
  if (!body.password || String(body.password).length < 8) throw bad('Mật khẩu tối thiểu 8 ký tự')
  const u = await User.create({ ...pick(body, ['email', 'name', 'phone', 'gender', 'role', 'status']), passwordHash: await bcrypt.hash(body.password, 10) })
  await audit(session, 'user', u._id, 'create', `Tạo người dùng ${u.email} (${u.role})`)
  const o = u.toObject()
  delete o.passwordHash
  return o
})

put('/users/:id', ADMIN, async ({ session, params, body }) => {
  const u = await User.findById(oid(params.id))
  if (!u) throw notFound()
  if (String(u._id) === session.id && (body.status === 'disabled' || (body.role && body.role !== u.role))) throw bad('Không thể tự khóa hoặc đổi vai trò của chính mình')
  const before = { role: u.role, status: u.status }
  Object.assign(u, pick(body, ['name', 'phone', 'gender', 'role', 'status', 'email']))
  if (body.password) {
    if (String(body.password).length < 8) throw bad('Mật khẩu tối thiểu 8 ký tự')
    u.passwordHash = await bcrypt.hash(body.password, 10)
  }
  await u.save()
  await audit(session, 'user', u._id, 'update', `Cập nhật người dùng ${u.email}`, before, { role: u.role, status: u.status })
  const o = u.toObject()
  delete o.passwordHash
  return o
})
