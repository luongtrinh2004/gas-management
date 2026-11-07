export const fmtMoney = (v, ccy = 'VND') => {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—'
  const n = Number(v)
  const s = ccy === 'VND' ? Math.round(n).toLocaleString('vi-VN') : n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${s} ${ccy === 'VND' ? 'đ' : ccy}`
}
export const fmtNum = v => (v == null ? '—' : Number(v).toLocaleString('vi-VN'))
export const fmtDate = d => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')
export const fmtDateTime = d => (d ? new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
export const toInputDate = d => (d ? new Date(d).toISOString().slice(0, 10) : '')
export const fmtPct = v => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`)
