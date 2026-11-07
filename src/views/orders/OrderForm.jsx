'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid2'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import CustomAutocomplete from '@core/components/mui/Autocomplete'
import PageHeader from '@components/app/PageHeader'
import { Text, SelectField } from '@components/app/fields'
import { useOptions } from '@components/app/useOptions'
import { useAction } from '@components/app/useAction'
import { useSession } from '@components/SessionProvider'
import { api } from '@/utils/api'
import { fmtMoney } from '@/utils/format'
import { DriverSelect, unitLabel, toLocalInput } from './shared'

const emptyLine = () => ({ product: '', unit: '', price: '', plannedQty: '', priceState: 'none' })

// Form tạo / sửa đơn. initial: đơn khi sửa
export default function OrderForm({ initial }) {
  const router = useRouter()
  const act = useAction()
  const session = useSession()
  const { raw: customers } = useOptions('/customers/options')
  const { raw: products } = useOptions('/products/options')
  const settings = useQuery({ queryKey: ['settings-lite'], queryFn: () => api('/settings'), retry: false })
  const canPrice = session.role === 'admin' || (settings.data?.priceEditRoles || []).includes(session.role)

  const [customer, setCustomer] = useState(initial?.customer || '')
  const [address, setAddress] = useState(initial?.deliveryAddress || '')
  const [deliveryAt, setDeliveryAt] = useState(toLocalInput(initial?.deliveryAt))
  const [note, setNote] = useState(initial?.note || '')
  const [assignees, setAssignees] = useState((initial?.assignees || []).map(a => a._id || a))
  const [lines, setLines] = useState(
    initial?.lines?.length
      ? initial.lines.map(l => ({ _id: l._id, product: l.product, unit: l.unit, price: l.price, plannedQty: l.plannedQty, priceState: 'locked' }))
      : [emptyLine()]
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const cust = customers.find(c => c._id === customer)
  const setLine = (i, patch) => setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  const fetchPrice = async (i, custId, productId) => {
    if (!custId || !productId) return
    try {
      const p = await api('/prices/current', { query: { customer: custId, product: productId, date: new Date().toISOString() } })
      if (p) setLine(i, { price: p.price, unit: p.unit, priceState: 'locked' })
      else {
        const prod = products.find(x => x._id === productId)
        setLine(i, { price: '', unit: prod?.unit || '', priceState: 'missing' })
      }
    } catch {
      setLine(i, { priceState: 'missing' })
    }
  }

  const pickCustomer = c => {
    const id = c?._id || ''
    setCustomer(id)
    if (c && !address) setAddress(c.address || '')
    if (c) lines.forEach((l, i) => l.product && fetchPrice(i, id, l.product))
  }
  const pickProduct = (i, productId) => {
    setLine(i, { product: productId, price: '', unit: '', priceState: 'none' })
    fetchPrice(i, customer, productId)
  }

  // khi dữ liệu khách hàng tải xong lúc sửa đơn → điền địa chỉ trống
  useEffect(() => {
    if (initial && cust && !address) setAddress(cust.address || '')
  }, [cust?._id])

  const lineAmount = l => Math.round(Number(l.plannedQty || 0) * Number(l.price || 0))
  const total = lines.reduce((s, l) => s + lineAmount(l), 0)

  const submit = async e => {
    e.preventDefault()
    setError('')
    if (!customer) return setError('Vui lòng chọn khách hàng')
    if (lines.some(l => !l.product || !(Number(l.plannedQty) > 0))) return setError('Mỗi dòng cần chọn sản phẩm và số lượng lớn hơn 0')
    const body = {
      customer,
      deliveryAddress: address,
      deliveryAt: deliveryAt ? new Date(deliveryAt).toISOString() : null,
      note,
      lines: lines.map(l => ({ _id: l._id, product: l.product, unit: l.unit, price: l.price === '' ? undefined : Number(l.price), plannedQty: Number(l.plannedQty) }))
    }
    if (!initial) body.assignees = assignees
    setSaving(true)
    try {
      const r = await act(initial ? `/orders/${initial._id}` : '/orders', { method: initial ? 'PUT' : 'POST', body, ok: initial ? 'Đã cập nhật đơn' : 'Đã tạo đơn' })
      router.push(`/orders/${r._id || initial._id}`)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <PageHeader title={initial ? `Sửa đơn ${initial.code}` : 'Tạo đơn hàng'} subtitle='Đơn giá được lấy theo bảng giá của khách và chốt tại thời điểm lập đơn' back={{ href: initial ? `/orders/${initial._id}` : '/orders', label: initial ? 'Chi tiết đơn' : 'Danh sách đơn' }} />
      {error && <Alert severity='error' className='mbe-4'>{error}</Alert>}
      <Grid container spacing={6}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card>
            <CardHeader title='Thông tin giao hàng' />
            <CardContent className='flex flex-col gap-4'>
              <CustomAutocomplete
                size='small'
                options={customers}
                value={cust || null}
                getOptionLabel={o => (o ? `${o.name}${o.phone ? ' – ' + o.phone : ''}` : '')}
                isOptionEqualToValue={(a, b) => a._id === b._id}
                onChange={(_, v) => pickCustomer(v)}
                renderInput={p => <Text {...p} label='Khách hàng *' placeholder='Gõ tên hoặc số điện thoại' />}
                noOptionsText='Không có khách hàng'
              />
              <Text label='Địa chỉ giao hàng' value={address} onChange={e => setAddress(e.target.value)} multiline minRows={2} />
              <Text type='datetime-local' label='Thời gian giao' value={deliveryAt} onChange={e => setDeliveryAt(e.target.value)} InputLabelProps={{ shrink: true }} />
              {!initial && <DriverSelect value={assignees} onChange={setAssignees} label='Phân công ngay (không bắt buộc)' helperText='Để trống nếu phân công sau' />}
              <Text label='Ghi chú' value={note} onChange={e => setNote(e.target.value)} multiline minRows={2} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardHeader
              title='Sản phẩm'
              action={<Button size='small' variant='tonal' startIcon={<i className='tabler-plus' />} onClick={() => setLines(ls => [...ls, emptyLine()])}>Thêm dòng</Button>}
            />
            <CardContent className='flex flex-col gap-4'>
              {lines.map((l, i) => {
                const prod = products.find(p => p._id === l.product)
                return (
                  <div key={i} className='rounded border p-3'>
                    <Grid container spacing={3} alignItems='center'>
                      <Grid size={{ xs: 12, sm: 5 }}>
                        <SelectField label='Sản phẩm *' value={l.product} options={products.filter(p => p.status !== 'inactive' || p._id === l.product).map(p => ({ value: p._id, label: p.name }))} onChange={v => pickProduct(i, v)} />
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Text type='number' label={`Số lượng dự kiến${l.unit ? ' (' + unitLabel(l.unit) + ')' : ''} *`} value={l.plannedQty} onChange={e => setLine(i, { plannedQty: e.target.value })} inputProps={{ min: 0, step: 'any', inputMode: 'decimal' }} />
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Text
                          type='number'
                          label={`Đơn giá${l.unit ? '/' + unitLabel(l.unit) : ''}`}
                          value={l.price}
                          disabled={!canPrice || l.priceState === 'none'}
                          onChange={e => setLine(i, { price: e.target.value })}
                          helperText={l.priceState === 'missing' ? (canPrice ? 'Khách chưa có giá — nhập giá' : 'Khách chưa có giá') : l.priceState === 'locked' && !canPrice ? 'Giá theo hồ sơ khách' : undefined}
                          error={l.priceState === 'missing'}
                          inputProps={{ min: 0, step: 'any' }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 1 }} className='flex justify-end'>
                        <IconButton color='error' disabled={lines.length === 1} onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}><i className='tabler-trash' /></IconButton>
                      </Grid>
                    </Grid>
                    <Typography variant='body2' color='text.secondary' className='mbs-2'>
                      {prod?.kgPerUnit ? `1 ${unitLabel(prod.unit)} = ${prod.kgPerUnit} kg · ` : ''}Thành tiền tạm tính: <b>{fmtMoney(lineAmount(l))}</b>
                    </Typography>
                  </div>
                )
              })}
              <div className='flex items-center justify-between'>
                <Typography variant='h6'>Tạm tính (theo số lượng dự kiến)</Typography>
                <Typography variant='h5' color='primary'>{fmtMoney(total)}</Typography>
              </div>
              <Typography variant='caption' color='text.secondary'>Thành tiền chính thức được tính lại theo số lượng thực giao do nhân viên giao hàng xác nhận.</Typography>
              <div className='flex justify-end gap-3'>
                <Button variant='tonal' color='secondary' onClick={() => router.back()} disabled={saving}>Hủy bỏ</Button>
                <Button type='submit' variant='contained' disabled={saving}>{saving ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : 'Tạo đơn'}</Button>
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </form>
  )
}
