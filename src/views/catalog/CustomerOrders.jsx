'use client'

import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import DataTable, { col, colFn } from '@components/app/DataTable'
import StatusChip from '@components/app/StatusChip'
import { useList } from '@components/app/useList'
import { fmtMoney, fmtDateTime } from '@/utils/format'

export default function CustomerOrders({ customerId }) {
  const router = useRouter()
  const l = useList('/orders', { customer: customerId })
  const columns = [
    col('Mã đơn', 'code'),
    colFn('Thời gian giao', r => r.deliveryAt, { cell: ({ row: { original: r } }) => fmtDateTime(r.deliveryAt) }),
    colFn('Sản phẩm', r => (r.lines || []).map(x => `${x.productName} × ${x.actualQty ?? x.plannedQty}`).join(', ')),
    colFn('Thành tiền', r => r.amount, { align: 'right', cell: ({ row: { original: r } }) => fmtMoney(r.amount) }),
    colFn('Trạng thái', r => r.status, { align: 'center', cell: ({ row: { original: r } }) => <StatusChip status={r.status} /> })
  ]
  return (
    <Card>
      <DataTable columns={columns} rows={l.rows} total={l.total} page={l.page} limit={l.limit} onPageChange={l.onPageChange} loading={l.isFetching} onRowClick={r => router.push(`/orders/${r._id}`)} />
    </Card>
  )
}
