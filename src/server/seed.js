// Bộ khởi tạo dữ liệu mẫu phong phú và toàn diện cho hệ thống Quản lý Kinh doanh Gas.
// Dùng chung cho: `npm run seed`, `npm run seed -- --force`, và tự seed khi khởi động nếu DB trống (SEED_ON_START=true).
import bcrypt from 'bcryptjs'
import zlib from 'zlib'
import path from 'path'
import fs from 'fs'
import mongoose from './db'
import { connectDB } from './db'
import {
  User,
  Product,
  Supplier,
  Customer,
  CustomerPrice,
  Order,
  Import,
  CashTx,
  DebtAdjust,
  ShellEntry,
  ResidualEntry,
  Material,
  MaterialTx,
  Maintenance,
  Setting,
  AuditLog,
  Counter,
} from './models'
import { DEFAULT_SETTINGS } from './constants'

// ---------- Tiện ích tạo ảnh hóa đơn PNG hợp lệ ----------
const crcT = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
const crc = (b) => {
  let c = -1
  for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (t, d) => {
  const l = Buffer.alloc(4)
  l.writeUInt32BE(d.length)
  const td = Buffer.concat([Buffer.from(t), d])
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc(td))
  return Buffer.concat([l, td, c])
}
function invoicePng(seed = 1) {
  const W = 300,
    H = 420,
    px = Buffer.alloc(W * H * 3, 250)
  const rect = (x, y, w, h, c) => {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        const o = (j * W + i) * 3
        px[o] = c[0]
        px[o + 1] = c[1]
        px[o + 2] = c[2]
      }
  }
  rect(0, 0, W, 46, [115, 103, 240])
  rect(20, 14, 120, 16, [255, 255, 255])
  for (let r = 0; r < 14; r++) {
    rect(20, 70 + r * 22, 100 + ((r * 37 + seed * 53) % 140), 8, [90, 90, 100])
    rect(236, 70 + r * 22, 44, 8, [90, 90, 100])
  }
  rect(20, 390, 260, 2, [60, 60, 60])
  rect(170, 370, 110, 12, [200, 40, 40])
  const raw = Buffer.alloc((W * 3 + 1) * H)
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0
    px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function ensureSampleImages() {
  const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), '.uploads')
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const list = []
    for (let i = 1; i <= 6; i++) {
      const filename = `sample-invoice-${i}.png`
      const filepath = path.join(dir, filename)
      if (!fs.existsSync(filepath)) {
        fs.writeFileSync(filepath, invoicePng(i))
      }
      list.push({
        name: `Hóa đơn bán hàng #${i}.png`,
        url: `/api/files?f=${filename}`,
      })
    }
    return list
  } catch {
    return [
      {
        name: 'Hóa đơn bán hàng #1.png',
        url: '/api/files?f=sample-invoice-1.png',
      },
    ]
  }
}

