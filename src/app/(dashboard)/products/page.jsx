'use client'

import MasterPage from '@components/app/MasterPage'
import { col, colFn } from '@components/app/DataTable'
import StatusChip from '@components/app/StatusChip'
import { toOptions } from '@components/app/fields'
import { useSession } from '@components/SessionProvider'
import { UNITS } from '@/server/constants'
import { fmtNum } from '@/utils/format'

const columns = [
  col('Mã', 'code'),
  col('Tên sản phẩm', 'name'),
  colFn('Đơn vị bán', r => r.unit, { cell: ({ row: { original: r } }) => UNITS[r.unit] }),
  colFn('Quy đổi (kg/bình)', r => r.kgPerUnit, { align: 'right', cell: ({ row: { original: r } }) => (r.kgPerUnit ? fmtNum(r.kgPerUnit) : '—') }),
  colFn('Số bình/thùng', r => r.unitsPerBox, { align: 'right', cell: ({ row: { original: r } }) => (r.unitsPerBox ? fmtNum(r.unitsPerBox) : '—') }),
  col('Ghi chú', 'note'),
  colFn('Trạng thái', r => r.status, { align: 'center', cell: ({ row: { original: r } }) => <StatusChip status={r.status} /> })
]

const fields = [
  { name: 'code', label: 'Mã sản phẩm', xs: 6, helper: 'Để trống để tự sinh' },
  { name: 'name', label: 'Tên sản phẩm', required: true, xs: 6 },
  { name: 'unit', label: 'Đơn vị bán mặc định', type: 'select', options: toOptions(UNITS), allowEmpty: false, xs: 6 },
  { name: 'status', label: 'Trạng thái', type: 'select', allowEmpty: false, xs: 6, options: [{ value: 'active', label: 'Đang bán' }, { value: 'inactive', label: 'Ngừng bán' }] },
  { name: 'kgPerUnit', label: 'Quy đổi kg / bình', type: 'number', xs: 6, helper: 'Dùng khi bán theo kg để trừ tồn. Gas mini để trống.' },
  { name: 'unitsPerBox', label: 'Số bình / thùng (gas mini)', type: 'number', xs: 6, helper: 'Chưa xác nhận quy cách thì để trống' },
  { name: 'note', label: 'Ghi chú', type: 'textarea' }
]

export default function ProductsPage() {
  const s = useSession()
  return (
    <MasterPage
      title='Sản phẩm'
      subtitle='Danh mục gas (đơn giá bán được thiết lập riêng cho từng khách hàng)'
      path='/products'
      columns={columns}
      fields={fields}
      canWrite={s.role === 'admin'}
      defaultValues={{ unit: 'binh', status: 'active' }}
      itemLabel='sản phẩm'
      toPayload={v => ({ ...v, kgPerUnit: v.kgPerUnit === '' ? null : v.kgPerUnit, unitsPerBox: v.unitsPerBox === '' ? null : v.unitsPerBox })}
    />
  )
}
