'use client'

import MasterPage from '@components/app/MasterPage'
import { col, colFn } from '@components/app/DataTable'
import { toOptions } from '@components/app/fields'
import { useSession } from '@components/SessionProvider'
import CustomChip from '@core/components/mui/Chip'
import { fmtDate, fmtMoney } from '@/utils/format'
import { MAINT_KINDS, VEHICLE_TYPES } from '@/server/constants'

const KIND_COLOR = { repair: 'error', maintenance: 'info', inspection: 'primary' }
const toInput = d => (d ? new Date(d).toISOString().slice(0, 10) : '')
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

function DueChip({ d }) {
  if (!d) return '—'
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  if (days < 0) return <CustomChip round='true' variant='tonal' size='small' color='error' label={`Quá hạn ${-days} ngày (${fmtDate(d)})`} />
  if (days <= 30) return <CustomChip round='true' variant='tonal' size='small' color='warning' label={`Còn ${days} ngày (${fmtDate(d)})`} />
  return fmtDate(d)
}

const columns = [
  colFn('Ngày', r => r.date, { cell: ({ row: { original: r } }) => fmtDate(r.date) }),
  colFn('Phương tiện', r => r.plate, { cell: ({ row: { original: r } }) => `${VEHICLE_TYPES[r.vehicleType]} · ${r.plate}` }),
  colFn('Loại', r => r.kind, { align: 'center', cell: ({ row: { original: r } }) => <CustomChip round='true' variant='tonal' size='small' color={KIND_COLOR[r.kind]} label={MAINT_KINDS[r.kind]} /> }),
  col('Hạng mục', 'item'),
  col('Đơn vị thực hiện', 'vendor'),
  colFn('Chi phí', r => r.cost, { align: 'right', cell: ({ row: { original: r } }) => fmtMoney(r.cost) }),
  colFn('Hạn tiếp theo', r => r.nextDue, { cell: ({ row: { original: r } }) => <DueChip d={r.nextDue} /> }),
  col('Ghi chú', 'note')
]

const fields = [
  { name: 'vehicleType', label: 'Loại phương tiện', type: 'select', allowEmpty: false, options: toOptions(VEHICLE_TYPES), xs: 6, required: true },
  { name: 'plate', label: 'Biển số', xs: 6, required: true },
  { name: 'kind', label: 'Loại hạng mục', type: 'select', allowEmpty: false, options: toOptions(MAINT_KINDS), xs: 6, required: true },
  { name: 'date', label: 'Ngày thực hiện', type: 'date', xs: 6, required: true },
  { name: 'item', label: 'Hạng mục (vd: thay nhớt, đăng kiểm)', required: true },
  { name: 'vendor', label: 'Đơn vị thực hiện', xs: 6 },
  { name: 'cost', label: 'Chi phí', type: 'money', xs: 6, helper: 'Chi phí > 0 tự ghi vào Thu chi (chi sửa chữa, tiền mặt)' },
  { name: 'nextDue', label: 'Hạn tiếp theo (bảo trì/kiểm định)', type: 'date', xs: 6 },
  { name: 'note', label: 'Ghi chú', type: 'textarea' }
]

export default function MaintenancePage() {
  const s = useSession()
  return (
    <MasterPage
      title='Sửa chữa & bảo trì'
      subtitle='Sửa chữa, bảo trì, kiểm định xe máy và xe tải'
      path='/maintenance'
      columns={columns}
      fields={fields}
      canWrite
      canDelete={s.role === 'admin'}
      defaultValues={{ vehicleType: 'truck', kind: 'maintenance', date: today(), cost: '' }}
      mapRow={r => ({ ...r, date: toInput(r.date), nextDue: toInput(r.nextDue) })}
      searchPlaceholder='Tìm biển số, hạng mục, đơn vị…'
      itemLabel='hồ sơ'
      filters={[
        { name: 'vehicleType', label: 'Phương tiện', options: toOptions(VEHICLE_TYPES) },
        { name: 'kind', label: 'Loại', options: toOptions(MAINT_KINDS) }
      ]}
    />
  )
}
