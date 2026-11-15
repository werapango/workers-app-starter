# TASKS — Work Breakdown Structure (WBS)

> แตกงานจาก SPEC.md เป็น task เล็ก ๆ ที่ **1 task = 1 prompt ให้ agent**
>
> task ที่ดี:
> - เสร็จได้ใน 1 prompt (แก้ 1–3 ไฟล์)
> - ตรวจได้ — ผูกกับ AC ใน SPEC.md
> - รู้ว่าต้องทำอะไรก่อน (depends on)
>
> สั่ง agent ทีละ task: `ทำ task T1.1 ใน TASKS.md`

## Epic 0: Starter (มีให้แล้ว)
- [x] **T0.1** โครง Worker + Hono + หน้าเว็บ + `/api/health` — AC-0.1
- [x] **T0.2** ผู้ใช้ + เข้าสู่ระบบ + จัดการผู้ใช้ (admin) — AC-A1.1 – AC-A4.6
- [x] **T0.3** smoke test + traceability check (`npm run smoke`, `npm run trace`)

## Epic 1: [ ชื่อเรื่องของโจทย์ ]
- [ ] **T1.1** [ ทำอะไร ] — ไฟล์: [ ] — depends: [ ] — AC: [ ]
- [ ] **T1.2** [ ]

## 👤 งานของคน (ไม่ใช่งานของ agent)
- [ ] รัน migration (`npx wrangler d1 migrations apply app-db --local` / `--remote`)
- [ ] รัน `npm run smoke` + `npm run trace` และทดสอบในเบราว์เซอร์
- [ ] commit + deploy
