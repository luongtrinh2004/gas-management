'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import OrderForm from '@/views/orders/OrderForm'
import { api } from '@/utils/api'

export default function EditOrderPage() {
  const { id } = useParams()
  const { data, isLoading, error } = useQuery({ queryKey: ['order', id], queryFn: () => api(`/orders/${id}`) })
  if (isLoading) return <CircularProgress />
  if (error) return <Alert severity='error'>{error.message}</Alert>
  return <OrderForm initial={data} />
}
