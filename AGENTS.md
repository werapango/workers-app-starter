# AGENTS.md — คู่มือประจำโปรเจกต์สำหรับ AI agent

> ไฟล์นี้ถูกอ่านเป็น context แรกทุกครั้งที่เปิด session ใหม่
> เขียนสิ่งที่ "ต้องบอก agent ทุกครั้ง" ไว้ที่นี่ แทนการพิมพ์ซ้ำในทุก prompt

## โปรเจกต์นี้คืออะไร
- ข้อกำหนดสำหรับลงมือทำ: `SPEC.md` (AC, data model, API contract) — **อ่านก่อนทุก task**
- รายการงาน: `TASKS.md` (WBS)
- เอกสารฉบับเต็มสำหรับคน: `docs/SRS.md`, `docs/DESIGN.md` — อ่านเฉพาะเมื่อ SPEC.md ไม่พอ

## Stack
- Cloudflare Workers + Hono (TypeScript) — API อยู่ใน `src/`
- หน้าเว็บ: HTML + CSS + JavaScript ธรรมดา ไม่ใช้ framework — อยู่ใน `public/`
- ฐานข้อมูล: Cloudflare D1 (SQLite) binding ชื่อ `DB` ฐานข้อมูลชื่อ `app-db` — schema อยู่ใน `migrations/`
- ทดสอบ: `scripts/smoke.mjs` (เรียก API จริง) + `scripts/trace.mjs` (ตรวจว่าทุก AC มีเคสทดสอบ)

## โครงไฟล์
```
src/index.ts             จุดรวม route ทั้งหมด
src/routes/<เรื่อง>.ts     1 เรื่อง = 1 ไฟล์
src/routes/users.ts      ⭐ ตัวอย่าง CRUD มาตรฐาน — route ใหม่ให้เขียนตามแบบนี้
src/lib/auth.ts          hash รหัสผ่าน, session, middleware requireAuth / requireAdmin
src/types.ts             ชนิดของ bindings และค่าใน context (userId, username, role)
public/index.html        หน้าเว็บ (หลาย view สลับด้วย #hash)
public/app.js            โค้ดฝั่ง client — หน้าใหม่เพิ่มใน VIEWS
migrations/NNNN_*.sql    การเปลี่ยน schema แต่ละครั้ง (เรียงตามเลข)
scripts/smoke.mjs        smoke test (ชื่อเคสขึ้นต้นด้วยรหัส AC)
skills/                  ขั้นตอนมาตรฐานสำหรับงานที่ทำซ้ำ
```

## กติกาการทำงาน (สำคัญ)
1. **ทำทีละ 1 task จาก TASKS.md** ตามที่ผู้ใช้สั่งเท่านั้น ห้ามทำ task อื่นล่วงหน้า
2. **ห้ามรันคำสั่งเหล่านี้เอง:** `wrangler` ทุกคำสั่ง, `npm install`, `git` — เขียนคำสั่งที่ผู้ใช้ต้องรันไว้ท้ายคำตอบ ผู้ใช้จะรันเองแล้วแปะผลกลับมาถ้ามีปัญหา
3. อ่านเฉพาะไฟล์ที่เกี่ยวกับ task — ห้ามอ่าน `node_modules/`, `.wrangler/`, `package-lock.json`
4. ถ้า SPEC.md ไม่ได้บอก (เช่น ไม่รู้ว่าควรตอบ status อะไร) **ให้ถามก่อน ห้ามเดา**
5. จบ task ทุกครั้ง ตอบสั้น ๆ 3 ส่วน: **ไฟล์ที่แก้**, **คำสั่งที่ผู้ใช้ต้องรัน**, **วิธีทดสอบ** และเปลี่ยนสถานะ task ใน TASKS.md เป็น `[x]`
6. ห้ามเพิ่ม dependency ใหม่ โดยไม่ถามก่อน

## กติกาของโค้ด
- ตอบและเขียนคอมเมนต์เป็นภาษาไทย
- SQL ทุกคำสั่งต้องเป็น prepared statement (`.prepare(...).bind(...)`) ห้ามต่อ string
- เปลี่ยน schema = สร้างไฟล์ migration ใหม่เท่านั้น **ห้ามแก้ไฟล์ migration ที่มีอยู่แล้ว**
- route ที่ต้องล็อกอินใช้ `requireAuth` จาก `src/lib/auth.ts` · ข้อมูลที่เป็นของผู้ใช้ต้องกรองด้วย `c.get("userId")` เสมอ
- API ตอบ JSON เสมอ — error ใช้รูปแบบ `{ "error": "ข้อความภาษาไทย" }` พร้อม status ที่ถูกต้อง (400, 401, 403, 404, 409)
- เวลาในระบบเก็บเป็นข้อความ `YYYY-MM-DDTHH:MM` (เวลาท้องถิ่น) ยกเว้นที่ระบุไว้ใน SPEC.md
- หน้าเว็บ: แสดงข้อมูลผู้ใช้ผ่าน `esc()` เสมอ (กัน XSS)
- ทุก AC ใหม่ต้องมีเคสใน `scripts/smoke.mjs` ชื่อเคสขึ้นต้นด้วยรหัส AC

## Skills (ขั้นตอนมาตรฐาน)
ก่อนทำงานประเภทต่อไปนี้ ให้อ่านไฟล์ skill ที่ระบุและทำตามขั้นตอนในนั้น:

| งาน | อ่านไฟล์ |
|---|---|
| เพิ่ม/แก้ API endpoint หรือเปลี่ยน schema | `skills/add-endpoint/SKILL.md` |
