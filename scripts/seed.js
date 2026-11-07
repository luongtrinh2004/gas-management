// Seed an toàn cho deploy: 4 tài khoản theo vai trò + danh mục sản phẩm. Chỉ chạy khi DB trống.
// Chạy: npm run seed. Mật khẩu lấy từ SEED_PASSWORD (.env.local); nếu không đặt, sinh ngẫu nhiên và in ra MỘT LẦN.
// Dữ liệu mô phỏng (khách hàng, đơn, thu chi…): npm run simulate (cần app đang chạy)
import crypto from 'crypto'
import { seedIfEmpty } from '../src/server/seed'

async function main() {
  const plain = process.env.SEED_PASSWORD || crypto.randomBytes(9).toString('base64url')
  const r = await seedIfEmpty({ password: plain })
  if (r.created && !process.env.SEED_PASSWORD) console.log(`Mật khẩu khởi tạo (chỉ hiện một lần, hãy lưu lại): ${plain}`)
  console.log(r.message)
  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
