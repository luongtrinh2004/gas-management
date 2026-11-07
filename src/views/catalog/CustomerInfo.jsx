'use client'

import { useEffect, useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid2'
import Button from '@mui/material/Button'
import { Text, MoneyField, DateField, SelectField, toOptions } from '@components/app/fields'
import FileUpload from '@components/app/FileUpload'
import { useAction } from '@components/app/useAction'
import { useSession } from '@components/SessionProvider'
import { CONTRACT_STATUS, GAS_SYSTEM_STATUS } from '@/server/constants'
import { toInputDate } from '@/utils/format'

const init = c => ({
  name: c.name || '', phone: c.phone || '', address: c.address || '', contactName: c.contactName || '', contactInfo: c.contactInfo || '', openingDebt: c.openingDebt || 0, status: c.status || 'active', note: c.note || '',
  contract: { number: c.contract?.number || '', signedAt: toInputDate(c.contract?.signedAt), term: c.contract?.term || '', status: c.contract?.status || 'none', files: c.contract?.files || [] },
  gasSystem: { installStatus: c.gasSystem?.installStatus || 'none', investmentSupport: c.gasSystem?.investmentSupport || '', note: c.gasSystem?.note || '' }
})

export default function CustomerInfo({ customer }) {
  const s = useSession()
  const act = useAction()
  const [v, setV] = useState(init(customer))
  const [saving, setSaving] = useState(false)
  useEffect(() => setV(init(customer)), [customer])
  const canWrite = ['admin', 'office'].includes(s.role)
  const set = (k, x) => setV(p => ({ ...p, [k]: x }))
  const setC = (k, x) => setV(p => ({ ...p, contract: { ...p.contract, [k]: x } }))
  const setG = (k, x) => setV(p => ({ ...p, gasSystem: { ...p.gasSystem, [k]: x } }))
  const t = (label, k, xs = 6, extra = {}) => (
    <Grid size={{ xs: 12, sm: xs }}><Text label={label} value={v[k]} disabled={!canWrite} onChange={e => set(k, e.target.value)} {...extra} /></Grid>
  )

  const save = async () => {
    setSaving(true)
    try {
      await act(`/customers/${customer._id}`, { method: 'PUT', body: { ...v, contract: { ...v.contract, signedAt: v.contract.signedAt || null } }, ok: 'Đã lưu hồ sơ khách hàng' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12, lg: 6 }}>
        <Card>
          <CardHeader title='Thông tin cơ bản' />
          <CardContent>
            <Grid container spacing={4}>
              {t('Tên khách / công ty', 'name', 12)}
              {t('Số điện thoại', 'phone')}
              {t('Người liên hệ', 'contactName')}
              {t('Địa chỉ giao hàng', 'address', 12, { multiline: true, minRows: 2 })}
              {t('Thông tin liên hệ khác', 'contactInfo', 12)}
              <Grid size={{ xs: 12, sm: 6 }}><MoneyField label='Dư nợ đầu kỳ' value={v.openingDebt} disabled={!canWrite} onChange={x => set('openingDebt', x)} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <SelectField label='Trạng thái' allowEmpty={false} disabled={!canWrite} value={v.status} onChange={x => set('status', x)} options={[{ value: 'active', label: 'Hoạt động' }, { value: 'inactive', label: 'Ngừng' }]} />
              </Grid>
              {t('Ghi chú', 'note', 12, { multiline: true, minRows: 2 })}
            </Grid>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, lg: 6 }} className='flex flex-col gap-6'>
        <Card>
          <CardHeader title='Hợp đồng' />
          <CardContent>
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, sm: 6 }}><Text label='Số hợp đồng' value={v.contract.number} disabled={!canWrite} onChange={e => setC('number', e.target.value)} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><DateField label='Ngày ký' value={v.contract.signedAt} disabled={!canWrite} onChange={x => setC('signedAt', x)} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><Text label='Thời hạn' value={v.contract.term} disabled={!canWrite} onChange={e => setC('term', e.target.value)} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><SelectField label='Trạng thái' allowEmpty={false} disabled={!canWrite} value={v.contract.status} onChange={x => setC('status', x)} options={toOptions(CONTRACT_STATUS)} /></Grid>
              <Grid size={12}><FileUpload label='Tệp hợp đồng đính kèm' value={v.contract.files} readOnly={!canWrite} onChange={f => setC('files', f)} /></Grid>
            </Grid>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title='Hệ thống gas / báo rò' />
          <CardContent>
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, sm: 6 }}><SelectField label='Tình trạng lắp đặt' allowEmpty={false} disabled={!canWrite} value={v.gasSystem.installStatus} onChange={x => setG('installStatus', x)} options={toOptions(GAS_SYSTEM_STATUS)} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><Text label='Hỗ trợ đầu tư' value={v.gasSystem.investmentSupport} disabled={!canWrite} onChange={e => setG('investmentSupport', e.target.value)} /></Grid>
              <Grid size={12}><Text label='Ghi chú' multiline minRows={2} value={v.gasSystem.note} disabled={!canWrite} onChange={e => setG('note', e.target.value)} /></Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
      {canWrite && (
        <Grid size={12}>
          <Button variant='contained' disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</Button>
        </Grid>
      )}
    </Grid>
  )
}
