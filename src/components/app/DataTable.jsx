'use client'

import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import classnames from 'classnames'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import TablePaginationComponent from '@components/TablePaginationComponent'
import tableStyles from '@core/styles/table.module.css'

// columns: [{ header, accessorKey | cell, align: 'left'|'right'|'center' }]
export default function DataTable({ columns, rows = [], total = 0, page = 1, limit = 10, onPageChange, loading, onRowClick, empty = 'Chưa có dữ liệu' }) {
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel(), manualPagination: true })
  const al = c => c.meta?.align || 'left'

  return (
    <>
      <div className='overflow-x-auto relative'>
        {loading && (
          <div className='absolute inset-0 flex items-center justify-center z-10' style={{ background: 'rgba(255,255,255,0.35)' }}>
            <CircularProgress size={28} />
          </div>
        )}
        <table className={tableStyles.table}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id} style={{ textAlign: al(h.column.columnDef) }}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center' }}>
                  <Typography className='plb-6' color='text.secondary'>
                    {loading ? 'Đang tải…' : empty}
                  </Typography>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className={classnames({ 'cursor-pointer': !!onRowClick })} onClick={onRowClick ? () => onRowClick(row.original) : undefined} style={{ transition: 'background .15s' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(115, 103, 240, 0.04)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} style={{ textAlign: al(cell.column.columnDef) }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {onPageChange && <TablePaginationComponent table={table} total={total} page={page} limit={limit} onPageChange={onPageChange} />}
    </>
  )
}

export const col = (header, accessorKey, o = {}) => ({ header, accessorKey, cell: o.cell || (info => info.getValue() ?? '—'), meta: { align: o.align }, ...(o.size ? { size: o.size } : {}) })
export const colFn = (header, fn, o = {}) => ({ header, id: o.id || header, accessorFn: fn, cell: o.cell || (info => info.getValue() ?? '—'), meta: { align: o.align } })
