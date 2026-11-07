'use client'

import AppReactApexCharts from '@/libs/styles/AppReactApexCharts'

// series: [{ name, data: [] }]; categories: []
export default function BarChart({ categories, series, height = 300, colors, stacked }) {
  const muted = '#8a8d93'
  const grid = 'rgba(128,131,144,0.25)'
  const options = {
    chart: { type: 'bar', toolbar: { show: false }, stacked: !!stacked, fontFamily: 'inherit' },
    colors: colors || ['#7367F0', '#FF9F43', '#28C76F', '#00BAD1'],
    plotOptions: { bar: { borderRadius: 4, columnWidth: '45%' } },
    dataLabels: { enabled: false },
    stroke: { show: false },
    xaxis: { categories, labels: { style: { colors: muted } }, axisBorder: { show: false } },
    yaxis: { labels: { formatter: v => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(0)}tr` : v.toLocaleString('vi-VN')), style: { colors: muted } } },
    tooltip: { y: { formatter: v => `${Math.round(v).toLocaleString('vi-VN')} đ` } },
    grid: { borderColor: grid, strokeDashArray: 6 },
    legend: { position: 'top', horizontalAlign: 'right'}
  }
  return (
    <AppReactApexCharts type='bar' height={height} width='100%' options={options} series={series} />
  )
}
