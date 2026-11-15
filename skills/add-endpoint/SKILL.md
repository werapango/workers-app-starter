---
name: add-endpoint
description: ใช้เมื่อต้องเพิ่มหรือแก้ API endpoint ของโปรเจกต์นี้ (route ใหม่, ตารางใหม่, หรือเปลี่ยน schema) ตาม task ใน TASKS.md
---

# add-endpoint — เพิ่ม API endpoint แบบมาตรฐานของโปรเจกต์

## ใช้เมื่อไร
- task ใน TASKS.md ที่ต้องสร้างหรือแก้ endpoint ใต้ `/api/...`
- task ที่ต้องเพิ่มตารางหรือคอลัมน์ในฐานข้อมูล

## ข้อมูลที่ต้องมีก่อนเริ่ม
- task ID (เช่น T1.2) และ AC ที่ผูกไว้ใน SPEC.md
- ถ้าข้อมูลใน SPEC ไม่พอ (เช่น ไม่รู้ว่า error ควรเป็น status อะไร) **ให้ถามก่อน อย่าเดา**

## ขั้นตอน
1. อ่าน AC ของ task ใน `SPEC.md` §3 และแถวของ endpoint ใน §5 (API Contract)
2. ถ้าต้องเปลี่ยน schema:
   - สร้างไฟล์ใหม่ `migrations/NNNN_<ชื่อ>.sql` (NNNN = เลขถัดจากไฟล์ล่าสุด) — **ห้ามแก้ไฟล์ migration เดิม**
   - อัปเดตตาราง §4 Data Model ใน SPEC.md ให้ตรง
3. เขียน route ใน `src/routes/<เรื่อง>.ts` โดย**เลียนแบบโครงของ `src/routes/users.ts`** แล้วผูกใน `src/index.ts`
   - ต้องล็อกอิน → `xxx.use("*", requireAuth)` · เฉพาะ admin → เพิ่ม `requireAdmin`
   - ตรวจ input ทุกช่อง → ผิดตอบ 400 `{ error: "ข้อความไทย" }`
   - SQL ใช้ `.prepare(...).bind(...)` เท่านั้น · ข้อมูลของผู้ใช้กรองด้วย `c.get("userId")`
4. เพิ่มเคสใน `scripts/smoke.mjs` อย่างน้อย 1 เคสต่อ 1 AC (ชื่อเคสขึ้นต้นด้วยรหัส AC เช่น `"AC-2.2 ..."`) ใช้ `makeUser()` เมื่อต้องการผู้ใช้ทดสอบ
5. เปลี่ยนสถานะ task ใน TASKS.md เป็น `[x]`

## ห้ามทำ
- ห้ามรัน `wrangler` / `npm` / `git` เอง
- ห้ามแก้ไฟล์นอกเหนือจาก: migrations/, src/, public/ (ถ้า task บอก), scripts/smoke.mjs, SPEC.md §4, TASKS.md
- ห้ามแก้ `src/lib/auth.ts` และ `src/routes/auth.ts` ถ้า task ไม่ได้สั่ง
- ห้ามทำ task ถัดไปต่อเอง

## เช็กลิสต์ก่อนบอกว่าเสร็จ
- [ ] ทุก AC ของ task มีเคสใน smoke.mjs
- [ ] ไม่มี SQL ที่ต่อ string
- [ ] error ทุกแบบตอบ JSON + status ตาม API Contract
- [ ] ตอบผู้ใช้ 3 ส่วน: ไฟล์ที่แก้ / คำสั่งที่ต้องรัน (เช่น `npx wrangler d1 migrations apply app-db --local`, `npm run smoke`, `npm run trace`) / วิธีทดสอบในเบราว์เซอร์
