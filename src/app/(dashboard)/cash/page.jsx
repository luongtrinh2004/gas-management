'use client'

import { useState } from 'react'
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import PageHeader from '@components/app/PageHeader'
import StatCards from '@components/app/StatCards'
import DataTable, { col, colFn } from '@components/app/DataTable'
import DataTableToolbar from '@components/DataTableToolbar'
import PeriodFilter, { monthRange } from '@components/app/PeriodFilter'
import { SelectField, toOptions } from '@components/app/fields'
import CustomChip from '@core/components/mui/Chip'
import { useList } from '@components/app/useList'
import { fmtDateTime, fmtMoney } from '@/utils/format'
import { PAY_METHODS, CASH_IN_CATEGORIES, CASH_OUT_CATEGORIES } from '@/server/constants'
import { CashDialog, VoidDialog } from '@views/finance/dialogs'

const ALL_CATS = { ...CASH_IN_CATEGORIES, ...CASH_OUT_CATEGORIES }

export default function CashPage() {
  const list = useList('/cash', { ...monthRange(), type: '', category: '', channel: '' })
  const [dlg, setDlg] = useState(null) // { type, edit }
  const [voidTx, setVoidTx] = useState(null)
  const t = list.data?.totals || {}
  const by = list.data?.byChannel || []

  const columns = [
    colFn('Ngày', r => r.date, { cell: ({ row: { original: r } }) => fmtDateTime(r.date) }),
    col('Mã phiếu', 'code'),
    colFn('Loại', r => r.type, { align: 'center', cell: ({ row: { original: r } }) => <CustomChip round='true' size='small' variant='tonal' color={r.type === 'in' ? 'success' : 'error'} label={r.type === 'in' ? 'Thu' : 'Chi'} /> }),
    colFn('Danh mục', r => r.category, { cell: ({ row: { original: r } }) => ALL_CATS[r.category] || r.category }),
    colFn('Nội dung', r => r.content, { cell: ({ row: { original: r } }) => <div className='flex flex-col'><span>{r.content || '—'}</span>{(r.customerName || r.refCode) && <span className='text-textSecondary text-sm'>{[r.customerName, r.refCode].filter(Boolean).join(' · ')}</span>}</div> }),
    colFn('Kênh tiền', r => r.channel, { cell: ({ row: { original: r } }) => <div className='flex flex-col'><span>{PAY_METHODS[r.channel]}</span>{r.accountNote && <span className='text-textSecondary text-sm'>{r.accountNote}</span>}</div> }),
    colFn('Số tiền', r => r.amount, { align: 'right', cell: ({ row: { original: r } }) => <b style={{ color: `var(--mui-palette-${r.type === 'in' ? 'success' : 'error'}-main)`, textDecoration: r.void ? 'line-through' : undefined }}>{r.type === 'in' ? '+' : '−'}{fmtMoney(r.amount)}</b> }),
    colFn('Ảnh', r => (r.attachments || []).length, { align: 'center', cell: ({ row: { original: r } }) => ((r.attachments || []).length ? <i className='tabler-paperclip' title={`${r.attachments.length} tệp`} /> : '—') }),
    {
      header: 'Thao tác', id: 'actions', meta: { align: 'center' },
      cell: ({ row: { original: r } }) =>
        r.void ? <CustomChip round='true' size='small' variant='tonal' color='secondary' label='Đã hủy' /> : r.refType === 'manual' ? (
          <div className='flex justify-center gap-1'>
            <Tooltip title='Sửa'><IconButton size='small' onClick={() => setDlg({ type: r.type, edit: r })}><i className='tabler-edit text-[20px]' /></IconButton></Tooltip>
            <Tooltip title='Hủy phiếu'><IconButton size='small' color='error' onClick={() => setVoidTx(r)}><i className='tabler-ban text-[20px]' /></IconButton></Tooltip>
          </div>
        ) : (
          <Tooltip title='Phiếu tự sinh từ chứng từ gốc, chỉ đọc'><i className='tabler-lock text-textSecondary' /></Tooltip>
        )
    }
  ]

  return (
    <>
      <PageHeader
        title='Thu chi'
        subtitle='Nguồn duy nhất của dòng tiền: thu bán hàng, thu nợ, chi nhập gas, vận hành, sửa chữa…'
        actions={
          <>
            <Button variant='contained' color='success' startIcon={<i className='tabler-plus' />} onClick={() => setDlg({ type: 'in' })}>Thêm thu</Button>
            <Button variant='contained' color='error' startIcon={<i className='tabler-minus' />} onClick={() => setDlg({ type: 'out' })}>Thêm chi</Button>
          </>
        }
      />
      <div className='mbe-6'><PeriodFilter value={{ from: list.filters.from, to: list.filters.to }} onChange={v => { list.setFilter('from', v.from); list.setFilter('to', v.to) }} /></div>
      <StatCards size={{ xs: 12, sm: 6, md: 4 }} cards={[
        { label: 'Tổng thu', value: t.in, money: true, icon: 'tabler-arrow-down-left', color: 'success' },
        { label: 'Tổng chi', value: t.out, money: true, icon: 'tabler-arrow-up-right', color: 'error' },
        { label: 'Chênh lệch thu − chi', value: t.balance, money: true, icon: 'tabler-scale', color: 'primary' }
      ]} />
      {by.length > 0 && (
        <div className='mbs-6'>
          <StatCards size={{ xs: 12, sm: 6, md: 3 }} cards={by.map(c => ({ label: PAY_METHODS[c.channel] || c.channel, value: c.balance, money: true, icon: 'tabler-wallet', color: 'info', sub: `Thu ${fmtMoney(c.in)} · Chi ${fmtMoney(c.out)}` }))} />
        </div>
      )}
      <Card className='mbs-6'>
        <DataTableToolbar search={list.search} onSearchChange={list.setSearch} limit={list.limit} onLimitChange={list.setLimit} placeholder='Tìm nội dung, mã phiếu, khách…' itemLabel='phiếu'>
          <div style={{ minWidth: 130 }}><SelectField placeholder='Thu / Chi' options={[{ value: 'in', label: 'Thu' }, { value: 'out', label: 'Chi' }]} value={list.filters.type} onChange={v => list.setFilter('type', v)} /></div>
          <div style={{ minWidth: 170 }}><SelectField placeholder='Danh mục' options={toOptions(ALL_CATS)} value={list.filters.category} onChange={v => list.setFilter('category', v)} /></div>
          <div style={{ minWidth: 170 }}><SelectField placeholder='Kênh tiền' options={toOptions(PAY_METHODS)} value={list.filters.channel} onChange={v => list.setFilter('channel', v)} /></div>
        </DataTableToolbar>
        <DataTable columns={columns} rows={list.rows} total={list.total} page={list.page} limit={list.limit} onPageChange={list.onPageChange} loading={list.isFetching} />
      </Card>
      <CashDialog open={!!dlg} type={dlg?.type} edit={dlg?.edit} onClose={() => setDlg(null)} />
      <VoidDialog open={!!voidTx} tx={voidTx} onClose={() => setVoidTx(null)} />
    </>
  )
}
