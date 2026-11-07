import ExcelJS from 'exceljs'

// columns: [{ header, key, width?, numFmt? }], rows: object[] -> Response (.xlsx)
export async function xlsxResponse(filename, sheets) {
  const wb = new ExcelJS.Workbook()
  for (const sh of Array.isArray(sheets) ? sheets : [sheets]) {
    const ws = wb.addWorksheet((sh.name || 'Báo cáo').slice(0, 31))
    ws.columns = sh.columns.map(c => ({ header: c.header, key: c.key, width: c.width || 16, style: c.numFmt ? { numFmt: c.numFmt } : undefined }))
    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEBFD' } }
    sh.rows.forEach(r => ws.addRow(r))
    if (sh.totals) ws.addRow(sh.totals).font = { bold: true }
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }
  const buf = await wb.xlsx.writeBuffer()
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.xlsx`
    }
  })
}
