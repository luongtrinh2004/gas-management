// Seed an toàn cho deploy: 4 tài khoản theo vai trò + danh mục sản phẩm. Chỉ chạy khi DB trống.
// Chạy: npm run seed. Mật khẩu lấy từ SEED_PASSWORD (.env.local); nếu không đặt, sinh ngẫu nhiên và in ra MỘT LẦN.
// Dữ liệu mô phỏng (khách hàng, đơn, thu chi…): npm run simulate (cần app đang chạy)
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import mongoose from 'mongoose'
import { connectDB } from '../src/server/db'
import { User, Product } from '../src/server/models'

async function main() {
  await connectDB()
  if (await User.countDocuments()) {
    console.log('Đã có dữ liệu — bỏ qua seed (xóa DB để seed lại).')
    process.exit(0)
  }
  await Promise.all(Object.values(mongoose.models).map(m => m.createCollection().catch(() => {}).then(() => m.syncIndexes())))
  const plain = process.env.SEED_PASSWORD || crypto.randomBytes(9).toString('base64url')
  if (!process.env.SEED_PASSWORD) console.log(`Mật khẩu khởi tạo (chỉ hiện một lần, hãy lưu lại): ${plain}`)
  const pw = await bcrypt.hash(plain, 10)
  await User.insertMany([
    { email: 'admin@gmail.com', name: 'Nguyễn Văn Hùng', phone: '0912000001', gender: 'male', role: 'admin', passwordHash: pw },
    { email: 'office@gmail.com', name: 'Trần Thị Mai', phone: '0912000002', gender: 'female', role: 'office', passwordHash: pw },
    { email: 'driver@gmail.com', name: 'Lê Văn Nam', phone: '0912000003', gender: 'male', role: 'driver', passwordHash: pw },
    { email: 'accountant@gmail.com', name: 'Phạm Thu Hà', phone: '0912000004', gender: 'female', role: 'accountant', passwordHash: pw }
  ])
  await Product.insertMany([
    { code: 'GAS45', name: 'Gas 45kg', unit: 'binh', kgPerUnit: 45 },
    { code: 'GAS48', name: 'Gas 48kg', unit: 'binh', kgPerUnit: 48 },
    { code: 'GAS12', name: 'Gas 12kg', unit: 'binh', kgPerUnit: 12 },
    { code: 'GAS6', name: 'Gas 6kg', unit: 'binh', kgPerUnit: 6 },
    { code: 'GASMINI', name: 'Gas mini', unit: 'thung', note: 'Tính theo thùng — quy cách/thùng chờ xác nhận' }
  ])
  console.log('Đã tạo tài khoản: admin@, office@, driver@, accountant@gmail.com + 5 sản phẩm.')
  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
