'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import StatCards from '@components/app/StatCards'
import DataTable, { col, colFn } from '@components/app/DataTable'
import PeriodFilter, { monthRange } from '@components/app/PeriodFilter'
import { useSession } from '@components/SessionProvider'
import { api } from '@/utils/api'
import { fmtDate, fmtMoney, fmtNum } from '@/utils/format'
import { SHELL_KINDS } from '@/server/constants'
import { PaymentDialog, AdjustDialog, ShellEntryDialog, ResidualEntryDialog } from './dialogs'

const SIZE = { xs: 12, sm: 6, md: 3 }
const DEBT_KIND = { opening: 'Dư đầu kỳ', sale: 'Bán hàng', payment: 'Thanh toán', adjust: 'Điều chỉnh' }
const RES_KIND = { arise: 'Phát sinh từ đơn', opening: 'Số dư đầu kỳ', offset: 'Đối trừ', adjust: 'Điều chỉnh' }
const signed = v => <span style={{ color: v > 0 ? 'var(--mui-palette-error-main)' : v < 0 ? 'var(--mui-palette-success-main)' : undefined }}>{v > 0 ? '+' : ''}{fmtNum(v)}</span>

function DebtTab({ customerId, canWrite }) {
  const [period, setPeriod] = useState(monthRange())
  const [pay, setPay] = useState(false)
  const [adj, setAdj] = useState(false)
  const { data, isFetching } = useQuery({ queryKey: ['debt-customer', customerId, period], queryFn: () => api(`/debts/customer/${customerId}`, { query: period }) })
  const s = data?.summary || {}
  const columns = [
    colFn('Ngày', r => r.date, { cell: ({ row: { original: r } }) => fmtDate(r.date) }),
    colFn('Loại', r => r.kind, { cell: ({ row: { original: r } }) => DEBT_KIND[r.kind] }),
    col('Chứng từ', 'refCode'),
    col('Nội dung', 'note'),
    colFn('Phát sinh', r => r.amount, { align: 'right', cell: ({ row: { original: r } }) => (r.kind === 'opening' ? '—' : signed(r.amount)) }),
    colFn('Dư nợ', r => r.balance, { align: 'right', cell: ({ row: { original: r } }) => fmtMoney(r.balance) })
  ]
  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <PeriodFilter value={period} onChange={setPeriod} />
        {canWrite && (
          <div className='flex gap-2'>
            <Button variant='contained' startIcon={<i className='tabler-cash' />} onClick={() => setPay(true)}>Thu nợ</Button>
            <Button variant='tonal' color='secondary' onClick={() => setAdj(true)}>Điều chỉnh</Button>
          </div>
        )}
      </div>
      <StatCards size={SIZE} cards={[
        { label: 'Dư đầu kỳ', value: s.opening, money: true, icon: 'tabler-arrow-bar-to-right', color: 'secondary' },
        { label: 'Phát sinh tăng', value: s.increase, money: true, icon: 'tabler-trending-up', color: 'warning' },
        { label: 'Đã thu / giảm', value: s.decrease, money: true, icon: 'tabler-trending-down', color: 'success' },
        { label: 'Dư cuối kỳ (còn phải thu)', value: s.closing, money: true, icon: 'tabler-report-money', color: s.closing > 0 ? 'error' : 'primary' }
      ]} />
      <Card><DataTable columns={columns} rows={data?.rows || []} loading={isFetching} /></Card>
      <PaymentDialog open={pay} onClose={() => setPay(false)} customerId={customerId} />
      <AdjustDialog open={adj} onClose={() => setAdj(false)} customerId={customerId} />
    </div>
  )
}

