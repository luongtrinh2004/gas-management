// Cấu hình menu + quyền truy cập trang theo vai trò (dùng cho sidebar và middleware).
// Quyền thật sự vẫn được kiểm tra ở API — ẩn menu chỉ là lớp giao diện.
// Vai trò: admin (Quản trị/Chủ), office (Văn phòng), driver (Giao hàng), accountant (Kế toán)

const ALL = ['admin', 'office', 'driver', 'accountant']
const BACK = ['admin', 'office', 'accountant'] // người dùng văn phòng (không gồm giao hàng)
const MONEY = ['admin', 'accountant']

export const MENU = [
  { label: 'Trang chủ', href: '/home', icon: 'tabler-smart-home', roles: ALL },
  { label: 'Đơn giao của tôi', href: '/deliveries', icon: 'tabler-truck-delivery', roles: ['driver'] },
  { label: 'Đơn hàng', href: '/orders', icon: 'tabler-clipboard-list', roles: BACK },
  { label: 'Chờ đối soát', href: '/reconcile', icon: 'tabler-checklist', roles: BACK },
  { label: 'Khách hàng', href: '/customers', icon: 'tabler-users', roles: BACK },
  { label: 'Sản phẩm', href: '/products', icon: 'tabler-flame', roles: BACK },
  { label: 'Công nợ', href: '/debts', icon: 'tabler-report-money', roles: BACK },
  { label: 'Vỏ bình & gas dư', href: '/shells', icon: 'tabler-cylinder', roles: BACK },
  {
    label: 'Nhập hàng & kho',
    icon: 'tabler-building-warehouse',
    roles: BACK,
    children: [
      { label: 'Phiếu nhập', href: '/imports', roles: BACK },
      { label: 'Nhập – xuất – tồn', href: '/stock', roles: BACK },
      { label: 'Nhà cung cấp', href: '/suppliers', roles: BACK }
    ]
  },
  { label: 'Thu chi', href: '/cash', icon: 'tabler-wallet', roles: MONEY },
  { label: 'Vật tư', href: '/materials', icon: 'tabler-package', roles: BACK },
  { label: 'Sửa chữa & bảo trì', href: '/maintenance', icon: 'tabler-tool', roles: BACK },
  { label: 'Báo cáo', href: '/reports', icon: 'tabler-chart-bar', roles: BACK },
  {
    label: 'Quản trị',
    icon: 'tabler-settings',
    roles: ['admin'],
    children: [
      { label: 'Người dùng', href: '/admin/users', roles: ['admin'] },
      { label: 'Cấu hình', href: '/admin/settings', roles: ['admin'] },
      { label: 'Nhật ký hoạt động', href: '/admin/audit-logs', roles: ['admin'] }
    ]
  }
]

// Trang không thuộc menu nhưng cần chặn theo vai trò (khớp theo tiền tố dài nhất)
const flat = []
const walk = items =>
  items.forEach(i => {
    if (i.href) flat.push({ href: i.href, roles: i.roles })
    if (i.children) walk(i.children)
  })
walk(MENU)

export const PAGE_ACCESS = [
  ...flat,
  { href: '/orders/', roles: ALL }, // chi tiết đơn: giao hàng chỉ thấy đơn được phân công (API kiểm tra)
  { href: '/orders/new', roles: ['admin', 'office'] },
  { href: '/customers/', roles: BACK },
  { href: '/deliveries/', roles: ['driver'] }
]

export function canAccess(role, pathname) {
  if (/^\/orders\/[^/]+\/edit\/?$/.test(pathname)) return ['admin', 'office'].includes(role)
  let best = null
  for (const p of PAGE_ACCESS) {
    if (pathname === p.href || pathname.startsWith(p.href.endsWith('/') ? p.href : p.href + '/')) {
      if (!best || p.href.length > best.href.length) best = p
    }
  }
  return best ? best.roles.includes(role) : true
}

export function filterMenu(role) {
  return MENU.filter(m => m.roles.includes(role))
    .map(m => (m.children ? { ...m, children: m.children.filter(c => c.roles.includes(role)) } : m))
    .filter(m => !m.children || m.children.length)
}
