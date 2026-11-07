import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { connectDB } from './db'
import { User } from './models'

export const COOKIE = 'gas_session'
// Bắt buộc đặt AUTH_SECRET khi chạy production; dev dùng khóa tạm (không dùng được ngoài máy dev)
const SECRET = () => {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!s && process.env.NODE_ENV === 'production') throw new Error('Thiếu biến môi trường AUTH_SECRET')
  return new TextEncoder().encode(s || 'gas-local-dev-only-secret')
}
const MAX_AGE = 60 * 60 * 10

export async function signSession(user) {
  return new SignJWT({ uid: String(user._id), role: user.role, name: user.name, email: user.email })
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
  jar.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: MAX_AGE, secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== '1' })
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
  const u = await User.findById(p.uid).select('role status name email gender').lean()
  if (!u || u.status !== 'active') return null
  return { id: p.uid, role: u.role, name: u.name, email: u.email, gender: u.gender }
}
