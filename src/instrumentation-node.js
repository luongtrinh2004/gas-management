// Tự tạo tài khoản và nạp dữ liệu mẫu nếu DB trống VÀ SEED_ON_START=true.
// Có thể đặt SEED_FORCE=true để xóa sạch dữ liệu cũ và nạp lại từ đầu trên server deploy.
import { seedIfEmpty } from "./server/seed";

if (process.env.SEED_ON_START === "true") {
  const password = process.env.SEED_PASSWORD || "12345678";
  const force = process.env.SEED_FORCE === "true";
  if (password.length < 8) {
    console.error("[seed] Bỏ qua: cần SEED_PASSWORD tối thiểu 8 ký tự");
  } else {
    seedIfEmpty({ password, force })
      .then((r) => console.log("[seed]", r.message))
      .catch((e) => console.error("[seed] Lỗi:", e.message));
  }
}
