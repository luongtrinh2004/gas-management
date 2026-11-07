import mongoose from './db'

const { Schema } = mongoose
const ObjectId = Schema.Types.ObjectId
const Mixed = Schema.Types.Mixed

const opts = { timestamps: true }

function model(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema)
}

export const Counter = model('Counter', new Schema({ key: { type: String, unique: true }, seq: { type: Number, default: 0 } }))

export const User = model(
  'User',
  new Schema(
    {
      email: { type: String, required: true, unique: true, lowercase: true, trim: true },
      name: { type: String, required: true },
      phone: String,
      gender: { type: String, enum: ['male', 'female'], default: 'male' },
      passwordHash: { type: String, required: true },
      role: { type: String, enum: ['admin', 'office', 'driver', 'accountant'], required: true },
      status: { type: String, enum: ['active', 'disabled'], default: 'active' },
      lastLoginAt: Date
    },
    opts
  )
)


// ===== Danh mục =====
export const Customer = model(
  'Customer',
  new Schema(
    {
      code: { type: String, unique: true },
      name: { type: String, required: true },
      phone: String,
      address: String,
      contactName: String,
      contactInfo: String,
      contract: { number: String, signedAt: Date, term: String, status: { type: String, enum: ['none', 'active', 'expired', 'terminated'], default: 'none' }, files: [Mixed] },
      gasSystem: { installStatus: { type: String, enum: ['none', 'installed', 'planned'], default: 'none' }, investmentSupport: String, note: String },
      openingDebt: { type: Number, default: 0 }, // dư nợ đầu kỳ (đồng)
      status: { type: String, enum: ['active', 'inactive'], default: 'active' },
      note: String
    },
    opts
  )
)

export const Supplier = model(
  'Supplier',
  new Schema({ code: String, name: { type: String, required: true }, phone: String, address: String, status: { type: String, enum: ['active', 'inactive'], default: 'active' }, note: String }, opts)
)

// unit: đơn vị bán mặc định (binh | kg | thung). kgPerUnit: quy đổi kg/bình (gas mini để trống: tính theo thùng)
export const Product = model(
  'Product',
  new Schema(
    {
      code: { type: String, unique: true },
      name: { type: String, required: true },
      unit: { type: String, enum: ['binh', 'kg', 'thung'], default: 'binh' },
      kgPerUnit: Number,
      unitsPerBox: Number, // gas mini: số bình/thùng (nếu có)
      status: { type: String, enum: ['active', 'inactive'], default: 'active' },
      note: String
    },
    opts
  )
)

// Giá riêng theo khách + sản phẩm + ngày hiệu lực. Giá hiện hành = bản ghi có effectiveFrom <= ngày, mới nhất.
export const CustomerPrice = model(
  'CustomerPrice',
  new Schema(
    {
      customer: { type: ObjectId, ref: 'Customer', required: true, index: true },
      product: { type: ObjectId, ref: 'Product', required: true },
      unit: { type: String, enum: ['binh', 'kg', 'thung'], required: true }, // giá tính theo đơn vị nào
      price: { type: Number, required: true },
      effectiveFrom: { type: Date, required: true },
      note: String,
      createdBy: { type: ObjectId, ref: 'User' },
      createdByName: String
    },
    opts
  )
)

// ===== Đơn hàng & giao hàng =====
const OrderLine = new Schema(
  {
    product: { type: ObjectId, ref: 'Product', required: true },
    productName: String,
    unit: { type: String, enum: ['binh', 'kg', 'thung'], required: true },
    price: { type: Number, default: 0 }, // đơn giá chốt tại thời điểm tạo đơn
    plannedQty: { type: Number, default: 0 }, // số lượng dự kiến
    actualQty: { type: Number, default: null }, // số lượng thực giao (tách biệt với dự kiến)
    shellsCollected: { type: Number, default: 0 }, // vỏ thu về
    shellsLent: { type: Number, default: 0 }, // vỏ giao/mượn thêm (chưa thu hồi)
    residualKg: { type: Number, default: 0 } // gas dư ghi nhận (kg)
  },
  { _id: true }
)

