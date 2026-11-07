'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import CustomTextField from '@core/components/mui/TextField'
import { api } from '@/utils/api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api('/auth/login', { method: 'POST', body: { email, password } })
      window.location.href = '/home'
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <Box className='flex items-center justify-center min-bs-[100dvh] p-4' sx={{ bgcolor: 'background.default' }}>
      <Card className='is-full max-is-[440px]'>
        <CardContent className='flex flex-col gap-5 p-6 sm:p-10'>
          <div className='flex flex-col gap-1'>
            <div className='flex items-center gap-2'>
              <i className='tabler-flame text-[32px]' style={{ color: 'var(--mui-palette-primary-main)' }} />
              <Typography variant='h4' color='primary'>
                Gas Management
              </Typography>
            </div>
            <Typography variant='h5'>Đăng nhập hệ thống</Typography>
            <Typography variant='body2'>Hệ thống quản lý gas</Typography>
          </div>
          {error && <Alert severity='error'>{error}</Alert>}
          <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
            <CustomTextField autoFocus label='Email' type='email' value={email} onChange={e => setEmail(e.target.value)} fullWidth required />
            <CustomTextField label='Mật khẩu' type='password' value={password} onChange={e => setPassword(e.target.value)} fullWidth required />
            <Button type='submit' variant='contained' fullWidth disabled={loading}>
              {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}
