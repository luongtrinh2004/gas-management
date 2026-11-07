'use client'

import MasterPage from '@components/app/MasterPage'
import { col, colFn } from '@components/app/DataTable'
import StatusChip from '@components/app/StatusChip'
import { useSession } from '@components/SessionProvider'

const columns = [
  col('Mã', 'code'),
  col('Nhà cung cấp', 'name'),
  col('Điện thoại', 'phone'),
  col('Địa chỉ', 'address'),
  colFn('Trạng thái', r => r.status, { align: 'center', cell: ({ row: { original: r } }) => <StatusChip status={r.status} /> })
]

const fields = [
  { name: 'name', label: 'Tên nhà cung cấp', required: true },
  { name: 'phone', label: 'Số điện thoại', xs: 6 },
  { name: 'status', label: 'Trạng thái', type: 'select', allowEmpty: false, xs: 6, options: [{ value: 'active', label: 'Hoạt động' }, { value: 'inactive', label: 'Ngừng' }] },
  { name: 'address', label: 'Địa chỉ', type: 'textarea' },
  { name: 'note', label: 'Ghi chú', type: 'textarea' }
]

export default function SuppliersPage() {
  const s = useSession()
  return (
    <MasterPage
      title='Nhà cung cấp'
      subtitle='Nơi nhập gas'
      path='/suppliers'
      columns={columns}
      fields={fields}
      canWrite={['admin', 'office'].includes(s.role)}
      defaultValues={{ status: 'active' }}
      itemLabel='nhà cung cấp'
    />
  )
}
