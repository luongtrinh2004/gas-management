'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import PageHeader from '@components/app/PageHeader'
import StatCards from '@components/app/StatCards'
import DataTable, { col, colFn } from '@components/app/DataTable'
import DataTableToolbar from '@components/DataTableToolbar'
import PeriodFilter, { monthRange } from '@components/app/PeriodFilter'
import { Check } from '@components/app/fields'
import { useList } from '@components/app/useList'
import { useSession } from '@components/SessionProvider'
import { fmtMoney } from '@/utils/format'
import { PaymentDialog, AdjustDialog } from '@views/finance/dialogs'

export default function DebtsPage() {
  const s = useSession()
  const router = useRouter()
  const canWrite = ['admin', 'accountant'].includes(s.role)
  const list = useList('/debts', { ...monthRange(), onlyDebt: '' })
  const [pay, setPay] = useState(null) // { customerId? }
  const [adj, setAdj] = useState(null)
  const t = list.data?.totals || {}
  const columns = [
    colFn('Khách hàng', r => r.customer.name, { cell: ({ row: { original: r } }) => <div className='flex flex-col'><span className='font-medium'>{r.customer.name}</span><span className='text-textSecondary text-sm'>{r.customer.code} {r.customer.phone ? '· ' + r.customer.phone : ''}</span></div> }),
    colFn('Dư đầu kỳ', r => r.opening, { align: 'right', cell: ({ row: { original: r } }) => fmtMoney(r.opening) }),
    colFn('Phát sinh tăng', r => r.increase, { align: 'right', cell: ({ row: { original: r } }) => fmtMoney(r.increase) }),
    colFn('Đã thu / giảm', r => r.decrease, { align: 'right', cell: ({ row: { original: r } }) => fmtMoney(r.decrease) }),
    colFn('Dư cuối kỳ', r => r.closing, { align: 'right', cell: ({ row: { original: r } }) => <b style={{ color: r.closing > 0 ? 'var(--mui-palette-warning-main)' : r.closing < 0 ? 'var(--mui-palette-success-main)' : undefined }}>{fmtMoney(r.closing)}</b> })
  ]
  if (canWrite) {
    columns.push({
      header: 'Thao tác', id: 'actions', meta: { align: 'center' },
      cell: ({ row }) => (
        <div onClick={e => e.stopPropagation()} className='flex justify-center gap-1'>
          <Button size='small' variant='tonal' onClick={() => setPay({ customerId: row.original.customer._id })}>Thu nợ</Button>
          <Button size='small' variant='tonal' color='secondary' onClick={() => setAdj({ customerId: row.original.customer._id })}>Điều chỉnh</Button>
        </div>
      )
    })
  }
  return (
    <>
      <PageHeader title='Công nợ khách hàng' subtitle='Tổng hợp từ đơn đã duyệt, phiếu thu và điều chỉnh có lưu vết' actions={canWrite && <Button variant='contained' startIcon={<i className='tabler-cash' />} onClick={() => setPay({})}>Thu nợ</Button>} />
      <div className='mbe-6'><PeriodFilter value={{ from: list.filters.from, to: list.filters.to }} onChange={v => { list.setFilter('from', v.from); list.setFilter('to', v.to) }} /></div>
      <StatCards size={{ xs: 12, sm: 6, md: 3 }} cards={[
        { label: 'Dư đầu kỳ', value: t.opening, money: true, icon: 'tabler-arrow-bar-to-right', color: 'secondary' },
        { label: 'Phát sinh tăng', value: t.increase, money: true, icon: 'tabler-trending-up', color: 'warning' },
        { label: 'Đã thu / giảm', value: t.decrease, money: true, icon: 'tabler-trending-down', color: 'success' },
        { label: 'Dư cuối kỳ (phải thu)', value: t.closing, money: true, icon: 'tabler-report-money', color: 'error' }
      ]} />
      <Card className='mbs-6'>
        <DataTableToolbar search={list.search} onSearchChange={list.setSearch} limit={list.limit} onLimitChange={list.setLimit} placeholder='Tìm khách hàng…' itemLabel='khách'>
          <Check label='Chỉ khách còn dư nợ' checked={list.filters.onlyDebt === '1'} onChange={v => list.setFilter('onlyDebt', v ? '1' : '')} />
        </DataTableToolbar>
        <DataTable columns={columns} rows={list.rows} total={list.total} page={list.page} limit={list.limit} onPageChange={list.onPageChange} loading={list.isFetching} onRowClick={r => router.push(`/customers/${r.customer._id}`)} />
      </Card>
      <PaymentDialog open={!!pay} customerId={pay?.customerId} onClose={() => setPay(null)} />
      <AdjustDialog open={!!adj} customerId={adj?.customerId} onClose={() => setAdj(null)} />
    </>
  )
}
