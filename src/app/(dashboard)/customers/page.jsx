'use client'

import { useRouter } from 'next/navigation'
import MasterPage from '@components/app/MasterPage'
import { col, colFn } from '@components/app/DataTable'
import StatusChip from '@components/app/StatusChip'
import { useSession } from '@components/SessionProvider'
import { fmtMoney } from '@/utils/format'

const columns = [
  col('Mã KH', 'code'),
  col('Tên khách hàng', 'name'),
  col('Điện thoại', 'phone'),
  col('Địa chỉ giao hàng', 'address'),
  colFn('Dư nợ đầu kỳ', r => r.openingDebt, { align: 'right', cell: ({ row: { original: r } }) => fmtMoney(r.openingDebt || 0) }),
  colFn('Trạng thái', r => r.status, { align: 'center', cell: ({ row: { original: r } }) => <StatusChip status={r.status} /> })
]

const fields = [
  { name: 'name', label: 'Tên khách / công ty', required: true },
  { name: 'phone', label: 'Số điện thoại', xs: 6 },
  { name: 'contactName', label: 'Người liên hệ', xs: 6 },
  { name: 'address', label: 'Địa chỉ giao hàng', type: 'textarea' },
  { name: 'contactInfo', label: 'Thông tin liên hệ khác' },
  { name: 'openingDebt', label: 'Dư nợ đầu kỳ', type: 'money', xs: 6, helper: 'Số nợ khách đang còn khi bắt đầu dùng hệ thống' },
  { name: 'status', label: 'Trạng thái', type: 'select', allowEmpty: false, xs: 6, options: [{ value: 'active', label: 'Hoạt động' }, { value: 'inactive', label: 'Ngừng' }] },
  { name: 'note', label: 'Ghi chú', type: 'textarea' }
]

export default function CustomersPage() {
  const s = useSession()
  const router = useRouter()
  return (
    <MasterPage
      title='Khách hàng'
      subtitle='Hồ sơ khách, hợp đồng, bảng giá riêng, vỏ bình và công nợ'
      path='/customers'
      columns={columns}
      fields={fields}
      canWrite={['admin', 'office'].includes(s.role)}
      defaultValues={{ status: 'active', openingDebt: 0 }}
      searchPlaceholder='Tìm theo tên, mã, số điện thoại…'
      itemLabel='khách'
      filters={[{ name: 'status', label: 'Trạng thái', options: [{ value: 'active', label: 'Hoạt động' }, { value: 'inactive', label: 'Ngừng' }] }]}
      onRowClick={r => router.push(`/customers/${r._id}`)}
    />
  )
}
