// Mô phỏng dữ liệu vận hành ~30 ngày qua CHÍNH API của ứng dụng (đúng quyền từng vai trò),
// nên công nợ / sổ quỹ / vỏ bình / tồn kho tự khớp với nghiệp vụ.
// Chạy: npm run seed (DB trống) → chạy app (npm run dev) → npm run simulate
// Biến môi trường: BASE (mặc định http://localhost:3000), SEED_PASSWORD (bắt buộc: mật khẩu của 4 tài khoản đã seed)
import zlib from 'zlib'

const BASE = process.env.BASE || 'http://localhost:3000'
const PW = process.env.SEED_PASSWORD
if (!PW) {
  console.error('Thiếu SEED_PASSWORD (đặt trong .env.local)')
  process.exit(1)
}

// ---------- tiện ích ----------
let seedN = 20261107
const rnd = () => ((seedN = (seedN + 0x6d2b79f5) | 0), (((t => ((t = Math.imul(t ^ (t >>> 15), t | 1)), (t ^= t + Math.imul(t ^ (t >>> 7), t | 61)), ((t ^ (t >>> 14)) >>> 0) / 4294967296))(seedN))))
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const pickOne = arr => arr[Math.floor(rnd() * arr.length)]
const chance = p => rnd() < p
const pickW = items => {
  const tot = items.reduce((s, i) => s + i.w, 0)
  let r = rnd() * tot
  for (const i of items) if ((r -= i.w) <= 0) return i
  return items[0]
}

// ngày giờ theo giờ Việt Nam (UTC+7): dayAt(-3, 9, 30) = 3 ngày trước lúc 09:30
const dayAt = (offset, h = 8, m = 0) => {
  const t = new Date(Date.now() + 7 * 3600e3 + offset * 86400e3)
  const p = n => String(n).padStart(2, '0')
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(h)}:${p(m)}:00+07:00`
}
const dateOnly = (offset) => dayAt(offset).slice(0, 10)
const dow = offset => new Date(Date.now() + 7 * 3600e3 + offset * 86400e3).getUTCDay()

async function login(email) {
  const res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) })
  const j = await res.json()
  if (!res.ok) throw new Error(`Đăng nhập ${email} thất bại: ${j.error}`)
  const cookie = res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
  return { email, cookie, id: j.data.id }
}
async function call(who, method, path, body) {
  const res = await fetch(BASE + '/api' + path, { method, headers: { 'content-type': 'application/json', cookie: who.cookie }, body: body ? JSON.stringify(body) : undefined })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${j.error}`)
  return j.data
}
const get = (w, p) => call(w, 'GET', p)
const post = (w, p, b) => call(w, 'POST', p, b || {})
const put = (w, p, b) => call(w, 'PUT', p, b || {})

// ---------- ảnh hóa đơn giả (PNG) ----------
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c })
const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0 }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
function invoicePng(seed) {
  const W = 300, H = 420, px = Buffer.alloc(W * H * 3, 250)
  const rect = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const o = (j * W + i) * 3; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2] } }
  rect(0, 0, W, 46, [115, 103, 240]); rect(20, 14, 120, 16, [255, 255, 255])
  for (let r = 0; r < 14; r++) { rect(20, 70 + r * 22, 100 + ((r * 37 + seed * 53) % 140), 8, [90, 90, 100]); rect(236, 70 + r * 22, 44, 8, [90, 90, 100]) }
  rect(20, 390, 260, 2, [60, 60, 60]); rect(170, 370, 110, 12, [200, 40, 40])
  const raw = Buffer.alloc((W * 3 + 1) * H)
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
async function upload(who, name, seed) {
  const fd = new FormData()
  fd.append('file', new Blob([invoicePng(seed)], { type: 'image/png' }), name)
  const res = await fetch(BASE + '/api/files', { method: 'POST', headers: { cookie: who.cookie }, body: fd })
  const j = await res.json()
  if (!res.ok) throw new Error('Upload lỗi: ' + j.error)
  return j.data
}

// ---------- danh mục mô phỏng ----------
const SUPPLIERS = [
  { name: 'Công ty CP Gas Petrolimex Hà Nội', phone: '02438251234', address: 'KCN Đức Giang, Long Biên, Hà Nội' },
  { name: 'Công ty TNHH Gas South Miền Bắc', phone: '02435567890', address: 'KCN Quang Minh, Mê Linh, Hà Nội' },
  { name: 'Công ty CP Đầu tư Dầu khí Hưng Yên', phone: '02213812345', address: 'KCN Phố Nối A, Hưng Yên' }
]

