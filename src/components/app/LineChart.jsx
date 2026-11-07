'use client'

import AppReactApexCharts from '@/libs/styles/AppReactApexCharts'

const fmtM = v => (v === 0 ? '0' : Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : `${(v / 1e6).toFixed(1)}M`)
const monthLabel = k => (/^\d{4}-\d{2}$/.test(k) ? `Tháng ${k.slice(5)}/${k.slice(2, 4)}` : k)
const monthTitle = k => (/^\d{4}-\d{2}$/.test(k) ? `Tháng ${k.slice(5)}/${k.slice(0, 4)}` : k)

// Biểu đồ đường mượt có chấm: series [{ name, data }], categories là khóa 'YYYY-MM'
export default function LineChart({ categories = [], series = [], colors = ['#FF4C51', '#28C76F'], height = 320 }) {
  const muted = '#8a8d93'
  const options = {
    chart: { type: 'line', toolbar: { show: false }, fontFamily: 'inherit', zoom: { enabled: false } },
    colors,
    stroke: { curve: 'smooth', width: 3 },
    markers: { size: 5, strokeWidth: 0, hover: { size: 8 } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: categories.map(monthLabel),
      labels: { style: { colors: muted, fontSize: '12px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: true }
    },
    yaxis: { labels: { formatter: fmtM, style: { colors: muted, fontSize: '12px' } } },
    grid: { borderColor: 'rgba(128,131,144,0.25)', strokeDashArray: 6, padding: { left: 8, right: 8 } },
    legend: { position: 'top', horizontalAlign: 'right', markers: { shape: 'circle', size: 6 }, itemMargin: { horizontal: 12 } },
    tooltip: {
      shared: true,
      intersect: false,
      x: { formatter: (_, o) => monthTitle(categories[o?.dataPointIndex] ?? '') },
      y: { formatter: v => `${Math.round(v).toLocaleString('vi-VN')} đ` }
    }
  }
  return <AppReactApexCharts type='line' height={height} width='100%' options={options} series={series} />
}