export const Order = model(
  'Order',
  new Schema(
    {
      code: { type: String, unique: true },
      customer: { type: ObjectId, ref: 'Customer', required: true, index: true },
      customerName: String,
      deliveryAddress: String,
      deliveryAt: Date,
      note: String,
      lines: [OrderLine],
      status: { type: String, enum: ['new', 'waiting_assign', 'assigned', 'delivering', 'pending_review', 'need_fix', 'approved', 'cancelled'], default: 'waiting_assign', index: true },
      assignees: [{ type: ObjectId, ref: 'User' }],
      createdBy: { type: ObjectId, ref: 'User' },
      createdByName: String,
      // kết quả giao hàng
      delivery: {
        deliveredAt: Date,
        note: String,
        confirmedBy: { type: ObjectId, ref: 'User' },
        confirmedByName: String,
        confirmedAt: Date,
        paidAmount: { type: Number, default: 0 }, // số tiền đã thu tại điểm giao
        payMethod: { type: String, enum: ['cash', 'company_account', 'personal_account', 'other'] },
        payAccountNote: String // ví dụ: chuyển khoản vào tài khoản cá nhân của ai
      },
      attachments: [Mixed], // ảnh hóa đơn: { name, url, uploadedBy, uploadedAt }
      returnReason: String, // lý do trả lại chỉnh sửa
      cancelReason: String,
      reviewedBy: { type: ObjectId, ref: 'User' },
      reviewedByName: String,
      approvedAt: Date,
      amount: { type: Number, default: 0 }, // thành tiền cuối (theo số thực giao) — chốt khi gửi kết quả/duyệt
      bookDate: Date, // ngày hạch toán (ngày giao thực tế) khi duyệt
      cashTx: { type: ObjectId, ref: 'CashTx' } // phiếu thu sinh ra khi duyệt
    },
    opts
  )
)

// ===== Nhập hàng =====
const ImportLine = new Schema(
  {
    product: { type: ObjectId, ref: 'Product', required: true },
    productName: String,
    qty: { type: Number, default: 0 }, // số bình/thùng nhập
    kgDocument: { type: Number, default: 0 }, // kg trên chứng từ
    kgActual: { type: Number, default: 0 }, // kg thực tế
    pricePerKg: { type: Number, default: 0 },
    shellsReturned: { type: Number, default: 0 } // vỏ trả nhà cung cấp
  },
  { _id: true }
)

export const Import = model(
  'Import',
  new Schema(
    {
      code: { type: String, unique: true },
      supplier: { type: ObjectId, ref: 'Supplier', required: true },
      supplierName: String,
      date: { type: Date, required: true },
      lines: [ImportLine],
      valueBasis: { type: String, enum: ['actual', 'document'], default: 'actual' }, // chốt theo cấu hình lúc lập phiếu
      totalValue: { type: Number, default: 0 },
      paidAmount: { type: Number, default: 0 },
      payMethod: { type: String, enum: ['cash', 'company_account', 'personal_account', 'other'], default: 'cash' },
      status: { type: String, enum: ['draft', 'confirmed', 'void'], default: 'confirmed' },
      note: String,
      attachments: [Mixed],
      createdBy: { type: ObjectId, ref: 'User' },
      createdByName: String
    },
    opts
  )
)

// ===== Thu chi (nguồn duy nhất cho dòng tiền) =====
export const CashTx = model(
  'CashTx',
  new Schema(
    {
      code: { type: String, unique: true },
      type: { type: String, enum: ['in', 'out'], required: true },
      category: { type: String, required: true }, // sale | debt_collect | material_sale | other_in | import | operation | repair | supplies | other_out
      date: { type: Date, required: true, index: true },
      amount: { type: Number, required: true },
      channel: { type: String, enum: ['cash', 'company_account', 'personal_account', 'other'], default: 'cash' },
      accountNote: String, // tài khoản cá nhân của ai...
      content: String,
      customer: { type: ObjectId, ref: 'Customer' },
      customerName: String,
      refType: String, // order | import | material | maintenance | manual
      refId: String,
      refCode: String,
      attachments: [Mixed],
      void: { type: Boolean, default: false },
      voidReason: String,
      createdBy: { type: ObjectId, ref: 'User' },
      createdByName: String
    },
    opts
  )
)

