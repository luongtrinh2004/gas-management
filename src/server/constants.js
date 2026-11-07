// Hằng số dùng chung cho cả server và client (không import code server-only vào đây).

export const ROLES = {
  admin: 'Quản trị / Chủ cửa hàng',
  office: 'Nhân viên văn phòng',
  driver: 'Nhân viên giao hàng',
  accountant: 'Kế toán'
}

export const UNITS = { binh: 'Bình', kg: 'Kg', thung: 'Thùng' }

export const ORDER_STATUS = {
  new: 'Mới tạo',
  waiting_assign: 'Chờ phân công',
  assigned: 'Đã phân công',
  delivering: 'Đang giao',
  pending_review: 'Chờ đối soát',
  need_fix: 'Cần xử lý',
  approved: 'Đã duyệt',
  cancelled: 'Đã hủy'
}

export const PAY_METHODS = { cash: 'Tiền mặt', company_account: 'Tài khoản công ty', personal_account: 'Tài khoản cá nhân', other: 'Khác' }

export const CASH_IN_CATEGORIES = { sale: 'Thu bán hàng', debt_collect: 'Thu công nợ', material_sale: 'Thu bán vật tư', other_in: 'Thu khác' }
export const CASH_OUT_CATEGORIES = { import: 'Chi nhập gas', operation: 'Chi vận hành', repair: 'Chi sửa chữa / bảo trì', supplies: 'Chi mua vật tư', other_out: 'Chi khác' }

export const CONTRACT_STATUS = { none: 'Chưa có', active: 'Còn hiệu lực', expired: 'Hết hạn', terminated: 'Đã chấm dứt' }
export const GAS_SYSTEM_STATUS = { none: 'Chưa lắp', installed: 'Đã lắp đặt', planned: 'Dự kiến lắp' }

export const MATERIAL_TX = { in: 'Nhập', sale: 'Bán', gift: 'Tặng' }
export const SHELL_KINDS = { opening: 'Số dư đầu kỳ', supplier_return: 'Trả nhà cung cấp', stocktake: 'Chênh lệch kiểm kê', adjust: 'Điều chỉnh' }
export const MAINT_KINDS = { repair: 'Sửa chữa', maintenance: 'Bảo trì', inspection: 'Kiểm định' }
export const VEHICLE_TYPES = { motorbike: 'Xe máy', truck: 'Xe tải' }

// Cấu hình mặc định (admin chỉnh được ở /admin/settings) — các điểm nghiệp vụ chưa được khách hàng xác nhận
export const DEFAULT_SETTINGS = {
  importValueBasis: 'actual', // 'actual' = kg thực tế | 'document' = kg chứng từ
  allowDriverMultiAssign: true, // một đơn giao nhiều nhân viên
  priceEditRoles: ['admin'] // vai trò được sửa giá trên đơn / bảng giá
}
