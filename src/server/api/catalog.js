import { get, post, put, del, bad, forbidden, notFound, list, rx, audit, pick, oid, nextCode } from '../core'
import { Customer, CustomerPrice, Product, Supplier, Order } from '../models'
import { currentPrice, getSettings } from '../lib'

const WRITE = ['admin', 'office']
const BACK = ['admin', 'office', 'accountant']

// ===== Khách hàng =====
const CUSTOMER_FIELDS = ['name', 'phone', 'address', 'contactName', 'contactInfo', 'contract', 'gasSystem', 'openingDebt', 'status', 'note']

get('/customers', BACK, async ({ query }) => {
  const f = {}
  if (query.q) f.$or = [{ name: rx(query.q) }, { code: rx(query.q) }, { phone: rx(query.q) }]
  if (query.status) f.status = query.status
  return list(Customer, f, query, { sort: { name: 1 } })
})

get('/customers/options', BACK, async ({ query }) => {
  const f = { status: 'active' }
  if (query.q) f.$or = [{ name: rx(query.q) }, { code: rx(query.q) }, { phone: rx(query.q) }]
  return Customer.find(f).select('code name phone address status').sort({ name: 1 }).limit(50).lean()
})

get('/customers/:id', BACK, async ({ params }) => {
  const c = await Customer.findById(oid(params.id)).lean()
  if (!c) throw notFound()
  return c
})

post('/customers', WRITE, async ({ session, body }) => {
  if (!String(body.name || '').trim()) throw bad('Vui lòng nhập tên khách hàng')
  const code = await nextCode('KH', false)
  const c = await Customer.create({ ...pick(body, CUSTOMER_FIELDS), code })
  await audit(session, 'customer', c._id, 'create', `Tạo khách hàng ${c.code} - ${c.name}`)
  return c
})

put('/customers/:id', WRITE, async ({ session, params, body }) => {
  const c = await Customer.findById(oid(params.id))
  if (!c) throw notFound()
  const before = c.toObject()
  Object.assign(c, pick(body, CUSTOMER_FIELDS))
  await c.save()
  await audit(session, 'customer', c._id, 'update', `Cập nhật khách hàng ${c.code} - ${c.name}`, before, c.toObject())
  return c
})

// Xóa mềm: chuyển sang ngừng hoạt động; không xóa vật lý khách đã có đơn
del('/customers/:id', WRITE, async ({ session, params }) => {
  const c = await Customer.findById(oid(params.id))
  if (!c) throw notFound()
  const hasOrders = await Order.exists({ customer: c._id })
  c.status = 'inactive'
  await c.save()
  await audit(session, 'customer', c._id, 'deactivate', `Ngừng hoạt động khách hàng ${c.code} - ${c.name}${hasOrders ? ' (đã có đơn, giữ lại dữ liệu)' : ''}`)
  return { ok: true }
})

// ===== Bảng giá riêng theo khách (lịch sử bất biến) =====
get('/customers/:id/prices', BACK, async ({ params }) => {
  return CustomerPrice.find({ customer: oid(params.id) }).populate('product', 'code name').sort({ effectiveFrom: -1, createdAt: -1 }).lean()
})

post('/customers/:id/prices', null, async ({ session, params, body }) => {
  const st = await getSettings()
  if (session.role !== 'admin' && !(st.priceEditRoles || []).includes(session.role)) throw forbidden('Bạn không có quyền thay đổi giá')
  const customer = await Customer.findById(oid(params.id))
  if (!customer) throw notFound('Không tìm thấy khách hàng')
  const product = await Product.findById(oid(body.product))
  if (!product) throw bad('Vui lòng chọn sản phẩm')
  if (!['binh', 'kg', 'thung'].includes(body.unit)) throw bad('Đơn vị tính giá không hợp lệ')
  const price = Number(body.price)
  if (!(price >= 0) || body.price === '' || body.price == null) throw bad('Đơn giá không hợp lệ')
  if (!body.effectiveFrom) throw bad('Vui lòng chọn ngày bắt đầu áp dụng')
  const p = await CustomerPrice.create({
    customer: customer._id,
    product: product._id,
    unit: body.unit,
    price,
    effectiveFrom: new Date(body.effectiveFrom),
    note: body.note,
    createdBy: session.id,
    createdByName: session.name
  })
  await audit(session, 'price', p._id, 'create', `Giá ${product.name} cho ${customer.name}: ${price} đ/${body.unit} từ ${String(body.effectiveFrom).slice(0, 10)}`)
  return p
})

