'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import DataTable, { col, colFn } from '@components/app/DataTable'
import FormDialog from '@components/app/FormDialog'
import { toOptions } from '@components/app/fields'
import { useOptions } from '@components/app/useOptions'
import { useAction } from '@components/app/useAction'
import { useSession } from '@components/SessionProvider'
import { UNITS } from '@/server/constants'
import { api } from '@/utils/api'
import { fmtMoney, fmtDate, toInputDate } from '@/utils/format'

export default function CustomerPrices({ customerId }) {
  const s = useSession()
  const act = useAction()
  const [open, setOpen] = useState(false)
  const { data: rows = [] } = useQuery({ queryKey: ['/customers', customerId, 'prices'], queryFn: () => api(`/customers/${customerId}/prices`) })
  const { data: st } = useQuery({ queryKey: ['settings'], queryFn: () => api('/settings') })
  const { options: products, raw } = useOptions('/products/options')
  const canEdit = s.role === 'admin' || (st?.priceEditRoles || []).includes(s.role)

  const current = useMemo(() => {
    const now = Date.now()
    const m = new Map()
    for (const r of rows) {
      const pid = r.product?._id
      if (new Date(r.effectiveFrom).getTime() <= now && !m.has(pid)) m.set(pid, r) // rows đã sắp mới nhất trước
    }
    return [...m.values()]
  }, [rows])

  const money = ({ row: { original: r } }) => `${fmtMoney(r.price)} / ${UNITS[r.unit]?.toLowerCase()}`
  const curCols = [
    colFn('Sản phẩm', r => r.product?.name),
    colFn('Đơn giá hiện hành', r => r.price, { align: 'right', cell: money }),
    colFn('Áp dụng từ', r => r.effectiveFrom, { cell: ({ row: { original: r } }) => fmtDate(r.effectiveFrom) })
  ]
  const histCols = [
    colFn('Áp dụng từ', r => r.effectiveFrom, { cell: ({ row: { original: r } }) => fmtDate(r.effectiveFrom) }),
    colFn('Sản phẩm', r => r.product?.name),
    colFn('Đơn giá', r => r.price, { align: 'right', cell: money }),
    col('Người thay đổi', 'createdByName'),
    colFn('Ngày nhập', r => r.createdAt, { cell: ({ row: { original: r } }) => fmtDate(r.createdAt) }),
    col('Ghi chú', 'note')
  ]
  const fields = [
    { name: 'product', label: 'Sản phẩm', type: 'select', options: products, required: true, allowEmpty: false },
    { name: 'unit', label: 'Tính giá theo', type: 'select', options: toOptions(UNITS), required: true, allowEmpty: false, xs: 6 },
    { name: 'price', label: 'Đơn giá', type: 'money', required: true, xs: 6 },
    { name: 'effectiveFrom', label: 'Ngày bắt đầu áp dụng', type: 'date', required: true },
    { name: 'note', label: 'Ghi chú', type: 'textarea' }
  ]

  return (
    <div className='flex flex-col gap-6'>
      <Alert severity='info'>Đơn hàng lưu cố định đơn giá tại thời điểm tạo đơn; thay đổi bảng giá không làm thay đổi các đơn đã phát sinh.</Alert>
      <Card>
        <CardHeader
          title='Giá đang hiệu lực'
          action={canEdit && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => setOpen(true)}>Thêm giá mới</Button>}
        />
        <DataTable columns={curCols} rows={current} empty='Khách hàng chưa có giá riêng' />
      </Card>
      <Card>
        <CardHeader title='Lịch sử thay đổi giá' />
        <DataTable columns={histCols} rows={rows} />
      </Card>
      <FormDialog
        open={open}
        title='Thêm giá mới'
        fields={fields}
        initial={{ effectiveFrom: toInputDate(new Date()), unit: 'binh' }}
        onClose={() => setOpen(false)}
        onSubmit={async v => {
          const p = raw.find(x => x._id === v.product)
          await act(`/customers/${customerId}/prices`, { method: 'POST', body: { ...v, unit: v.unit || p?.unit }, ok: 'Đã thêm giá mới' })
        }}
      />
    </div>
  )
}
