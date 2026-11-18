import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { canAccess } from '@/configs/access'

// Khóa ký JWT phiên đăng nhập: lấy từ AUTH_SECRET / NEXTAUTH_SECRET, hoặc khóa dự phòng an toàn
const SECRET = () => {
  const s =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'gas-management-prod-fallback-secret-2026'
  return new TextEncoder().encode(s)
}

export async function middleware(req) {
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/api')) return NextResponse.next()

  // Luôn cho phép hiển thị trang /login, KHÔNG tự động chuyển hướng /login sang /home.
  // Điều này loại bỏ hoàn toàn nguy cơ vòng lặp chuyển hướng (ERR_TOO_MANY_REDIRECTS)
  // khi cookie cũ không còn khớp với bản ghi người dùng trong cơ sở dữ liệu.
  if (pathname === '/login') {
    return NextResponse.next()
  }

  const token = req.cookies.get('gas_session')?.value
  let payload = null
  if (token) {
    try {
      payload = (await jwtVerify(token, SECRET())).payload
    } catch {
      payload = null
    }
  }

  // Chưa đăng nhập hoặc token không hợp lệ -> chuyển về /login
  if (!payload) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Đã đăng nhập nhưng không có quyền truy cập trang -> chuyển về /401
  if (pathname !== '/401' && !canAccess(payload.role, pathname)) {
    const url = req.nextUrl.clone()
    url.pathname = '/401'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|fonts|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js|ttf|woff2?)$).*)',
  ],
}