function ShellTab({ customerId, canWrite }) {
  const [kind, setKind] = useState(null)
  const { data, isFetching } = useQuery({ queryKey: ['shell-customer', customerId], queryFn: () => api(`/shells/customer/${customerId}`) })
  const total = (data?.holdings || []).reduce((s, h) => s + h.holding, 0)
  const hCols = [
    colFn('Loại vỏ', r => r.product?.name, {}),
    colFn('Đã giao / mượn', r => r.lent, { align: 'right', cell: ({ row: { original: r } }) => fmtNum(r.lent) }),
    colFn('Đã thu về', r => r.collected, { align: 'right', cell: ({ row: { original: r } }) => fmtNum(r.collected) }),
    colFn('Điều chỉnh / đầu kỳ', r => r.entries, { align: 'right', cell: ({ row: { original: r } }) => fmtNum(r.entries) }),
    colFn('Đang giữ', r => r.holding, { align: 'right', cell: ({ row: { original: r } }) => <b>{fmtNum(r.holding)}</b> })
  ]
  const kCols = [
    colFn('Ngày', r => r.date, { cell: ({ row: { original: r } }) => fmtDate(r.date) }),
    colFn('Loại', r => r.kind, { cell: ({ row: { original: r } }) => ({ lent: 'Giao / mượn thêm', collected: 'Thu về' }[r.kind] || SHELL_KINDS[r.kind]) }),
    col('Sản phẩm', 'product'),
    colFn('Số lượng', r => r.qty, { align: 'right', cell: ({ row: { original: r } }) => signed(r.qty) }),
    colFn('Đơn hàng / ghi chú', r => r.orderCode || r.note, {})
  ]
  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Typography variant='h6'>Vỏ đang giữ: {fmtNum(total)}</Typography>
        {canWrite && (
          <div className='flex gap-2'>
            <Button variant='tonal' onClick={() => setKind('opening')}>Số dư đầu kỳ</Button>
            <Button variant='tonal' color='secondary' onClick={() => setKind('adjust')}>Điều chỉnh</Button>
          </div>
        )}
      </div>
      <Card><DataTable columns={hCols} rows={data?.holdings || []} loading={isFetching} empty='Khách chưa phát sinh vỏ bình' /></Card>
      <Card><CardHeader title='Lịch sử phát sinh vỏ' /><DataTable columns={kCols} rows={data?.history || []} loading={isFetching} /></Card>
      <ShellEntryDialog open={!!kind} kind={kind || 'opening'} customerId={customerId} onClose={() => setKind(null)} />
    </div>
  )
}

function ResidualTab({ customerId, canWrite }) {
  const [kind, setKind] = useState(null)
  const { data, isFetching } = useQuery({ queryKey: ['residual-customer', customerId], queryFn: () => api(`/residual/customer/${customerId}`) })
  const bCols = [
    colFn('Sản phẩm', r => r.product?.name || 'Chung', {}),
    colFn('Gas dư (kg)', r => r.kg, { align: 'right', cell: ({ row: { original: r } }) => fmtNum(r.kg) })
  ]
  const hCols = [
    colFn('Ngày', r => r.date, { cell: ({ row: { original: r } }) => fmtDate(r.date) }),
    colFn('Loại', r => r.kind, { cell: ({ row: { original: r } }) => RES_KIND[r.kind] }),
    colFn('Sản phẩm', r => r.product, { cell: ({ row: { original: r } }) => r.product || '—' }),
    colFn('Kg', r => r.kg, { align: 'right', cell: ({ row: { original: r } }) => signed(r.kg) }),
    colFn('Đơn hàng / ghi chú', r => r.orderCode || r.note, {})
  ]
  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Typography variant='h6'>Gas dư hiện có: {fmtNum(data?.totalKg || 0)} kg</Typography>
        {canWrite && (
          <div className='flex gap-2'>
            <Button variant='contained' onClick={() => setKind('offset')}>Đối trừ</Button>
            <Button variant='tonal' onClick={() => setKind('opening')}>Số dư đầu kỳ</Button>
            <Button variant='tonal' color='secondary' onClick={() => setKind('adjust')}>Điều chỉnh</Button>
          </div>
        )}
      </div>
      <Card><DataTable columns={bCols} rows={data?.balances || []} loading={isFetching} empty='Khách chưa có gas dư' /></Card>
      <Card><CardHeader title='Lịch sử gas dư' /><DataTable columns={hCols} rows={data?.history || []} loading={isFetching} /></Card>
      <ResidualEntryDialog open={!!kind} kind={kind || 'offset'} customerId={customerId} onClose={() => setKind(null)} />
    </div>
  )
}

// Sổ của một khách hàng: công nợ, vỏ bình, gas dư (dùng trong hồ sơ khách)
export default function CustomerLedger({ customerId }) {
  const s = useSession()
  const canWrite = ['admin', 'accountant'].includes(s?.role)
  const [tab, setTab] = useState('debt')
  return (
    <div className='flex flex-col gap-6'>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab value='debt' label='Công nợ' icon={<i className='tabler-report-money' />} iconPosition='start' />
        <Tab value='shell' label='Vỏ bình' icon={<i className='tabler-cylinder' />} iconPosition='start' />
        <Tab value='residual' label='Gas dư' icon={<i className='tabler-droplet' />} iconPosition='start' />
      </Tabs>
      {tab === 'debt' && <DebtTab customerId={customerId} canWrite={canWrite} />}
      {tab === 'shell' && <ShellTab customerId={customerId} canWrite={canWrite} />}
      {tab === 'residual' && <ResidualTab customerId={customerId} canWrite={canWrite} />}
    </div>
  )
}
