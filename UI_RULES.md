# GAS MANAGEMENT - UI & DESIGN SYSTEM RULES

Tài liệu quy định toàn bộ chuẩn mực giao diện, hệ màu, typography, bố cục và quy tắc phân quyền (Role-based UI) áp dụng cho hệ thống **Gas Management**.

---

## 1. Màu Sắc Chủ Đạo (Color System & Tokens)

Hệ thống sử dụng bộ màu chuẩn Materio MUI với tông màu chính tím hiện đại (Violet / Indigo) kết hợp cùng hệ thống màu ngữ nghĩa (Semantic Colors):

### 1.1. Bảng Màu Ngữ Nghĩa (Semantic Palette)

| Vai trò | Tên Token | Mã màu Hex | Light / Dark Opacity | Ứng dụng thực tế |
| :--- | :--- | :--- | :--- | :--- |
| **Primary (Chính)** | `primary.main` | `#7367F0` | `#8F85F3` / `#675DD8` | Nút bấm chính, sidebar active, link, icon thương hiệu |
| **Secondary** | `secondary.main`| `#808390` | `#999CA6` / `#737682` | Nút phụ, text phụ, trạng thái trung tính |
| **Success** | `success.main` | `#28C76F` | `#53D28C` / `#24B364` | Trạng thái "Đang hoạt động", "Đã đóng quỹ", "Hoàn thành", số dư dương |
| **Error** | `error.main` | `#FF4C51` | `#FF7074` / `#E64449` | Trạng thái "Vô hiệu hóa", "Đã hủy", xóa, số dư âm cảnh báo |
| **Warning** | `warning.main` | `#FF9F43` | `#FFB269` / `#E68F3C` | Trạng thái "Chờ duyệt", cảnh báo chênh lệch điểm, nhắc nhở |
| **Info** | `info.main` | `#00BAD1` | `#33C8DA` / `#00A7BC` | Trạng thái "Sắp tới", thông tin hướng dẫn, badge thông báo |

### 1.2. Biến Thể Nền & Opacity (Soft Colors)
- Để tạo cảm giác nhẹ nhàng, hiện đại, các Badge và Chip trạng thái không dùng nền đậm đặc mà sử dụng biến thể **light opacity (12% - 16%)**:
  - `Chip` xanh: background `rgba(40, 199, 111, 0.12)`, text `#28C76F`.
  - `Chip` đỏ: background `rgba(255, 76, 81, 0.12)`, text `#FF4C51`.
  - `Chip` tím: background `rgba(115, 103, 240, 0.12)`, text `#7367F0`.
  - `Chip` cam: background `rgba(255, 159, 67, 0.12)`, text `#FF9F43`.

### 1.3. Nền (Background) & Đường Viền (Borders)
- **Light Mode**:
  - Paper / Card: `#FFFFFF`
  - Body Background: `#F8F7FA`
  - Border: `rgba(47, 43, 61, 0.12)`
- **Dark Mode**:
  - Paper / Card: `#2F3349`
  - Body Background: `#25293C`
  - Border: `rgba(225, 222, 245, 0.12)`

---

## 2. Typography & Font Chữ

- **Font Family**: `"Public Sans", sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`
- **Quy tắc cỡ chữ & độ đậm (Font Scale)**:

| Phân cấp | Cỡ chữ (Rem/Px) | Font Weight | Line Height | Trường hợp sử dụng |
| :--- | :--- | :--- | :--- | :--- |
| **H1** | `2.875rem` (46px) | 500 | 1.48 | Tiêu đề trang landing |
| **H3** | `1.75rem` (28px) | 500 | 1.50 | Tiêu đề phân hệ lớn |
| **H4** | `1.5rem` (24px) | 500 | 1.58 | Tiêu đề màn hình chính (Dashboard, Nhân sự...) |
| **H5** | `1.125rem` (18px) | 500 | 1.55 | Tiêu đề Card, tiêu đề Modal/Dialog |
| **H6** | `0.9375rem` (15px) | 500 | 1.47 | Tiêu đề mục con, Header bảng |
| **Body1** | `0.9375rem` (15px) | 400 | 1.47 | Nội dung văn bản chính, dữ liệu ô bảng |
| **Body2** | `0.8125rem` (13px) | 400 | 1.54 | Văn bản phụ, chú thích nhỏ, email phụ |
| **Button** | `0.9375rem` (15px) | 500 | 1.47 | Chữ nút bấm (chữ thường hoặc Capitalize, không ALL CAPS thô cứng) |
| **Caption** | `0.8125rem` (13px) | 400 | 1.38 | Gợi ý dưới input, timestamp |

---

## 3. Quy Tắc Component (Component Standards)

### 3.1. Ô Nhập Liệu (Input Fields)
- Luôn ưu tiên dùng `@core/components/mui/TextField` (`CustomTextField`).
- Kích thước chuẩn: `size="small"` cho các bảng lọc và form trong card.
- Định dạng số tiền: Tự động format dấu chấm phân cách hàng nghìn (ví dụ `100.000`) và tách nhãn đơn vị `VNĐ`.

