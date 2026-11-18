'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid2'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import FormDialog from '@components/app/FormDialog'
import FileUpload from '@components/app/FileUpload'
import {
  Text,
  MoneyField,
  SelectField,
  DateField,
  toOptions,
} from '@components/app/fields'
import { useAction } from '@components/app/useAction'
import { useOptions } from '@components/app/useOptions'
import {
  PAY_METHODS,
  CASH_IN_CATEGORIES,
  CASH_OUT_CATEGORIES,
} from '@/server/constants'
import { api } from '@/utils/api'
import { fmtMoney } from '@/utils/format'

export const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)
}
export const dateInput = (v) =>
  v
    ? new Date(new Date(v).getTime() - new Date(v).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10)
    : today()

export const useCustomerOptions = () =>
  useOptions('/customers/options', {}, (r) => ({
    value: r._id,
    label: `${r.code ? r.code + ' – ' : ''}${r.name}`,
  }))
export const useProductOptions = () =>
  useOptions('/products/options', {}, (r) => ({ value: r._id, label: r.name }))

const payFields = [
  {
    name: 'channel',
    label: 'Hình thức thu',
    type: 'select',
    options: toOptions(PAY_METHODS),
    allowEmpty: false,
    xs: 6,
  },
  {
    name: 'accountNote',
    label: 'Tài khoản (nếu chuyển khoản)',
    xs: 6,
    helper: 'VD: tài khoản cá nhân của ai',
  },
]

