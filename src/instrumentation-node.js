// Tự tạo tài khoản đầu tiên nếu DB trống VÀ SEED_ON_START=true (dùng khi hosting không cho chạy lệnh/kết nối DB từ ngoài).
// Sau khi đăng nhập được, hãy XÓA biến SEED_ON_START và SEED_PASSWORD khỏi môi trường.
import { seedIfEmpty } from './server/seed'

if (process.env.SEED_ON_START === 'true') {
  const password = process.env.SEED_PASSWORD
  if (!password || password.length < 8) {
    console.error('[seed] Bỏ qua: cần SEED_PASSWORD tối thiểu 8 ký tự')
  } else {
    seedIfEmpty({ password })
      .then(r => console.log('[seed]', r.message))
      .catch(e => console.error('[seed] Lỗi:', e.message))
  }
}
