'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import PageHeader from '@components/app/PageHeader'
import { SelectField, Check, Text } from '@components/app/fields'
import MenuItem from '@mui/material/MenuItem'
import { useAction } from '@components/app/useAction'
import { api } from '@/utils/api'
import { ROLES } from '@/server/constants'

export default function SettingsPage() {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => api('/settings') })
  const act = useAction()
  const [v, setV] = useState(null)
  useEffect(() => { if (data) setV(data) }, [data])
  if (!v) return null
  const set = (k, x) => setV(s => ({ ...s, [k]: x }))

  return (
    <>
      <PageHeader title='Cấu hình nghiệp vụ' subtitle='Các điểm chưa được khách hàng xác nhận — chỉnh tại đây thay vì sửa mã nguồn' />
      <Alert severity='info' className='mbe-6'>Thay đổi chỉ áp dụng cho phiếu/đơn lập sau đó; dữ liệu đã ghi nhận giữ nguyên giá trị đã chốt.</Alert>
      <Card>
        <CardHeader title='Quy tắc nghiệp vụ' />
        <CardContent className='flex flex-col gap-6'>
          <div className='flex flex-col gap-2' style={{ maxWidth: 480 }}>
            <SelectField
              label='Giá trị phiếu nhập tính theo'
              allowEmpty={false}
              value={v.importValueBasis}
              onChange={x => set('importValueBasis', x)}
              options={[{ value: 'actual', label: 'Kg thực tế' }, { value: 'document', label: 'Kg trên chứng từ' }]}
            />
            <Typography variant='caption'>Giá trị phiếu nhập = số kg theo lựa chọn × đơn giá nhập/kg.</Typography>
          </div>
          <div className='flex flex-col gap-1'>
            <Check label='Cho phép phân công nhiều nhân viên giao cho một đơn' checked={v.allowDriverMultiAssign} onChange={x => set('allowDriverMultiAssign', x)} />
            <Typography variant='caption'>Tắt: mỗi đơn chỉ được giao cho một nhân viên.</Typography>
          </div>
          <div className='flex flex-col gap-2' style={{ maxWidth: 480 }}>
            <Text select label='Vai trò được thay đổi giá bán' value={v.priceEditRoles || []} SelectProps={{ multiple: true }} onChange={e => set('priceEditRoles', e.target.value)}>
              {Object.entries(ROLES).map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
            </Text>
            <Typography variant='caption'>Áp dụng cho việc thêm giá mới trong bảng giá khách hàng. Quản trị luôn có quyền.</Typography>
          </div>
          <div>
            <Button variant='contained' onClick={() => act('/settings', { method: 'PUT', body: v, ok: 'Đã lưu cấu hình' })}>Lưu thay đổi</Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
