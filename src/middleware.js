import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { canAccess } from '@/configs/access'

// Bắt buộc đặt AUTH_SECRET khi chạy production; dev dùng khóa tạm (không dùng được ngoài máy dev)
const SECRET = () => {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!s && process.env.NODE_ENV === 'production') throw new Error('Thiếu biến môi trường AUTH_SECRET')
  return new TextEncoder().encode(s || 'gas-local-dev-only-secret')
}

export async function middleware(req) {
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/api')) return NextResponse.next()

  const token = req.cookies.get('gas_session')?.value
  let payload = null
  if (token) {
    try {
      payload = (await jwtVerify(token, SECRET())).payload
    } catch {}
  }

  if (pathname === '/login') {
    if (payload) return NextResponse.redirect(new URL('/home', req.url))
    return NextResponse.next()
  }
  if (!payload) {
    const url = new URL('/login', req.url)
    return NextResponse.redirect(url)
  }
  if (pathname !== '/401' && !canAccess(payload.role, pathname)) return NextResponse.redirect(new URL('/401', req.url))
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|fonts|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js|ttf|woff2?)$).*)']
}