export async function seedIfEmpty({ password, force = false }) {
  await connectDB()

  const existingUsers = await User.countDocuments()
  const existingOrders = await Order.countDocuments()

  if (!force && existingUsers > 0 && existingOrders > 0) {
    return { created: false, message: 'Đã có dữ liệu đầy đủ — bỏ qua seed.' }
  }

  // Nếu force: xóa sạch dữ liệu cũ
  if (force) {
    await Promise.all(
      Object.values(mongoose.models).map((m) =>
        m.deleteMany({}).catch(() => {}),
      ),
    )
  } else if (existingUsers > 0 && existingOrders === 0) {
    // Có users nhưng chưa có orders (chỉ mới seed sơ khởi), dọn sạch để nạp bộ dữ liệu đầy đủ
    await Promise.all(
      Object.values(mongoose.models).map((m) =>
        m.deleteMany({}).catch(() => {}),
      ),
    )
  }

  await Promise.all(
    Object.values(mongoose.models).map((m) =>
      m
        .createCollection()
        .catch(() => {})
        .then(() => m.syncIndexes()),
    ),
  )

  const sampleImages = ensureSampleImages()
  const now = new Date()
  const currentYear = now.getFullYear()

  // Hàm tính ngày tương đối so với hôm nay
  const dayAt = (offsetDays, hour = 8, minute = 0) => {
    const d = new Date(now.getTime() + offsetDays * 86400e3)
    d.setHours(hour, minute, 0, 0)
    return d
  }
  const dateOnly = (offsetDays) => dayAt(offsetDays).toISOString().slice(0, 10)

  // 1. NGƯỜI DÙNG (5 tài khoản cho 4 vai trò)
  const pw = await bcrypt.hash(password, 10)
  const users = await User.insertMany([
    {
      email: 'admin@gmail.com',
      name: 'Nguyễn Văn Hùng',
      phone: '0912000001',
      gender: 'male',
      role: 'admin',
      passwordHash: pw,
      status: 'active',
    },
    {
      email: 'office@gmail.com',
      name: 'Trần Thị Mai',
      phone: '0912000002',
      gender: 'female',
      role: 'office',
      passwordHash: pw,
      status: 'active',
    },
    {
      email: 'driver@gmail.com',
      name: 'Lê Văn Nam',
      phone: '0912000003',
      gender: 'male',
      role: 'driver',
      passwordHash: pw,
      status: 'active',
    },
    {
      email: 'driver2@gmail.com',
      name: 'Hoàng Văn Đức',
      phone: '0912000005',
      gender: 'male',
      role: 'driver',
      passwordHash: pw,
      status: 'active',
    },
    {
      email: 'accountant@gmail.com',
      name: 'Phạm Thu Hà',
      phone: '0912000004',
      gender: 'female',
      role: 'accountant',
      passwordHash: pw,
      status: 'active',
    },
  ])

  const [uAdmin, uOffice, uDriver1, uDriver2, uAccountant] = users

  // 2. CẤU HÌNH HỆ THỐNG
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await Setting.create({ key, value })
  }

  // 3. SẢN PHẨM GAS
  const prods = await Product.insertMany([
    {
      code: 'GAS45',
      name: 'Gas 45kg',
      unit: 'binh',
      kgPerUnit: 45,
      status: 'active',
      note: 'Gas công nghiệp cho nhà hàng, bếp ăn',
    },
    {
      code: 'GAS48',
      name: 'Gas 48kg',
      unit: 'binh',
      kgPerUnit: 48,
      status: 'active',
      note: 'Gas công nghiệp lớn',
    },
    {
      code: 'GAS12',
      name: 'Gas 12kg',
      unit: 'binh',
      kgPerUnit: 12,
      status: 'active',
      note: 'Gas dân dụng và quán ăn vừa',
    },
    {
      code: 'GAS6',
      name: 'Gas 6kg',
      unit: 'binh',
      kgPerUnit: 6,
      status: 'active',
      note: 'Gas mini gia đình nhỏ',
    },
    {
      code: 'GASMINI',
      name: 'Gas mini',
      unit: 'thung',
      unitsPerBox: 24,
      status: 'active',
      note: 'Thùng 24 bình mini du lịch/lẩu',
    },
  ])

  const pGas45 = prods.find((p) => p.code === 'GAS45')
  const pGas48 = prods.find((p) => p.code === 'GAS48')
  const pGas12 = prods.find((p) => p.code === 'GAS12')
  const pGas6 = prods.find((p) => p.code === 'GAS6')
  const pGasMini = prods.find((p) => p.code === 'GASMINI')

  // 4. NHÀ CUNG CẤP
  const sups = await Supplier.insertMany([
    {
      code: 'NCC-001',
      name: 'Công ty CP Gas Petrolimex Hà Nội',
      phone: '02438251234',
      address: 'KCN Đức Giang, Long Biên, Hà Nội',
      status: 'active',
      note: 'Nhà cung cấp chính',
    },
    {
      code: 'NCC-002',
      name: 'Công ty TNHH Gas South Miền Bắc',
      phone: '02435567890',
      address: 'KCN Quang Minh, Mê Linh, Hà Nội',
      status: 'active',
      note: 'Nhà cung cấp gas công nghiệp',
    },
    {
      code: 'NCC-003',
      name: 'Công ty CP Đầu tư Dầu khí Hưng Yên',
      phone: '02213812345',
      address: 'KCN Phố Nối A, Hưng Yên',
      status: 'active',
      note: 'Kho dự phòng',
    },
  ])

  // 5. KHÁCH HÀNG (14 khách hàng thực tế)
  const custs = await Customer.insertMany([
    {
      code: 'KH-0001',
      name: 'Nhà hàng Hương Việt',
      phone: '0901234501',
      address: '12 Nguyễn Trãi, Thanh Xuân, Hà Nội',
      contactName: 'Chị Hương (Quản lý)',
      openingDebt: 0,
      contract: {
        number: 'HĐ-2026/001',
        signedAt: dayAt(-180),
        term: '12 tháng',
        status: 'active',
        files: [],
      },
      gasSystem: {
        installStatus: 'installed',
        note: 'Hệ thống bồn trung tâm 4 bình 45kg',
      },
      status: 'active',
    },
    {
      code: 'KH-0002',
      name: 'Quán cơm Bình Dân Lê Lợi',
      phone: '0901234502',
      address: '45 Lê Lợi, Hà Đông, Hà Nội',
      contactName: 'Anh Bình',
      openingDebt: 1500000,
      contract: { status: 'none' },
      gasSystem: { installStatus: 'none' },
      status: 'active',
    },
    {
      code: 'KH-0003',
      name: 'Bếp ăn công nghiệp Phenikaa',
      phone: '0901234503',
      address: 'KCN Phenikaa, Yên Nghĩa, Hà Đông, Hà Nội',
      contactName: 'Chị Lan (Hành chính)',
      openingDebt: 8200000,
      contract: {
        number: 'HĐ-2026/002',
        signedAt: dayAt(-200),
        term: '24 tháng',
        status: 'active',
        files: [],
      },
      gasSystem: {
        installStatus: 'installed',
        investmentSupport: 'Hỗ trợ 50% van và giàn gom gas',
      },
      status: 'active',
    },
    {
      code: 'KH-0004',
      name: 'Quán phở Thìn Bờ Hồ',
      phone: '0901234504',
      address: '61 Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội',
      contactName: 'Anh Thìn',
      openingDebt: 0,
      contract: { status: 'none' },
      gasSystem: { installStatus: 'none' },
      status: 'active',
    },
    {
      code: 'KH-0005',
      name: 'Trường mầm non Hoa Sen',
      phone: '0901234505',
      address: '8 Trần Phú, Hà Đông, Hà Nội',
      contactName: 'Cô Thủy (Hiệu phó)',
      openingDebt: 0,
      contract: {
        number: 'HĐ-2026/003',
        signedAt: dayAt(-120),
        term: '12 tháng',
        status: 'active',
        files: [],
      },
      gasSystem: {
        installStatus: 'installed',
        note: 'Hệ thống an toàn tự ngắt',
      },
      status: 'active',
    },
    {
      code: 'KH-0006',
      name: 'Lẩu nướng Hàn Quốc Seoul',
      phone: '0901234507',
      address: '27 Trần Đăng Ninh, Cầu Giấy, Hà Nội',
      contactName: 'Chị Yến (Chủ quán)',
      openingDebt: 0,
      contract: { status: 'none' },
      gasSystem: { installStatus: 'none' },
      status: 'active',
    },
    {
      code: 'KH-0007',
      name: 'Bệnh viện Đa khoa Tâm Đức',
      phone: '0901234508',
      address: '102 Quang Trung, Hà Đông, Hà Nội',
      contactName: 'Anh Đức (Hậu cần)',
      openingDebt: 4500000,
      contract: {
        number: 'HĐ-2026/004',
        signedAt: dayAt(-150),
        term: '12 tháng',
        status: 'active',
        files: [],
      },
      gasSystem: { installStatus: 'installed' },
      status: 'active',
    },
    {
      code: 'KH-0008',
      name: 'Cơm văn phòng Anh Tuấn',
      phone: '0901234509',
      address: '33 Tố Hữu, Nam Từ Liêm, Hà Nội',
      contactName: 'Anh Tuấn',
      openingDebt: 0,
      contract: { status: 'none' },
      gasSystem: { installStatus: 'none' },
      status: 'active',
    },
    {
      code: 'KH-0009',
      name: 'Khách sạn Thiên Phú',
      phone: '0901234510',
      address: '15 Quang Trung, Hà Đông, Hà Nội',
      contactName: 'Chị Phú',
      openingDebt: 0,
      contract: { status: 'none' },
      gasSystem: { installStatus: 'none' },
      status: 'active',
    },
    {
      code: 'KH-0010',
      name: 'Quán bia Hơi Hà Nội 68',
      phone: '0901234511',
      address: '68 Nguyễn Khuyến, Hà Đông, Hà Nội',
      contactName: 'Anh Sơn',
      openingDebt: 0,
      contract: { status: 'none' },
      gasSystem: { installStatus: 'none' },
      status: 'active',
    },
    {
      code: 'KH-0011',
      name: 'Tiệm bánh mì Cô Ba',
      phone: '0901234512',
      address: '9 Chùa Bộc, Đống Đa, Hà Nội',
      contactName: 'Cô Ba',
      openingDebt: 0,
      contract: { status: 'none' },
      gasSystem: { installStatus: 'none' },
      status: 'active',
    },
    {
      code: 'KH-0012',
      name: 'Nhà hàng chay An Lạc',
      phone: '0901234514',
      address: '24 Văn Quán, Hà Đông, Hà Nội',
      contactName: 'Thầy Minh Tâm',
      openingDebt: 0,
      contract: { status: 'none' },
      gasSystem: { installStatus: 'none' },
      status: 'active',
      note: 'Khách hàng uy tín, thường nộp tiền tạm ứng trước',
    },
    {
      code: 'KH-0013',
      name: 'Gia đình chị Hoa',
      phone: '0901234513',
      address: 'P1205 CT2 Xa La, Hà Đông, Hà Nội',
      contactName: 'Chị Hoa',
      openingDebt: 0,
      contract: { status: 'none' },
      gasSystem: { installStatus: 'none' },
      status: 'active',
    },
    {
      code: 'KH-0014',
      name: 'Anh Minh (hộ gia đình)',
      phone: '0901234506',
      address: 'Số 5 ngõ 34 Nguyễn Văn Trỗi, Hà Đông',
      contactName: 'Anh Minh',
      openingDebt: 0,
      contract: { status: 'none' },
      gasSystem: { installStatus: 'none' },
      status: 'active',
    },
  ])

  // Map khách hàng theo mã
  const cMap = {}
  custs.forEach((c) => (cMap[c.code] = c))

  // 6. BẢNG GIÁ RIÊNG CHO TỪNG KHÁCH HÀNG
  const pricesData = [
    // Hương Việt: mua gas 45kg tính theo kg
    {
      customer: cMap['KH-0001']._id,
      product: pGas45._id,
      unit: 'kg',
      price: 36500,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    {
      customer: cMap['KH-0001']._id,
      product: pGas45._id,
      unit: 'kg',
      price: 37000,
      effectiveFrom: dayAt(-5),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
      note: 'Điều chỉnh theo giá thị trường tháng này',
    },
    // Quán cơm Bình Dân: mua gas 48kg và 12kg
    {
      customer: cMap['KH-0002']._id,
      product: pGas48._id,
      unit: 'binh',
      price: 1760000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    {
      customer: cMap['KH-0002']._id,
      product: pGas12._id,
      unit: 'binh',
      price: 435000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    // Bếp ăn Phenikaa: mua số lượng lớn
    {
      customer: cMap['KH-0003']._id,
      product: pGas45._id,
      unit: 'kg',
      price: 35800,
      effectiveFrom: dayAt(-90),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    {
      customer: cMap['KH-0003']._id,
      product: pGas12._id,
      unit: 'binh',
      price: 428000,
      effectiveFrom: dayAt(-90),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    // Phở Thìn
    {
      customer: cMap['KH-0004']._id,
      product: pGas12._id,
      unit: 'binh',
      price: 440000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    {
      customer: cMap['KH-0004']._id,
      product: pGas45._id,
      unit: 'binh',
      price: 1650000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    // Mầm non Hoa Sen
    {
      customer: cMap['KH-0005']._id,
      product: pGas45._id,
      unit: 'kg',
      price: 36800,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    // Lẩu Seoul
    {
      customer: cMap['KH-0006']._id,
      product: pGas45._id,
      unit: 'kg',
      price: 36300,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    {
      customer: cMap['KH-0006']._id,
      product: pGas12._id,
      unit: 'binh',
      price: 432000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    {
      customer: cMap['KH-0006']._id,
      product: pGasMini._id,
      unit: 'thung',
      price: 510000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    // Bệnh viện Tâm Đức
    {
      customer: cMap['KH-0007']._id,
      product: pGas48._id,
      unit: 'binh',
      price: 1740000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    // Cơm Anh Tuấn
    {
      customer: cMap['KH-0008']._id,
      product: pGas12._id,
      unit: 'binh',
      price: 438000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    {
      customer: cMap['KH-0008']._id,
      product: pGas6._id,
      unit: 'binh',
      price: 232000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    // Khách sạn Thiên Phú
    {
      customer: cMap['KH-0009']._id,
      product: pGas45._id,
      unit: 'binh',
      price: 1660000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    {
      customer: cMap['KH-0009']._id,
      product: pGas12._id,
      unit: 'binh',
      price: 436000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    // Bia hơi 68
    {
      customer: cMap['KH-0010']._id,
      product: pGas12._id,
      unit: 'binh',
      price: 442000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    // Bánh mì Cô Ba
    {
      customer: cMap['KH-0011']._id,
      product: pGas6._id,
      unit: 'binh',
      price: 236000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    {
      customer: cMap['KH-0011']._id,
      product: pGas12._id,
      unit: 'binh',
      price: 441000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    // Chay An Lạc
    {
      customer: cMap['KH-0012']._id,
      product: pGas12._id,
      unit: 'binh',
      price: 434000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    {
      customer: cMap['KH-0012']._id,
      product: pGasMini._id,
      unit: 'thung',
      price: 520000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    // Hộ gia đình
    {
      customer: cMap['KH-0013']._id,
      product: pGas12._id,
      unit: 'binh',
      price: 446000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    {
      customer: cMap['KH-0014']._id,
      product: pGas12._id,
      unit: 'binh',
      price: 445000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
    {
      customer: cMap['KH-0014']._id,
      product: pGas6._id,
      unit: 'binh',
      price: 235000,
      effectiveFrom: dayAt(-60),
      createdBy: uAdmin._id,
      createdByName: uAdmin.name,
    },
  ]
  await CustomerPrice.insertMany(pricesData)

  // 7. VỎ BÌNH VÀ GAS DƯ ĐẦU KỲ
  await ShellEntry.insertMany([
    {
      customer: cMap['KH-0001']._id,
      product: pGas45._id,
      kind: 'opening',
      qty: 8,
      date: dayAt(-31),
      note: 'Vỏ đầu kỳ tại khách',
      createdBy: uAccountant._id,
      createdByName: uAccountant.name,
    },
    {
      customer: cMap['KH-0003']._id,
      product: pGas45._id,
      kind: 'opening',
      qty: 16,
      date: dayAt(-31),
      note: 'Vỏ đầu kỳ tại khách',
      createdBy: uAccountant._id,
      createdByName: uAccountant.name,
    },
    {
      customer: cMap['KH-0002']._id,
      product: pGas48._id,
      kind: 'opening',
      qty: 4,
      date: dayAt(-31),
      note: 'Vỏ đầu kỳ tại khách',
      createdBy: uAccountant._id,
      createdByName: uAccountant.name,
    },
    {
      customer: cMap['KH-0002']._id,
      product: pGas12._id,
      kind: 'opening',
      qty: 6,
      date: dayAt(-31),
      note: 'Vỏ đầu kỳ tại khách',
      createdBy: uAccountant._id,
      createdByName: uAccountant.name,
    },
    {
      customer: cMap['KH-0006']._id,
      product: pGas45._id,
      kind: 'opening',
      qty: 6,
      date: dayAt(-31),
      note: 'Vỏ đầu kỳ tại khách',
      createdBy: uAccountant._id,
      createdByName: uAccountant.name,
    },
    {
      customer: cMap['KH-0007']._id,
      product: pGas48._id,
      kind: 'opening',
      qty: 8,
      date: dayAt(-31),
      note: 'Vỏ đầu kỳ tại khách',
      createdBy: uAccountant._id,
      createdByName: uAccountant.name,
    },
  ])

  await ResidualEntry.insertMany([
    {
      customer: cMap['KH-0003']._id,
      product: pGas45._id,
      kind: 'opening',
      kg: 38.5,
      date: dayAt(-31),
      note: 'Gas dư đầu kỳ tích lũy',
      createdBy: uAccountant._id,
      createdByName: uAccountant.name,
    },
    {
      customer: cMap['KH-0001']._id,
      product: pGas45._id,
      kind: 'opening',
      kg: 12.0,
      date: dayAt(-31),
      note: 'Gas dư đầu kỳ tích lũy',
      createdBy: uAccountant._id,
      createdByName: uAccountant.name,
    },
  ])

  // 8. PHIẾU NHẬP HÀNG (8 phiếu nhập trải dài 30 ngày)
  const importSchedules = [
    {
      offset: -28,
      supIdx: 0,
      lines: [
        { p: pGas45, qty: 12, price: 22800 },
        { p: pGas12, qty: 30, price: 23000 },
      ],
      payRatio: 1.0,
    },
    {
      offset: -24,
      supIdx: 1,
      lines: [
        { p: pGas48, qty: 8, price: 22700 },
        { p: pGas12, qty: 25, price: 23100 },
      ],
      payRatio: 0.8,
    },
    {
      offset: -20,
      supIdx: 0,
      lines: [
        { p: pGas45, qty: 14, price: 22900 },
        { p: pGas6, qty: 20, price: 23200 },
      ],
      payRatio: 1.0,
    },
    {
      offset: -16,
      supIdx: 2,
      lines: [
        { p: pGas45, qty: 10, price: 22800 },
        { p: pGas12, qty: 28, price: 23000 },
      ],
      payRatio: 0.7,
    },
    {
      offset: -12,
      supIdx: 0,
      lines: [
        { p: pGas48, qty: 6, price: 22700 },
        { p: pGas45, qty: 12, price: 22900 },
      ],
      payRatio: 1.0,
    },
    {
      offset: -8,
      supIdx: 1,
      lines: [
        { p: pGas12, qty: 35, price: 23000 },
        { p: pGas6, qty: 15, price: 23200 },
      ],
      payRatio: 1.0,
    },
    {
      offset: -4,
      supIdx: 0,
      lines: [
        { p: pGas45, qty: 15, price: 22950 },
        { p: pGas12, qty: 25, price: 23100 },
      ],
      payRatio: 0.9,
    },
    {
      offset: -1,
      supIdx: 2,
      lines: [
        { p: pGas45, qty: 12, price: 23000 },
        { p: pGas48, qty: 6, price: 22800 },
        { p: pGas12, qty: 20, price: 23100 },
      ],
      payRatio: 1.0,
    },
  ]

  let pcSeq = 0
  let pnSeq = 0
  for (const impCfg of importSchedules) {
    pnSeq++
    const sup = sups[impCfg.supIdx]
    const code = `PN-${currentYear}-${String(pnSeq).padStart(4, '0')}`
    const date = dayAt(impCfg.offset, 14, 30)
    let totalVal = 0

    const lines = impCfg.lines.map((item) => {
      const nominalKg = item.qty * item.p.kgPerUnit
      const kgDoc = nominalKg
      // Chênh lệch thực tế nhẹ (bơm đủ / lệch 0.1 - 0.2%)
      const kgAct = nominalKg - (pnSeq % 3 === 0 ? 1.5 : -0.8)
      const val = Math.round(kgAct * item.price)
      totalVal += val
      return {
        product: item.p._id,
        productName: item.p.name,
        qty: item.qty,
        kgDocument: kgDoc,
        kgActual: kgAct,
        pricePerKg: item.price,
        shellsReturned: item.qty - (pnSeq % 4 === 0 ? 1 : 0),
      }
    })

    const paid = Math.round((totalVal * impCfg.payRatio) / 1000) * 1000
    const impDoc = await Import.create({
      code,
      supplier: sup._id,
      supplierName: sup.name,
      date,
      lines,
      valueBasis: 'actual',
      totalValue: totalVal,
      paidAmount: paid,
      payMethod: 'company_account',
      status: 'confirmed',
      note: `Nhập gas lô ${pnSeq}/${currentYear} – ${sup.name}`,
      attachments: [sampleImages[(pnSeq - 1) % sampleImages.length]],
      createdBy: uOffice._id,
      createdByName: uOffice.name,
    })

    if (paid > 0) {
      pcSeq++
      await CashTx.create({
        code: `PC-${currentYear}-${String(pcSeq).padStart(4, '0')}`,
        type: 'out',
        category: 'import',
        date,
        amount: paid,
        channel: 'company_account',
        content: `Chi thanh toán tiền nhập gas ${code} – ${sup.name}`,
        refType: 'import',
        refId: String(impDoc._id),
        refCode: code,
        attachments: [sampleImages[(pnSeq - 1) % sampleImages.length]],
        createdBy: uAccountant._id,
        createdByName: uAccountant.name,
      })
    }
  }

  // 9. ĐƠN HÀNG VÀ GIAO HÀNG (Khoảng 65 đơn trải dài 30 ngày)
  let dhSeq = 0
  let ptSeq = 0

  // Kịch bản các đơn hàng trong 30 ngày
  const orderConfigs = [
    // --- Các đơn Approved trong quá khứ (-28 đến -2) ---
    // Ngày -28
    {
      offset: -28,
      cCode: 'KH-0001',
      p: pGas45,
      unit: 'kg',
      price: 36500,
      planned: 180,
      actual: 180,
      paidRatio: 1.0,
      payM: 'company_account',
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -28,
      cCode: 'KH-0002',
      p: pGas48,
      unit: 'binh',
      price: 1760000,
      planned: 2,
      actual: 2,
      paidRatio: 0.0,
      status: 'approved',
      driver: uDriver2,
    },
    {
      offset: -27,
      cCode: 'KH-0004',
      p: pGas12,
      unit: 'binh',
      price: 440000,
      planned: 3,
      actual: 3,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -26,
      cCode: 'KH-0003',
      p: pGas45,
      unit: 'kg',
      price: 35800,
      planned: 270,
      actual: 270,
      paidRatio: 0.0,
      status: 'approved',
      driver: uDriver1,
      resKg: 2.5,
    },
    {
      offset: -25,
      cCode: 'KH-0006',
      p: pGas45,
      unit: 'kg',
      price: 36300,
      planned: 90,
      actual: 90,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver2,
    },
    {
      offset: -25,
      cCode: 'KH-0006',
      p: pGasMini,
      unit: 'thung',
      price: 510000,
      planned: 2,
      actual: 2,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver2,
    },
    {
      offset: -24,
      cCode: 'KH-0007',
      p: pGas48,
      unit: 'binh',
      price: 1740000,
      planned: 3,
      actual: 3,
      paidRatio: 0.0,
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -23,
      cCode: 'KH-0008',
      p: pGas12,
      unit: 'binh',
      price: 438000,
      planned: 2,
      actual: 2,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver2,
    },
    {
      offset: -22,
      cCode: 'KH-0010',
      p: pGas12,
      unit: 'binh',
      price: 442000,
      planned: 4,
      actual: 4,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -22,
      cCode: 'KH-0005',
      p: pGas45,
      unit: 'kg',
      price: 36800,
      planned: 90,
      actual: 90,
      paidRatio: 0.5,
      payM: 'company_account',
      status: 'approved',
      driver: uDriver2,
      resKg: 1.8,
    },
    {
      offset: -21,
      cCode: 'KH-0011',
      p: pGas6,
      unit: 'binh',
      price: 236000,
      planned: 3,
      actual: 3,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -20,
      cCode: 'KH-0001',
      p: pGas45,
      unit: 'kg',
      price: 36500,
      planned: 225,
      actual: 225,
      paidRatio: 1.0,
      payM: 'company_account',
      status: 'approved',
      driver: uDriver1,
      resKg: 3.2,
    },
    {
      offset: -20,
      cCode: 'KH-0014',
      p: pGas12,
      unit: 'binh',
      price: 445000,
      planned: 1,
      actual: 1,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver2,
    },
    {
      offset: -19,
      cCode: 'KH-0009',
      p: pGas45,
      unit: 'binh',
      price: 1660000,
      planned: 2,
      actual: 2,
      paidRatio: 0.0,
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -18,
      cCode: 'KH-0003',
      p: pGas45,
      unit: 'kg',
      price: 35800,
      planned: 315,
      actual: 315,
      paidRatio: 0.0,
      status: 'approved',
      driver: uDriver1,
      resKg: 4.1,
    },
    {
      offset: -18,
      cCode: 'KH-0002',
      p: pGas12,
      unit: 'binh',
      price: 435000,
      planned: 3,
      actual: 3,
      paidRatio: 0.5,
      payM: 'cash',
      status: 'approved',
      driver: uDriver2,
    },
    {
      offset: -17,
      cCode: 'KH-0004',
      p: pGas12,
      unit: 'binh',
      price: 440000,
      planned: 2,
      actual: 2,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -16,
      cCode: 'KH-0012',
      p: pGas12,
      unit: 'binh',
      price: 434000,
      planned: 2,
      actual: 2,
      paidRatio: 1.0,
      payM: 'company_account',
      status: 'approved',
      driver: uDriver2,
    },
    {
      offset: -15,
      cCode: 'KH-0013',
      p: pGas12,
      unit: 'binh',
      price: 446000,
      planned: 1,
      actual: 1,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -15,
      cCode: 'KH-0007',
      p: pGas48,
      unit: 'binh',
      price: 1740000,
      planned: 4,
      actual: 4,
      paidRatio: 0.0,
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -14,
      cCode: 'KH-0006',
      p: pGas45,
      unit: 'kg',
      price: 36300,
      planned: 135,
      actual: 135,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver2,
    },
    {
      offset: -13,
      cCode: 'KH-0008',
      p: pGas12,
      unit: 'binh',
      price: 438000,
      planned: 3,
      actual: 3,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -12,
      cCode: 'KH-0001',
      p: pGas45,
      unit: 'kg',
      price: 36500,
      planned: 180,
      actual: 180,
      paidRatio: 1.0,
      payM: 'company_account',
      status: 'approved',
      driver: uDriver1,
      resKg: 2.0,
    },
    {
      offset: -12,
      cCode: 'KH-0010',
      p: pGas12,
      unit: 'binh',
      price: 442000,
      planned: 3,
      actual: 3,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver2,
    },
    {
      offset: -11,
      cCode: 'KH-0003',
      p: pGas45,
      unit: 'kg',
      price: 35800,
      planned: 270,
      actual: 270,
      paidRatio: 0.0,
      status: 'approved',
      driver: uDriver1,
      resKg: 3.5,
    },
    {
      offset: -10,
      cCode: 'KH-0002',
      p: pGas48,
      unit: 'binh',
      price: 1760000,
      planned: 2,
      actual: 2,
      paidRatio: 0.0,
      status: 'approved',
      driver: uDriver2,
    },
    {
      offset: -10,
      cCode: 'KH-0005',
      p: pGas45,
      unit: 'kg',
      price: 36800,
      planned: 90,
      actual: 90,
      paidRatio: 1.0,
      payM: 'company_account',
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -9,
      cCode: 'KH-0004',
      p: pGas12,
      unit: 'binh',
      price: 440000,
      planned: 3,
      actual: 3,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver2,
    },
    {
      offset: -8,
      cCode: 'KH-0011',
      p: pGas12,
      unit: 'binh',
      price: 441000,
      planned: 2,
      actual: 2,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -7,
      cCode: 'KH-0009',
      p: pGas45,
      unit: 'binh',
      price: 1660000,
      planned: 3,
      actual: 3,
      paidRatio: 0.0,
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -6,
      cCode: 'KH-0006',
      p: pGasMini,
      unit: 'thung',
      price: 510000,
      planned: 3,
      actual: 3,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver2,
    },
    {
      offset: -5,
      cCode: 'KH-0001',
      p: pGas45,
      unit: 'kg',
      price: 37000,
      planned: 180,
      actual: 180,
      paidRatio: 1.0,
      payM: 'company_account',
      status: 'approved',
      driver: uDriver1,
      resKg: 2.2,
    },
    {
      offset: -5,
      cCode: 'KH-0003',
      p: pGas45,
      unit: 'kg',
      price: 35800,
      planned: 225,
      actual: 225,
      paidRatio: 0.0,
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -4,
      cCode: 'KH-0007',
      p: pGas48,
      unit: 'binh',
      price: 1740000,
      planned: 3,
      actual: 3,
      paidRatio: 0.0,
      status: 'approved',
      driver: uDriver2,
    },
    {
      offset: -3,
      cCode: 'KH-0008',
      p: pGas12,
      unit: 'binh',
      price: 438000,
      planned: 2,
      actual: 2,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -3,
      cCode: 'KH-0002',
      p: pGas12,
      unit: 'binh',
      price: 435000,
      planned: 4,
      actual: 4,
      paidRatio: 0.0,
      status: 'approved',
      driver: uDriver2,
    },
    {
      offset: -2,
      cCode: 'KH-0010',
      p: pGas12,
      unit: 'binh',
      price: 442000,
      planned: 3,
      actual: 3,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver1,
    },
    {
      offset: -2,
      cCode: 'KH-0004',
      p: pGas12,
      unit: 'binh',
      price: 440000,
      planned: 2,
      actual: 2,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'approved',
      driver: uDriver2,
    },

    // --- Đơn đã hủy ---
    {
      offset: -15,
      cCode: 'KH-0002',
      p: pGas12,
      unit: 'binh',
      price: 435000,
      planned: 2,
      status: 'cancelled',
      cancelReason: 'Khách đổi lịch nhận hàng sang tuần sau',
    },
    {
      offset: -6,
      cCode: 'KH-0008',
      p: pGas6,
      unit: 'binh',
      price: 232000,
      planned: 2,
      status: 'cancelled',
      cancelReason: 'Trùng đơn khách đã gọi qua nhân viên giao hàng',
    },

    // --- Đơn CẦN XỬ LÝ (need_fix) để test màn hình đối soát/sửa lỗi ---
    {
      offset: -1,
      cCode: 'KH-0002',
      p: pGas48,
      unit: 'binh',
      price: 1760000,
      planned: 2,
      actual: 2,
      paidRatio: 0.0,
      status: 'need_fix',
      driver: uDriver2,
      returnReason:
        'Số vỏ thu về chưa khớp với chứng từ, tài xế kiểm tra lại và cập nhật bổ sung',
    },

    // --- 3 Đơn CHỜ ĐỐI SOÁT (pending_review) để test duyệt ngay trên /reconcile ---
    {
      offset: -1,
      cCode: 'KH-0003',
      p: pGas45,
      unit: 'kg',
      price: 35800,
      planned: 180,
      actual: 180,
      paidRatio: 0.0,
      status: 'pending_review',
      driver: uDriver1,
      resKg: 3.0,
    },
    {
      offset: 0,
      cCode: 'KH-0006',
      p: pGas45,
      unit: 'kg',
      price: 36300,
      planned: 90,
      actual: 90,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'pending_review',
      driver: uDriver2,
    },
    {
      offset: 0,
      cCode: 'KH-0004',
      p: pGas12,
      unit: 'binh',
      price: 440000,
      planned: 3,
      actual: 3,
      paidRatio: 1.0,
      payM: 'cash',
      status: 'pending_review',
      driver: uDriver1,
    },

    // --- 2 Đơn ĐANG GIAO (delivering) ---
    {
      offset: 0,
      cCode: 'KH-0009',
      p: pGas45,
      unit: 'binh',
      price: 1660000,
      planned: 2,
      status: 'delivering',
      driver: uDriver1,
    },
    {
      offset: 0,
      cCode: 'KH-0008',
      p: pGas12,
      unit: 'binh',
      price: 438000,
      planned: 2,
      status: 'delivering',
      driver: uDriver2,
    },

    // --- 2 Đơn ĐÃ PHÂN CÔNG (assigned) ---
    {
      offset: 0,
      cCode: 'KH-0001',
      p: pGas45,
      unit: 'kg',
      price: 37000,
      planned: 180,
      status: 'assigned',
      driver: uDriver1,
    },
    {
      offset: 0,
      cCode: 'KH-0010',
      p: pGas12,
      unit: 'binh',
      price: 442000,
      planned: 4,
      status: 'assigned',
      driver: uDriver2,
    },

    // --- 1 Đơn MỚI CHỜ PHÂN CÔNG (waiting_assign) ---
    {
      offset: 0,
      cCode: 'KH-0011',
      p: pGas12,
      unit: 'binh',
      price: 441000,
      planned: 2,
      status: 'waiting_assign',
    },
  ]

  for (const cfg of orderConfigs) {
    dhSeq++
    const cust = cMap[cfg.cCode]
    const code = `DH-${currentYear}-${String(dhSeq).padStart(4, '0')}`
    const deliveryAt = dayAt(cfg.offset, 9 + (dhSeq % 7), (dhSeq * 15) % 60)
    const amount = Math.round((cfg.actual ?? cfg.planned) * cfg.price)
    const paidAmount = cfg.paidRatio ? Math.round(amount * cfg.paidRatio) : 0
    const payMethod = cfg.payM || 'cash'

    const line = {
      product: cfg.p._id,
      productName: cfg.p.name,
      unit: cfg.unit,
      price: cfg.price,
      plannedQty: cfg.planned,
      actualQty: cfg.actual !== undefined ? cfg.actual : null,
      shellsCollected:
        cfg.actual !== undefined
          ? cfg.unit === 'kg'
            ? Math.round(cfg.actual / cfg.p.kgPerUnit)
            : cfg.actual
          : 0,
      shellsLent: dhSeq % 5 === 0 ? 1 : 0,
      residualKg: cfg.resKg || 0,
    }

    const orderData = {
      code,
      customer: cust._id,
      customerName: cust.name,
      deliveryAddress: cust.address,
      deliveryAt,
      status: cfg.status,
      lines: [line],
      amount: cfg.actual !== undefined ? amount : 0,
      createdBy: uOffice._id,
      createdByName: uOffice.name,
      note: dhSeq % 4 === 0 ? 'Giao giờ hành chính, gọi trước 15p' : undefined,
    }

    if (cfg.driver) {
      orderData.assignees = [cfg.driver._id]
    }

    if (['pending_review', 'need_fix', 'approved'].includes(cfg.status)) {
      orderData.delivery = {
        deliveredAt: deliveryAt,
        confirmedBy: cfg.driver?._id || uDriver1._id,
        confirmedByName: cfg.driver?.name || uDriver1.name,
        confirmedAt: deliveryAt,
        paidAmount,
        payMethod: paidAmount > 0 ? payMethod : undefined,
        note: 'Đã bàn giao đủ hóa đơn và kiểm tra vỏ',
      }
      orderData.attachments = [sampleImages[(dhSeq - 1) % sampleImages.length]]
    }

    if (cfg.status === 'need_fix') {
      orderData.returnReason = cfg.returnReason
    }

    if (cfg.status === 'cancelled') {
      orderData.cancelReason = cfg.cancelReason
    }

    if (cfg.status === 'approved') {
      orderData.bookDate = deliveryAt
      orderData.reviewedBy = uAccountant._id
      orderData.reviewedByName = uAccountant.name
      orderData.approvedAt = deliveryAt

      // Tự sinh phiếu thu CashTx cho đơn đã duyệt có thu tiền
      if (paidAmount > 0) {
        ptSeq++
        const ptCode = `PT-${currentYear}-${String(ptSeq).padStart(4, '0')}`
        const tx = await CashTx.create({
          code: ptCode,
          type: 'in',
          category: 'sale',
          date: deliveryAt,
          amount: paidAmount,
          channel: payMethod,
          content: `Thu tiền đơn ${code} – ${cust.name}`,
          customer: cust._id,
          customerName: cust.name,
          refType: 'order',
          refCode: code,
          attachments: [sampleImages[(dhSeq - 1) % sampleImages.length]],
          createdBy: uAccountant._id,
          createdByName: uAccountant.name,
        })
        orderData.cashTx = tx._id
      }
    }

    await Order.create(orderData)
  }

  // 10. THU NỢ ĐỊNH KỲ VÀ KHÁCH TẠM ỨNG (Tạo số liệu công nợ sống động)
  // Thu nợ Quán cơm Bình Dân
  ptSeq++
  await CashTx.create({
    code: `PT-${currentYear}-${String(ptSeq).padStart(4, '0')}`,
    type: 'in',
    category: 'debt_collect',
    date: dayAt(-6, 10, 30),
    amount: 2500000,
    channel: 'company_account',
    content: `Thu công nợ Quán cơm Bình Dân Lê Lợi đợt 1`,
    customer: cMap['KH-0002']._id,
    customerName: cMap['KH-0002'].name,
    refType: 'manual',
    attachments: [sampleImages[1]],
    createdBy: uAccountant._id,
    createdByName: uAccountant.name,
  })

  // Thu nợ Bếp ăn Phenikaa
  ptSeq++
  await CashTx.create({
    code: `PT-${currentYear}-${String(ptSeq).padStart(4, '0')}`,
    type: 'in',
    category: 'debt_collect',
    date: dayAt(-7, 11, 0),
    amount: 20000000,
    channel: 'company_account',
    content: `Thanh toán chuyển khoản công nợ Bếp ăn Phenikaa`,
    customer: cMap['KH-0003']._id,
    customerName: cMap['KH-0003'].name,
    refType: 'manual',
    attachments: [sampleImages[2]],
    createdBy: uAccountant._id,
    createdByName: uAccountant.name,
  })

  // Thu nợ Bệnh viện Tâm Đức
  ptSeq++
  await CashTx.create({
    code: `PT-${currentYear}-${String(ptSeq).padStart(4, '0')}`,
    type: 'in',
    category: 'debt_collect',
    date: dayAt(-5, 14, 15),
    amount: 10000000,
    channel: 'company_account',
    content: `Bệnh viện Tâm Đức thanh toán tiền gas đợt 1/tháng`,
    customer: cMap['KH-0007']._id,
    customerName: cMap['KH-0007'].name,
    refType: 'manual',
    attachments: [sampleImages[3]],
    createdBy: uAccountant._id,
    createdByName: uAccountant.name,
  })

  // ĐẶC BIỆT: Nhà hàng chay An Lạc NỘP TẠM ỨNG TRƯỚC 3.500.000 ₫
  // Tổng tiền đơn giao là ~868.000 ₫ -> Sau khi cấn trừ sẽ còn DƯ NỢ ÂM (~ -2.500.000 ₫)
  // để làm nổi bật tính năng Tag [Trả thừa] màu xanh dương cực chuẩn!
  ptSeq++
  await CashTx.create({
    code: `PT-${currentYear}-${String(ptSeq).padStart(4, '0')}`,
    type: 'in',
    category: 'debt_collect',
    date: dayAt(-8, 9, 0),
    amount: 3500000,
    channel: 'company_account',
    content: `Nhà hàng chay An Lạc chuyển khoản tiền tạm ứng tiền gas tháng này`,
    customer: cMap['KH-0012']._id,
    customerName: cMap['KH-0012'].name,
    refType: 'manual',
    attachments: [sampleImages[0]],
    createdBy: uAccountant._id,
    createdByName: uAccountant.name,
  })

  // Điều chỉnh công nợ: Chiết khấu hỗ trợ khách quen Quán cơm Bình Dân
  await DebtAdjust.create({
    customer: cMap['KH-0002']._id,
    date: dayAt(-3, 16, 0),
    amount: -150000,
    reason: 'Chiết khấu hỗ trợ quán cơm khách quen theo chính sách cửa hàng',
    createdBy: uAccountant._id,
    createdByName: uAccountant.name,
  })

  // Đối trừ gas dư: Bếp ăn Phenikaa
  await ResidualEntry.create({
    customer: cMap['KH-0003']._id,
    product: pGas45._id,
    kind: 'offset',
    kg: -25.0,
    date: dayAt(-4, 15, 30),
    note: 'Bù trừ 25kg gas dư vào đơn giao ngày 14',
    createdBy: uAccountant._id,
    createdByName: uAccountant.name,
  })

  // Trả vỏ nhà cung cấp và kiểm kê kho
  await ShellEntry.create({
    customer: undefined,
    product: pGas12._id,
    kind: 'supplier_return',
    qty: 30,
    date: dayAt(-6, 16, 0),
    note: 'Xuất trả vỏ Petrolimex đợt 1',
    createdBy: uAccountant._id,
    createdByName: uAccountant.name,
  })
  await ShellEntry.create({
    customer: undefined,
    product: pGas45._id,
    kind: 'stocktake',
    qty: -2,
    date: dayAt(-2, 17, 30),
    note: 'Kiểm kê cuối tuần: hao hụt/thiếu 2 vỏ tại kho',
    createdBy: uAccountant._id,
    createdByName: uAccountant.name,
  })

  // 11. CÁC KHOẢN THU / CHI HOẠT ĐỘNG KHÁC (Dòng tiền thực tế)
  const opCashOut = [
    {
      cat: 'operation',
      desc: 'Tiền điện văn phòng & kho bãi tháng trước',
      amount: 2850000,
      ch: 'company_account',
      day: -20,
    },
    {
      cat: 'operation',
      desc: 'Tiền thuê mặt bằng kho bãi tháng này',
      amount: 12000000,
      ch: 'company_account',
      day: -6,
    },
    {
      cat: 'operation',
      desc: 'Xăng dầu xe tải giao hàng 29C-123.45 (tuần 1)',
      amount: 1450000,
      ch: 'cash',
      day: -23,
    },
    {
      cat: 'operation',
      desc: 'Xăng dầu xe tải giao hàng 29C-123.45 (tuần 2)',
      amount: 1380000,
      ch: 'cash',
      day: -16,
    },
    {
      cat: 'operation',
      desc: 'Xăng dầu xe tải giao hàng 29C-123.45 (tuần 3)',
      amount: 1520000,
      ch: 'cash',
      day: -9,
    },
    {
      cat: 'operation',
      desc: 'Xăng dầu xe tải giao hàng 29C-123.45 (tuần 4)',
      amount: 1290000,
      ch: 'cash',
      day: -2,
    },
    {
      cat: 'operation',
      desc: 'Lương nhân viên giao hàng tháng trước',
      amount: 19000000,
      ch: 'company_account',
      day: -7,
    },
    {
      cat: 'operation',
      desc: 'Lương nhân viên văn phòng & kế toán tháng trước',
      amount: 17000000,
      ch: 'company_account',
      day: -7,
    },
    {
      cat: 'supplies',
      desc: 'Mua sổ sách, giấy in hóa đơn nhiệt và mực in',
      amount: 380000,
      ch: 'cash',
      day: -14,
    },
    {
      cat: 'other_out',
      desc: 'Tiếp khách đối tác cung cấp thiết bị bếp',
      amount: 650000,
      ch: 'cash',
      day: -11,
    },
    {
      cat: 'operation',
      desc: 'Cước internet cáp quang & điện thoại bàn',
      amount: 480000,
      ch: 'company_account',
      day: -18,
    },
  ]

  for (const c of opCashOut) {
    pcSeq++
    await CashTx.create({
      code: `PC-${currentYear}-${String(pcSeq).padStart(4, '0')}`,
      type: 'out',
      category: c.cat,
      date: dayAt(c.day, 15, 0),
      amount: c.amount,
      channel: c.ch,
      content: c.desc,
      refType: 'manual',
      createdBy: uAccountant._id,
      createdByName: uAccountant.name,
    })
  }

  // Thu tiền đặt cọc vỏ bình của khách mới
  ptSeq++
  await CashTx.create({
    code: `PT-${currentYear}-${String(ptSeq).padStart(4, '0')}`,
    type: 'in',
    category: 'other_in',
    date: dayAt(-10, 15, 0),
    amount: 2000000,
    channel: 'cash',
    content: 'Thu tiền cọc vỏ bình 45kg khách mới thuê',
    refType: 'manual',
    createdBy: uAccountant._id,
    createdByName: uAccountant.name,
  })

  // 12. VẬT TƯ & PHỤ TÙNG
  const mats = await Material.insertMany([
    {
      code: 'VT-01',
      name: 'Van điều áp gas công nghiệp',
      unit: 'cái',
      defaultPrice: 185000,
      status: 'active',
    },
    {
      code: 'VT-02',
      name: 'Van an toàn ngắt tự động (Gia đình)',
      unit: 'cái',
      defaultPrice: 95000,
      status: 'active',
    },
    {
      code: 'VT-03',
      name: 'Dây dẫn gas lõi thép 1.5m',
      unit: 'sợi',
      defaultPrice: 55000,
      status: 'active',
    },
    {
      code: 'VT-04',
      name: 'Bếp gas đơn chuyên dụng',
      unit: 'cái',
      defaultPrice: 320000,
      status: 'active',
    },
    {
      code: 'VT-05',
      name: 'Bếp gas đôi mặt kính',
      unit: 'cái',
      defaultPrice: 780000,
      status: 'active',
    },
    {
      code: 'VT-06',
      name: 'Bộ cổ dê đai siết ống mềm inox',
      unit: 'bộ',
      defaultPrice: 25000,
      status: 'active',
    },
  ])

  // Nhập kho vật tư đầu kỳ
  for (const [i, m] of mats.entries()) {
    await MaterialTx.create({
      material: m._id,
      materialName: m.name,
      type: 'in',
      date: dayAt(-28 + i, 9, 0),
      qty: 50,
      unitPrice: Math.round(m.defaultPrice * 0.7),
      amount: Math.round(50 * m.defaultPrice * 0.7),
      paidAmount: Math.round(50 * m.defaultPrice * 0.7),
      payMethod: 'cash',
      note: 'Nhập kho vật tư định kỳ',
      createdBy: uOffice._id,
      createdByName: uOffice.name,
    })
  }

  // Một số giao dịch bán và tặng vật tư cho khách
  await MaterialTx.create({
    material: mats[0]._id,
    materialName: mats[0].name,
    type: 'sale',
    date: dayAt(-15, 10, 0),
    qty: 2,
    unitPrice: mats[0].defaultPrice,
    amount: mats[0].defaultPrice * 2,
    paidAmount: mats[0].defaultPrice * 2,
    payMethod: 'cash',
    customer: cMap['KH-0001']._id,
    customerName: cMap['KH-0001'].name,
    note: 'Thay mới 2 van điều áp cho hệ thống bếp',
    createdBy: uOffice._id,
    createdByName: uOffice.name,
  })
  await MaterialTx.create({
    material: mats[2]._id,
    materialName: mats[2].name,
    type: 'gift',
    date: dayAt(-10, 11, 0),
    qty: 1,
    unitPrice: 0,
    amount: 0,
    paidAmount: 0,
    payMethod: 'cash',
    customer: cMap['KH-0004']._id,
    customerName: cMap['KH-0004'].name,
    note: 'Tặng dây dẫn gas mới tri ân khách quen',
    createdBy: uOffice._id,
    createdByName: uOffice.name,
  })

  // 13. SỬA CHỮA, BẢO TRÌ VÀ ĐĂNG KIỂM PHƯƠNG TIỆN
  const maintRecords = [
    {
      vehicleType: 'truck',
      plate: '29C-123.45',
      kind: 'inspection',
      item: 'Đăng kiểm định kỳ xe tải 2.5 tấn',
      date: dayAt(-40),
      vendor: 'Trung tâm đăng kiểm 29-03D',
      cost: 560000,
      nextDue: dayAt(140),
    },
    {
      vehicleType: 'truck',
      plate: '29C-123.45',
      kind: 'maintenance',
      item: 'Thay dầu động cơ và lọc nhớt định kỳ',
      date: dayAt(-25),
      vendor: 'Gara Ô tô Hùng Cường',
      cost: 1850000,
      nextDue: dayAt(65),
    },
    {
      vehicleType: 'truck',
      plate: '29C-123.45',
      kind: 'repair',
      item: 'Thay má phanh trước và láng đĩa phanh',
      date: dayAt(-12),
      vendor: 'Gara Ô tô Hùng Cường',
      cost: 2400000,
    },
    {
      vehicleType: 'truck',
      plate: '30E-678.90',
      kind: 'inspection',
      item: 'Đăng kiểm định kỳ xe tải nhỏ 1.25 tấn',
      date: dayAt(-320),
      vendor: 'Trung tâm đăng kiểm 29-01S',
      cost: 480000,
      nextDue: dayAt(45),
    },
    {
      vehicleType: 'truck',
      plate: '30E-678.90',
      kind: 'maintenance',
      item: 'Bảo dưỡng định kỳ mốc 20.000 km',
      date: dayAt(-8),
      vendor: 'Gara Thành Đạt',
      cost: 1250000,
      nextDue: dayAt(80),
    },
    {
      vehicleType: 'motorbike',
      plate: '29H1-456.78',
      kind: 'repair',
      item: 'Thay lốp không săm sau + nhông xích',
      date: dayAt(-15),
      vendor: 'Tiệm xe máy Bình Minh',
      cost: 520000,
    },
    {
      vehicleType: 'motorbike',
      plate: '29H1-456.78',
      kind: 'maintenance',
      item: 'Thay nhớt Motul và vệ sinh bugi',
      date: dayAt(-5),
      vendor: 'Tiệm xe máy Bình Minh',
      cost: 180000,
      nextDue: dayAt(60),
    },
    {
      vehicleType: 'motorbike',
      plate: '29K1-222.33',
      kind: 'maintenance',
      item: 'Bảo dưỡng xe máy giao hàng định kỳ',
      date: dayAt(-20),
      vendor: 'Head Honda Hà Đông',
      cost: 350000,
      nextDue: dayAt(40),
    },
  ]

  for (const m of maintRecords) {
    await Maintenance.create({
      ...m,
      note: 'Đã hoàn tất thanh toán, có hóa đơn',
      createdBy: uOffice._id,
      createdByName: uOffice.name,
    })
  }

  // 14. KHỞI TẠO BỘ ĐẾM CHUẨN (Counter) ĐỂ ĐẢM BẢO TẠO ĐƠN MỚI TỰ ĐỘNG TĂNG MÃ CHUẨN
  await Counter.findOneAndUpdate(
    { key: `DH-${currentYear}` },
    { seq: dhSeq },
    { upsert: true },
  )
  await Counter.findOneAndUpdate(
    { key: `PN-${currentYear}` },
    { seq: pnSeq },
    { upsert: true },
  )
  await Counter.findOneAndUpdate(
    { key: `PT-${currentYear}` },
    { seq: ptSeq },
    { upsert: true },
  )
  await Counter.findOneAndUpdate(
    { key: `PC-${currentYear}` },
    { seq: pcSeq },
    { upsert: true },
  )

  // 15. NHẬT KÝ HOẠT ĐỘNG (AuditLog)
  await AuditLog.insertMany([
    {
      at: dayAt(-28),
      user: uOffice._id,
      userName: uOffice.name,
      entity: 'order',
      entityId: 'init',
      action: 'create',
      summary: 'Tạo đơn hàng định kỳ cho Nhà hàng Hương Việt',
    },
    {
      at: dayAt(-24),
      user: uAccountant._id,
      userName: uAccountant.name,
      entity: 'import',
      entityId: 'init',
      action: 'create',
      summary: 'Xác nhận phiếu nhập gas PN-2026-0002 từ Gas South',
    },
    {
      at: dayAt(-10),
      user: uAdmin._id,
      userName: uAdmin.name,
      entity: 'customer',
      entityId: 'init',
      action: 'update',
      summary: 'Ký gia hạn hợp đồng HĐ-2026/002 cho Bếp ăn Phenikaa',
    },
    {
      at: dayAt(-5),
      user: uAdmin._id,
      userName: uAdmin.name,
      entity: 'price',
      entityId: 'init',
      action: 'update',
      summary:
        'Điều chỉnh đơn giá gas 45kg cho Nhà hàng Hương Việt lên 37.000 ₫/kg',
    },
    {
      at: dayAt(-1),
      user: uAccountant._id,
      userName: uAccountant.name,
      entity: 'order',
      entityId: 'return',
      summary: 'Yêu cầu kiểm tra lại vỏ đơn hàng DH-2026-0040',
    },
  ])

  return {
    created: true,
    message: `Đã khởi tạo thành công cơ sở dữ liệu SIÊU ĐẦY ĐỦ:
- 5 Tài khoản nhân viên (admin, office, driver, driver2, accountant)
- 5 Danh mục sản phẩm gas
- 3 Nhà cung cấp chính
- 14 Khách hàng VIP, chuỗi nhà hàng, bếp ăn công nghiệp, quán ăn, trường học, hộ gia đình
- Bảng giá riêng từng khách hàng kèm lịch sử điều chỉnh
- 8 Phiếu nhập gas với chênh lệch bơm đủ/thiếu thực tế
- ${dhSeq} Đơn hàng phủ kín 30 ngày (Đã duyệt, Chờ đối soát, Cần xử lý, Đang giao, Đã phân công)
- Sổ quỹ thu chi hoàn chỉnh (Thu bán hàng, Thu nợ, Chi nhập gas, Chi mặt bằng, Lương, Xăng xe...)
- Sổ công nợ sống động: khách còn nợ, khách hết nợ, và đặc biệt khách có số dư trả thừa/tạm ứng
- Quản lý vỏ bình, gas dư tích lũy, bù trừ gas dư
- Danh mục và giao dịch nhập/bán/tặng vật tư
- 8 Hồ sơ bảo trì, sửa chữa, đăng kiểm xe máy & xe tải
- Bộ đếm chứng từ tự tăng (Counter) đã đồng bộ.`,
  }
}
