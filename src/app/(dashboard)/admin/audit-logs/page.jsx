'use client'

import { useState } from 'react'
import Card from '@mui/material/Card'
import PageHeader from '@components/app/PageHeader'
import DataTable, { col, colFn } from '@components/app/DataTable'
import DataTableToolbar from '@components/DataTableToolbar'
import { SelectField } from '@components/app/fields'
import { useList } from '@components/app/useList'
import { fmtDateTime } from '@/utils/format'

const ENTITIES = { customer: 'Khách hàng', price: 'Bảng giá', product: 'Sản phẩm', supplier: 'Nhà cung cấp', user: 'Người dùng', setting: 'Cấu hình', order: 'Đơn hàng', import: 'Phiếu nhập', cash: 'Thu chi', debt: 'Công nợ', shell: 'Vỏ bình', material: 'Vật tư', maintenance: 'Bảo trì' }

export default function AuditLogsPage() {
  const l = useList('/audit-logs', { entity: '' })
  const columns = [
    colFn('Thời gian', r => r.at, { cell: ({ row: { original: r } }) => fmtDateTime(r.at) }),
    col('Người thực hiện', 'userName'),
    colFn('Đối tượng', r => r.entity, { cell: ({ row: { original: r } }) => ENTITIES[r.entity] || r.entity }),
    col('Thao tác', 'action'),
    col('Nội dung', 'summary')
  ]
  return (
    <>
      <PageHeader title='Nhật ký hoạt động' subtitle='Lịch sử thao tác quan trọng — chỉ quản trị xem được' />
      <Card>
        <DataTableToolbar search={l.search} onSearchChange={l.setSearch} limit={l.limit} onLimitChange={l.setLimit} placeholder='Tìm nội dung, người thực hiện…' itemLabel='dòng'>
          <div style={{ minWidth: 180 }}>
            <SelectField placeholder='Đối tượng' options={Object.entries(ENTITIES).map(([value, label]) => ({ value, label }))} value={l.filters.entity} onChange={v => l.setFilter('entity', v)} />
          </div>
        </DataTableToolbar>
        <DataTable columns={columns} rows={l.rows} total={l.total} page={l.page} limit={l.limit} onPageChange={l.onPageChange} loading={l.isFetching} />
      </Card>
    </>
  )
}