### 3.2. Bảng Dữ Liệu (Data Tables)
- Dùng `@tanstack/react-table` v8 kết hợp `@core/styles/table.module.css`.
- Header bảng: Background nhạt, chữ in hoa nhẹ hoặc hoa đầu từ, canh lề thẳng với dữ liệu (cột chữ canh trái, cột số/tiền canh phải, trạng thái canh giữa).
- Phân trang: Sử dụng `@components/TablePaginationComponent`.
- Hiệu ứng dòng: `hover` nhẹ (`rgba(115, 103, 240, 0.04)`).

### 3.3. Nút Bấm (Buttons)
- **Thao tác chính (Primary Action)**: `variant="contained" color="primary"` (vd: Lưu thay đổi, Thêm nhân sự, Random lịch).
- **Thao tác phụ (Secondary Action)**: `variant="tonal"` hoặc `variant="outlined"` (vd: Đóng, Hủy bỏ, Xuất Excel).
- **Thao tác xóa / Nguy hiểm**: `variant="tonal" color="error"` hoặc `variant="contained" color="error"` kèm Dialog xác nhận (Confirmation Modal).

### 3.4. Avatar & Icon
- **Avatar**: Sử dụng `@core/components/mui/Avatar` (`CustomAvatar`) với màu nền tương ứng theo vai trò hoặc bộ phận.
- **Icon Set**: Sử dụng chuẩn **Tabler Icons** (`tabler-*` như `tabler-users`, `tabler-droplet`, `tabler-wallet`, `tabler-package`, `tabler-history`, `tabler-file-spreadsheet`).

---

## 4. Bố Cục & Điều Hướng (Layout & Sidebar Navigation)

### 4.1. Khung Điều Hướng Sidebar
| Mục | Đường dẫn | Icon | Vai trò |
| :--- | :--- | :--- | :--- |
| Trang chủ | `/home` | `tabler-smart-home` | Tất cả |
| Đơn giao của tôi | `/deliveries` | `tabler-truck-delivery` | Giao hàng |
| Đơn hàng | `/orders` | `tabler-clipboard-list` | Admin, Văn phòng, Kế toán |
| Chờ đối soát | `/reconcile` | `tabler-checklist` | Admin, Văn phòng, Kế toán |
| Khách hàng | `/customers` | `tabler-users` | Admin, Văn phòng, Kế toán |
| Sản phẩm | `/products` | `tabler-flame` | Admin, Văn phòng, Kế toán |
| Công nợ | `/debts` | `tabler-report-money` | Admin, Văn phòng, Kế toán |
| Vỏ bình & gas dư | `/shells` | `tabler-cylinder` | Admin, Văn phòng, Kế toán |
| Nhập hàng & kho | `/imports`, `/stock`, `/suppliers` | `tabler-building-warehouse` | Admin, Văn phòng, Kế toán |
| Thu chi | `/cash` | `tabler-wallet` | Admin, Kế toán |
| Vật tư | `/materials` | `tabler-package` | Admin, Văn phòng, Kế toán |
| Sửa chữa & bảo trì | `/maintenance` | `tabler-tool` | Admin, Văn phòng, Kế toán |
| Báo cáo | `/reports` | `tabler-chart-bar` | Admin, Văn phòng, Kế toán |
| Quản trị | `/admin/users`, `/admin/settings`, `/admin/audit-logs` | `tabler-settings` | Chỉ Admin |

### 4.2. Trạng thái đơn hàng (màu Chip)
Mới tạo (info) · Chờ phân công (warning) · Đã phân công (primary) · Đang giao (info) · Chờ đối soát (warning) · Cần xử lý (error) · Đã duyệt (success) · Đã hủy (secondary).

---

## 5. Quy Tắc Phân Quyền Trên Giao Diện (Role-Based UI Rules)

Bốn vai trò: **Quản trị / Chủ cửa hàng**, **Nhân viên văn phòng**, **Nhân viên giao hàng**, **Kế toán**. Ẩn menu chỉ là lớp giao diện; quyền thật được kiểm tra ở API và Middleware.

- **Admin**: toàn quyền, gồm `/admin/*`.
- **Văn phòng**: tạo/sửa đơn trước duyệt, phân công, đối soát, quản lý khách hàng; xem công nợ, vỏ, kho; không vào Thu chi và Quản trị.
- **Giao hàng**: chỉ thấy `Trang chủ` và `Đơn giao của tôi`; chỉ xem đơn được phân công, nhập kết quả giao + ảnh hóa đơn trên giao diện điện thoại (nút lớn, ít nhập liệu); không tự cập nhật công nợ/báo cáo.
- **Kế toán**: công nợ, thu chi, đối soát, duyệt, báo cáo.
- Đơn **đã duyệt** không xóa; sửa sai bằng thao tác "Mở lại để điều chỉnh" có lý do và lưu vết.
