'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid2'
import Button from '@mui/material/Button'
import PageHeader from '@components/app/PageHeader'
import StatCards from '@components/app/StatCards'
import Typography from '@mui/material/Typography'
import StockChart from '@components/app/StockChart'
import { fmtMoney } from '@/utils/format'
import { useSession } from '@components/SessionProvider'
import { api } from '@/utils/api'
import { ROLES } from '@/server/constants'

export default function HomePage() {
  const s = useSession()
  const router = useRouter()
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: () => api('/orders/dashboard'), refetchInterval: 60000 })
  const isDriver = s.role === 'driver'
  const rev = (data?.trend || []).map(t => t.revenue)
  const total = rev.reduce((a, b) => a + b, 0)
  const prev = rev.length > 1 ? rev[rev.length - 2] : 0
  const pct = prev > 0 ? ((rev[rev.length - 1] - prev) / prev) * 100 : null
  const up = pct == null || pct >= 0
  return (
    <>
      <PageHeader
        title={`Xin chào, ${s.name}`}
        subtitle={`Tổng quan hoạt động – ${ROLES[s.role]}`}
        actions={
          <>
            {isDriver && <Button variant='contained' startIcon={<i className='tabler-truck-delivery' />} onClick={() => router.push('/deliveries')}>Đơn giao của tôi</Button>}
            {['admin', 'office'].includes(s.role) && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => router.push('/orders/new')}>Tạo đơn</Button>}
            {!isDriver && <Button variant='tonal' startIcon={<i className='tabler-checklist' />} onClick={() => router.push('/reconcile')}>Chờ đối soát</Button>}
          </>
        }
      />
      <StatCards cards={data?.cards || []} size={isDriver ? { xs: 6, lg: 3 } : { xs: 12, sm: 6, md: 4, xl: 3 }} />
      {data?.trend && (
        <Grid container spacing={6} className='mbs-6'>
          <Grid size={12}>
            <Card>
              <CardHeader title='Doanh thu 7 ngày gần nhất' subheader='Tính theo đơn đã duyệt, ngày hạch toán là ngày giao' />
              <CardContent>
                <div className='flex flex-wrap items-end gap-x-6 gap-y-1 mbe-2'>
                  <div>
                    <Typography variant='caption' color='text.secondary'>Tổng 7 ngày</Typography>
                    <Typography variant='h4'>{fmtMoney(total)}</Typography>
                  </div>
                  <div className='flex items-center gap-1 mbe-1' style={{ color: up ? '#28C76F' : '#FF4C51' }}>
                    <i className={up ? 'tabler-trending-up text-[22px]' : 'tabler-trending-down text-[22px]'} />
                    <Typography component='span' variant='h6' sx={{ color: 'inherit' }}>{pct == null ? '—' : `${up ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%`}</Typography>
                    <Typography component='span' variant='body2' color='text.secondary'>so với hôm trước</Typography>
                  </div>
                </div>
                <StockChart categories={data.trend.map(t => t.label)} data={data.trend.map(t => t.revenue)} height={300} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </>
  )
}
