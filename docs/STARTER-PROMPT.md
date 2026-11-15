# STARTER-PROMPT — สร้าง starter นี้เองด้วย AI agent

> ใช้เมื่อต้องการสร้าง starter แบบนี้ขึ้นใหม่เอง (เช่น เปลี่ยน stack หรืออยากเข้าใจทุกบรรทัด)
> เขียนแบบ **spec + WBS**: ส่งบริบทครั้งเดียว → สั่งทีละ task → คนรันคำสั่งเอง → ตรวจด้วย smoke/trace ทุก task
>
> 🪙 ประมาณการ token ถ้าทำครบ: ~300–600K (ยังไม่ได้วัดจริง) · แนะนำโมเดลเก่ง (เช่น GLM-5.3) สำหรับ T3–T4 ที่เป็นโค้ดความปลอดภัย ข้ออื่นใช้โมเดลเบาได้

---

## ส่วนที่ 1 — บริบท (ส่งครั้งแรกครั้งเดียว หรือบันทึกเป็นไฟล์ให้ agent อ่าน)

```
ฉันจะสร้าง "starter" สำหรับเว็บแอปบน Cloudflare ที่นำไปต่อยอดได้ทุกโจทย์ ทำทีละ task ตามที่ฉันสั่งเท่านั้น

เป้าหมาย: โครงเว็บแอปที่ deploy ได้ทันที มีระบบเข้าสู่ระบบและจัดการผู้ใช้แบบง่าย
มีเอกสารและการทดสอบพร้อมให้ต่อยอดแบบ spec-driven

ข้อจำกัด:
- Cloudflare Workers + Hono (TypeScript) + D1 (binding ชื่อ DB, ฐานข้อมูลชื่อ app-db) + Static Assets (โฟลเดอร์ public/)
- ต้องอยู่ใน free plan ห้ามใช้บริการที่ต้องผูกบัตร (Access, R2, Email)
- หน้าเว็บเป็น HTML/CSS/JS ธรรมดา ไม่ใช้ framework รองรับมือถือ
- ห้ามเพิ่ม dependency นอกจาก hono โดยไม่ถาม
- SQL ทุกคำสั่งต้องเป็น prepared statement · เปลี่ยน schema ด้วยไฟล์ migration ใหม่เท่านั้น
- คอมเมนต์และข้อความ error เป็นภาษาไทย · API ตอบ JSON รูปแบบ { "error": "..." } พร้อม status ที่ถูกต้อง
- route 1 เรื่อง = 1 ไฟล์ใน src/routes/

กติกาการทำงาน:
- ห้ามรัน wrangler, npm, git เอง ให้เขียนคำสั่งที่ฉันต้องรันไว้ท้ายคำตอบ
- ถ้าข้อมูลไม่พอ ให้ถามก่อน ห้ามเดา
- จบแต่ละ task ตอบ 3 ส่วน: ไฟล์ที่แก้ / คำสั่งที่ต้องรัน / วิธีทดสอบ
```

## ส่วนที่ 2 — 👤 คนรันเองก่อนเริ่ม

```bash
npm create cloudflare@latest my-app -- --category=hello-world --type=hello-world-with-assets --lang=ts --no-deploy --no-git --no-agents
cd my-app
npm install hono
git init
```

## ส่วนที่ 3 — task (ส่งให้ agent ทีละข้อ แล้ว commit หลังแต่ละข้อ)

**T1 โครงแอป**
```
ทำ T1: แปลง src/index.ts เป็น Hono แยก route ไว้ใน src/routes/ เพิ่ม GET /api/health ตอบ { ok: true, db, time }
โดย db บอกสถานะฐานข้อมูล ("ready" / "no-binding" / "not-migrated"), ดัก 404 และ 500 เป็น JSON,
ตั้ง wrangler.jsonc ให้มี assets (public/) และ observability พร้อมคอมเมนต์ภาษาไทยทุกส่วน
เสร็จเมื่อ: npm run dev แล้ว /api/health ตอบ 200 และหน้า public/index.html เรียก API นี้แสดงผลได้
```

