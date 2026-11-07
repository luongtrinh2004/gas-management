// Tạo 4 tài khoản theo vai trò + danh mục sản phẩm khi DB còn trống. Dùng chung cho `npm run seed` và tự seed khi khởi động.
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDB } from './db'
import { User, Product } from './models'

export async function seedIfEmpty({ password }) {
  await connectDB()
  if (await User.countDocuments()) return { created: false, message: 'Đã có dữ liệu — bỏ qua seed.' }
  await Promise.all(Object.values(mongoose.models).map(m => m.createCollection().catch(() => {}).then(() => m.syncIndexes())))
  const pw = await bcrypt.hash(password, 10)
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
  return { created: true, message: 'Đã tạo tài khoản: admin@, office@, driver@, accountant@gmail.com + 5 sản phẩm.' }
}
