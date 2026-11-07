'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import PageHeader from '@components/app/PageHeader'
import StatusChip from '@components/app/StatusChip'
import { api } from '@/utils/api'
import { fmtDateTime } from '@/utils/format'
import { qtyText, sameDay } from '@/views/orders/shared'

const TABS = [
  { key: 'fix', label: 'Cần bổ sung', color: 'error', icon: 'tabler-alert-triangle', empty: 'Không có đơn nào cần bổ sung' },
  { key: 'today', label: 'Hôm nay', color: 'primary', icon: 'tabler-calendar-event', empty: 'Hôm nay không còn đơn cần giao' },
  { key: 'later', label: 'Sắp tới', color: 'info', icon: 'tabler-calendar-time', empty: 'Chưa có đơn sắp tới' },
  { key: 'sent', label: 'Chờ đối soát', color: 'warning', icon: 'tabler-clock-check', empty: 'Không có đơn đang chờ đối soát' },
  { key: 'done', label: 'Đã duyệt', color: 'success', icon: 'tabler-circle-check', empty: 'Hôm nay chưa có đơn nào được duyệt' }
]

function OrderCard({ o, color, onOpen }) {
  return (
    <Card sx={{ borderInlineStart: `4px solid var(--mui-palette-${color}-main)` }}>
      <CardActionArea onClick={onOpen}>
        <CardContent className='flex flex-col gap-1 !p-3'>
          <div className='flex items-start justify-between gap-2'>
            <Typography variant='subtitle1' className='min-is-0 break-words font-semibold leading-tight'>{o.customerName}</Typography>
            <div className='shrink-0'><StatusChip status={o.status} /></div>
          </div>
          <Typography variant='caption' color='text.secondary'>{o.code} · {o.deliveryAt ? fmtDateTime(o.deliveryAt) : 'Chưa hẹn giờ'}</Typography>
          {o.deliveryAddress && <div className='flex items-start gap-1.5'><i className='tabler-map-pin text-[16px] mbs-[2px] shrink-0 text-textSecondary' /><Typography variant='body2' className='line-clamp-2'>{o.deliveryAddress}</Typography></div>}
          <Typography variant='body2' className='font-medium'>{o.lines.map(l => `${l.productName} × ${qtyText(l.actualQty ?? l.plannedQty, l.unit)}`).join(' · ')}</Typography>
          {o.status === 'need_fix' && o.returnReason && <Typography variant='caption' color='error'>Cần bổ sung: {o.returnReason}</Typography>}
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

export default function DeliveriesPage() {
  const router = useRouter()
  const [tab, setTab] = useState(null)
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ['orders-mine'], queryFn: () => api('/orders/mine', { query: { limit: 100 } }), refetchInterval: 30000 })
  const rows = data?.rows || []
  const now = new Date()
  const open = rows.filter(o => ['assigned', 'delivering'].includes(o.status))
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  const today = open.filter(o => !o.deliveryAt || new Date(o.deliveryAt) <= endToday)
  const groups = {
    fix: rows.filter(o => o.status === 'need_fix'),
    today,
    later: open.filter(o => !today.includes(o)),
    sent: rows.filter(o => o.status === 'pending_review'),
    done: rows.filter(o => o.status === 'approved' && o.bookDate && sameDay(o.bookDate, now))
  }
  // Mặc định mở tab ưu tiên đầu tiên có đơn (cần bổ sung → hôm nay → sắp tới…)
  const active = tab || TABS.find(t => groups[t.key].length)?.key || 'today'
  const cur = TABS.find(t => t.key === active)
  const items = groups[active]

  return (
    <>
      <PageHeader title='Đơn giao của tôi' actions={<IconButton onClick={() => refetch()} disabled={isFetching} aria-label='Làm mới'><i className={`tabler-refresh ${isFetching ? 'animate-spin' : ''}`} /></IconButton>} />

      <div className='flex flex-wrap gap-2 mbe-3' role='tablist'>
        {TABS.map(t => {
          const on = t.key === active
          const n = groups[t.key].length
          return (
            <Button
              key={t.key}
              role='tab'
              aria-selected={on}
              color={t.color}
              variant={on ? 'contained' : 'tonal'}
              onClick={() => setTab(t.key)}
              sx={{ minBlockSize: 36, borderRadius: 5, px: 2.5, py: 0.5, fontSize: '0.8125rem', lineHeight: 1.2, whiteSpace: 'nowrap' }}
            >
              {t.label}
              <span className='mis-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-semibold min-is-[20px] bs-[20px] pli-1' style={{ background: on ? 'rgba(255,255,255,0.3)' : `var(--mui-palette-${t.color}-main)`, color: on ? 'inherit' : '#fff' }}>{n}</span>
            </Button>
          )
        })}
      </div>

      {isLoading && <div className='flex justify-center plb-6'><CircularProgress /></div>}
      <div className='flex flex-col gap-2.5 max-is-[720px]'>
        {items.map(o => <OrderCard key={o._id} o={o} color={cur.color} onOpen={() => router.push(`/orders/${o._id}`)} />)}
        {!isLoading && !items.length && (
          <div className='flex flex-col items-center gap-2 plb-10 text-center'>
            <i className={`${cur.icon} text-[40px]`} style={{ color: `var(--mui-palette-${cur.color}-main)`, opacity: 0.6 }} />
            <Typography color='text.secondary'>{cur.empty}</Typography>
          </div>
        )}
      </div>
    </>
  )
}
