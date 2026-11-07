'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/utils/api'

// Tải danh sách rút gọn để chọn (Select): [{value,label}]
export function useOptions(path, query, map) {
  const q = useQuery({ queryKey: ['opt', path, query], queryFn: () => api(path, { query }), staleTime: 60_000 })
  const options = (Array.isArray(q.data) ? q.data : q.data?.rows || []).map(map || (r => ({ value: r._id, label: r.name })))
  return { options, raw: Array.isArray(q.data) ? q.data : q.data?.rows || [], isLoading: q.isLoading }
}