get('/prices/current', ['admin', 'office', 'accountant'], async ({ query }) => {
  if (!query.customer || !query.product) return null
  const p = await currentPrice(oid(query.customer), oid(query.product), query.date ? new Date(query.date) : new Date())
  return p ? { price: p.price, unit: p.unit, effectiveFrom: p.effectiveFrom } : null
})

// ===== Sản phẩm =====
const PRODUCT_FIELDS = ['name', 'unit', 'kgPerUnit', 'unitsPerBox', 'status', 'note']

get('/products', null, async ({ query }) => {
  const f = {}
  if (query.q) f.$or = [{ name: rx(query.q) }, { code: rx(query.q) }]
  if (query.status) f.status = query.status
  return list(Product, f, query, { sort: { code: 1 } })
})

get('/products/options', null, async () => Product.find({ status: 'active' }).select('code name unit kgPerUnit unitsPerBox').sort({ code: 1 }).lean())

post('/products', ['admin'], async ({ session, body }) => {
  if (!String(body.name || '').trim()) throw bad('Vui lòng nhập tên sản phẩm')
  const code = body.code ? String(body.code).trim().toUpperCase() : await nextCode('SP', false)
  const p = await Product.create({ ...pick(body, PRODUCT_FIELDS), code })
  await audit(session, 'product', p._id, 'create', `Tạo sản phẩm ${p.code} - ${p.name}`)
  return p
})

put('/products/:id', ['admin'], async ({ session, params, body }) => {
  const p = await Product.findById(oid(params.id))
  if (!p) throw notFound()
  const before = p.toObject()
  Object.assign(p, pick(body, PRODUCT_FIELDS))
  await p.save()
  await audit(session, 'product', p._id, 'update', `Cập nhật sản phẩm ${p.code} - ${p.name}`, before, p.toObject())
  return p
})

// Sản phẩm không xóa vật lý: chuyển ngừng bán
del('/products/:id', ['admin'], async ({ session, params }) => {
  const p = await Product.findById(oid(params.id))
  if (!p) throw notFound()
  p.status = 'inactive'
  await p.save()
  await audit(session, 'product', p._id, 'deactivate', `Ngừng bán sản phẩm ${p.code} - ${p.name}`)
  return { ok: true }
})

// ===== Nhà cung cấp =====
const SUPPLIER_FIELDS = ['name', 'phone', 'address', 'status', 'note']

get('/suppliers', BACK, async ({ query }) => {
  const f = {}
  if (query.q) f.$or = [{ name: rx(query.q) }, { phone: rx(query.q) }]
  if (query.status) f.status = query.status
  return list(Supplier, f, query, { sort: { name: 1 } })
})

get('/suppliers/options', BACK, async () => Supplier.find({ status: 'active' }).select('code name phone').sort({ name: 1 }).lean())

post('/suppliers', ['admin', 'office'], async ({ session, body }) => {
  if (!String(body.name || '').trim()) throw bad('Vui lòng nhập tên nhà cung cấp')
  const s = await Supplier.create({ ...pick(body, SUPPLIER_FIELDS), code: await nextCode('NCC', false) })
  await audit(session, 'supplier', s._id, 'create', `Tạo nhà cung cấp ${s.name}`)
  return s
})

put('/suppliers/:id', ['admin', 'office'], async ({ session, params, body }) => {
  const s = await Supplier.findById(oid(params.id))
  if (!s) throw notFound()
  Object.assign(s, pick(body, SUPPLIER_FIELDS))
  await s.save()
  await audit(session, 'supplier', s._id, 'update', `Cập nhật nhà cung cấp ${s.name}`)
  return s
})

del('/suppliers/:id', ['admin', 'office'], async ({ session, params }) => {
  const s = await Supplier.findById(oid(params.id))
  if (!s) throw notFound()
  s.status = 'inactive'
  await s.save()
  await audit(session, 'supplier', s._id, 'deactivate', `Ngừng hợp tác nhà cung cấp ${s.name}`)
  return { ok: true }
})