// ===== Điều chỉnh sổ (nhập tay, có lưu vết): công nợ / vỏ / gas dư =====
export const DebtAdjust = model(
  'DebtAdjust',
  new Schema(
    {
      customer: { type: ObjectId, ref: 'Customer', required: true, index: true },
      date: { type: Date, required: true },
      amount: { type: Number, required: true }, // dương: tăng nợ, âm: giảm nợ
      reason: { type: String, required: true },
      createdBy: { type: ObjectId, ref: 'User' },
      createdByName: String
    },
    opts
  )
)

// kind: opening | supplier_return | stocktake | adjust. customer rỗng = vỏ của công ty. qty: dương = khách giữ thêm (hoặc kho tăng khi stocktake)
export const ShellEntry = model(
  'ShellEntry',
  new Schema(
    {
      customer: { type: ObjectId, ref: 'Customer', index: true },
      product: { type: ObjectId, ref: 'Product', required: true },
      kind: { type: String, enum: ['opening', 'supplier_return', 'stocktake', 'adjust'], required: true },
      qty: { type: Number, required: true },
      date: { type: Date, required: true },
      note: String,
      createdBy: { type: ObjectId, ref: 'User' },
      createdByName: String
    },
    opts
  )
)

// kind: opening | offset (đối trừ vào đơn sau/quy đổi tiền) | adjust. kg dương: phát sinh thêm, âm: đã đối trừ
export const ResidualEntry = model(
  'ResidualEntry',
  new Schema(
    {
      customer: { type: ObjectId, ref: 'Customer', required: true, index: true },
      product: { type: ObjectId, ref: 'Product' },
      kind: { type: String, enum: ['opening', 'offset', 'adjust'], required: true },
      kg: { type: Number, required: true },
      date: { type: Date, required: true },
      note: String,
      createdBy: { type: ObjectId, ref: 'User' },
      createdByName: String
    },
    opts
  )
)

// ===== Vật tư =====
export const Material = model(
  'Material',
  new Schema({ code: String, name: { type: String, required: true }, unit: { type: String, default: 'cái' }, defaultPrice: { type: Number, default: 0 }, status: { type: String, enum: ['active', 'inactive'], default: 'active' }, note: String }, opts)
)

// type: in (nhập) | sale (bán) | gift (tặng). qty luôn dương.
export const MaterialTx = model(
  'MaterialTx',
  new Schema(
    {
      material: { type: ObjectId, ref: 'Material', required: true, index: true },
      materialName: String,
      type: { type: String, enum: ['in', 'sale', 'gift'], required: true },
      date: { type: Date, required: true },
      qty: { type: Number, required: true },
      unitPrice: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
      paidAmount: { type: Number, default: 0 }, // tiền thu (bán) / tiền chi (nhập)
      payMethod: { type: String, enum: ['cash', 'company_account', 'personal_account', 'other'], default: 'cash' },
      customer: { type: ObjectId, ref: 'Customer' },
      customerName: String,
      note: String,
      void: { type: Boolean, default: false },
      createdBy: { type: ObjectId, ref: 'User' },
      createdByName: String
    },
    opts
  )
)

// ===== Sửa chữa, bảo trì, kiểm định =====
export const Maintenance = model(
  'Maintenance',
  new Schema(
    {
      vehicleType: { type: String, enum: ['motorbike', 'truck'], required: true },
      plate: { type: String, required: true },
      kind: { type: String, enum: ['repair', 'maintenance', 'inspection'], required: true },
      item: { type: String, required: true }, // hạng mục
      date: { type: Date, required: true },
      vendor: String, // đơn vị thực hiện
      cost: { type: Number, default: 0 },
      nextDue: Date,
      note: String,
      createdBy: { type: ObjectId, ref: 'User' },
      createdByName: String
    },
    opts
  )
)

export const Setting = model('Setting', new Schema({ key: { type: String, unique: true }, value: Mixed }, opts))

export const Notification = model(
  'Notification',
  new Schema(
    {
      user: { type: ObjectId, ref: 'User' },
      role: String,
      type: String,
      message: String,
      link: String,
      readBy: [{ type: ObjectId }],
      readAt: Date
    },
    opts
  )
)

export const AuditLog = model(
  'AuditLog',
  new Schema(
    {
      at: { type: Date, default: Date.now, index: true },
      user: { type: ObjectId, ref: 'User' },
      userName: String,
      entity: String,
      entityId: String,
      action: String,
      summary: String,
      before: Mixed,
      after: Mixed
    },
    { timestamps: false }
  )
)
