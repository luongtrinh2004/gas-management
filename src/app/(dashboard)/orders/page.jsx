'use client'

import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import PageHeader from '@components/app/PageHeader'
import DataTable, { col, colFn } from '@components/app/DataTable'
import StatusChip from '@components/app/StatusChip'
import { SelectField, DateField, toOptions } from '@components/app/fields'
import { useList } from '@components/app/useList'
import { useOptions } from '@components/app/useOptions'
import { useSession } from '@components/SessionProvider'
import DataTableToolbar from '@components/DataTableToolbar'
import { fmtDateTime, fmtMoney } from '@/utils/format'
import { ORDER_STATUS } from '@/server/constants'

export default function OrdersPage() {
  const router = useRouter()
  const s = useSession()
  const list = useList('/orders', { status: '', driver: '', from: '', to: '' })
  const { options: drivers } = useOptions('/users/options', { role: 'driver' }, u => ({ value: u._id, label: u.name }))
  const columns = [
    col('Mã đơn', 'code', { cell: i => <b>{i.getValue()}</b> }),
    col('Khách hàng', 'customerName'),
    colFn('Giao lúc', r => r.deliveryAt, { cell: i => fmtDateTime(i.getValue()) }),
    colFn('Sản phẩm', r => r.lines?.map(l => `${l.productName} × ${l.actualQty ?? l.plannedQty}`).join(', '), { cell: i => <span className='text-textSecondary'>{i.getValue()}</span> }),
    colFn('Nhân viên giao', r => r.assignees?.map(a => a.name).join(', ') || '—'),
    colFn('Thành tiền', r => r.amount, { align: 'right', cell: i => fmtMoney(i.getValue()) }),
    colFn('Trạng thái', r => r.status, { align: 'center', cell: ({ row: { original: r } }) => <StatusChip status={r.status} /> })
  ]
  return (
    <>
      <PageHeader
        title='Đơn hàng'
        subtitle='Tiếp nhận, phân công và theo dõi giao hàng'
        actions={['admin', 'office'].includes(s.role) && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => router.push('/orders/new')}>Tạo đơn</Button>}
      />
      <Card>
        <DataTableToolbar search={list.search} onSearchChange={list.setSearch} limit={list.limit} onLimitChange={list.setLimit} placeholder='Tìm mã đơn, khách hàng…' itemLabel='đơn'>
          <div style={{ minWidth: 160 }}><SelectField placeholder='Trạng thái' options={toOptions(ORDER_STATUS)} value={list.filters.status} onChange={v => list.setFilter('status', v)} /></div>
          <div style={{ minWidth: 160 }}><SelectField placeholder='Nhân viên giao' options={drivers} value={list.filters.driver} onChange={v => list.setFilter('driver', v)} /></div>
          <div style={{ width: 150 }}><DateField value={list.filters.from} onChange={v => list.setFilter('from', v)} /></div>
          <div style={{ width: 150 }}><DateField value={list.filters.to} onChange={v => list.setFilter('to', v)} /></div>
        </DataTableToolbar>
        <DataTable columns={columns} rows={list.rows} total={list.total} page={list.page} limit={list.limit} onPageChange={list.onPageChange} loading={list.isFetching} onRowClick={r => router.push(`/orders/${r._id}`)} />
      </Card>
    </>
  )
}