**T2 การทดสอบ**
```
ทำ T2: สร้าง scripts/smoke.mjs (เรียก API จริง, จำ cookie ได้แบบเบราว์เซอร์, เปลี่ยน local/production ด้วย BASE_URL,
ชื่อเคสขึ้นต้นด้วยรหัส AC, รายงาน ผ่าน/ไม่ผ่าน/ข้าม) และ scripts/trace.mjs (ตรวจว่า AC ตัวหนาทุกข้อใน SPEC.md
มีเคสใน smoke.mjs และทุกเคสอ้าง AC ที่มีจริง, เตือนถ้า FR ใน docs/SRS.md ไม่ถูกอ้างใน SPEC.md)
เพิ่ม npm scripts: dev, deploy, smoke, trace
```

👤 หลัง T2 สร้างฐานข้อมูล:
```bash
npx wrangler d1 create app-db --binding DB --update-config
```

**T3 ฐานข้อมูลผู้ใช้ + ไลบรารี auth**
```
ทำ T3: migration ตาราง users (username unique, password_hash, role admin/user, created_at)
และ sessions (token, user_id อ้าง users ลบตาม, expires_at) + src/lib/auth.ts:
hash ด้วย PBKDF2-SHA256 100,000 รอบ + salt สุ่ม เก็บเป็น "salt:hash", session token สุ่ม 32 ไบต์ อายุ 7 วัน,
cookie HttpOnly + SameSite=Lax (Secure เมื่อเป็น https), middleware requireAuth (ฝาก userId, username, role ใน context)
และ requireAdmin (403 ถ้าไม่ใช่ admin)
```

👤 หลัง T3:
```bash
npx wrangler d1 migrations apply app-db --local
```

**T4 API ผู้ใช้**
```
ทำ T4: /api/auth/setup (GET บอกว่ายังไม่มีผู้ใช้ไหม, POST สร้าง admin คนแรกได้เฉพาะตอนยังไม่มีผู้ใช้ แล้วล็อกอินให้),
login, logout, me, PUT password (เปลี่ยนรหัสของตัวเอง ต้องยืนยันรหัสเดิม)
และ /api/users CRUD สำหรับ admin เท่านั้น (ไม่ส่ง password_hash ออกไป)
กติกา: ล็อกอินผิดตอบข้อความเดียวกันไม่ว่าชื่อหรือรหัสผิด, admin ลบตัวเองไม่ได้, ต้องเหลือ admin อย่างน้อย 1 คน,
admin ตั้งรหัสใหม่ให้ใครแล้ว session เดิมของคนนั้นต้องใช้ไม่ได้
เพิ่มเคส smoke ครบทุกกติกา
```

**T5 หน้าเว็บ**
```
ทำ T5: หน้าเดียวหลาย view สลับด้วย #hash: ตั้งค่าครั้งแรก, ล็อกอิน, หน้าหลัก (แสดง /api/health),
จัดการผู้ใช้ (admin), เปลี่ยนรหัสผ่าน · แยกไฟล์ index.html / app.css / app.js
ทุกหน้าใช้ fetch เรียก API แสดง error จาก API และ escape ข้อมูลผู้ใช้ก่อนแสดง (กัน XSS)
```

**T6 เอกสาร**
```
ทำ T6: AGENTS.md (stack, โครงไฟล์, กติกาการทำงานแบบในส่วนที่ 1, ตาราง skills),
SPEC.md (ส่วนผู้ใช้และการเข้าสู่ระบบเขียนครบเป็นตัวอย่าง: user story, AC แบบ Given/When/Then ตัวหนาพร้อมรหัส,
data model, API contract, NFR ที่วัดได้) + template เปล่าของ TASKS.md, docs/SRS.md, docs/DESIGN.md,
skills/add-endpoint/SKILL.md, README.md
```

## ส่วนที่ 4 — 👤 ตรวจทุก task

```bash
npm run dev
npm run smoke
npm run trace
git add . && git commit -m "Tn: ..."
```