// Thu nợ (thanh toán toàn phần / một phần / gộp nhiều đơn: tính trên tổng công nợ khách)
export function PaymentDialog({
  open,
  onClose,
  customerId,
  currentDebt,
  customerName,
}) {
  const act = useAction()
  const { options } = useCustomerOptions()
  const [selectedCust, setSelectedCust] = useState(customerId || '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [channel, setChannel] = useState('cash')
  const [accountNote, setAccountNote] = useState('')
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedCust(customerId || '')
      setAmount('')
      setDate(today())
      setChannel('cash')
      setAccountNote('')
      setContent('')
      setAttachments([])
      setError('')
    }
  }, [open, customerId])

  const { data: balanceData, isFetching: loadingBalance } = useQuery({
    queryKey: ['debt-balance', selectedCust],
    queryFn: () => api(`/debts/balance/${selectedCust}`),
    enabled: open && !!selectedCust,
  })

  const balance =
    selectedCust === customerId && currentDebt !== undefined
      ? currentDebt
      : (balanceData?.balance ?? 0)

  const submit = async (e) => {
    e?.preventDefault()
    if (!selectedCust) return setError('Vui lòng chọn khách hàng')
    const numAmount = Number(amount)
    if (!numAmount || numAmount <= 0)
      return setError('Số tiền thu phải lớn hơn 0')
    setSaving(true)
    setError('')
    try {
      await act('/debts/payment', {
        body: {
          customer: selectedCust,
          amount: numAmount,
          date,
          channel,
          accountNote,
          content,
          attachments,
        },
        ok: 'Đã ghi nhận thu nợ',
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const numAmount = Number(amount) || 0
  const isOverDebt = balance > 0 && numAmount > balance

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth='sm'
    >
      <form onSubmit={submit}>
        <DialogTitle variant='h5'>Thu nợ khách hàng</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity='error' className='mbe-4'>
              {error}
            </Alert>
          )}
          <Grid container spacing={4} className='pbs-2'>
            {!customerId && (
              <Grid size={12}>
                <SelectField
                  label='Khách hàng *'
                  options={options}
                  value={selectedCust}
                  onChange={(v) => setSelectedCust(v)}
                  allowEmpty={false}
                />
              </Grid>
            )}

            {selectedCust && (
              <Grid size={12}>
                {loadingBalance ? (
                  <Typography variant='caption' color='text.secondary'>
                    Đang kiểm tra dư nợ…
                  </Typography>
                ) : balance > 0 ? (
                  <Alert
                    severity='info'
                    icon={<i className='tabler-info-circle' />}
                    action={
                      <Button
                        size='small'
                        variant='tonal'
                        color='primary'
                        onClick={() => setAmount(String(balance))}
                      >
                        Điền đủ nợ
                      </Button>
                    }
                  >
                    Dư nợ hiện tại:{' '}
                    <b style={{ color: 'var(--mui-palette-error-main)' }}>
                      {fmtMoney(balance)}
                    </b>
                  </Alert>
                ) : balance < 0 ? (
                  <Alert
                    severity='warning'
                    icon={<i className='tabler-alert-triangle' />}
                  >
                    Khách hàng đang{' '}
                    <b>trả thừa / tạm ứng: {fmtMoney(Math.abs(balance))}</b>.
                    Thu thêm sẽ làm tăng số tiền trả thừa.
                  </Alert>
                ) : (
                  <Alert
                    severity='success'
                    icon={<i className='tabler-check' />}
                  >
                    Khách hàng hiện tại <b>không còn dư nợ (0 ₫)</b>.
                  </Alert>
                )}
              </Grid>
            )}

            {isOverDebt && (
              <Grid size={12}>
                <Alert
                  severity='warning'
                  icon={<i className='tabler-alert-circle' />}
                >
                  Số tiền thu ({fmtMoney(numAmount)}) lớn hơn dư nợ (
                  {fmtMoney(balance)}). Số tiền vượt{' '}
                  <b>{fmtMoney(numAmount - balance)}</b> sẽ được ghi nhận là
                  khách trả trước / tạm ứng.
                </Alert>
              </Grid>
            )}

            <Grid size={{ xs: 12, sm: 6 }}>
              <MoneyField
                label='Số tiền thu *'
                value={amount}
                onChange={setAmount}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DateField label='Ngày thu *' value={date} onChange={setDate} />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <SelectField
                label='Hình thức thu *'
                options={toOptions(PAY_METHODS)}
                allowEmpty={false}
                value={channel}
                onChange={setChannel}
              />
            </Grid>
            {channel === 'personal_account' || channel === 'other' ? (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Text
                  label='Tài khoản (nếu chuyển khoản)'
                  placeholder='VD: tài khoản cá nhân của ai'
                  value={accountNote}
                  onChange={(e) => setAccountNote(e.target.value)}
                />
              </Grid>
            ) : null}

            <Grid size={12}>
              <Text
                label='Nội dung'
                multiline
                minRows={2}
                placeholder='Có thể thu một phần hoặc thu gộp nhiều đơn'
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </Grid>

            <Grid size={12}>
              <FileUpload
                label='Chứng từ / Ảnh chuyển khoản (nếu có)'
                value={attachments}
                onChange={setAttachments}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 4, sm: 6 }, pb: 5 }}>
          <Button
            variant='tonal'
            color='secondary'
            onClick={onClose}
            disabled={saving}
          >
            Hủy bỏ
          </Button>
          <Button type='submit' variant='contained' disabled={saving}>
            {saving ? 'Đang lưu…' : 'Ghi nhận thu'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export function AdjustDialog({ open, onClose, customerId }) {
  const act = useAction()
  const { options } = useCustomerOptions()
  const initial = useMemo(
    () => ({ customer: customerId || '', date: today(), amount: '' }),
    [customerId, open],
  )
  const fields = [
    {
      name: 'customer',
      label: 'Khách hàng',
      type: 'select',
      options,
      required: true,
      hidden: () => !!customerId,
    },
    {
      name: 'amount',
      label: 'Số tiền điều chỉnh',
      type: 'money',
      required: true,
      xs: 6,
      helper: 'Dương: tăng nợ; âm: giảm nợ',
    },
    { name: 'date', label: 'Ngày', type: 'date', required: true, xs: 6 },
    {
      name: 'reason',
      label: 'Lý do điều chỉnh',
      type: 'textarea',
      required: true,
    },
  ]
  // MoneyField loại bỏ dấu "-": dùng 2 nút chọn chiều để nhập số âm
  fields.splice(2, 0, {
    name: 'direction',
    label: 'Chiều điều chỉnh',
    type: 'select',
    allowEmpty: false,
    xs: 12,
    options: [
      { value: 'up', label: 'Tăng nợ (+)' },
      { value: 'down', label: 'Giảm nợ (−)' },
    ],
  })
  const init2 = useMemo(() => ({ ...initial, direction: 'up' }), [initial])
  return (
    <FormDialog
      open={open}
      title='Điều chỉnh công nợ'
      fields={fields.map((f) =>
        f.name === 'amount'
          ? { ...f, helper: 'Nhập số dương, chọn chiều điều chỉnh bên dưới' }
          : f,
      )}
      initial={init2}
      onClose={onClose}
      onSubmit={(v) => {
        const n = Math.abs(Number(v.amount) || 0)
        return act('/debts/adjust', {
          body: {
            customer: customerId || v.customer,
            date: v.date,
            reason: v.reason,
            amount: v.direction === 'down' ? -n : n,
          },
          ok: 'Đã điều chỉnh công nợ',
        })
      }}
    />
  )
}

const SHELL_KIND_OPTS = {
  opening: 'Số dư vỏ đầu kỳ (khách đang giữ)',
  adjust: 'Điều chỉnh vỏ khách giữ',
  supplier_return: 'Trả vỏ nhà cung cấp',
  stocktake: 'Chênh lệch kiểm kê (vỏ công ty)',
}

// kind cố định theo nút bấm; customerId cố định khi mở từ hồ sơ khách
export function ShellEntryDialog({
  open,
  onClose,
  kind = 'opening',
  customerId,
}) {
  const act = useAction()
  const { options } = useCustomerOptions()
  const prods = useProductOptions()
  const company = kind === 'supplier_return' || kind === 'stocktake'
  const initial = useMemo(
    () => ({ customer: customerId || '', date: today(), product: '', qty: '' }),
    [customerId, open, kind],
  )
  const fields = [
    {
      name: 'customer',
      label: 'Khách hàng',
      type: 'select',
      options,
      required: true,
      hidden: () => company || !!customerId,
    },
    {
      name: 'product',
      label: 'Loại vỏ / sản phẩm',
      type: 'select',
      options: prods.options,
      required: true,
    },
    {
      name: 'qty',
      label:
        kind === 'stocktake' || kind === 'adjust'
          ? 'Số lượng (âm nếu giảm)'
          : 'Số lượng',
      type: 'number',
      required: true,
      xs: 6,
    },
    { name: 'date', label: 'Ngày', type: 'date', required: true, xs: 6 },
    { name: 'note', label: 'Ghi chú', type: 'textarea' },
  ]
  return (
    <FormDialog
      open={open}
      title={SHELL_KIND_OPTS[kind]}
      fields={fields}
      initial={initial}
      onClose={onClose}
      onSubmit={(v) =>
        act('/shells/entry', {
          body: {
            ...v,
            kind,
            customer: company ? undefined : customerId || v.customer,
            qty: Number(v.qty),
          },
          ok: 'Đã ghi nhận',
        })
      }
    />
  )
}

export function ResidualEntryDialog({
  open,
  onClose,
  kind = 'offset',
  customerId,
}) {
  const act = useAction()
  const { options } = useCustomerOptions()
  const prods = useProductOptions()
  const initial = useMemo(
    () => ({ customer: customerId || '', date: today(), kg: '' }),
    [customerId, open, kind],
  )
  const title = {
    offset: 'Đối trừ gas dư',
    opening: 'Gas dư đầu kỳ',
    adjust: 'Điều chỉnh gas dư',
  }[kind]
  const fields = [
    {
      name: 'customer',
      label: 'Khách hàng',
      type: 'select',
      options,
      required: true,
      hidden: () => !!customerId,
    },
    {
      name: 'product',
      label: 'Sản phẩm (nếu có)',
      type: 'select',
      options: prods.options,
    },
    {
      name: 'kg',
      label: kind === 'offset' ? 'Số kg đối trừ' : 'Số kg (âm nếu giảm)',
      type: 'number',
      required: true,
      xs: 6,
    },
    { name: 'date', label: 'Ngày', type: 'date', required: true, xs: 6 },
    {
      name: 'note',
      label: 'Cách xử lý / ghi chú',
      type: 'textarea',
      helper:
        kind === 'offset'
          ? 'VD: trừ vào đơn sau, quy đổi thành tiền'
          : undefined,
    },
  ]
  return (
    <FormDialog
      open={open}
      title={title}
      fields={fields}
      initial={initial}
      onClose={onClose}
      onSubmit={(v) =>
        act('/residual/entry', {
          body: {
            ...v,
            kind,
            customer: customerId || v.customer,
            product: v.product || undefined,
            kg: Number(v.kg),
          },
          ok: 'Đã ghi nhận',
        })
      }
    />
  )
}

// Phiếu thu / chi thủ công (có ảnh chứng từ)
export function CashDialog({ open, onClose, type = 'in', edit }) {
  const act = useAction()
  const { options } = useCustomerOptions()
  const [v, setV] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const t = edit?.type || type
  const cats =
    t === 'in'
      ? {
          debt_collect: CASH_IN_CATEGORIES.debt_collect,
          other_in: CASH_IN_CATEGORIES.other_in,
        }
      : CASH_OUT_CATEGORIES
  useEffect(() => {
    if (open) {
      setError('')
      setV(
        edit
          ? {
              ...edit,
              date: dateInput(edit.date),
              customer: edit.customer || '',
            }
          : {
              date: today(),
              channel: 'cash',
              category: t === 'in' ? 'other_in' : 'operation',
              amount: '',
              attachments: [],
            },
      )
    }
  }, [open, edit, t])
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }))

  const submit = async (e) => {
    e.preventDefault()
    if (t === 'in' && v.category === 'debt_collect' && !v.customer) {
      return setError('Vui lòng chọn khách hàng khi ghi nhận thu công nợ')
    }
    setSaving(true)
    setError('')
    try {
      const body = {
        type: t,
        category: v.category,
        date: v.date,
        amount: v.amount,
        channel: v.channel,
        accountNote: v.accountNote,
        content: v.content,
        customer: v.customer || undefined,
        attachments: v.attachments || [],
      }
      if (edit?._id)
        await act(`/cash/${edit._id}`, {
          method: 'PUT',
          body,
          ok: 'Đã lưu phiếu',
        })
      else await act('/cash', { body, ok: 'Đã ghi nhận phiếu' })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth='sm'
    >
      <form onSubmit={submit}>
        <DialogTitle variant='h5'>
          {edit
            ? 'Sửa phiếu'
            : t === 'in'
              ? 'Thêm khoản thu'
              : 'Thêm khoản chi'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity='error' className='mbe-4'>
              {error}
            </Alert>
          )}
          <Grid container spacing={4} className='pbs-2'>
            <Grid size={{ xs: 12, sm: 6 }}>
              <SelectField
                label='Danh mục *'
                options={toOptions(cats)}
                allowEmpty={false}
                value={v.category}
                onChange={(x) => set('category', x)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DateField
                label='Ngày *'
                value={v.date}
                onChange={(x) => set('date', x)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MoneyField
                label='Số tiền *'
                value={v.amount}
                onChange={(x) => set('amount', x)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <SelectField
                label='Phương thức / kênh tiền'
                options={toOptions(PAY_METHODS)}
                allowEmpty={false}
                value={v.channel}
                onChange={(x) => set('channel', x)}
              />
            </Grid>
            {v.channel === 'personal_account' || v.channel === 'other' ? (
              <Grid size={12}>
                <Text
                  label='Tài khoản / ghi chú kênh tiền'
                  placeholder='VD: tài khoản cá nhân của ai'
                  value={v.accountNote ?? ''}
                  onChange={(e) => set('accountNote', e.target.value)}
                />
              </Grid>
            ) : null}
            {t === 'in' && (
              <Grid size={12}>
                <SelectField
                  label={
                    v.category === 'debt_collect'
                      ? 'Khách hàng *'
                      : 'Khách hàng (nếu có)'
                  }
                  options={options}
                  value={v.customer}
                  onChange={(x) => set('customer', x)}
                  helper={
                    v.category === 'debt_collect' && !v.customer
                      ? 'Bắt buộc chọn khách hàng khi thu công nợ để trừ vào sổ nợ'
                      : undefined
                  }
                />
              </Grid>
            )}
            <Grid size={12}>
              <Text
                label='Nội dung'
                multiline
                minRows={2}
                value={v.content ?? ''}
                onChange={(e) => set('content', e.target.value)}
              />
            </Grid>
            <Grid size={12}>
              <FileUpload
                label='Chứng từ (nếu có)'
                value={v.attachments}
                onChange={(x) => set('attachments', x)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 5 }}>
          <Button
            variant='tonal'
            color='secondary'
            onClick={onClose}
            disabled={saving}
          >
            Hủy bỏ
          </Button>
          <Button type='submit' variant='contained' disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export function VoidDialog({ open, onClose, tx }) {
  const act = useAction()
  const initial = useMemo(() => ({ reason: '' }), [open])
  return (
    <FormDialog
      open={open}
      title={`Hủy phiếu ${tx?.code || ''}`}
      fields={[
        {
          name: 'reason',
          label: 'Lý do hủy',
          type: 'textarea',
          required: true,
          helper: 'Phiếu không bị xóa, chỉ đánh dấu đã hủy và lưu vết',
        },
      ]}
      initial={initial}
      onClose={onClose}
      submitText='Hủy phiếu'
      onSubmit={(v) =>
        act(`/cash/${tx._id}/void`, { body: v, ok: 'Đã hủy phiếu' })
      }
    />
  )
}
