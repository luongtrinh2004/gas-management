'use client'

import Grid from '@mui/material/Grid2'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CustomAvatar from '@core/components/mui/Avatar'
import { fmtMoney, fmtNum } from '@/utils/format'

export default function StatCards({ cards = [], size = { xs: 12, sm: 6, md: 4, xl: 2 } }) {
  return (
    <Grid container spacing={{ xs: 3, sm: 6 }}>
      {cards.map(c => (
        <Grid key={c.label} size={size}>
          <Card sx={{ height: '100%' }}>
            <CardContent className='flex items-center gap-3 !p-3 sm:!p-5 bs-full'>
              <CustomAvatar variant='rounded' skin='light' color={c.color || 'primary'} size={42}>
                <i className={`${c.icon || 'tabler-chart-bar'} text-[28px]`} />
              </CustomAvatar>
              <div className='min-is-0'>
                <Typography variant='body2'>{c.label}</Typography>
                <Typography variant='h6' className='truncate' title={c.money ? fmtMoney(c.value) : undefined}>{c.money ? fmtMoney(c.value) : fmtNum(c.value)}</Typography>
                {c.sub && <Typography variant='caption'>{c.sub}</Typography>}
              </div>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}
