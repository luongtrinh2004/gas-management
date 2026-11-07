// Tải file (Excel) từ API có xác thực cookie
export async function downloadFile(path, query = {}, filename = 'export.xlsx') {
  const qs = '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)).toString()
  const res = await fetch((process.env.NEXT_PUBLIC_BASEPATH || '') + '/api' + path + qs, { credentials: 'same-origin' })
  if (!res.ok) {
    let msg = 'Không thể xuất file'
    try { msg = (await res.json()).error || msg } catch {}
    throw new Error(msg)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
