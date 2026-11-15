import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv, Role } from "../types";

// ════════ 1) รหัสผ่าน: เก็บเป็น hash + salt เท่านั้น ไม่เก็บรหัสจริง ════════
// PBKDF2 = ฟังก์ชัน hash ที่ "ตั้งใจให้ช้า" เพื่อให้การเดารหัสทีละล้านครั้งทำได้ยาก
// salt = ค่าสุ่มต่อผู้ใช้ ทำให้รหัสเดียวกันของ 2 คนได้ hash ไม่เหมือนกัน
const ITERATIONS = 100_000; // ค่าสูงสุดที่ Workers รองรับ

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) =>
  new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));

async function pbkdf2(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256
  );
  return toHex(bits);
}

// คืนค่า "salt:hash" สำหรับเก็บลงคอลัมน์ password_hash
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return toHex(salt) + ":" + (await pbkdf2(password, salt));
}

// ตรวจรหัสผ่าน: hash รหัสที่กรอกด้วย salt เดิม แล้วเทียบกับ hash ที่เก็บไว้
// (ระบบจริงควรเทียบแบบ constant-time — ดูหัวข้อ "ยังไม่พร้อม production" ในเอกสาร)
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hash] = stored.split(":");
  return (await pbkdf2(password, fromHex(saltHex))) === hash;
}

// กติกาของชื่อผู้ใช้และรหัสผ่าน — คืนข้อความ error หรือ null ถ้าผ่าน
export function validateUsername(v: unknown): string | null {
  return typeof v === "string" && /^[a-zA-Z0-9_]{3,30}$/.test(v)
    ? null : "ชื่อผู้ใช้ต้องเป็น a-z, 0-9 หรือ _ ยาว 3–30 ตัว";
}
export function validatePassword(v: unknown): string | null {
  return typeof v === "string" && v.length >= 8 && v.length <= 100
    ? null : "รหัสผ่านต้องยาว 8–100 ตัว";
}

// ════════ 2) Session: ล็อกอินสำเร็จ → ได้ token สุ่ม เก็บใน DB + cookie ════════
export const SESSION_COOKIE = "session";
export const SESSION_DAYS = 7;

export async function createSession(db: D1Database, userId: number): Promise<string> {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(token, userId, expiresAt).run();
  return token;
}

// cookie HttpOnly = JavaScript ในหน้าเว็บอ่านไม่ได้ → ขโมยผ่านสคริปต์แปลกปลอม (XSS) ยากขึ้น
export function cookieOptions(c: Context) {
  return {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  };
}

// ════════ 3) เช็กสิทธิ์ทุกคำขอ: middleware วางหน้า route ที่ต้องล็อกอิน ════════
// ใช้กับ route ของโจทย์ได้ทันที เช่น  bookings.use("*", requireAuth)
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "กรุณาเข้าสู่ระบบ" }, 401);

  const row = await c.env.DB.prepare(
    `SELECT users.id, users.username, users.role FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token = ? AND sessions.expires_at > ?`
  ).bind(token, new Date().toISOString()).first<{ id: number; username: string; role: Role }>();

  if (!row) return c.json({ error: "session หมดอายุ กรุณาเข้าสู่ระบบใหม่" }, 401);

  c.set("userId", row.id);
  c.set("username", row.username);
  c.set("role", row.role);
  await next();
};

// authorization: ต้องเป็น admin (ใช้ต่อจาก requireAuth เสมอ)
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get("role") !== "admin") return c.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้น" }, 403);
  await next();
};
