'use client'

import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { api } from '@/utils/api'

// Gọi API ghi dữ liệu + toast + làm mới dữ liệu
export function useAction() {
  const qc = useQueryClient()
  return async (path, { method = 'POST', body, ok = 'Thành công', silent } = {}) => {
    try {
      const r = await api(path, { method, body })
      if (!silent) toast.success(ok)
      qc.invalidateQueries()
      return r
    } catch (e) {
      toast.error(e.message)
      throw e
    }
  }
}
