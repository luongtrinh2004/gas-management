'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid2'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Timeline from '@mui/lab/Timeline'
import TimelineItem from '@mui/lab/TimelineItem'
import TimelineSeparator from '@mui/lab/TimelineSeparator'
import TimelineConnector from '@mui/lab/TimelineConnector'
import TimelineContent from '@mui/lab/TimelineContent'
import TimelineDot from '@mui/lab/TimelineDot'
import timelineItemClasses from '@mui/lab/TimelineItem/timelineItemClasses'
import PageHeader from '@components/app/PageHeader'
import StatusChip from '@components/app/StatusChip'
import FileUpload from '@components/app/FileUpload'
import { useAction } from '@components/app/useAction'
import { useSession } from '@components/SessionProvider'
import ConfirmDialog from '@components/ConfirmDialog'
import tableStyles from '@core/styles/table.module.css'
import { api } from '@/utils/api'
import { fmtDateTime, fmtMoney } from '@/utils/format'
import { PAY_METHODS } from '@/server/constants'
import { qtyText, unitLabel, ReasonDialog, AssignDialog } from '@/views/orders/shared'
import ResultForm from '@/views/orders/ResultForm'

const Info = ({ label, children }) => (
  <div className='flex flex-col gap-0.5'>
    <Typography variant='caption' color='text.secondary'>{label}</Typography>
    <Typography variant='body1' component='div'>{children || '—'}</Typography>
  </div>
)

