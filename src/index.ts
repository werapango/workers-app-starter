import { Hono } from "hono";
import type { AppEnv } from "./types";
import { health } from "./routes/health";
import { auth } from "./routes/auth";
import { users } from "./routes/users";

// จุดเริ่มของ API ทั้งหมด
// หน้าเว็บ (public/) ถูกเสิร์ฟโดย Cloudflare ก่อนถึงไฟล์นี้ — ไฟล์นี้รับเฉพาะ /api/...
const app = new Hono<AppEnv>();

// ⬇ ผูก route ของแต่ละเรื่องไว้ที่นี่ (1 เรื่อง = 1 ไฟล์ใน src/routes/)
app.route("/api/health", health);
app.route("/api/auth", auth);   // เข้าสู่ระบบ / ออกจากระบบ / ตั้งค่าครั้งแรก
app.route("/api/users", users); // จัดการผู้ใช้ (admin)
// app.route("/api/<เรื่องของโจทย์>", ...);   ← route ของโจทย์เพิ่มตรงนี้

// path ที่ไม่มีอยู่จริง → 404 แบบ JSON
app.notFound((c) => c.json({ error: "ไม่พบ path นี้" }, 404));

// error ที่ไม่ได้ดักไว้ → 500 แบบ JSON (รายละเอียดดูได้จาก log ของ wrangler)
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, 500);
});

export default app;
