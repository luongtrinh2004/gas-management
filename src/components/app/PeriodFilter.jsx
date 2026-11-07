'use client'

import { useState } from 'react'
import Button from '@mui/material/Button'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { DateField } from './fields'

const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
export const monthRange = (d = new Date()) => ({ from: iso(new Date(d.getFullYear(), d.getMonth(), 1)), to: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) })
export const todayRange = () => ({ from: iso(new Date()), to: iso(new Date()) })

// Bộ lọc kỳ báo cáo: Ngày / Tháng / Tùy chọn. value = {from,to}; onChange({from,to})
export default function PeriodFilter({ value, onChange, children }) {
  const [mode, setMode] = useState('month')
  const setMode2 = m => {
    if (!m) return
    setMode(m)
    if (m === 'day') onChange(todayRange())
    if (m === 'month') onChange(monthRange())
  }
  return (
    <div className='flex flex-wrap items-center gap-3'>
      <ToggleButtonGroup size='small' exclusive value={mode} onChange={(_, m) => setMode2(m)}>
        <ToggleButton value='day'>Ngày</ToggleButton>
        <ToggleButton value='month'>Tháng</ToggleButton>
        <ToggleButton value='range'>Tùy chọn</ToggleButton>
      </ToggleButtonGroup>
      <div style={{ width: 160 }}><DateField value={value.from} onChange={v => { setMode('range'); onChange({ ...value, from: v }) }} /></div>
      <span>→</span>
      <div style={{ width: 160 }}><DateField value={value.to} onChange={v => { setMode('range'); onChange({ ...value, to: v }) }} /></div>
      {children}
    </div>
  )
}
