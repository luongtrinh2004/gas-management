'use client'

import MasterPage from '@components/app/MasterPage'
import { col, colFn } from '@components/app/DataTable'
import { useSession } from '@components/SessionProvider'
import StatusChip from '@components/app/StatusChip'
import { toOptions } from '@components/app/fields'
import CustomChip from '@core/components/mui/Chip'
import Avatar from '@mui/material/Avatar'
import { resolveAvatar } from '@/utils/getDefaultAvatar'
import { fmtDateTime } from '@/utils/format'
import { ROLES } from '@/server/constants'

const GENDERS = { male: 'Nam', female: 'Nữ' }
const ROLE_COLOR = { admin: 'error', office: 'primary', driver: 'success', accountant: 'info' }

export default function UsersPage() {
  const s = useSession()
  const columns = [
    colFn('Họ tên', r => r.name, { cell: ({ row: { original: r } }) => <div className='flex items-center gap-3'><Avatar src={resolveAvatar(r)} alt={r.name} sx={{ width: 34, height: 34 }} /><span>{r.name}</span></div> }),
    col('Email', 'email'),
    col('Điện thoại', 'phone'),
    colFn('Giới tính', r => r.gender, { align: 'center', cell: ({ row: { original: r } }) => GENDERS[r.gender] || '—' }),
    colFn('Vai trò', r => r.role, { align: 'center', cell: ({ row: { original: r } }) => <CustomChip round='true' variant='tonal' size='small' color={ROLE_COLOR[r.role]} label={ROLES[r.role]} /> }),
    colFn('Đăng nhập cuối', r => r.lastLoginAt, { cell: ({ row: { original: r } }) => fmtDateTime(r.lastLoginAt) }),
    colFn('Trạng thái', r => r.status, { align: 'center', cell: ({ row: { original: r } }) => <StatusChip status={r.status} /> })
  ]
  const fields = [
    { name: 'name', label: 'Họ tên', required: true },
    { name: 'email', label: 'Email đăng nhập', type: 'email', required: true },
    { name: 'phone', label: 'Điện thoại', xs: 6 },
    { name: 'gender', label: 'Giới tính', type: 'select', options: toOptions(GENDERS), allowEmpty: false, required: true, xs: 6 },
    { name: 'role', label: 'Vai trò', type: 'select', options: toOptions(ROLES), allowEmpty: false, required: true, xs: 6 },
    { name: 'status', label: 'Trạng thái', type: 'select', allowEmpty: false, xs: 6, options: [{ value: 'active', label: 'Hoạt động' }, { value: 'disabled', label: 'Vô hiệu hóa' }] },
    { name: 'password', label: 'Mật khẩu (tối thiểu 8 ký tự; để trống nếu không đổi)', type: 'password', xs: 6 }
  ]
  return (
    <MasterPage
      title='Người dùng'
      subtitle='Tài khoản và phân quyền'
      path='/users'
      columns={columns}
      fields={fields}
      canWrite={s.role === 'admin'}
      defaultValues={{ role: 'office', status: 'active', gender: 'male' }}
      itemLabel='tài khoản'
      filters={[{ name: 'role', label: 'Vai trò', options: toOptions(ROLES) }]}
    />
  )
}
