'use client'

import { useRef, useState } from 'react'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { toast } from 'react-toastify'

// Ảnh chứng từ: value = [{name,url}], onChange(newArray). readOnly: chỉ xem.
export default function FileUpload({ value = [], onChange, readOnly, label = 'Ảnh hóa đơn / chứng từ' }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  const base = process.env.NEXT_PUBLIC_BASEPATH || ''

  const pick = async e => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    try {
      const added = []
      for (const f of files) {
        const fd = new FormData()
        fd.append('file', f)
        const res = await fetch(base + '/api/files', { method: 'POST', body: fd, credentials: 'same-origin' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Tải lên thất bại')
        added.push(j.data)
      }
      onChange([...(value || []), ...added])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between gap-2'>
        <Typography variant='body2' className='font-medium'>{label}</Typography>
        {!readOnly && (
          <>
            <input ref={ref} type='file' accept='image/*,application/pdf' capture='environment' multiple hidden onChange={pick} />
            <Button size='small' variant='tonal' disabled={busy} startIcon={<i className='tabler-camera' />} onClick={() => ref.current?.click()}>
              {busy ? 'Đang tải…' : 'Chụp / tải ảnh'}
            </Button>
          </>
        )}
      </div>
      {(value || []).length === 0 && <Typography variant='caption' color='text.secondary'>Chưa có tệp đính kèm</Typography>}
      <div className='flex flex-wrap gap-3'>
        {(value || []).map((f, i) => {
          const isPdf = /\.pdf$/i.test(f.url)
          return (
            <div key={f.url + i} className='relative' style={{ width: 96 }}>
              <a href={base + f.url} target='_blank' rel='noreferrer'>
                {isPdf ? (
                  <div className='flex items-center justify-center rounded border' style={{ width: 96, height: 96 }}><i className='tabler-file-type-pdf text-[36px]' /></div>
                ) : (
                  <img src={base + f.url} alt={f.name} className='rounded border object-cover' style={{ width: 96, height: 96 }} />
                )}
              </a>
              {!readOnly && (
                <IconButton size='small' color='error' className='absolute' style={{ top: -8, right: -8, background: 'var(--mui-palette-background-paper)' }} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  <i className='tabler-x text-[16px]' />
                </IconButton>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
