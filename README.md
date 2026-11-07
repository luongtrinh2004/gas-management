# Gas Management

Hệ thống quản lý kinh doanh gas theo tài liệu *Đề xuất nghiệp vụ v2*: tiếp nhận đơn → phân công → giao hàng (mobile) → đối soát/duyệt → công nợ, vỏ bình, gas dư → nhập hàng/kho, thu chi, vật tư, bảo trì → báo cáo ngày/tháng + xuất Excel.
Next.js 15 (App Router) + Material UI (Materio) + MongoDB (Mongoose). Quy chuẩn giao diện: [UI_RULES.md](./UI_RULES.md).

## Chạy thử

```bash
npm install
cp .env.example .env.local     # MONGODB_URI, AUTH_SECRET
npm run seed                   # chỉ khi DB trống
npm run dev
```
Tài khoản mẫu (mật khẩu `Gas@123456`): `admin@`, `office@`, `driver1@`, `driver2@`, `ketoan@gas.local`.
Ảnh hóa đơn lưu ở `.uploads/` (đổi bằng `UPLOAD_DIR`).

## Cấu trúc
- `src/server/models.js` — toàn bộ model. `lib.js` — tính công nợ/vỏ/gas dư/tồn kho (tổng hợp từ dữ liệu gốc), `syncCash` (mỗi chứng từ đúng 1 phiếu thu/chi). `api/*.js`: `auth`, `system`, `catalog`, `orders`, `finance`, `inventory`, `reports`.
- `src/configs/access.js` — menu + quyền trang theo vai trò (admin, office, driver, accountant). API kiểm tra quyền thật.
- `src/app/(dashboard)/*` — các trang; `src/views/*` — form/dialog theo module.

## Quy tắc chính
- Giá chốt trên dòng đơn; số lượng dự kiến và thực giao lưu riêng. Chỉ đơn **đã duyệt** mới vào công nợ/vỏ/gas dư/tồn/thu chi; đơn đã duyệt không xóa, chỉ "mở lại để điều chỉnh" (có lý do, lưu vết, hủy phiếu thu).
- Giao hàng chỉ thấy đơn được phân công, không tự ghi sổ.
- Các điểm spec chưa chốt (mục 8) được làm thành cấu hình ở `/admin/settings`: cách tính giá trị phiếu nhập (kg thực tế/chứng từ), nhiều người giao một đơn, ai được sửa giá.
