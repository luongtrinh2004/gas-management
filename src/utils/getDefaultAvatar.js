// Avatar mặc định theo vai trò + giới tính (ảnh ở public/images/avatars/{gender}-{kind}.png)
// admin → admin, accountant → accountant, driver → shipper, office → user
const KIND = { admin: 'admin', accountant: 'accountant', driver: 'shipper', office: 'user' }

export function getDefaultAvatar(role, gender) {
  return `/images/avatars/${gender === 'female' ? 'female' : 'male'}-${KIND[role] || 'user'}.png`
}

// Ưu tiên ảnh riêng (avatarUrl) nếu có, ngược lại dùng ảnh mặc định
export function resolveAvatar(user) {
  const base = process.env.NEXT_PUBLIC_BASEPATH || ''
  return user?.avatarUrl || base + getDefaultAvatar(user?.role, user?.gender)
}
