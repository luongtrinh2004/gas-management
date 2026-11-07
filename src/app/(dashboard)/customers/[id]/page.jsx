'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Card from '@mui/material/Card'
import PageHeader from '@components/app/PageHeader'
import StatusChip from '@components/app/StatusChip'
import { api } from '@/utils/api'
import CustomerInfo from '@/views/catalog/CustomerInfo'
import CustomerPrices from '@/views/catalog/CustomerPrices'
import CustomerOrders from '@/views/catalog/CustomerOrders'
import CustomerLedger from '@/views/finance/CustomerLedger'

export default function CustomerDetailPage() {
  const { id } = useParams()
  const [tab, setTab] = useState('info')
  const { data: c } = useQuery({ queryKey: ['/customers', id], queryFn: () => api(`/customers/${id}`) })
  if (!c) return null
  return (
    <>
      <PageHeader
        back={{ href: '/customers', label: 'Khách hàng' }}
        title={`${c.code} · ${c.name}`}
        subtitle={[c.phone, c.address].filter(Boolean).join(' · ')}
        actions={<StatusChip status={c.status} />}
      />
      <Card className='mbe-6'>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant='scrollable' scrollButtons='auto'>
          <Tab value='info' label='Thông tin & hợp đồng' icon={<i className='tabler-id' />} iconPosition='start' />
          <Tab value='prices' label='Bảng giá riêng' icon={<i className='tabler-tags' />} iconPosition='start' />
          <Tab value='orders' label='Đơn hàng' icon={<i className='tabler-clipboard-list' />} iconPosition='start' />
          <Tab value='ledger' label='Công nợ · vỏ · gas dư' icon={<i className='tabler-report-money' />} iconPosition='start' />
        </Tabs>
      </Card>
      {tab === 'info' && <CustomerInfo customer={c} />}
      {tab === 'prices' && <CustomerPrices customerId={id} />}
      {tab === 'orders' && <CustomerOrders customerId={id} />}
      {tab === 'ledger' && <CustomerLedger customerId={id} />}
    </>
  )
}
