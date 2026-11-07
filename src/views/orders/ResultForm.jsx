'use client'

import { useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid2'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import { Text, MoneyField, SelectField } from '@components/app/fields'
import FileUpload from '@components/app/FileUpload'
import { useAction } from '@components/app/useAction'
import { fmtMoney } from '@/utils/format'
import { PAY_METHODS } from '@/server/constants'
import { unitLabel, qtyText, toLocalInput } from './shared'

const big = { '& .MuiInputBase-input': { fontSize: '1.125rem', paddingBlock: '12px' } }
const num = v => (v === '' || v == null ? 0 : Number(v))

// Nhập kết quả giao hàng (ưu tiên điện thoại)
export default function ResultForm({ order }) {
  const act = useAction()
  const d = order.delivery || {}
  const [lines, setLines] = useState(order.lines.map(l => ({ _id: l._id, actualQty: l.actualQty ?? l.plannedQty, shellsCollected: l.shellsCollected || 0, shellsLent: l.shellsLent || 0, residualKg: l.residualKg || 0 })))
  const [paid, setPaid] = useState(d.paidAmount ?? 0)
  const [payMethod, setPayMethod] = useState(d.payMethod || 'cash')
  const [accountNote, setAccountNote] = useState(d.payAccountNote || '')
  const [note, setNote] = useState(d.note || '')
  const [deliveredAt, setDeliveredAt] = useState(toLocalInput(d.deliveredAt || new Date()))
  const [atts, setAtts] = useState(order.attachments || [])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const setL = (i, k, v) => setLines(ls => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  const total = order.lines.reduce((s, l, i) => s + Math.round(num(lines[i].actualQty) * num(l.price)), 0)

  const submit = async () => {
    setError('')
    if (num(paid) > total) return setError('Số tiền đã thu lớn hơn thành tiền của đơn')
    if (!atts.length) return setError('Vui lòng chụp ảnh hóa đơn trước khi gửi')
    setBusy(true)
    try {
      await act(`/orders/${order._id}/result`, {
        body: { lines, attachments: atts, delivery: { deliveredAt: new Date(deliveredAt).toISOString(), note, paidAmount: num(paid), payMethod: num(paid) > 0 ? payMethod : undefined, payAccountNote: accountNote } },
        ok: 'Đã gửi kết quả giao hàng'
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader title='Kết quả giao hàng' subheader='Nhập số liệu thực tế tại điểm giao. Văn phòng sẽ đối soát trước khi ghi sổ.' />
      <CardContent className='flex flex-col gap-5'>
        {error && <Alert severity='error'>{error}</Alert>}
        {order.lines.map((l, i) => (
          <div key={l._id} className='rounded border p-3 flex flex-col gap-3'>
            <div className='flex items-center justify-between'>
              <Typography variant='h6'>{l.productName}</Typography>
              <Typography variant='body2' color='text.secondary'>Dự kiến: {qtyText(l.plannedQty, l.unit)}</Typography>
            </div>
            <Grid container spacing={3}>
              <Grid size={12}>
                <Text sx={big} type='number' label={`Số lượng thực giao (${unitLabel(l.unit)}) *`} value={lines[i].actualQty} onChange={e => setL(i, 'actualQty', e.target.value)} inputProps={{ min: 0, step: 'any', inputMode: 'decimal' }} />
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Text sx={big} type='number' label='Vỏ thu về' value={lines[i].shellsCollected} onChange={e => setL(i, 'shellsCollected', e.target.value)} inputProps={{ min: 0, inputMode: 'numeric' }} />
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Text sx={big} type='number' label='Vỏ giao/mượn' value={lines[i].shellsLent} onChange={e => setL(i, 'shellsLent', e.target.value)} inputProps={{ min: 0, inputMode: 'numeric' }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Text sx={big} type='number' label='Gas dư (kg)' value={lines[i].residualKg} onChange={e => setL(i, 'residualKg', e.target.value)} inputProps={{ min: 0, step: 'any', inputMode: 'decimal' }} />
              </Grid>
            </Grid>
            <Typography variant='body2' color='text.secondary'>Thành tiền: <b>{fmtMoney(Math.round(num(lines[i].actualQty) * num(l.price)))}</b> ({fmtMoney(l.price)}/{unitLabel(l.unit)})</Typography>
          </div>
        ))}

        <div className='flex items-center justify-between'>
          <Typography variant='h6'>Tổng thành tiền</Typography>
          <Typography variant='h5' color='primary'>{fmtMoney(total)}</Typography>
        </div>

        <div className='rounded border p-3 flex flex-col gap-3'>
          <Typography variant='h6'>Thanh toán</Typography>
          <MoneyField sx={big} label='Số tiền đã thu' value={paid} onChange={setPaid} />
          <div className='flex flex-wrap gap-2'>
            <Button size='small' variant='tonal' onClick={() => setPaid(total)}>Thu đủ</Button>
            <Button size='small' variant='tonal' color='secondary' onClick={() => setPaid(0)}>Chưa thu (ghi nợ)</Button>
          </div>
          {num(paid) > 0 && <SelectField label='Hình thức thu' allowEmpty={false} value={payMethod} onChange={setPayMethod} options={Object.entries(PAY_METHODS).map(([value, label]) => ({ value, label }))} />}
          {num(paid) > 0 && payMethod === 'personal_account' && <Text label='Chuyển vào tài khoản cá nhân của ai? *' value={accountNote} onChange={e => setAccountNote(e.target.value)} />}
          <Typography variant='body2' color='text.secondary'>Còn ghi nợ: <b>{fmtMoney(Math.max(0, total - num(paid)))}</b></Typography>
        </div>

        <Text type='datetime-local' label='Thời gian giao thực tế' value={deliveredAt} onChange={e => setDeliveredAt(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Text multiline minRows={2} label='Ghi chú tại điểm giao' value={note} onChange={e => setNote(e.target.value)} />
        <FileUpload value={atts} onChange={setAtts} />
        <div className='sticky bottom-0 z-10 -mli-4 plb-3 pli-4 sm:static sm:m-0 sm:p-0' style={{ background: 'var(--mui-palette-background-paper)', boxShadow: '0 -4px 8px rgba(0,0,0,0.06)' }}>
          <Button size='large' variant='contained' fullWidth disabled={busy} onClick={submit} startIcon={<i className='tabler-send' />} sx={{ py: 1.5 }}>
            {busy ? 'Đang gửi…' : 'Gửi kết quả giao hàng'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