export default function OrderDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const s = useSession()
  const act = useAction()
  const { data: o, isLoading, error } = useQuery({ queryKey: ['order', id], queryFn: () => api(`/orders/${id}`) })
  const [dlg, setDlg] = useState(null) // assign | return | cancel | reopen | approve | skip

  if (isLoading) return <CircularProgress />
  if (error) return <Alert severity='error'>{error.message}</Alert>

  const isDriver = s.role === 'driver'
  const back = isDriver ? { href: '/deliveries', label: 'Đơn giao của tôi' } : { href: '/orders', label: 'Danh sách đơn' }
  const mine = (o.assignees || []).some(a => a._id === s.id)
  const canDeliver = (isDriver ? mine : s.role === 'admin') && ['assigned', 'delivering', 'need_fix'].includes(o.status)
  const canEdit = ['admin', 'office'].includes(s.role) && ['new', 'waiting_assign', 'assigned', 'need_fix'].includes(o.status)
  const canAssign = ['admin', 'office'].includes(s.role) && ['new', 'waiting_assign', 'assigned', 'delivering', 'need_fix'].includes(o.status)
  const canReview = !isDriver && o.status === 'pending_review'
  const canCancel = ['admin', 'office'].includes(s.role) && !['approved', 'cancelled'].includes(o.status)
  const canReopen = ['admin', 'accountant'].includes(s.role) && o.status === 'approved'
  const useActual = o.lines.some(l => l.actualQty != null)
  const total = o.lines.reduce((sum, l) => sum + Math.round(Number(useActual && l.actualQty != null ? l.actualQty : l.plannedQty) * l.price), 0)
  const post = (path, body, ok) => act(`/orders/${id}/${path}`, { body: body || {}, ok })
  const attEditable = !isDriver && !['approved', 'cancelled'].includes(o.status)
  const d = o.delivery || {}

  return (
    <>
      <PageHeader
        back={back}
        title={`Đơn ${o.code}`}
        subtitle={o.customerName}
        actions={
          <>
            <StatusChip status={o.status} size='medium' />
            {canEdit && <Button variant='tonal' startIcon={<i className='tabler-edit' />} onClick={() => router.push(`/orders/${id}/edit`)}>Sửa đơn</Button>}
            {canAssign && <Button variant='tonal' startIcon={<i className='tabler-user-plus' />} onClick={() => setDlg('assign')}>{o.assignees?.length ? 'Đổi người giao' : 'Phân công'}</Button>}
            {canCancel && <Button variant='tonal' color='error' onClick={() => setDlg('cancel')}>Hủy đơn</Button>}
            {canReopen && <Button variant='tonal' color='warning' startIcon={<i className='tabler-arrow-back-up' />} onClick={() => setDlg('reopen')}>Mở lại để điều chỉnh</Button>}
          </>
        }
      />

      {o.status === 'need_fix' && o.returnReason && <Alert severity='warning' className='mbe-4'>Cần xử lý: {o.returnReason}</Alert>}
      {o.status === 'cancelled' && <Alert severity='error' className='mbe-4'>Đơn đã hủy. Lý do: {o.cancelReason}</Alert>}

      {isDriver && (o.customerInfo?.phone || o.deliveryAddress) && (
        <div className='flex gap-3 mbe-4'>
          {o.customerInfo?.phone && <Button fullWidth size='large' variant='contained' color='success' href={`tel:${o.customerInfo.phone}`} startIcon={<i className='tabler-phone' />} sx={{ minBlockSize: 48 }}>Gọi khách</Button>}
          {o.deliveryAddress && <Button fullWidth size='large' variant='contained' color='info' href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.deliveryAddress)}`} target='_blank' rel='noreferrer' startIcon={<i className='tabler-route' />} sx={{ minBlockSize: 48 }}>Chỉ đường</Button>}
        </div>
      )}

      <Grid container spacing={6}>
        <Grid size={{ xs: 12, lg: 8 }} className='flex flex-col gap-6'>
          <Card>
            <CardHeader title='Thông tin đơn' />
            <CardContent>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, sm: 6 }}><Info label='Khách hàng'>{o.customerName}{o.customerInfo?.code ? ` (${o.customerInfo.code})` : ''}</Info></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><Info label='Điện thoại'>{o.customerInfo?.phone ? <a href={`tel:${o.customerInfo.phone}`} className='text-primary'>{o.customerInfo.phone}</a> : null}</Info></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><Info label='Địa chỉ giao hàng'>{o.deliveryAddress ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.deliveryAddress)}`} target='_blank' rel='noreferrer' className='text-primary'>{o.deliveryAddress}</a> : null}</Info></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><Info label='Thời gian giao'>{o.deliveryAt ? fmtDateTime(o.deliveryAt) : null}</Info></Grid>
                {!isDriver && <Grid size={{ xs: 12, sm: 6 }}><Info label='Nhân viên giao'>{o.assignees?.length ? <div className='flex flex-wrap gap-1'>{o.assignees.map(a => <Chip key={a._id} size='small' variant='tonal' color='primary' label={a.name} />)}</div> : 'Chưa phân công'}</Info></Grid>}
                {!isDriver && <Grid size={{ xs: 12, sm: 6 }}><Info label='Người tạo'>{o.createdByName} · {fmtDateTime(o.createdAt)}</Info></Grid>}
                <Grid size={12}><Info label='Ghi chú'>{o.note}</Info></Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title='Sản phẩm' subheader='Số lượng dự kiến và số lượng thực giao được lưu riêng; đơn giá đã chốt khi lập đơn' />
            <div className='flex flex-col sm:hidden'>
              {o.lines.map(l => (
                <div key={l._id} className='flex flex-col gap-1 p-4 border-bs'>
                  <div className='flex items-start justify-between gap-2'>
                    <Typography variant='h6'>{l.productName}</Typography>
                    <Typography variant='h6' color='primary' className='shrink-0'>{fmtMoney(Math.round(Number(l.actualQty != null ? l.actualQty : l.plannedQty) * l.price))}</Typography>
                  </div>
                  <Typography variant='body2' color='text.secondary'>Đơn giá: {fmtMoney(l.price)}/{unitLabel(l.unit)}</Typography>
                  <Typography variant='body2'>Dự kiến: {qtyText(l.plannedQty, l.unit)}{l.actualQty != null ? ` · Thực giao: ${qtyText(l.actualQty, l.unit)}` : ''}</Typography>
                  {l.actualQty != null && <Typography variant='body2' color='text.secondary'>Vỏ thu: {l.shellsCollected} · Vỏ giao/mượn: {l.shellsLent} · Gas dư: {l.residualKg} kg</Typography>}
                </div>
              ))}
            </div>
            <div className='overflow-x-auto max-sm:hidden'>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Sản phẩm</th><th style={{ textAlign: 'right' }}>Đơn giá</th><th style={{ textAlign: 'right' }}>Dự kiến</th><th style={{ textAlign: 'right' }}>Thực giao</th>
                    <th style={{ textAlign: 'right' }}>Vỏ thu</th><th style={{ textAlign: 'right' }}>Vỏ giao/mượn</th><th style={{ textAlign: 'right' }}>Gas dư (kg)</th><th style={{ textAlign: 'right' }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {o.lines.map(l => (
                    <tr key={l._id}>
                      <td>{l.productName}</td>
                      <td style={{ textAlign: 'right' }}>{fmtMoney(l.price)}/{unitLabel(l.unit)}</td>
                      <td style={{ textAlign: 'right' }}>{qtyText(l.plannedQty, l.unit)}</td>
                      <td style={{ textAlign: 'right' }}>{l.actualQty != null ? qtyText(l.actualQty, l.unit) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{l.actualQty != null ? l.shellsCollected : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{l.actualQty != null ? l.shellsLent : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{l.actualQty != null ? l.residualKg : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{fmtMoney(Math.round(Number(l.actualQty != null ? l.actualQty : l.plannedQty) * l.price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardContent className='flex items-center justify-between'>
              <Typography variant='h6'>{useActual ? 'Tổng thành tiền (thực giao)' : 'Tạm tính (dự kiến)'}</Typography>
              <Typography variant='h5' color='primary'>{fmtMoney(total)}</Typography>
            </CardContent>
          </Card>

          {d.confirmedAt && (
            <Card>
              <CardHeader title='Kết quả giao hàng' />
              <CardContent>
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, sm: 6 }}><Info label='Giao lúc'>{fmtDateTime(d.deliveredAt)}</Info></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><Info label='Người xác nhận'>{d.confirmedByName} · {fmtDateTime(d.confirmedAt)}</Info></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><Info label='Đã thu'>{fmtMoney(d.paidAmount || 0)}{d.payMethod ? ` (${PAY_METHODS[d.payMethod]}${d.payAccountNote ? ' – ' + d.payAccountNote : ''})` : ''}</Info></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><Info label='Còn ghi nợ'>{fmtMoney(Math.max(0, (o.amount || total) - (d.paidAmount || 0)))}</Info></Grid>
                  <Grid size={12}><Info label='Ghi chú tại điểm giao'>{d.note}</Info></Grid>
                  {o.reviewedByName && <Grid size={12}><Info label='Duyệt bởi'>{o.reviewedByName} · {fmtDateTime(o.approvedAt)}</Info></Grid>}
                </Grid>
              </CardContent>
            </Card>
          )}

          {canDeliver ? (
            <>
              {o.status === 'assigned' && (
                <Button size='large' variant='tonal' startIcon={<i className='tabler-player-play' />} onClick={() => post('start', {}, 'Đã bắt đầu giao')}>Bắt đầu giao</Button>
              )}
              <ResultForm key={o.updatedAt} order={o} />
            </>
          ) : (
            <Card>
              <CardContent>
                <FileUpload
                  value={o.attachments}
                  readOnly={!attEditable}
                  onChange={v => act(`/orders/${id}/attachments`, { method: 'PUT', body: { attachments: v }, ok: 'Đã cập nhật ảnh chứng từ' }).catch(() => {})}
                />
              </CardContent>
            </Card>
          )}
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }} className='flex flex-col gap-6'>
          {canReview && (
            <Card>
              <CardHeader title='Đối soát' subheader='Đối chiếu số liệu giao hàng với ảnh hóa đơn' />
              <CardContent className='flex flex-col gap-3'>
                {!o.attachments?.length && <Alert severity='warning'>Đơn chưa có ảnh hóa đơn.</Alert>}
                <Button variant='contained' color='success' size='large' startIcon={<i className='tabler-circle-check' />} onClick={() => setDlg(o.attachments?.length ? 'approve' : s.role === 'admin' ? 'skip' : 'noimg')}>Duyệt đơn</Button>
                <Button variant='tonal' color='error' startIcon={<i className='tabler-arrow-back-up' />} onClick={() => setDlg('return')}>Trả lại chỉnh sửa</Button>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader title='Lịch sử thao tác' />
            <CardContent>
              {!o.history?.length ? (
                <Typography variant='body2' color='text.secondary'>Chưa có lịch sử</Typography>
              ) : (
                <Timeline sx={{ p: 0, m: 0, [`& .${timelineItemClasses.root}:before`]: { flex: 0, padding: 0 } }}>
                  {o.history.map((h, i) => (
                    <TimelineItem key={h._id || i}>
                      <TimelineSeparator>
                        <TimelineDot color={h.action === 'approve' ? 'success' : ['return', 'cancel', 'reopen'].includes(h.action) ? 'error' : 'primary'} />
                        {i < o.history.length - 1 && <TimelineConnector />}
                      </TimelineSeparator>
                      <TimelineContent>
                        <Typography variant='body2' color='text.primary'>{h.summary}</Typography>
                        <Typography variant='caption' color='text.secondary'>{h.userName} · {fmtDateTime(h.at)}</Typography>
                      </TimelineContent>
                    </TimelineItem>
                  ))}
                </Timeline>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <AssignDialog open={dlg === 'assign'} current={o.assignees || []} onClose={() => setDlg(null)} onSubmit={ids => act(`/orders/${id}/assign`, { body: { assignees: ids }, ok: 'Đã phân công' })} />
      <ReasonDialog open={dlg === 'return'} title='Trả lại chỉnh sửa' label='Lý do trả lại' confirmText='Trả lại' color='error' onClose={() => setDlg(null)} onSubmit={reason => post('return', { reason }, 'Đã trả lại đơn')} />
      <ReasonDialog open={dlg === 'cancel'} title='Hủy đơn' label='Lý do hủy' confirmText='Hủy đơn' color='error' onClose={() => setDlg(null)} onSubmit={reason => post('cancel', { reason }, 'Đã hủy đơn')} />
      <ReasonDialog open={dlg === 'reopen'} title='Mở lại đơn đã duyệt' label='Lý do điều chỉnh' confirmText='Mở lại' color='warning' onClose={() => setDlg(null)} onSubmit={reason => post('reopen', { reason }, 'Đã mở lại đơn')} />
      <ReasonDialog open={dlg === 'skip'} title='Duyệt khi thiếu ảnh hóa đơn' label='Lý do duyệt thiếu ảnh' confirmText='Vẫn duyệt' color='warning' onClose={() => setDlg(null)} onSubmit={skipReason => post('approve', { skipAttachment: true, skipReason }, 'Đã duyệt đơn')} />
      <ConfirmDialog
        open={dlg === 'approve'}
        title='Duyệt đơn'
        confirmColor='success'
        confirmText='Duyệt'
        message='Xác nhận dữ liệu giao hàng hợp lệ? Sau khi duyệt, số liệu được ghi vào công nợ, vỏ bình, gas dư và thu chi.'
        onClose={() => setDlg(null)}
        onConfirm={async () => {
          await post('approve', {}, 'Đã duyệt đơn').catch(() => {})
          setDlg(null)
        }}
      />
      <ConfirmDialog open={dlg === 'noimg'} title='Thiếu ảnh hóa đơn' confirmText='Đã hiểu' confirmColor='primary' message='Đơn chưa có ảnh hóa đơn. Hãy bổ sung ảnh hoặc trả lại cho nhân viên giao hàng.' onClose={() => setDlg(null)} onConfirm={() => setDlg(null)} />
    </>
  )
}
