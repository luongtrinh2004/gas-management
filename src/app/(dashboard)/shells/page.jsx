'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import PageHeader from '@components/app/PageHeader'
import StatCards from '@components/app/StatCards'
import DataTable, { colFn } from '@components/app/DataTable'
import DataTableToolbar from '@components/DataTableToolbar'
import CustomChip from '@core/components/mui/Chip'
import { useList } from '@components/app/useList'
import { useSession } from '@components/SessionProvider'
import { fmtNum } from '@/utils/format'
import { ShellEntryDialog, ResidualEntryDialog } from '@views/finance/dialogs'

const SIZE = { xs: 12, sm: 6, md: 4, xl: 2 }

function ShellsTab({ canWrite }) {
  const router = useRouter()
  const list = useList('/shells')
  const [kind, setKind] = useState(null)
  const sm = list.data?.summary || {}
  const columns = [
    colFn('Khách hàng', r => r.customer.name, { cell: ({ row: { original: r } }) => <div className='flex flex-col'><span className='font-medium'>{r.customer.name}</span><span className='text-textSecondary text-sm'>{r.customer.code}</span></div> }),
    colFn('Vỏ đang giữ theo loại', r => r.byProduct, { cell: ({ row: { original: r } }) => <div className='flex flex-wrap gap-1'>{r.byProduct.map((p, i) => <CustomChip key={i} round='true' size='small' variant='tonal' color={p.holding > 0 ? 'primary' : 'secondary'} label={`${p.product?.name}: ${fmtNum(p.holding)}`} />)}</div> }),
    colFn('Tổng đang giữ', r => r.totalHolding, { align: 'right', cell: ({ row: { original: r } }) => <b>{fmtNum(r.totalHolding)}</b> })
  ]
  return (
    <div className='flex flex-col gap-6'>
      <StatCards size={SIZE} cards={[
        { label: 'Vỏ đã giao / mượn', value: sm.delivered, icon: 'tabler-truck-delivery', color: 'primary' },
        { label: 'Vỏ đã thu về', value: sm.collected, icon: 'tabler-arrow-back-up', color: 'success' },
        { label: 'Vỏ đang ở khách', value: sm.atCustomers, icon: 'tabler-cylinder', color: 'warning' },
        { label: 'Vỏ trả nhà cung cấp', value: sm.returnedToSupplier, icon: 'tabler-building-factory-2', color: 'info' },
        { label: 'Chênh lệch kiểm kê', value: sm.stocktakeDiff, icon: 'tabler-scale', color: 'error' }
      ]} />
      <Card>
        <DataTableToolbar search={list.search} onSearchChange={list.setSearch} limit={list.limit} onLimitChange={list.setLimit} placeholder='Tìm khách hàng…' itemLabel='khách'>
          {canWrite && (
            <>
              <Button variant='tonal' onClick={() => setKind('supplier_return')}>Trả vỏ NCC</Button>
              <Button variant='tonal' color='warning' onClick={() => setKind('stocktake')}>Chênh lệch kiểm kê</Button>
              <Button variant='tonal' color='secondary' onClick={() => setKind('opening')}>Vỏ đầu kỳ khách</Button>
            </>
          )}
        </DataTableToolbar>
        <DataTable columns={columns} rows={list.rows} total={list.total} page={list.page} limit={list.limit} onPageChange={list.onPageChange} loading={list.isFetching} onRowClick={r => router.push(`/customers/${r.customer._id}`)} />
      </Card>
      <ShellEntryDialog open={!!kind} kind={kind || 'opening'} onClose={() => setKind(null)} />
    </div>
  )
}

function ResidualTab({ canWrite }) {
  const router = useRouter()
  const list = useList('/residual')
  const [kind, setKind] = useState(null)
  const columns = [
    colFn('Khách hàng', r => r.customer.name, { cell: ({ row: { original: r } }) => <div className='flex flex-col'><span className='font-medium'>{r.customer.name}</span><span className='text-textSecondary text-sm'>{r.customer.code}</span></div> }),
    colFn('Theo sản phẩm', r => r.byProduct, { cell: ({ row: { original: r } }) => <div className='flex flex-wrap gap-1'>{r.byProduct.map((p, i) => <CustomChip key={i} round='true' size='small' variant='tonal' color='info' label={`${p.product?.name || 'Chung'}: ${fmtNum(p.kg)} kg`} />)}</div> }),
    colFn('Tổng gas dư (kg)', r => r.totalKg, { align: 'right', cell: ({ row: { original: r } }) => <b>{fmtNum(r.totalKg)}</b> })
  ]
  return (
    <div className='flex flex-col gap-6'>
      <StatCards size={SIZE} cards={[{ label: 'Tổng gas dư đang theo dõi (kg)', value: list.data?.summary?.totalKg, icon: 'tabler-droplet', color: 'info' }]} />
      <Card>
        <DataTableToolbar search={list.search} onSearchChange={list.setSearch} limit={list.limit} onLimitChange={list.setLimit} placeholder='Tìm khách hàng…' itemLabel='khách'>
          {canWrite && (
            <>
              <Button variant='contained' onClick={() => setKind('offset')}>Đối trừ gas dư</Button>
              <Button variant='tonal' color='secondary' onClick={() => setKind('opening')}>Gas dư đầu kỳ</Button>
            </>
          )}
        </DataTableToolbar>
        <DataTable columns={columns} rows={list.rows} total={list.total} page={list.page} limit={list.limit} onPageChange={list.onPageChange} loading={list.isFetching} onRowClick={r => router.push(`/customers/${r.customer._id}`)} />
      </Card>
      <ResidualEntryDialog open={!!kind} kind={kind || 'offset'} onClose={() => setKind(null)} />
    </div>
  )
}

export default function ShellsPage() {
  const s = useSession()
  const canWrite = ['admin', 'accountant'].includes(s.role)
  const [tab, setTab] = useState('shell')
  return (
    <>
      <PageHeader title='Vỏ bình & gas dư' subtitle='Theo dõi riêng từng nhóm, truy ngược về đơn hàng' />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} className='mbe-6'>
        <Tab value='shell' label='Vỏ bình' icon={<i className='tabler-cylinder' />} iconPosition='start' />
        <Tab value='residual' label='Gas dư' icon={<i className='tabler-droplet' />} iconPosition='start' />
      </Tabs>
      {tab === 'shell' ? <ShellsTab canWrite={canWrite} /> : <ResidualTab canWrite={canWrite} />}
    </>
  )
}
