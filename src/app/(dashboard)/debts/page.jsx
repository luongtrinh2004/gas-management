'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import PageHeader from '@components/app/PageHeader'
import StatCards from '@components/app/StatCards'
import DataTable, { colFn } from '@components/app/DataTable'
import DataTableToolbar from '@components/DataTableToolbar'
import PeriodFilter, { monthRange } from '@components/app/PeriodFilter'
import { SelectField } from '@components/app/fields'
import CustomChip from '@core/components/mui/Chip'
import { useList } from '@components/app/useList'
import { useSession } from '@components/SessionProvider'
import { fmtMoney } from '@/utils/format'
import { PaymentDialog, AdjustDialog } from '@views/finance/dialogs'

const STATUS_OPTS = [
  { value: '', label: 'Tất cả trạng thái nợ' },
  { value: 'debt', label: 'Chỉ khách còn nợ (> 0)' },
  { value: 'overpaid', label: 'Khách trả thừa / Tạm ứng (< 0)' },
  { value: 'zero', label: 'Đã hết nợ (0 ₫)' },
]

export default function DebtsPage() {
  const s = useSession()
  const router = useRouter()
  const canWrite = ['admin', 'accountant'].includes(s.role)
  const list = useList('/debts', { ...monthRange(), status: '' })
  const [pay, setPay] = useState(null) // { customerId?, currentDebt?, customerName? }
  const [adj, setAdj] = useState(null)
  const t = list.data?.totals || {}

  const finalCard = () => {
    const hasDebt = (t.totalDebt || 0) > 0
    const hasOverpaid = (t.totalOverpaid || 0) > 0
    if (hasDebt && hasOverpaid) {
      return {
        label: 'Dư cuối kỳ (còn phải thu)',
        value: t.totalDebt,
        money: true,
        icon: 'tabler-report-money',
        color: 'error',
        sub: `Có ${fmtMoney(t.totalOverpaid)} khách trả thừa / tạm ứng`,
      }
    }
    if (t.closing < 0) {
      return {
        label: 'Dư cuối kỳ (khách trả thừa / tạm ứng)',
        value: Math.abs(t.closing),
        money: true,
        icon: 'tabler-wallet',
        color: 'info',
        sub: 'Khách hàng đang ứng trước tiền',
      }
    }
    if (t.closing > 0) {
      return {
        label: 'Dư cuối kỳ (phải thu)',
        value: t.closing,
        money: true,
        icon: 'tabler-report-money',
        color: 'error',
      }
    }
    return {
      label: 'Dư cuối kỳ (hết nợ)',
      value: 0,
      money: true,
      icon: 'tabler-check',
      color: 'secondary',
    }
  }

  const columns = [
    colFn('Khách hàng', (r) => r.customer.name, {
      cell: ({ row: { original: r } }) => (
        <div
          className='flex flex-col cursor-pointer group'
          onClick={() => router.push(`/customers/${r.customer._id}`)}
        >
          <span className='font-medium text-primary group-hover:underline flex items-center gap-1'>
            {r.customer.name}
            <i className='tabler-arrow-up-right text-[15px] opacity-70' />
          </span>
          <span className='text-textSecondary text-sm'>
            {r.customer.code} {r.customer.phone ? '· ' + r.customer.phone : ''}
          </span>
        </div>
      ),
    }),
    colFn('Dư đầu kỳ', (r) => r.opening, {
      align: 'right',
      cell: ({ row: { original: r } }) => fmtMoney(r.opening),
    }),
    colFn('Phát sinh tăng', (r) => r.increase, {
      align: 'right',
      cell: ({ row: { original: r } }) => fmtMoney(r.increase),
    }),
    colFn('Đã thu / giảm', (r) => r.decrease, {
      align: 'right',
      cell: ({ row: { original: r } }) => fmtMoney(r.decrease),
    }),
    colFn('Dư cuối kỳ', (r) => r.closing, {
      align: 'right',
      cell: ({ row: { original: r } }) => {
        if (r.closing > 0) {
          return (
            <b style={{ color: 'var(--mui-palette-error-main)' }}>
              {fmtMoney(r.closing)}
            </b>
          )
        }
        if (r.closing < 0) {
          return (
            <div className='flex items-center justify-end gap-1.5'>
              <b style={{ color: 'var(--mui-palette-info-main)' }}>
                {fmtMoney(r.closing)}
              </b>
              <CustomChip
                round='true'
                size='small'
                variant='tonal'
                color='info'
                label='Trả thừa'
              />
            </div>
          )
        }
        return <span className='text-textSecondary'>0 ₫</span>
      },
    }),
  ]

  if (canWrite) {
    columns.push({
      header: 'Thao tác',
      id: 'actions',
      meta: { align: 'center' },
      cell: ({ row: { original: r } }) => (
        <div
          onClick={(e) => e.stopPropagation()}
          className='flex justify-center gap-1'
        >
          {r.closing > 0 ? (
            <Button
              size='small'
              variant='tonal'
              color='primary'
              startIcon={<i className='tabler-cash' />}
              onClick={() =>
                setPay({
                  customerId: r.customer._id,
                  currentDebt: r.closing,
                  customerName: r.customer.name,
                })
              }
            >
              Thu nợ
            </Button>
          ) : (
            <Button
              size='small'
              variant='tonal'
              color={r.closing < 0 ? 'info' : 'secondary'}
              startIcon={<i className='tabler-file-invoice' />}
              onClick={() => router.push(`/customers/${r.customer._id}`)}
            >
              Xem sổ
            </Button>
          )}
          <Button
            size='small'
            variant='tonal'
            color='secondary'
            onClick={() => setAdj({ customerId: r.customer._id })}
          >
            Điều chỉnh
          </Button>
        </div>
      ),
    })
  }

  return (
    <>
      <PageHeader
        title='Công nợ khách hàng'
        subtitle='Tổng hợp từ đơn đã duyệt, phiếu thu và điều chỉnh có lưu vết'
        actions={
          canWrite && (
            <Button
              variant='contained'
              startIcon={<i className='tabler-cash' />}
              onClick={() => setPay({})}
            >
              Thu nợ
            </Button>
          )
        }
      />
      <div className='mbe-6'>
        <PeriodFilter
          value={{ from: list.filters.from, to: list.filters.to }}
          onChange={(v) => {
            list.setFilter('from', v.from)
            list.setFilter('to', v.to)
          }}
        />
      </div>
      <StatCards
        size={{ xs: 12, sm: 6, md: 3 }}
        cards={[
          {
            label: 'Dư đầu kỳ',
            value: t.opening,
            money: true,
            icon: 'tabler-arrow-bar-to-right',
            color: 'secondary',
          },
          {
            label: 'Phát sinh tăng',
            value: t.increase,
            money: true,
            icon: 'tabler-trending-up',
            color: 'warning',
          },
          {
            label: 'Đã thu / giảm',
            value: t.decrease,
            money: true,
            icon: 'tabler-trending-down',
            color: 'success',
          },
          finalCard(),
        ]}
      />
      <Card className='mbs-6'>
        <DataTableToolbar
          search={list.search}
          onSearchChange={list.setSearch}
          limit={list.limit}
          onLimitChange={list.setLimit}
          placeholder='Tìm khách hàng…'
          itemLabel='khách'
        >
          <div style={{ minWidth: 230 }}>
            <SelectField
              placeholder='Tất cả trạng thái nợ'
              options={STATUS_OPTS}
              value={list.filters.status}
              onChange={(v) => list.setFilter('status', v)}
            />
          </div>
        </DataTableToolbar>
        <DataTable
          columns={columns}
          rows={list.rows}
          total={list.total}
          page={list.page}
          limit={list.limit}
          onPageChange={list.onPageChange}
          loading={list.isFetching}
          onRowClick={(r) => router.push(`/customers/${r.customer._id}`)}
        />
      </Card>
      <PaymentDialog
        open={!!pay}
        customerId={pay?.customerId}
        currentDebt={pay?.currentDebt}
        customerName={pay?.customerName}
        onClose={() => setPay(null)}
      />
      <AdjustDialog
        open={!!adj}
        customerId={adj?.customerId}
        onClose={() => setAdj(null)}
      />
    </>
  )
}
