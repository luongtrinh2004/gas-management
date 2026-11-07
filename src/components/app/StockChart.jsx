'use client'

import AppReactApexCharts from '@/libs/styles/AppReactApexCharts'

const GREEN = '#28C76F'
const money = v => `${Math.round(v).toLocaleString('vi-VN')} đ`
const axis = v => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(v % 1e6 ? 1 : 0).replace('.', ',')}tr` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v))

// Biểu đồ vùng xanh kiểu chứng khoán: đường mượt + nền gradient + chấm ở điểm mới nhất + đường dóng khi rê chuột
export default function StockChart({ categories = [], data = [], name = 'Doanh thu', height = 300, color = GREEN }) {
  const muted = '#8a8d93'
  const last = data.length - 1
  const options = {
    chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit', animations: { easing: 'easeinout', speed: 600 } },
    colors: [color],
    stroke: { curve: 'smooth', width: 3 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.38, opacityTo: 0.02, stops: [0, 95, 100] } },
    dataLabels: { enabled: false },
    markers: {
      size: 0,
      hover: { size: 6, sizeOffset: 2 },
      discrete: last >= 0 ? [{ seriesIndex: 0, dataPointIndex: last, fillColor: color, strokeColor: '#fff', size: 6 }] : []
    },
    xaxis: {
      categories,
      labels: { style: { colors: muted, fontSize: '12px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
      crosshairs: { show: true, stroke: { color, width: 1, dashArray: 4 } },
      tooltip: { enabled: false }
    },
    yaxis: { min: 0, labels: { formatter: axis, style: { colors: muted, fontSize: '12px' } } },
    grid: { borderColor: 'rgba(128,131,144,0.2)', strokeDashArray: 5, padding: { left: 8, right: 12 } },
    legend: { show: false },
    tooltip: { shared: true, intersect: false, y: { formatter: money } }
  }
  return <AppReactApexCharts type='area' height={height} width='100%' options={options} series={[{ name, data }]} />
}