// profile: tỷ lệ thanh toán tại điểm giao. full = trả đủ; part = trả một phần; debt = ghi nợ (khách quen thanh toán cuối tháng)
const CUSTOMERS = [
  { name: 'Nhà hàng Hương Việt', phone: '0901234501', address: '12 Nguyễn Trãi, Thanh Xuân, Hà Nội', contact: 'Chị Hương', w: 9, pay: 'full', lines: [['GAS45', 'kg', 36500]], gas: 'installed', contract: 'HĐ-2026/001' },
  { name: 'Quán cơm Bình Dân Lê Lợi', phone: '0901234502', address: '45 Lê Lợi, Hà Đông, Hà Nội', contact: 'Anh Bình', w: 7, pay: 'debt', lines: [['GAS48', 'binh', 1760000], ['GAS12', 'binh', 435000]], opening: 1500000 },
  { name: 'Bếp ăn công nghiệp Phenikaa', phone: '0901234503', address: 'Khu công nghiệp Phenikaa, Yên Nghĩa, Hà Đông', contact: 'Chị Lan (Hành chính)', w: 10, pay: 'debt', lines: [['GAS45', 'kg', 35800], ['GAS12', 'binh', 428000]], gas: 'installed', contract: 'HĐ-2026/002', opening: 8200000 },
  { name: 'Quán phở Thìn Bờ Hồ', phone: '0901234504', address: '61 Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội', contact: 'Anh Thìn', w: 6, pay: 'full', lines: [['GAS12', 'binh', 440000], ['GAS45', 'binh', 1650000]] },
  { name: 'Trường mầm non Hoa Sen', phone: '0901234505', address: '8 Trần Phú, Hà Đông, Hà Nội', contact: 'Cô Thủy', w: 4, pay: 'part', lines: [['GAS45', 'kg', 36800]], gas: 'installed', contract: 'HĐ-2026/003' },
  { name: 'Anh Minh (hộ gia đình)', phone: '0901234506', address: 'Số 5 ngõ 34 Nguyễn Văn Trỗi, Hà Đông', contact: 'Anh Minh', w: 3, pay: 'full', lines: [['GAS12', 'binh', 445000], ['GAS6', 'binh', 235000]] },
  { name: 'Lẩu nướng Hàn Quốc Seoul', phone: '0901234507', address: '27 Trần Đăng Ninh, Cầu Giấy, Hà Nội', contact: 'Chị Yến', w: 7, pay: 'part', lines: [['GAS45', 'kg', 36300], ['GAS12', 'binh', 432000]] },
  { name: 'Bệnh viện Đa khoa Tâm Đức', phone: '0901234508', address: '102 Quang Trung, Hà Đông, Hà Nội', contact: 'Anh Đức (Hậu cần)', w: 5, pay: 'debt', lines: [['GAS48', 'binh', 1740000]], gas: 'installed', contract: 'HĐ-2026/004', opening: 4500000 },
  { name: 'Cơm văn phòng Anh Tuấn', phone: '0901234509', address: '33 Tố Hữu, Nam Từ Liêm, Hà Nội', contact: 'Anh Tuấn', w: 5, pay: 'full', lines: [['GAS12', 'binh', 438000], ['GAS6', 'binh', 232000]] },
  { name: 'Khách sạn Thiên Phú', phone: '0901234510', address: '15 Quang Trung, Hà Đông, Hà Nội', contact: 'Chị Phú', w: 4, pay: 'debt', lines: [['GAS45', 'binh', 1660000], ['GAS12', 'binh', 436000]] },
  { name: 'Quán bia Hơi Hà Nội 68', phone: '0901234511', address: '68 Nguyễn Khuyến, Hà Đông, Hà Nội', contact: 'Anh Sơn', w: 5, pay: 'full', lines: [['GAS12', 'binh', 442000]] },
  { name: 'Tiệm bánh mì Cô Ba', phone: '0901234512', address: '9 Chùa Bộc, Đống Đa, Hà Nội', contact: 'Cô Ba', w: 3, pay: 'full', lines: [['GAS6', 'binh', 236000], ['GAS12', 'binh', 441000]] },
  { name: 'Gia đình chị Hoa', phone: '0901234513', address: 'P1205 CT2 Xa La, Hà Đông, Hà Nội', contact: 'Chị Hoa', w: 2, pay: 'full', lines: [['GAS12', 'binh', 446000]] },
  { name: 'Nhà hàng chay An Lạc', phone: '0901234514', address: '24 Văn Quán, Hà Đông, Hà Nội', contact: 'Thầy Minh Tâm', w: 3, pay: 'part', lines: [['GAS12', 'binh', 434000], ['GASMINI', 'thung', 520000]] }
]

