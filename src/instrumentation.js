// Chạy một lần khi server Next.js khởi động. Chỉ nạp mã Node.js khi đang ở runtime nodejs (tránh đóng gói cho Edge).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node')
  }
}
