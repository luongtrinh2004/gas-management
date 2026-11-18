// Seed dữ liệu mẫu đầy đủ cho deploy: 5 tài khoản + danh mục sản phẩm + khách hàng + đơn hàng 30 ngày + công nợ + tồn kho + thu chi.
// Chạy: npm run seed
// Chạy ép buộc làm mới toàn bộ: npm run seed:force (hoặc npm run seed -- --force)
import crypto from "crypto";
import { seedIfEmpty } from "../src/server/seed";

async function main() {
  const force =
    process.argv.includes("--force") || process.env.SEED_FORCE === "true";
  const plain = process.env.SEED_PASSWORD || "12345678";
  const r = await seedIfEmpty({ password: plain, force });
  if (r.created && !process.env.SEED_PASSWORD) {
    console.log(`Mật khẩu khởi tạo: ${plain}`);
  }
  console.log(r.message);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
