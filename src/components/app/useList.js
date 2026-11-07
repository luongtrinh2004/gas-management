'use client'

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/utils/api'

// Hook danh sách phân trang + tìm kiếm + bộ lọc, đồng bộ với react-query
export function useList(path, initialFilters = {}, { limit: initLimit = 10 } = {}) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(initLimit)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(initialFilters)
  const query = { page, limit, q: search, ...filters }
  const q = useQuery({ queryKey: [path, query], queryFn: () => api(path, { query }), placeholderData: keepPreviousData })
  return {
    ...q,
    rows: q.data?.rows || [],
    total: q.data?.total || 0,
    page,
    limit,
    search,
    filters,
    setSearch: v => {
      setSearch(v)
      setPage(1)
    },
    setLimit: v => {
      setLimit(v)
      setPage(1)
    },
    setFilter: (k, v) => {
      setFilters(f => ({ ...f, [k]: v }))
      setPage(1)
    },
    onPageChange: (_, idx) => setPage(idx + 1)
  }
}
