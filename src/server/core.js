import mongoose from './db'
import { connectDB } from './db'
import { getSession } from './auth'
import { Counter, AuditLog, Notification } from './models'

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}
export const bad = (m, d) => new ApiError(400, m, d)
export const forbidden = (m = 'Bạn không có quyền thực hiện thao tác này') => new ApiError(403, m)
export const notFound = (m = 'Không tìm thấy dữ liệu') => new ApiError(404, m)

export const oid = v => {
  if (!v) return null
  if (!mongoose.isValidObjectId(v)) throw bad('Mã không hợp lệ')
  return new mongoose.Types.ObjectId(String(v))
}

// ===== Router =====
const routes = []
export function route(method, path, roles, handler) {
  const keys = []
  const re = new RegExp('^' + path.replace(/:([a-zA-Z]+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$')
  routes.push({ method, re, keys, roles, handler })
}
export const get = (p, r, h) => route('GET', p, r, h)
export const post = (p, r, h) => route('POST', p, r, h)
export const put = (p, r, h) => route('PUT', p, r, h)
export const del = (p, r, h) => route('DELETE', p, r, h)

export async function dispatch(req, segments) {
  const path = '/' + segments.join('/')
  const method = req.method
  try {
    await connectDB()
    for (const r of routes) {
      if (r.method !== method) continue
      const m = r.re.exec(path)
      if (!m) continue
      const params = {}
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])))
      let session = null
      if (r.roles !== 'public') {
        session = await getSession()
        if (!session) throw new ApiError(401, 'Phiên đăng nhập hết hạn')
        if (Array.isArray(r.roles) && !r.roles.includes(session.role)) throw forbidden()
      }
      const url = new URL(req.url)
      const query = Object.fromEntries(url.searchParams.entries())
      let body = {}
      if (method !== 'GET' && method !== 'DELETE') {
        try {
          body = await req.json()
        } catch {
          body = {}
        }
      }
      const data = await r.handler({ req, session, params, query, body })
      if (data instanceof Response) return data
      return Response.json({ data: data === undefined ? { ok: true } : data })
    }
    throw notFound('API không tồn tại')
  } catch (e) {
    if (e instanceof ApiError) return Response.json({ error: e.message, details: e.details }, { status: e.status })
    if (e?.name === 'ValidationError') return Response.json({ error: Object.values(e.errors).map(x => x.message).join('; ') }, { status: 400 })
    if (e?.code === 11000) return Response.json({ error: 'Dữ liệu bị trùng (đã tồn tại)' }, { status: 409 })
    console.error('[api]', method, path, e)
    return Response.json({ error: 'Lỗi hệ thống: ' + (e?.message || 'unknown') }, { status: 500 })
  }
}

// ===== Helpers =====
export async function nextCode(prefix, yearly = true) {
  const year = new Date().getFullYear()
  const key = yearly ? `${prefix}-${year}` : prefix
  const c = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" })
  return `${prefix}${yearly ? `-${year}` : ''}-${String(c.seq).padStart(4, '0')}`
}

export async function audit(session, entity, entityId, action, summary, before, after) {
  try {
    await AuditLog.create({ user: session?.id, userName: session?.name, entity, entityId: String(entityId || ''), action, summary, before, after })
  } catch (e) {
    console.error('audit failed', e)
  }
}

export async function notify({ user, role, type, message, link }) {
  try {
    await Notification.create({ user, role, type, message, link })
  } catch (e) {
    console.error('notify failed', e)
  }
}

export const num = v => (v === '' || v == null ? 0 : Number(v) || 0)
export const round = (v, ccy = 'VND') => (ccy === 'VND' ? Math.round(v) : Math.round(v * 100) / 100)

export function paging(query) {
  const page = Math.max(1, parseInt(query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10))
  return { page, limit, skip: (page - 1) * limit }
}

export function rx(s) {
  return new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
}

export async function list(Model, filter, query, { sort = { createdAt: -1 }, populate = [], map } = {}) {
  const { page, limit, skip } = paging(query)
  const [total, rows] = await Promise.all([
    Model.countDocuments(filter),
    Model.find(filter).sort(sort).skip(skip).limit(limit).populate(populate).lean()
  ])
  return { rows: map ? rows.map(map) : rows, total, page, limit }
}

export function pick(obj, keys) {
  const o = {}
  for (const k of keys) if (obj[k] !== undefined) o[k] = obj[k]
  return o
}
