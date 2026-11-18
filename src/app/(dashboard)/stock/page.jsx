'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import PageHeader from '@components/app/PageHeader'
import DataTable, { col, colFn } from '@components/app/DataTable'
import PeriodFilter, { monthRange } from '@components/app/PeriodFilter'
import StatCards from '@components/app/StatCards'
import { api } from '@/utils/api'
import { fmtNum } from '@/utils/format'
import { UNITS } from '@/server/constants'

const columns = [
  colFn('Sản phẩm', (r) => r.product.name, {
    cell: ({ row: { original: r } }) =>
      `${r.product.code ? r.product.code + ' – ' : ''}${r.product.name}`,
  }),
  colFn('ĐVT', (r) => r.product.unit, {
    align: 'center',
    cell: ({ row: { original: r } }) =>
      r.product.unit === 'kg' ? UNITS.binh : UNITS[r.product.unit],
  }),
  colFn('Tồn đầu kỳ', (r) => r.opening, {
    align: 'right',
    cell: ({ row: { original: r } }) => fmtNum(r.opening),
  }),
  colFn('Nhập trong kỳ', (r) => r.in, {
    align: 'right',
    cell: ({ row: { original: r } }) => fmtNum(r.in),
  }),
  colFn('Kg nhập (thực tế)', (r) => r.kgIn, {
    align: 'right',
    cell: ({ row: { original: r } }) => fmtNum(r.kgIn),
  }),
  colFn('Xuất trong kỳ', (r) => r.out, {
    align: 'right',
    cell: ({ row: { original: r } }) => fmtNum(Math.round(r.out * 100) / 100),
  }),
  colFn('Tồn cuối kỳ', (r) => r.closing, {
    align: 'right',
    cell: ({ row: { original: r } }) => (
      <b
        style={{
          color: r.closing < 0 ? 'var(--mui-palette-error-main)' : undefined,
        }}
      >
        {fmtNum(Math.round(r.closing * 100) / 100)}
      </b>
    ),
  }),
]

export default function StockPage() {
  const [p, setP] = useState(monthRange())
  const { data, isFetching } = useQuery({
    queryKey: ['stock', p],
    queryFn: () => api('/stock', { query: p }),
  })
  const rows = data?.rows || []
  const t = (k) => rows.reduce((s, r) => s + r[k], 0)
  return (
    <>
      <PageHeader
        title='Nhập – xuất – tồn'
        subtitle='Tồn kho gas theo bình/thùng. Nhập: phiếu nhập đã xác nhận · Xuất: đơn hàng đã duyệt (bán theo kg được quy đổi ra bình)'
      />
      <StatCards
        size={{ xs: 12, sm: 6, md: 3 }}
        cards={[
          {
            label: 'Tồn đầu kỳ',
            value: t('opening'),
            icon: 'tabler-building-warehouse',
            color: 'secondary',
          },
          {
            label: 'Nhập trong kỳ',
            value: t('in'),
            icon: 'tabler-arrow-down-left',
            color: 'success',
          },
          {
            label: 'Xuất trong kỳ',
            value: Math.round(t('out') * 100) / 100,
            icon: 'tabler-arrow-up-right',
            color: 'warning',
          },
          {
            label: 'Tồn cuối kỳ',
            value: Math.round(t('closing') * 100) / 100,
            icon: 'tabler-packages',
            color: t('closing') < 0 ? 'error' : 'primary',
          },
        ]}
      />
      <Card className='mbs-6'>
        <div className='p-4'>
          <PeriodFilter value={p} onChange={setP} />
        </div>
        <DataTable columns={columns} rows={rows} loading={isFetching} />
      </Card>
    </>
  )
}
