'use client'

import CustomChip from '@core/components/mui/Chip'

// map: { value: [label, color] }  — màu theo UI_RULES (tonal / soft)
export const STATUS_STYLES = {
  // đơn hàng
  new: ['Mới tạo', 'info'],
  waiting_assign: ['Chờ phân công', 'warning'],
  assigned: ['Đã phân công', 'primary'],
  delivering: ['Đang giao', 'info'],
  pending_review: ['Chờ đối soát', 'warning'],
  need_fix: ['Cần xử lý', 'error'],
  approved: ['Đã duyệt', 'success'],
  cancelled: ['Đã hủy', 'secondary'],
  // phiếu nhập / chứng từ
  draft: ['Nháp', 'secondary'],
  confirmed: ['Đã xác nhận', 'success'],
  void: ['Đã hủy', 'error'],
  // chung
  active: ['Hoạt động', 'success'],
  inactive: ['Ngừng', 'secondary'],
  disabled: ['Vô hiệu hóa', 'error'],
  pending: ['Chờ xử lý', 'warning'],
  done: ['Hoàn tất', 'success'],
  received: ['Đã nhận', 'success'],
  issued: ['Đã xuất', 'success'],
  none: ['Không', 'secondary']
}

export default function StatusChip({ status, label, color, size = 'small' }) {
  const [l, c] = STATUS_STYLES[status] || [status, 'secondary']
  return <CustomChip round='true' variant='tonal' size={size} label={label || l} color={color || c} />
}
