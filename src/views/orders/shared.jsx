'use client'

import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import MenuItem from '@mui/material/MenuItem'
import { Text } from '@components/app/fields'
import { useOptions } from '@components/app/useOptions'
import { UNITS } from '@/server/constants'

export const unitLabel = u => (UNITS[u] || u || '').toLowerCase()
export const qtyText = (q, u) => (q == null ? '—' : `${Number(q).toLocaleString('vi-VN')} ${unitLabel(u)}`)

// datetime-local <-> ISO
export const toLocalInput = d => {
  if (!d) return ''
  const x = new Date(d)
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()

// Hộp thoại nhập lý do (trả lại / hủy / điều chỉnh)
export function ReasonDialog({ open, title, label = 'Lý do', confirmText = 'Xác nhận', color = 'primary', onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) { setReason(''); setErr('') }
  }, [open])
  const go = async () => {
    if (!reason.trim()) return setErr(`Vui lòng nhập ${label.toLowerCase()}`)
    setBusy(true)
    try {
      await onSubmit(reason.trim())
      onClose()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth='xs'>
      <DialogTitle variant='h5'>{title}</DialogTitle>
      <DialogContent>
        {err && <Alert severity='error' className='mbe-3'>{err}</Alert>}
        <Text multiline minRows={3} label={`${label} *`} value={reason} onChange={e => setReason(e.target.value)} autoFocus />
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 5 }}>
        <Button variant='tonal' color='secondary' disabled={busy} onClick={onClose}>Hủy bỏ</Button>
        <Button variant='contained' color={color} disabled={busy} onClick={go}>{busy ? 'Đang xử lý…' : confirmText}</Button>
      </DialogActions>
    </Dialog>
  )
}

// Chọn nhân viên giao hàng (một hoặc nhiều)
export function DriverSelect({ value = [], onChange, label = 'Nhân viên giao hàng', helperText }) {
  const { options } = useOptions('/users/options', { role: 'driver' }, u => ({ value: u._id, label: u.name }))
  return (
    <Text select label={label} helperText={helperText} value={value} SelectProps={{ multiple: true }} onChange={e => onChange(e.target.value)}>
      {options.map(o => (<MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>))}
    </Text>
  )
}

export function AssignDialog({ open, current = [], onClose, onSubmit }) {
  const [ids, setIds] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) { setIds(current.map(a => a._id || a)); setErr('') }
  }, [open])
  const go = async () => {
    if (!ids.length) return setErr('Chọn ít nhất một nhân viên giao hàng')
    setBusy(true)
    try {
      await onSubmit(ids)
      onClose()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth='xs'>
      <DialogTitle variant='h5'>Phân công giao hàng</DialogTitle>
      <DialogContent>
        {err && <Alert severity='error' className='mbe-3'>{err}</Alert>}
        <DriverSelect value={ids} onChange={setIds} />
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 5 }}>
        <Button variant='tonal' color='secondary' disabled={busy} onClick={onClose}>Hủy bỏ</Button>
        <Button variant='contained' disabled={busy} onClick={go}>{busy ? 'Đang lưu…' : 'Phân công'}</Button>
      </DialogActions>
    </Dialog>
  )
}
