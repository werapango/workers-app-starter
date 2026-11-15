import { Hono } from "hono";
import type { AppEnv } from "../types";
import { hashPassword, requireAdmin, requireAuth, validatePassword, validateUsername } from "../lib/auth";

// จัดการผู้ใช้ — admin เท่านั้น (US-A4 ใน SPEC.md)
// ไฟล์นี้คือ "ตัวอย่าง CRUD มาตรฐาน" ของโปรเจกต์: route ของโจทย์ควรเขียนแบบเดียวกัน
//   ตรวจ input → prepared statement → ตอบ JSON + status ที่ถูกต้อง
export const users = new Hono<AppEnv>();

users.use("*", requireAuth, requireAdmin); // ทุก route ด้านล่าง: ต้องล็อกอิน + เป็น admin

type UserInput = { username?: unknown; password?: unknown; role?: unknown };
const isRole = (v: unknown) => v === "admin" || v === "user";

const countAdmins = async (db: D1Database) =>
  (await db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").first<{ n: number }>())!.n;

// GET /api/users → รายชื่อผู้ใช้ทั้งหมด (ไม่ส่ง password_hash ออกไป) (AC-A4.1)
users.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, username, role, created_at FROM users ORDER BY id"
  ).all();
  return c.json(results);
});

// POST /api/users → เพิ่มผู้ใช้ (AC-A4.2, AC-A4.3)
users.post("/", async (c) => {
  const body = await c.req.json<UserInput>().catch(() => ({} as UserInput));
  const err = validateUsername(body.username) ?? validatePassword(body.password);
  if (err) return c.json({ error: err }, 400);
  const role = body.role === undefined ? "user" : body.role;
  if (!isRole(role)) return c.json({ error: "role ต้องเป็น admin หรือ user" }, 400);

  try {
    const user = await c.env.DB.prepare(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?) RETURNING id, username, role, created_at"
    ).bind(body.username, await hashPassword(body.password as string), role).first();
    return c.json(user, 201);
  } catch (e) {
    if (String(e).includes("UNIQUE")) return c.json({ error: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" }, 409);
    throw e;
  }
});

// PUT /api/users/:id → เปลี่ยน role และ/หรือ ตั้งรหัสผ่านใหม่ให้ผู้ใช้ (AC-A4.4, AC-A4.6)
users.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<UserInput>().catch(() => ({} as UserInput));
  if (body.role !== undefined && !isRole(body.role)) return c.json({ error: "role ต้องเป็น admin หรือ user" }, 400);
  if (body.password !== undefined) {
    const err = validatePassword(body.password);
    if (err) return c.json({ error: err }, 400);
  }

  const target = await c.env.DB.prepare("SELECT id, role FROM users WHERE id = ?")
    .bind(id).first<{ id: number; role: string }>();
  if (!target) return c.json({ error: "ไม่พบผู้ใช้นี้" }, 404);

  // กันระบบไม่มี admin เหลือ: ห้ามลด role ของ admin คนสุดท้าย
  if (target.role === "admin" && body.role === "user" && (await countAdmins(c.env.DB)) <= 1)
    return c.json({ error: "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน" }, 409);

  if (body.role !== undefined)
    await c.env.DB.prepare("UPDATE users SET role = ? WHERE id = ?").bind(body.role, id).run();
  if (body.password !== undefined) {
    await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
      .bind(await hashPassword(body.password as string), id).run();
    // ตั้งรหัสใหม่แล้ว session เดิมของผู้ใช้นั้นต้องใช้ไม่ได้
    await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
  }

  const user = await c.env.DB.prepare("SELECT id, username, role, created_at FROM users WHERE id = ?")
    .bind(id).first();
  return c.json(user);
});

// DELETE /api/users/:id → ลบผู้ใช้ (AC-A4.5)
users.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (id === c.get("userId")) return c.json({ error: "ลบบัญชีของตัวเองไม่ได้" }, 409);

  const result = await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  if (result.meta.changes === 0) return c.json({ error: "ไม่พบผู้ใช้นี้" }, 404);
  return c.json({ ok: true });
});
