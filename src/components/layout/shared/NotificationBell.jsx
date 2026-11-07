'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Badge from '@mui/material/Badge'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import { api } from '@/utils/api'
import { fmtDateTime } from '@/utils/format'

export default function NotificationBell() {
  const [anchor, setAnchor] = useState(null)
  const router = useRouter()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api('/notifications'), refetchInterval: 30000 })

  const readAll = async () => {
    await api('/notifications/read-all', { method: 'POST' })
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <>
      <IconButton onClick={e => setAnchor(e.currentTarget)} aria-label='Thông báo'>
        <Badge color='error' badgeContent={data?.unread || 0} max={99}>
          <i className='tabler-bell text-[22px]' />
        </Badge>
      </IconButton>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} slotProps={{ paper: { sx: { width: { xs: 'calc(100vw - 32px)', sm: 380 }, maxHeight: 480 } } }}>
        <Box className='flex items-center justify-between p-4'>
          <Typography variant='h6'>Thông báo</Typography>
          <Button size='small' onClick={readAll} disabled={!data?.unread}>
            Đánh dấu đã đọc
          </Button>
        </Box>
        <Divider />
        {(data?.rows || []).length === 0 && (
          <Typography className='p-6' variant='body2' color='text.secondary' align='center'>
            Chưa có thông báo
          </Typography>
        )}
        {(data?.rows || []).map(n => (
          <Box
            key={n._id}
            onClick={() => {
              setAnchor(null)
              if (n.link) router.push(n.link)
            }}
            className='p-4 cursor-pointer'
            sx={{ borderBottom: '1px solid var(--mui-palette-divider)', bgcolor: n.read ? 'transparent' : 'rgba(115, 103, 240, 0.06)', '&:hover': { bgcolor: 'action.hover' } }}
          >
            <Typography variant='body2' color='text.primary'>
              {n.message}
            </Typography>
            <Typography variant='caption' color='text.disabled'>
              {fmtDateTime(n.createdAt)}
            </Typography>
          </Box>
        ))}
      </Popover>
    </>
  )
}
