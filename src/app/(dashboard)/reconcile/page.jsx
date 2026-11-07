'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import PageHeader from '@components/app/PageHeader'
import DataTable, { col, colFn } from '@components/app/DataTable'
import StatusChip from '@components/app/StatusChip'
import { SelectField } from '@components/app/fields'
import { useList } from '@components/app/useList'
import { useAction } from '@components/app/useAction'
import DataTableToolbar from '@components/DataTableToolbar'
import ConfirmDialog from '@components/ConfirmDialog'
import { ReasonDialog } from '@/views/orders/shared'
import { fmtDateTime, fmtMoney } from '@/utils/format'

export default function ReconcilePage() {
  const router = useRouter()
  const act = useAction()
  const list = useList('/orders/reconcile', { status: '' })
  const [approve, setApprove] = useState(null)
  const [ret, setRet] = useState(null)
  const columns = [
    col('Mã đơn', 'code', { cell: i => <b>{i.getValue()}</b> }),
    col('Khách hàng', 'customerName'),
    colFn('Nhân viên giao', r => r.assignees?.map(a => a.name).join(', ') || '—'),
    colFn('Gửi lúc', r => r.delivery?.confirmedAt, { cell: i => fmtDateTime(i.getValue()) }),
    colFn('Thành tiền', r => r.amount, { align: 'right', cell: i => fmtMoney(i.getValue()) }),
    colFn('Đã thu', r => r.delivery?.paidAmount, { align: 'right', cell: i => fmtMoney(i.getValue() || 0) }),
    colFn('Ảnh', r => r.attachments?.length || 0, { align: 'center', cell: i => (i.getValue() ? `${i.getValue()} ảnh` : <span className='text-error'>Thiếu</span>) }),
    colFn('Trạng thái', r => r.status, { align: 'center', cell: ({ row: { original: r } }) => <StatusChip status={r.status} /> }),
    {
      header: 'Thao tác',
      id: 'actions',
      meta: { align: 'center' },
      cell: ({ row: { original: r } }) =>
        r.status === 'pending_review' ? (
          <div className='flex justify-center gap-1' onClick={e => e.stopPropagation()}>
            <Button size='small' variant='contained' color='success' onClick={() => setApprove(r)}>Duyệt</Button>
            <Button size='small' variant='tonal' color='error' onClick={() => setRet(r)}>Trả lại</Button>
          </div>
        ) : null
    }
  ]
  return (
    <>
      <PageHeader title='Chờ đối soát' subtitle='Kiểm tra kết quả giao hàng với ảnh hóa đơn, sau đó duyệt hoặc trả lại' />
      <Card>
        <DataTableToolbar search={list.search} onSearchChange={list.setSearch} limit={list.limit} onLimitChange={list.setLimit} placeholder='Tìm mã đơn, khách hàng…' itemLabel='đơn'>
          <div style={{ minWidth: 170 }}>
            <SelectField placeholder='Tất cả' options={[{ value: 'pending_review', label: 'Chờ đối soát' }, { value: 'need_fix', label: 'Cần xử lý' }]} value={list.filters.status} onChange={v => list.setFilter('status', v)} />
          </div>
        </DataTableToolbar>
        <DataTable columns={columns} rows={list.rows} total={list.total} page={list.page} limit={list.limit} onPageChange={list.onPageChange} loading={list.isFetching} onRowClick={r => router.push(`/orders/${r._id}`)} empty='Không có đơn nào cần đối soát' />
      </Card>
      <ConfirmDialog
        open={!!approve}
        title='Duyệt đơn'
        confirmColor='success'
        confirmText='Duyệt'
        message={`Xác nhận dữ liệu giao hàng đơn ${approve?.code} hợp lệ? Sau khi duyệt, số liệu được ghi vào công nợ, vỏ bình, gas dư và thu chi.`}
        onClose={() => setApprove(null)}
        onConfirm={async () => {
          await act(`/orders/${approve._id}/approve`, { body: {}, ok: 'Đã duyệt đơn' }).catch(() => {})
          setApprove(null)
        }}
      />
      <ReasonDialog open={!!ret} title={`Trả lại đơn ${ret?.code}`} label='Lý do trả lại' confirmText='Trả lại' color='error' onClose={() => setRet(null)} onSubmit={reason => act(`/orders/${ret._id}/return`, { body: { reason }, ok: 'Đã trả lại đơn' })} />
    </>
  )
}
