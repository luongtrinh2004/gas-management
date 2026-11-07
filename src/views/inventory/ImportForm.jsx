'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Dialog from '@mui/material/Dialog'
import useMediaQuery from '@mui/material/useMediaQuery'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid2'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { Text, MoneyField, SelectField, DateField } from '@components/app/fields'
import FileUpload from '@components/app/FileUpload'
import { useOptions } from '@components/app/useOptions'
import { useAction } from '@components/app/useAction'
import { PAY_METHODS } from '@/server/constants'
import { api } from '@/utils/api'
import { fmtMoney, fmtNum } from '@/utils/format'

const emptyLine = () => ({ product: '', qty: '', kgDocument: '', kgActual: '', pricePerKg: '', shellsReturned: '' })
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

// Phiếu nhập: tạo / sửa / xem (readOnly)
export default function ImportForm({ open, onClose, initial, readOnly }) {
  const fullScreen = useMediaQuery(theme => theme.breakpoints.down('md'))
  const act = useAction()
  const sup = useOptions('/suppliers/options')
  const prod = useOptions('/products/options', undefined, r => ({ value: r._id, label: `${r.code ? r.code + ' – ' : ''}${r.name}` }))
  const { data: meta } = useQuery({ queryKey: ['imports-meta'], queryFn: () => api('/imports/meta'), staleTime: 60_000 })
  const [v, setV] = useState({})
  const [lines, setLines] = useState([emptyLine()])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const basis = initial?.valueBasis || meta?.valueBasis || 'actual'

  useEffect(() => {
    if (!open) return
    setError('')
    if (initial) {
      setV({ supplier: initial.supplier, date: (initial.date || '').slice(0, 10), paidAmount: initial.paidAmount, payMethod: initial.payMethod, note: initial.note, attachments: initial.attachments || [] })
      setLines(initial.lines.map(l => ({ product: l.product, qty: l.qty, kgDocument: l.kgDocument, kgActual: l.kgActual, pricePerKg: l.pricePerKg, shellsReturned: l.shellsReturned })))
    } else {
      setV({ date: today(), payMethod: 'cash', paidAmount: '', attachments: [] })
      setLines([emptyLine()])
    }
  }, [open, initial])

  const set = (k, x) => setV(s => ({ ...s, [k]: x }))
  const setLine = (i, k, x) => setLines(ls => ls.map((l, j) => (j === i ? { ...l, [k]: x } : l)))
  const lineVal = l => Math.round(Number(l.pricePerKg || 0) * Number((basis === 'document' ? l.kgDocument : l.kgActual) || 0))
  const total = lines.reduce((s, l) => s + lineVal(l), 0)
  const paid = Number(v.paidAmount || 0)

  const submit = async e => {
    e.preventDefault()
    if (!v.supplier) return setError('Vui lòng chọn nhà cung cấp')
    if (!v.date) return setError('Vui lòng chọn ngày nhập')
    if (lines.some(l => !l.product)) return setError('Mỗi dòng cần chọn sản phẩm')
    setSaving(true)
    setError('')
    try {
      const body = { ...v, lines }
      await act(initial?._id ? `/imports/${initial._id}` : '/imports', { method: initial?._id ? 'PUT' : 'POST', body, ok: 'Đã lưu phiếu nhập' })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const num = (i, k, label, w) => <Text type='number' label={label} value={lines[i][k] ?? ''} disabled={readOnly} onChange={e => setLine(i, k, e.target.value)} inputProps={{ min: 0, step: 'any' }} />

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth fullScreen={fullScreen} maxWidth='lg'>
      <form onSubmit={submit}>
        <DialogTitle variant='h5'>{readOnly ? `Phiếu nhập ${initial?.code}` : initial?._id ? `Sửa phiếu nhập ${initial.code}` : 'Tạo phiếu nhập'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity='error' className='mbe-4'>{error}</Alert>}
          <Grid container spacing={4} className='pbs-2'>
            <Grid size={{ xs: 12, sm: 6 }}><SelectField label='Nhà cung cấp *' options={sup.options} value={v.supplier} onChange={x => set('supplier', x)} disabled={readOnly} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><DateField label='Ngày nhập *' value={v.date} onChange={x => set('date', x)} disabled={readOnly} /></Grid>
            <Grid size={12}>
              <Typography variant='h6' className='mbe-2'>Dòng sản phẩm</Typography>
              <div className='flex flex-col gap-4'>
                {lines.map((l, i) => {
                  const p = prod.raw.find(x => x._id === l.product)
                  const nominal = p?.kgPerUnit ? Number(l.qty || 0) * p.kgPerUnit : null
                  const diff = Number(l.kgActual || 0) - Number(l.kgDocument || 0)
                  return (
                    <div key={i} className='rounded border p-3'>
                      <Grid container spacing={3} alignItems='center'>
                        <Grid size={{ xs: 12, md: 3 }}><SelectField label='Sản phẩm' options={prod.options} value={l.product} onChange={x => setLine(i, 'product', x)} disabled={readOnly} /></Grid>
                        <Grid size={{ xs: 6, md: 1.5 }}>{num(i, 'qty', 'SL bình/thùng')}</Grid>
                        <Grid size={{ xs: 6, md: 1.5 }}>{num(i, 'kgDocument', 'Kg chứng từ')}</Grid>
                        <Grid size={{ xs: 6, md: 1.5 }}>{num(i, 'kgActual', 'Kg thực tế')}</Grid>
                        <Grid size={{ xs: 6, md: 2 }}><MoneyField label='Đơn giá/kg' unit='' value={l.pricePerKg} onChange={x => setLine(i, 'pricePerKg', x)} disabled={readOnly} /></Grid>
                        <Grid size={{ xs: 6, md: 1.5 }}>{num(i, 'shellsReturned', 'Vỏ trả NCC')}</Grid>
                        <Grid size={{ xs: 6, md: 1 }} className='flex justify-end'>
                          {!readOnly && lines.length > 1 && <IconButton color='error' onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}><i className='tabler-trash' /></IconButton>}
                        </Grid>
                      </Grid>
                      <div className='flex flex-wrap items-center gap-3 mbs-2'>
                        {nominal != null && <Typography variant='caption'>Danh định: {fmtNum(nominal)} kg</Typography>}
                        {(l.kgDocument !== '' || l.kgActual !== '') && (
                          <Chip size='small' variant='tonal' color={diff >= 0 ? 'success' : 'warning'} label={diff >= 0 ? `Bơm đủ (${diff > 0 ? '+' : ''}${fmtNum(diff)} kg)` : `Bơm thiếu (${fmtNum(diff)} kg)`} />
                        )}
                        <Typography variant='caption'>Giá trị dòng: {fmtMoney(lineVal(l))}</Typography>
                      </div>
                    </div>
                  )
                })}
              </div>
              {!readOnly && <Button className='mbs-3' variant='tonal' startIcon={<i className='tabler-plus' />} onClick={() => setLines(ls => [...ls, emptyLine()])}>Thêm dòng</Button>}
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}><MoneyField label='Đã thanh toán NCC' value={v.paidAmount} onChange={x => set('paidAmount', x)} disabled={readOnly} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><SelectField label='Hình thức chi' allowEmpty={false} options={Object.entries(PAY_METHODS).map(([value, label]) => ({ value, label }))} value={v.payMethod} onChange={x => set('payMethod', x)} disabled={readOnly} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant='body2'>Tổng giá trị nhập ({basis === 'document' ? 'theo kg chứng từ' : 'theo kg thực tế'})</Typography>
              <Typography variant='h5'>{fmtMoney(total)}</Typography>
              <Typography variant='caption' color={total - paid > 0 ? 'warning.main' : 'text.secondary'}>Còn phải trả NCC: {fmtMoney(total - paid)}</Typography>
            </Grid>
            <Grid size={12}><Text label='Ghi chú' multiline minRows={2} value={v.note ?? ''} disabled={readOnly} onChange={e => set('note', e.target.value)} /></Grid>
            <Grid size={12}><FileUpload label='Chứng từ / phiếu cân' value={v.attachments} onChange={x => set('attachments', x)} readOnly={readOnly} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 5 }}>
          <Button variant='tonal' color='secondary' onClick={onClose} disabled={saving}>{readOnly ? 'Đóng' : 'Hủy bỏ'}</Button>
          {!readOnly && <Button type='submit' variant='contained' disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu phiếu nhập'}</Button>}
        </DialogActions>
      </form>
    </Dialog>
  )
}