const MATERIALS = [
  { name: 'Van điều áp gas', unit: 'cái', defaultPrice: 95000 },
  { name: 'Dây dẫn gas 1.5m', unit: 'sợi', defaultPrice: 55000 },
  { name: 'Bếp gas đơn', unit: 'cái', defaultPrice: 320000 },
  { name: 'Bếp gas đôi', unit: 'cái', defaultPrice: 780000 },
  { name: 'Ống mềm + cổ dê', unit: 'bộ', defaultPrice: 35000 },
  { name: 'Bình gas mini 3kg', unit: 'bình', defaultPrice: 180000 }
]

async function main() {
  console.log('→ Đăng nhập 4 vai trò…')
  const admin = await login('admin@gmail.com')
  const office = await login('office@gmail.com')
  const driver = await login('driver@gmail.com')
  const acc = await login('accountant@gmail.com')

  if ((await get(office, '/customers?limit=1')).total) {
    console.log('Đã có khách hàng trong DB — bỏ qua mô phỏng (chạy trên DB trống sau npm run seed).')
    return
  }

  const products = Object.fromEntries((await get(admin, '/products/options')).map(p => [p.code, p]))

  console.log('→ Nhà cung cấp, khách hàng, bảng giá…')
  const suppliers = []
  for (const s of SUPPLIERS) suppliers.push(await post(office, '/suppliers', s))
  const custs = []
  for (const c of CUSTOMERS) {
    const doc = await post(office, '/customers', {
      name: c.name, phone: c.phone, address: c.address, contactName: c.contact, openingDebt: c.opening || 0,
      contract: c.contract ? { number: c.contract, signedAt: '2026-01-15', term: '12 tháng', status: 'active', files: [] } : { status: 'none' },
      gasSystem: { installStatus: c.gas || 'none', note: c.gas ? 'Hệ thống bồn/bình trung tâm' : undefined }
    })
    custs.push({ ...c, _id: doc._id })
    for (const [code, unit, price] of c.lines) await post(admin, `/customers/${doc._id}/prices`, { product: products[code]._id, unit, price, effectiveFrom: '2026-01-01', note: 'Bảng giá năm 2026' })
  }
  // một khách có điều chỉnh giá mới (lịch sử giá)
  await post(admin, `/customers/${custs[0]._id}/prices`, { product: products.GAS45._id, unit: 'kg', price: 37000, effectiveFrom: dateOnly(-1), note: 'Điều chỉnh theo giá nhập tháng 11' })

  console.log('→ Phiếu nhập gas từ nhà cung cấp…')
  const importDays = [-29, -26, -22, -19, -15, -12, -8, -5, -2]
  for (const [i, d] of importDays.entries()) {
    const sup = suppliers[i % 2 === 0 ? 0 : i % 3 === 0 ? 2 : 1]
    const lines = [
      { product: products.GAS45._id, qty: ri(7, 12) },
      { product: products.GAS12._id, qty: ri(14, 28) },
      ...(chance(0.5) ? [{ product: products.GAS48._id, qty: ri(3, 6) }] : []),
      ...(chance(0.4) ? [{ product: products.GAS6._id, qty: ri(5, 12) }] : [])
    ].map(l => {
      const kgPer = Object.values(products).find(p => p._id === l.product).kgPerUnit
      const nominal = l.qty * kgPer
      const doc = nominal - ri(0, Math.round(nominal * 0.004))
      const act = doc + ri(-Math.round(nominal * 0.003), Math.round(nominal * 0.002)) // bơm đủ / thiếu nhẹ
      return { ...l, kgDocument: doc, kgActual: act, pricePerKg: 22500 + ri(-300, 300), shellsReturned: l.qty - ri(0, 3) }
    })
    const total = lines.reduce((s, l) => s + l.kgActual * l.pricePerKg, 0)
    const att = await upload(office, `phieu-nhap-${i + 1}.png`, i + 3)
    await post(chance(0.5) ? office : acc, '/imports', {
      supplier: sup._id, date: dayAt(d, 14), lines, paidAmount: chance(0.7) ? Math.round(total) : Math.round(total * 0.6),
      payMethod: pickOne(['company_account', 'company_account', 'cash']), note: `Nhập lô ${i + 1}/2026`, attachments: [att]
    })
  }

  console.log('→ Vỏ bình đầu kỳ…')
  for (const c of custs.filter(c => c.w >= 5)) {
    for (const code of ['GAS12', 'GAS45']) await post(acc, '/shells/entry', { kind: 'opening', customer: c._id, product: products[code]._id, qty: ri(2, 12), date: dateOnly(-31), note: 'Số dư vỏ đầu kỳ (kiểm kê tại khách)' })
  }
  await post(acc, '/residual/entry', { kind: 'opening', customer: custs[2]._id, kg: 38.5, date: dateOnly(-31), note: 'Gas dư đầu kỳ' })

  console.log('→ Đơn hàng 30 ngày (tạo → phân công → giao → đối soát)…')
  const att = []
  for (let i = 0; i < 6; i++) att.push(await upload(driver, `hoa-don-${i + 1}.png`, i))
  const stats = {}
  const bump = k => (stats[k] = (stats[k] || 0) + 1)

  const buildLines = c => {
    const n = c.lines.length > 1 && chance(0.4) ? 2 : 1
    const chosen = [...c.lines].sort(() => rnd() - 0.5).slice(0, n)
    return chosen.map(([code, unit]) => {
      const kgPer = products[code].kgPerUnit
      let q
      if (unit === 'kg') q = pickOne([90, 135, 180, 225, 270])
      else if (code === 'GAS45' || code === 'GAS48') q = ri(1, 4)
      else if (code === 'GASMINI') q = ri(1, 3)
      else q = ri(1, code === 'GAS6' ? 4 : 6)
      return { product: products[code]._id, plannedQty: q, _unit: unit, _kgPer: kgPer, _code: code }
    })
  }

  async function runOrder(c, offset, finalState) {
    const hour = ri(7, 16)
    const lines = buildLines(c)
    const body = { customer: c._id, deliveryAt: dayAt(offset, hour, pickOne([0, 15, 30, 45])), note: chance(0.2) ? pickOne(['Gọi trước khi đến 15 phút', 'Giao cổng sau', 'Khách nhận hàng tầng hầm', 'Mang theo hóa đơn VAT']) : undefined, lines: lines.map(({ product, plannedQty }) => ({ product, plannedQty })) }
    if (finalState !== 'waiting_assign') body.assignees = [driver.id]
    const o = await post(office, '/orders', body)
    if (finalState === 'waiting_assign') return bump('waiting_assign')
    if (finalState === 'cancelled') {
      await post(office, `/orders/${o._id}/cancel`, { reason: pickOne(['Khách hủy, đã mua nơi khác', 'Khách chưa cần gas, hẹn lại sau', 'Trùng đơn']) })
      return bump('cancelled')
    }
    if (finalState === 'assigned') return bump('assigned')
    await post(driver, `/orders/${o._id}/start`)
    if (finalState === 'delivering') return bump('delivering')

    let total = 0
    const resLines = o.lines.map((l, i) => {
      const src = lines[i]
      let actual = src.plannedQty
      if (chance(0.15)) actual = src._unit === 'kg' ? Math.max(45, actual + pickOne([-45, 45])) : Math.max(1, actual + pickOne([-1, 1]))
      total += Math.round(actual * l.price)
      const bottles = src._unit === 'kg' ? Math.round(actual / src._kgPer) : actual
      const lent = chance(0.12) ? 1 : 0
      const resid = src._code === 'GAS45' || src._code === 'GAS48' ? (chance(0.5) ? Number((rnd() * 5).toFixed(1)) : 0) : chance(0.1) ? Number((rnd() * 1.5).toFixed(1)) : 0
      return { _id: l._id, actualQty: actual, shellsCollected: Math.max(0, bottles - lent), shellsLent: lent, residualKg: resid }
    })
    let paid
    if (c.pay === 'full') paid = total
    else if (c.pay === 'part') paid = chance(0.5) ? Math.round((total * ri(40, 70)) / 100 / 1000) * 1000 : total
    else paid = chance(0.25) ? total : chance(0.5) ? 0 : Math.round((total * ri(30, 60)) / 100 / 1000) * 1000
    const payMethod = pickW([{ v: 'cash', w: 6 }, { v: 'company_account', w: 3 }, { v: 'personal_account', w: 1 }]).v
    await post(driver, `/orders/${o._id}/result`, {
      lines: resLines, attachments: [pickOne(att)],
      delivery: { deliveredAt: body.deliveryAt, note: chance(0.2) ? pickOne(['Khách kiểm tra đủ vỏ', 'Thu tiền mặt tại quầy', 'Đã đổi van mới cho khách']) : undefined, paidAmount: paid, payMethod: paid > 0 ? payMethod : undefined, payAccountNote: payMethod === 'personal_account' && paid > 0 ? 'Chủ cửa hàng (Nguyễn Văn Hùng)' : undefined }
    })
    if (finalState === 'pending_review') return bump('pending_review')
    if (finalState === 'need_fix') {
      await post(acc, `/orders/${o._id}/return`, { reason: pickOne(['Ảnh hóa đơn mờ, chụp lại giúp', 'Số vỏ thu về chưa khớp sổ, kiểm tra lại', 'Thiếu ghi chú gas dư']) })
      return bump('need_fix')
    }
    await post(chance(0.8) ? acc : admin, `/orders/${o._id}/approve`)
    bump('approved')
  }

  for (let d = -30; d <= 1; d++) {
    const sunday = dow(d) === 0
    let n = sunday ? ri(0, 1) : ri(2, 4)
    if (d === 0) n = 6
    if (d === 1) n = 3
    for (let k = 0; k < n; k++) {
      const c = pickW(custs.map(x => ({ ...x, w: x.w })))
      let state = 'approved'
      if (d === 1) state = 'assigned'
      else if (d === 0) state = ['assigned', 'delivering', 'waiting_assign', 'pending_review', 'approved', 'assigned'][k]
      else if (d >= -2) state = pickW([{ v: 'approved', w: 5 }, { v: 'pending_review', w: 3 }, { v: 'need_fix', w: 1 }]).v
      else state = pickW([{ v: 'approved', w: 46 }, { v: 'cancelled', w: 2 }, { v: 'need_fix', w: 1 }]).v
      if (d === -2 && k === 0) state = 'need_fix'
      await runOrder(c, d, state)
    }
  }
  console.log('   Đơn theo trạng thái:', stats)

  console.log('→ Thu nợ, điều chỉnh công nợ, bù trừ gas dư…')
  const dueRows = (await get(acc, `/debts?from=2026-01-01&to=${dateOnly(0)}&onlyDebt=1&limit=100`)).rows
  let di = 0
  for (const r of dueRows) {
    if (r.closing <= 100000) continue
    const pay = Math.round((r.closing * ri(40, 85)) / 100 / 10000) * 10000
    if (pay > 0) await post(acc, '/debts/payment', { customer: r.customer._id, amount: pay, channel: pickOne(['company_account', 'cash']), date: dayAt(-ri(1, 6), 10), content: `Thu công nợ ${r.customer.name} đợt ${++di}` })
  }
  await post(acc, '/debts/adjust', { customer: custs[1]._id, amount: -150000, date: dayAt(-4, 11), reason: 'Chiết khấu hỗ trợ khách quen theo thỏa thuận' })
  await post(acc, '/residual/entry', { kind: 'offset', customer: custs[2]._id, kg: 25, date: dayAt(-3, 11), note: 'Bù trừ gas dư vào đơn tháng 11' })
  await post(acc, '/shells/entry', { kind: 'supplier_return', product: products.GAS12._id, qty: 30, date: dayAt(-6, 15), note: 'Trả vỏ NCC kỳ 1' })
  await post(acc, '/shells/entry', { kind: 'stocktake', product: products.GAS45._id, qty: -2, date: dayAt(-1, 17), note: 'Kiểm kê cuối tuần: thiếu 2 vỏ' })

  console.log('→ Thu chi thủ công…')
  const out = [
    ['operation', 'Tiền điện cửa hàng tháng 10', 2850000, 'company_account', -20], ['operation', 'Tiền thuê kho bãi tháng 11', 12000000, 'company_account', -6],
    ['operation', 'Xăng xe tải giao hàng (tuần 1)', 1450000, 'cash', -23], ['operation', 'Xăng xe tải giao hàng (tuần 2)', 1380000, 'cash', -16],
    ['operation', 'Xăng xe tải giao hàng (tuần 3)', 1520000, 'cash', -9], ['operation', 'Xăng xe tải giao hàng (tuần 4)', 1290000, 'cash', -2],
    ['operation', 'Lương nhân viên giao hàng tháng 10', 9500000, 'company_account', -7], ['operation', 'Lương nhân viên văn phòng tháng 10', 8500000, 'company_account', -7],
    ['supplies', 'Mua giấy in hóa đơn, bút, sổ sách', 380000, 'cash', -14], ['other_out', 'Tiếp khách đối tác', 650000, 'cash', -11], ['operation', 'Phí internet & điện thoại', 480000, 'company_account', -18]
  ]
  for (const [category, content, amount, channel, d] of out) await post(acc, '/cash', { type: 'out', category, content, amount, channel, date: dayAt(d, 16) })
  await post(acc, '/cash', { type: 'in', category: 'other_in', content: 'Thu tiền đặt cọc vỏ bình khách mới', amount: 2000000, channel: 'cash', date: dayAt(-10, 15) })
  await post(acc, '/cash', { type: 'in', category: 'other_in', content: 'Hoàn tiền cọc vỏ từ nhà cung cấp', amount: 1200000, channel: 'company_account', date: dayAt(-5, 15) })

  console.log('→ Vật tư (nhập / bán / tặng)…')
  const mats = []
  for (const m of MATERIALS) mats.push(await post(office, '/materials', m))
  for (const [i, m] of mats.entries()) await post(office, '/material-tx', { material: m._id, type: 'in', qty: ri(30, 80), unitPrice: Math.round(m.defaultPrice * 0.72 / 1000) * 1000, paidAmount: 99999999, payMethod: 'cash', date: dayAt(-28 + i, 9), note: 'Nhập kho đầu kỳ' })
  for (let i = 0; i < 18; i++) {
    const m = pickOne(mats), c = pickOne(custs), type = chance(0.82) ? 'sale' : 'gift'
    const qty = ri(1, m.name.includes('Bếp') ? 2 : 4)
    await post(office, '/material-tx', { material: m._id, type, qty, unitPrice: m.defaultPrice, paidAmount: type === 'sale' ? (chance(0.8) ? qty * m.defaultPrice : 0) : 0, payMethod: pickOne(['cash', 'company_account']), customer: c._id, date: dayAt(-ri(0, 26), ri(8, 17)), note: type === 'gift' ? 'Tặng khách hàng thân thiết' : undefined }).catch(e => console.log('   (bỏ qua)', e.message))
  }

  console.log('→ Sửa chữa, bảo trì, kiểm định phương tiện…')
  const maint = [
    ['truck', '29C-123.45', 'inspection', 'Đăng kiểm định kỳ xe tải', -40, 'Trung tâm đăng kiểm 29-03D', 560000, 140],
    ['truck', '29C-123.45', 'maintenance', 'Thay dầu động cơ + lọc dầu', -25, 'Gara Ô tô Hùng Cường', 1850000, 65],
    ['truck', '29C-123.45', 'repair', 'Thay má phanh trước', -12, 'Gara Ô tô Hùng Cường', 2400000, undefined],
    ['truck', '30E-678.90', 'inspection', 'Đăng kiểm định kỳ xe tải nhỏ', -330, 'Trung tâm đăng kiểm 29-01S', 480000, 25],
    ['truck', '30E-678.90', 'maintenance', 'Bảo dưỡng 10.000 km', -8, 'Gara Thành Đạt', 1250000, 80],
    ['motorbike', '29H1-456.78', 'repair', 'Thay lốp sau + săm', -15, 'Tiệm xe máy Bình Minh', 420000, undefined],
    ['motorbike', '29H1-456.78', 'maintenance', 'Thay nhớt, vệ sinh bugi', -5, 'Tiệm xe máy Bình Minh', 180000, 60],
    ['motorbike', '29K1-222.33', 'maintenance', 'Bảo dưỡng định kỳ', -30, 'Head Honda Hà Đông', 350000, 10]
  ]
  for (const [vehicleType, plate, kind, item, d, vendor, cost, due] of maint) await post(office, '/maintenance', { vehicleType, plate, kind, item, date: dateOnly(d), vendor, cost, nextDue: due == null ? undefined : dateOnly(due), note: 'Có hóa đơn' })

  const dash = await get(admin, '/orders/dashboard')
  console.log('\n✓ Xong. Tổng quan:', dash.cards.map(c => `${c.label}: ${c.value.toLocaleString('vi-VN')}`).join(' | '))
}

main().catch(e => {
  console.error('✗ Lỗi:', e.message)
  process.exit(1)
})
