'use client'

import { useMemo, useState } from 'react'
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import DataTableToolbar from '@components/DataTableToolbar'
import ConfirmDialog from '@components/ConfirmDialog'
import PageHeader from './PageHeader'
import DataTable from './DataTable'
import FormDialog from './FormDialog'
import { SelectField } from './fields'
import { useList } from './useList'
import { useAction } from './useAction'

// Trang danh mục chuẩn: danh sách + tìm kiếm + lọc + thêm/sửa/xóa
export default function MasterPage({ title, subtitle, path, columns, fields, filters = [], canWrite, canDelete, defaultValues = {}, searchPlaceholder = 'Tìm kiếm…', itemLabel, onRowClick, toPayload, mapRow, extraActions }) {
  const list = useList(path, Object.fromEntries(filters.map(f => [f.name, ''])))
  const act = useAction()
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)

  const cols = useMemo(
    () => [
      ...columns,
      ...(canWrite || canDelete
        ? [
            {
              header: 'Thao tác',
              id: 'actions',
              meta: { align: 'center' },
              cell: ({ row }) => (
                <div className='flex items-center justify-center gap-1' onClick={e => e.stopPropagation()}>
                  {canWrite && (
                    <Tooltip title='Sửa'>
                      <IconButton size='small' onClick={() => setEdit({ ...(mapRow ? mapRow(row.original) : row.original) })}>
                        <i className='tabler-edit text-[20px]' />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title='Xóa'>
                      <IconButton size='small' color='error' onClick={() => setDel(row.original)}>
                        <i className='tabler-trash text-[20px]' />
                      </IconButton>
                    </Tooltip>
                  )}
                </div>
              )
            }
          ]
        : [])
    ],
    [columns, canWrite, canDelete]
  )

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {extraActions}
            {canWrite && (
              <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => setEdit({ ...defaultValues })}>
                Thêm mới
              </Button>
            )}
          </>
        }
      />
      <Card>
        <DataTableToolbar search={list.search} onSearchChange={list.setSearch} limit={list.limit} onLimitChange={list.setLimit} placeholder={searchPlaceholder} itemLabel={itemLabel}>
          {filters.map(f => (
            <div key={f.name} style={{ minWidth: 160 }}>
              <SelectField options={f.options} placeholder={f.label} value={list.filters[f.name]} onChange={v => list.setFilter(f.name, v)} />
            </div>
          ))}
        </DataTableToolbar>
        <DataTable columns={cols} rows={list.rows} total={list.total} page={list.page} limit={list.limit} onPageChange={list.onPageChange} loading={list.isFetching} onRowClick={onRowClick} />
      </Card>

      <FormDialog
        open={!!edit}
        title={edit?._id ? `Sửa ${title.toLowerCase()}` : `Thêm ${title.toLowerCase()}`}
        fields={fields}
        initial={edit}
        onClose={() => setEdit(null)}
        onSubmit={async v => {
          const body = toPayload ? toPayload(v) : v
          await act(edit?._id ? `${path}/${edit._id}` : path, { method: edit?._id ? 'PUT' : 'POST', body, ok: 'Đã lưu' })
        }}
      />
      <ConfirmDialog
        open={!!del}
        message='Bạn có chắc muốn xóa mục này? Thao tác không thể hoàn tác.'
        confirmText='Xóa'
        onClose={() => setDel(null)}
        onConfirm={async () => {
          await act(`${path}/${del._id}`, { method: 'DELETE', ok: 'Đã xóa' }).catch(() => {})
          setDel(null)
        }}
      />
    </>
  )
}
