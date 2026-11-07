'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import Tab from '@mui/material/Tab'
import Typography from '@mui/material/Typography'
import TabContext from '@mui/lab/TabContext'
import CustomTabList from '@core/components/mui/TabList'
import PageHeader from '@components/app/PageHeader'
import DataTable from '@components/app/DataTable'
import PeriodFilter, { monthRange } from '@components/app/PeriodFilter'
import { SelectField } from '@components/app/fields'
import { api } from '@/utils/api'
import { downloadFile } from '@/utils/download'
import { fmtMoney, fmtNum } from '@/utils/format'

const TABS = [
  ['sales', 'Bán hàng', 'tabler-shopping-cart'],
  ['delivery', 'Giao hàng', 'tabler-truck-delivery'],
  ['import', 'Nhập hàng', 'tabler-building-warehouse'],
  ['debt', 'Công nợ', 'tabler-report-money'],
  ['shells', 'Vỏ bình', 'tabler-cylinder'],
  ['residual', 'Gas dư', 'tabler-droplet'],
  ['cash', 'Thu chi', 'tabler-wallet'],
  ['materials', 'Vật tư', 'tabler-package'],
  ['maintenance', 'Bảo trì', 'tabler-tool']
]

const fmt = (c, v) => {
  if (v == null || v === '') return c.money || c.num ? '' : '—'
  if (c.money) return fmtMoney(v)
  if (c.num) return fmtNum(Math.round(Number(v) * 100) / 100)
  return v
}

export default function ReportsPage() {
  const [type, setType] = useState('sales')
  const [p, setP] = useState(monthRange())
  const [groupBy, setGroupBy] = useState('customer')
  const [busy, setBusy] = useState(false)
  const query = { ...p, ...(type === 'sales' ? { groupBy } : {}) }
  const { data, isFetching, error } = useQuery({ queryKey: ['report', type, query], queryFn: () => api(`/reports/${type}`, { query }) })

  const columns = (data?.columns || []).map(c => ({ header: c.header, id: c.key, accessorFn: r => r[c.key], meta: { align: c.align }, cell: ({ row: { original: r } }) => (r.__total ? <b>{fmt(c, r[c.key])}</b> : fmt(c, r[c.key])) }))
  const rows = data ? [...data.rows, ...(data.totals ? [{ ...data.totals, __total: true }] : [])] : []

  const exportXlsx = async () => {
    setBusy(true)
    try {
      await downloadFile(`/reports/${type}/export`, query, `Bao-cao-${type}-${p.from}-${p.to}.xlsx`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title='Báo cáo' subtitle='Tổng hợp tự động từ dữ liệu gốc theo ngày / tháng; xuất Excel để đối chiếu' />
      <TabContext value={type}>
        <CustomTabList onChange={(_, v) => setType(v)} variant='scrollable' pill='true' className='mbe-4'>
          {TABS.map(([v, l, i]) => <Tab key={v} value={v} label={l} icon={<i className={i} />} iconPosition='start' />)}
        </CustomTabList>
      </TabContext>
      <Card>
        <div className='p-4 flex flex-wrap items-center justify-between gap-3'>
          <PeriodFilter value={p} onChange={setP}>
            {type === 'sales' && <div style={{ width: 170 }}><SelectField allowEmpty={false} options={[{ value: 'customer', label: 'Gộp theo khách hàng' }, { value: 'day', label: 'Gộp theo ngày' }]} value={groupBy} onChange={setGroupBy} /></div>}
          </PeriodFilter>
          <Button variant='tonal' disabled={busy || !data} startIcon={<i className='tabler-file-spreadsheet' />} onClick={exportXlsx}>{busy ? 'Đang xuất…' : 'Xuất Excel'}</Button>
        </div>
        {error && <Typography color='error' className='p-4'>{error.message}</Typography>}
        <DataTable columns={columns} rows={rows} loading={isFetching} empty='Không có dữ liệu trong kỳ' />
      </Card>
    </>
  )
}
