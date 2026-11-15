import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../types";
import {
  SESSION_COOKIE, cookieOptions, createSession, hashPassword, requireAuth,
  validatePassword, validateUsername, verifyPassword,
} from "../lib/auth";

// การเข้าสู่ระบบ (US-A1 – US-A3 ใน SPEC.md)
export const auth = new Hono<AppEnv>();

type Body = { username?: unknown; password?: unknown; current_password?: unknown; new_password?: unknown };
const readBody = (c: { req: { json: <T>() => Promise<T> } }) =>
  c.req.json<Body>().catch(() => ({} as Body));

const countUsers = async (db: D1Database) =>
  (await db.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>())!.n;

// GET /api/auth/setup → ระบบยังไม่มีผู้ใช้เลยหรือไม่ (หน้าเว็บใช้ตัดสินว่าจะโชว์หน้าตั้งค่าครั้งแรก)
auth.get("/setup", async (c) => c.json({ needsSetup: (await countUsers(c.env.DB)) === 0 }));

// POST /api/auth/setup → สร้าง admin คนแรก ใช้ได้ครั้งเดียวตอนยังไม่มีผู้ใช้ (AC-A1.1, AC-A1.2)
auth.post("/setup", async (c) => {
  if ((await countUsers(c.env.DB)) > 0)
    return c.json({ error: "ระบบตั้งค่าไปแล้ว" }, 409);

  const { username, password } = await readBody(c);
  const err = validateUsername(username) ?? validatePassword(password);
  if (err) return c.json({ error: err }, 400);

  const user = await c.env.DB.prepare(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin') RETURNING id, username, role"
  ).bind(username, await hashPassword(password as string)).first<{ id: number }>();

  // ตั้งค่าเสร็จแล้วล็อกอินให้เลย
  setCookie(c, SESSION_COOKIE, await createSession(c.env.DB, user!.id), cookieOptions(c));
  return c.json(user, 201);
});

// POST /api/auth/login → ตรวจรหัส สร้าง session ตั้ง cookie (AC-A2.1, AC-A2.2)
auth.post("/login", async (c) => {
  const { username, password } = await readBody(c);
  if (typeof username !== "string" || typeof password !== "string")
    return c.json({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" }, 400);

  const user = await c.env.DB.prepare(
    "SELECT id, username, role, password_hash FROM users WHERE username = ?"
  ).bind(username).first<{ id: number; username: string; role: string; password_hash: string }>();

  // ตอบข้อความเดียวกันทั้ง "ไม่มีผู้ใช้" และ "รหัสผิด" — ไม่บอกใบ้ว่าชื่อไหนมีอยู่จริง
  if (!user || !(await verifyPassword(password, user.password_hash)))
    return c.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);

  setCookie(c, SESSION_COOKIE, await createSession(c.env.DB, user.id), cookieOptions(c));
  return c.json({ id: user.id, username: user.username, role: user.role });
});

// POST /api/auth/logout → ลบ session ทิ้งฝั่งเซิร์ฟเวอร์ + ลบ cookie (AC-A2.4)
auth.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// GET /api/auth/me → ตอนนี้ล็อกอินเป็นใคร (AC-A2.3)
auth.get("/me", requireAuth, (c) =>
  c.json({ id: c.get("userId"), username: c.get("username"), role: c.get("role") })
);

// PUT /api/auth/password → เปลี่ยนรหัสผ่านของตัวเอง ต้องยืนยันรหัสเดิม (AC-A3.1, AC-A3.2)
auth.put("/password", requireAuth, async (c) => {
  const { current_password, new_password } = await readBody(c);
  const err = validatePassword(new_password);
  if (err) return c.json({ error: err }, 400);

  const row = await c.env.DB.prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(c.get("userId")).first<{ password_hash: string }>();
  if (typeof current_password !== "string" || !(await verifyPassword(current_password, row!.password_hash)))
    return c.json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" }, 400);

  await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .bind(await hashPassword(new_password as string), c.get("userId")).run();
  return c.json({ ok: true });
});
