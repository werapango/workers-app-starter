import { Hono } from "hono";
import type { AppEnv } from "../types";

// GET /api/health → เช็กว่าเซิร์ฟเวอร์และฐานข้อมูลพร้อมไหม (ทั้งในเครื่องและบนคลาวด์)
export const health = new Hono<AppEnv>();

health.get("/", async (c) => {
  // บอกสถานะฐานข้อมูลด้วย — ช่วยหาสาเหตุเวลาระบบไม่ทำงาน
  let db: "ready" | "no-binding" | "not-migrated" = "ready";
  if (!c.env.DB) {
    db = "no-binding"; // ยังไม่ได้รัน d1 create ... --update-config
  } else {
    try {
      await c.env.DB.prepare("SELECT 1 FROM users LIMIT 1").first();
    } catch {
      db = "not-migrated"; // ยังไม่ได้รัน d1 migrations apply
    }
  }
  return c.json({ ok: true, db, time: new Date().toISOString() });
});
