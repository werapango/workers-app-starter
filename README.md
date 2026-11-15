# workers-app-starter

โครงเริ่มต้นเว็บแอปบน Cloudflare (Workers + Hono + D1) ที่ไม่ผูกกับโจทย์ใด — มีระบบผู้ใช้ เข้าสู่ระบบ จัดการผู้ใช้ smoke test และ template เอกสาร SDLC พร้อมต่อยอดแบบ spec-driven

## เริ่มใช้งาน

```bash
npm create cloudflare@latest my-app -- --template=werapango/workers-app-starter --no-deploy --no-git --no-agents
cd my-app
npx wrangler d1 create app-db --binding DB --update-config
npx wrangler d1 migrations apply app-db --local
npm run dev            # เปิด http://localhost:8787 → สร้างผู้ดูแลระบบคนแรก
```

ขึ้น production:

```bash
npx wrangler d1 migrations apply app-db --remote
npx wrangler deploy    # แล้วเปิด URL ที่ได้ → สร้างผู้ดูแลระบบคนแรกทันที
```

## มีอะไรให้แล้ว

| ส่วน | ไฟล์ |
|---|---|
| API: health, ตั้งค่าครั้งแรก, login/logout, เปลี่ยนรหัสผ่าน, CRUD ผู้ใช้ (admin) | `src/` |
| หน้าเว็บ: ตั้งค่าครั้งแรก, ล็อกอิน, จัดการผู้ใช้, เปลี่ยนรหัสผ่าน | `public/` |
| ฐานข้อมูล: users, sessions | `migrations/0001_auth.sql` |
| ทดสอบ: smoke test (ตาม AC) + traceability check | `scripts/` |
| เอกสาร: SRS, DESIGN, SPEC, TASKS, AGENTS, skill ตัวอย่าง | `docs/`, `*.md`, `skills/` |
| prompt สำหรับสร้าง starter นี้เองด้วย AI | `docs/STARTER-PROMPT.md` |

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รันในเครื่อง (local) ที่ http://localhost:8787 |
| `npm run smoke` | smoke test กับ local (ต้องเปิด dev ไว้) |
| `BASE_URL=https://... npm run smoke` | smoke test กับ production (ถ้ามี admin แล้ว เพิ่ม `SMOKE_ADMIN_USER=... SMOKE_ADMIN_PASS=...`) |
| `npm run trace` | ตรวจว่า AC ทุกข้อใน SPEC.md มีเคสทดสอบ |
| `npx wrangler d1 migrations create app-db <ชื่อ>` | สร้างไฟล์ migration ใหม่ |
| `npx wrangler d1 migrations apply app-db --local` / `--remote` | ใช้ migration กับฐานข้อมูลในเครื่อง / บนคลาวด์ |
| `npx wrangler deploy` | อัปโหลดขึ้น Cloudflare |
| `npx wrangler deployments list` / `npx wrangler rollback` | ดูเวอร์ชันที่ deploy / ย้อนเวอร์ชัน |
| `npx wrangler tail` | ดู log ของ production แบบสด |

> ⚠ ระบบผู้ใช้นี้ทำไว้เพื่อการเรียนรู้ ยังไม่มีการจำกัดจำนวนครั้งที่ล็อกอินผิดและการรีเซ็ตรหัสทางอีเมล — ก่อนใช้งานจริงดูหัวข้อ Out of Scope ใน `SPEC.md`
