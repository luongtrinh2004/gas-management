import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { connectDB } from './db'
import { User } from './models'

export const COOKIE = 'gas_session'
// Khóa ký JWT phiên đăng nhập: lấy từ AUTH_SECRET / NEXTAUTH_SECRET, hoặc khóa dự phòng an toàn
const SECRET = () => {
  const s =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'gas-management-prod-fallback-secret-2026'
  return new TextEncoder().encode(s)
}
const MAX_AGE = 60 * 60 * 10

export async function signSession(user) {
  return new SignJWT({
    uid: String(user._id),
    role: user.role,
    name: user.name,
    email: user.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(SECRET())
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET())
    return payload
  } catch {
    return null
  }
}

export async function setSessionCookie(token) {
  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
    secure:
      process.env.NODE_ENV === 'production' &&
      process.env.COOKIE_INSECURE !== '1',
  })
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.delete(COOKIE)
}

export async function getSession() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return null
  const p = await verifyToken(token)
  if (!p) return null
  await connectDB()
  const u = await User.findById(p.uid)
    .select('role status name email gender')
    .lean()
  if (!u || u.status !== 'active') return null
  return {
    id: p.uid,
    role: u.role,
    name: u.name,
    email: u.email,
    gender: u.gender,
  }
}
