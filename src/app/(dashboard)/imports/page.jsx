'use client'

import { useMemo, useState } from 'react'
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import PageHeader from '@components/app/PageHeader'
import DataTable, { col, colFn } from '@components/app/DataTable'
import DataTableToolbar from '@components/DataTableToolbar'
import FormDialog from '@components/app/FormDialog'
import StatusChip from '@components/app/StatusChip'
import { SelectField, DateField } from '@components/app/fields'
import { useList } from '@components/app/useList'
import { useOptions } from '@components/app/useOptions'
import { useAction } from '@components/app/useAction'
import { useSession } from '@components/SessionProvider'
import CustomChip from '@core/components/mui/Chip'
import ImportForm from '@views/inventory/ImportForm'
import { fmtDate, fmtMoney, fmtNum } from '@/utils/format'

const EMPTY = {}

export default function ImportsPage() {
  const s = useSession()
  const canVoid = ['admin', 'accountant'].includes(s.role)
  const list = useList('/imports', { supplier: '', status: '', from: '', to: '' })
  const sup = useOptions('/suppliers/options')
  const act = useAction()
  const [form, setForm] = useState(null) // { initial, readOnly }
  const [voiding, setVoiding] = useState(null)

  const columns = useMemo(
    () => [
      col('Số phiếu', 'code'),
      colFn('Ngày nhập', r => r.date, { cell: ({ row: { original: r } }) => fmtDate(r.date) }),
      col('Nhà cung cấp', 'supplierName'),
      colFn('Số lượng', r => r.totalQty, { align: 'right', cell: ({ row: { original: r } }) => fmtNum(r.totalQty) }),
      colFn('Kg thực tế', r => r.totalKg, { align: 'right', cell: ({ row: { original: r } }) => fmtNum(r.totalKg) }),
      colFn('Bơm', r => r.lines, {
        align: 'center',
        cell: ({ row: { original: r } }) => {
          const thieu = r.lines.filter(l => l.pump === 'thieu').length
          return <CustomChip round='true' variant='tonal' size='small' color={thieu ? 'warning' : 'success'} label={thieu ? `Thiếu ${thieu} dòng` : 'Đủ'} />
        }
      }),
      colFn('Giá trị nhập', r => r.totalValue, { align: 'right', cell: ({ row: { original: r } }) => fmtMoney(r.totalValue) }),
      colFn('Còn phải trả', r => r.debtAmount, { align: 'right', cell: ({ row: { original: r } }) => <Typography color={r.debtAmount > 0 && r.status !== 'void' ? 'warning.main' : 'text.primary'}>{fmtMoney(r.debtAmount)}</Typography> }),
      colFn('Trạng thái', r => r.status, { align: 'center', cell: ({ row: { original: r } }) => <StatusChip status={r.status} /> }),
      {
        header: 'Thao tác', id: 'actions', meta: { align: 'center' },
        cell: ({ row: { original: r } }) => (
          <div className='flex items-center justify-center gap-1'>
            <Tooltip title='Xem'><IconButton size='small' onClick={() => setForm({ initial: r, readOnly: true })}><i className='tabler-eye text-[20px]' /></IconButton></Tooltip>
            {r.status === 'confirmed' && <Tooltip title='Sửa'><IconButton size='small' onClick={() => setForm({ initial: r })}><i className='tabler-edit text-[20px]' /></IconButton></Tooltip>}
            {canVoid && r.status === 'confirmed' && <Tooltip title='Hủy phiếu'><IconButton size='small' color='error' onClick={() => setVoiding(r)}><i className='tabler-ban text-[20px]' /></IconButton></Tooltip>}
          </div>
        )
      }
    ],
    [canVoid]
  )

  return (
    <>
      <PageHeader title='Phiếu nhập hàng' subtitle='Nhập gas theo nhà cung cấp, theo dõi bơm đủ/thiếu' actions={<Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => setForm({ initial: null })}>Tạo phiếu nhập</Button>} />
      <Card>
        <DataTableToolbar search={list.search} onSearchChange={list.setSearch} limit={list.limit} onLimitChange={list.setLimit} placeholder='Tìm số phiếu, nhà cung cấp…' itemLabel='phiếu'>
          <div style={{ minWidth: 180 }}><SelectField options={sup.options} placeholder='Nhà cung cấp' value={list.filters.supplier} onChange={v => list.setFilter('supplier', v)} /></div>
          <div style={{ minWidth: 150 }}><SelectField options={[{ value: 'confirmed', label: 'Đã xác nhận' }, { value: 'void', label: 'Đã hủy' }]} placeholder='Trạng thái' value={list.filters.status} onChange={v => list.setFilter('status', v)} /></div>
          <div style={{ width: 150 }}><DateField value={list.filters.from} onChange={v => list.setFilter('from', v)} /></div>
          <div style={{ width: 150 }}><DateField value={list.filters.to} onChange={v => list.setFilter('to', v)} /></div>
        </DataTableToolbar>
        <DataTable columns={columns} rows={list.rows} total={list.total} page={list.page} limit={list.limit} onPageChange={list.onPageChange} loading={list.isFetching} />
      </Card>
      <ImportForm open={!!form} initial={form?.initial} readOnly={form?.readOnly} onClose={() => setForm(null)} />
      <FormDialog
        open={!!voiding}
        title={`Hủy phiếu nhập ${voiding?.code || ''}`}
        fields={[{ name: 'reason', label: 'Lý do hủy', type: 'textarea', required: true }]}
        initial={EMPTY}
        submitText='Xác nhận hủy'
        onClose={() => setVoiding(null)}
        onSubmit={v => act(`/imports/${voiding._id}/void`, { body: v, ok: 'Đã hủy phiếu nhập' })}
      />
    </>
  )
}
