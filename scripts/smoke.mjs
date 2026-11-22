// Smoke test = เรียก API จริง แล้วเช็กผลตาม acceptance criteria (AC) ใน SPEC.md
//
// ใช้ไฟล์เดียวกันได้ทั้งในเครื่องและบนคลาวด์ (พิมพ์แบบเดียวกันได้ทั้ง Git Bash, PowerShell และ cmd):
//   npm run smoke                                                  ← ทดสอบ http://localhost:8787 (ต้องเปิด npm run dev ไว้)
//   npm run smoke user=admin pass=รหัสของคุณ                        ← บอกบัญชี admin ที่มีอยู่แล้ว
//   npm run smoke url=https://my-app.xxx.workers.dev user=admin pass=รหัสของคุณ   ← ทดสอบ production
//
// ⚠ กติกา: ชื่อเคสต้องขึ้นต้นด้วยรหัส AC เช่น "AC-1.2 ..."  — npm run trace ใช้ชื่อนี้ตรวจว่า AC ทุกข้อมีเคสทดสอบ
//
// บัญชี admin ที่ smoke test ใช้:
//   - ถ้าฐานข้อมูลยังว่าง smoke test จะสร้าง admin ให้ด้วยค่าเริ่มต้นด้านล่าง
//   - ถ้ามี admin อยู่แล้ว ให้บอกชื่อ/รหัสด้วย user=... pass=... (ไม่บอก = เคสที่ต้องใช้ admin จะถูก "ข้าม")
//   - smoke test สร้างผู้ใช้ชั่วคราวชื่อขึ้นต้นด้วย smoke_ และลบทิ้งเองตอนจบ
//   - ยังใช้ตัวแปร BASE_URL / SMOKE_ADMIN_USER / SMOKE_ADMIN_PASS แบบเดิมได้

// อ่านค่าแบบ ชื่อ=ค่า ต่อท้ายคำสั่ง (รับ --url=... ได้ด้วย)
const ARGS = Object.fromEntries(
  process.argv.slice(2)
    .map((a) => a.replace(/^--?/, "").match(/^(url|user|pass)=(.*)$/i))
    .filter(Boolean)
    .map((m) => [m[1].toLowerCase(), m[2]])
);
const BASE = (ARGS.url || process.env.BASE_URL || "http://localhost:8787").replace(/\/$/, "");
const ADMIN_USER = ARGS.user || process.env.SMOKE_ADMIN_USER || "admin";
const ADMIN_PASS = ARGS.pass || process.env.SMOKE_ADMIN_PASS || "admin-pass-1234";
const RUN = Date.now().toString(36).slice(-5); // ค่าไม่ซ้ำต่อรอบ → รันซ้ำได้ไม่ชนข้อมูลเดิม

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
class Skip extends Error {}
const skip = (why) => { throw new Skip(why); };
function expect(cond, message) { if (!cond) throw new Error(message); }

// client = "เบราว์เซอร์จำลอง" 1 คน — จำ cookie ของตัวเองไว้
function client() {
  let cookie = "";
  const api = async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    let data = null;
    try { data = await res.json(); } catch { /* ไม่ใช่ JSON */ }
    return { status: res.status, data, setCookie };
  };
  return api;
}

// ───────────────────────── เตรียมบัญชี admin ─────────────────────────
const admin = client();
let adminReady = false;
let wasEmpty = false;
const created = []; // id ของผู้ใช้ชั่วคราว (ลบตอนจบ)
const needAdmin = () => { if (!adminReady) skip("ไม่มีบัญชี admin (เพิ่ม user=... pass=... ต่อท้ายคำสั่ง)"); };

async function prepareAdmin() {
  const s = await admin("GET", "/api/auth/setup");
  if (s.status !== 200) return; // ฐานข้อมูลยังไม่พร้อม — เคส health จะบอกสาเหตุ
  if (s.data.needsSetup) {
    wasEmpty = true;
    const r = await admin("POST", "/api/auth/setup", { username: ADMIN_USER, password: ADMIN_PASS });
    adminReady = r.status === 201;
  } else {
    const r = await admin("POST", "/api/auth/login", { username: ADMIN_USER, password: ADMIN_PASS });
    adminReady = r.status === 200;
  }
}

async function makeUser(role = "user") {
  needAdmin();
  const username = `smoke_${role}_${RUN}_${created.length}`;
  const password = "smoke-pass-1234";
  const r = await admin("POST", "/api/users", { username, password, role });
  expect(r.status === 201, `สร้างผู้ใช้ทดสอบไม่ได้: ${r.status} ${JSON.stringify(r.data)}`);
  created.push(r.data.id);
  const api = client();
  const login = await api("POST", "/api/auth/login", { username, password });
  expect(login.status === 200, `ผู้ใช้ทดสอบล็อกอินไม่ได้: ${login.status}`);
  return { api, id: r.data.id, username, password };
}

// ───────────────────────── เคสทดสอบของ starter ─────────────────────────

test("AC-0.1 GET /api/health ตอบ ok และฐานข้อมูลพร้อม", async () => {
  const r = await client()("GET", "/api/health");
  expect(r.status === 200 && r.data?.ok === true, `ควรได้ 200 + ok:true แต่ได้ ${r.status}`);
  expect(r.data.db === "ready", `ฐานข้อมูลยังไม่พร้อม: db = "${r.data.db}" (no-binding = ยังไม่ d1 create, not-migrated = ยังไม่ migrations apply)`);
});

test("AC-A1.1 ระบบว่าง → สร้าง admin คนแรกได้ และล็อกอินให้ทันที", async () => {
  if (!wasEmpty) skip("ฐานข้อมูลมีผู้ใช้อยู่แล้ว (ทดสอบได้เฉพาะฐานข้อมูลใหม่)");
  expect(adminReady, "สร้าง admin คนแรกไม่สำเร็จ");
  const me = await admin("GET", "/api/auth/me");
  expect(me.status === 200 && me.data.role === "admin", `หลังตั้งค่าควรล็อกอินเป็น admin แต่ได้ ${me.status}`);
});

test("AC-A1.2 มีผู้ใช้แล้ว เรียกตั้งค่าครั้งแรกซ้ำ → 409", async () => {
  const r = await client()("POST", "/api/auth/setup", { username: `x_${RUN}`, password: "whatever-1234" });
  expect(r.status === 409, `ควรได้ 409 แต่ได้ ${r.status}`);
});

test("AC-A2.1 ล็อกอินถูก → 200 และได้ cookie แบบ HttpOnly", async () => {
  const u = await makeUser();
  const api = client();
  const r = await api("POST", "/api/auth/login", { username: u.username, password: u.password });
  expect(r.status === 200, `ควรได้ 200 แต่ได้ ${r.status}`);
  expect(/HttpOnly/i.test(r.setCookie || ""), `cookie ต้องเป็น HttpOnly: ${r.setCookie}`);
});

test("AC-A2.2 รหัสผิด หรือไม่มีชื่อนี้ → 401 ข้อความเดียวกัน", async () => {
  const u = await makeUser();
  const wrongPass = await client()("POST", "/api/auth/login", { username: u.username, password: "wrong-wrong" });
  const noUser = await client()("POST", "/api/auth/login", { username: `nobody_${RUN}`, password: "wrong-wrong" });
  expect(wrongPass.status === 401 && noUser.status === 401, `ควรได้ 401 ทั้งคู่ แต่ได้ ${wrongPass.status}, ${noUser.status}`);
  expect(wrongPass.data.error === noUser.data.error, "ข้อความ error ต้องเหมือนกัน (ไม่บอกใบ้ว่าชื่อไหนมีจริง)");
});

test("AC-A2.3 ไม่ได้ล็อกอิน เรียก /api/auth/me → 401", async () => {
  const r = await client()("GET", "/api/auth/me");
  expect(r.status === 401, `ควรได้ 401 แต่ได้ ${r.status}`);
});

test("AC-A2.4 ออกจากระบบแล้ว session เดิมใช้ไม่ได้", async () => {
  const u = await makeUser();
  await u.api("POST", "/api/auth/logout");
  const r = await u.api("GET", "/api/auth/me");
  expect(r.status === 401, `หลัง logout ควรได้ 401 แต่ได้ ${r.status}`);
});

test("AC-A3.1 เปลี่ยนรหัสผ่านตัวเองได้ แล้วล็อกอินด้วยรหัสใหม่ได้", async () => {
  const u = await makeUser();
  const r = await u.api("PUT", "/api/auth/password", { current_password: u.password, new_password: "brand-new-pass-99" });
  expect(r.status === 200, `ควรได้ 200 แต่ได้ ${r.status} ${JSON.stringify(r.data)}`);
  const login = await client()("POST", "/api/auth/login", { username: u.username, password: "brand-new-pass-99" });
  expect(login.status === 200, `ล็อกอินด้วยรหัสใหม่ไม่ได้: ${login.status}`);
});

test("AC-A3.2 เปลี่ยนรหัสผ่านโดยใส่รหัสเดิมผิด → 400", async () => {
  const u = await makeUser();
  const r = await u.api("PUT", "/api/auth/password", { current_password: "not-my-pass", new_password: "brand-new-pass-99" });
  expect(r.status === 400, `ควรได้ 400 แต่ได้ ${r.status}`);
});

test("AC-A4.1 ผู้ใช้ทั่วไปเรียก /api/users → 403", async () => {
  const u = await makeUser();
  const r = await u.api("GET", "/api/users");
  expect(r.status === 403, `ควรได้ 403 แต่ได้ ${r.status}`);
});

test("AC-A4.2 admin เพิ่มผู้ใช้ได้ และไม่มี password_hash ในคำตอบ", async () => {
  needAdmin();
  const r = await admin("POST", "/api/users", { username: `smoke_new_${RUN}`, password: "smoke-pass-1234" });
  expect(r.status === 201, `ควรได้ 201 แต่ได้ ${r.status} ${JSON.stringify(r.data)}`);
  created.push(r.data.id);
  expect(r.data.role === "user" && !("password_hash" in r.data), "role เริ่มต้นต้องเป็น user และห้ามส่ง password_hash ออกมา");
  const list = await admin("GET", "/api/users");
  expect(list.data.every((x) => !("password_hash" in x)), "รายชื่อผู้ใช้ห้ามมี password_hash");
});

test("AC-A4.3 ชื่อผู้ใช้ซ้ำ → 409", async () => {
  const u = await makeUser();
  const r = await admin("POST", "/api/users", { username: u.username, password: "smoke-pass-1234" });
  expect(r.status === 409, `ควรได้ 409 แต่ได้ ${r.status}`);
});

test("AC-A4.4 admin ตั้งรหัสใหม่ให้ผู้ใช้ → session เดิมของผู้ใช้นั้นใช้ไม่ได้ และรหัสใหม่ใช้ได้", async () => {
  const u = await makeUser();
  const r = await admin("PUT", `/api/users/${u.id}`, { password: "reset-by-admin-1" });
  expect(r.status === 200, `ควรได้ 200 แต่ได้ ${r.status}`);
  const old = await u.api("GET", "/api/auth/me");
  expect(old.status === 401, `session เดิมควรใช้ไม่ได้ (401) แต่ได้ ${old.status}`);
  const login = await client()("POST", "/api/auth/login", { username: u.username, password: "reset-by-admin-1" });
  expect(login.status === 200, `ล็อกอินด้วยรหัสใหม่ไม่ได้: ${login.status}`);
});

test("AC-A4.5 admin ลบบัญชีตัวเองไม่ได้ (409) แต่ลบผู้ใช้อื่นได้", async () => {
  needAdmin();
  const me = await admin("GET", "/api/auth/me");
  const self = await admin("DELETE", `/api/users/${me.data.id}`);
  expect(self.status === 409, `ลบตัวเองควรได้ 409 แต่ได้ ${self.status}`);
  const u = await makeUser();
  const r = await admin("DELETE", `/api/users/${u.id}`);
  expect(r.status === 200, `ลบผู้ใช้อื่นควรได้ 200 แต่ได้ ${r.status}`);
  created.splice(created.indexOf(u.id), 1);
});

test("AC-A4.6 ลด role ของ admin คนสุดท้าย → 409", async () => {
  needAdmin();
  const list = await admin("GET", "/api/users");
  const admins = list.data.filter((x) => x.role === "admin");
  if (admins.length !== 1) skip(`มี admin ${admins.length} คน (ทดสอบได้เมื่อมี admin คนเดียว)`);
  const r = await admin("PUT", `/api/users/${admins[0].id}`, { role: "user" });
  expect(r.status === 409, `ควรได้ 409 แต่ได้ ${r.status}`);
});

// ⬇ เพิ่มเคสของโจทย์ต่อจากตรงนี้ — 1 เคสต่อ 1 AC ชื่อขึ้นต้นด้วยรหัส AC

// ───────────────────────── ตัวรัน ─────────────────────────

console.log(`Smoke test → ${BASE}  (admin: ${ADMIN_USER})\n`);
try { await prepareAdmin(); } catch (err) {
  console.log(`  ❌ ติดต่อเซิร์ฟเวอร์ไม่ได้: ${err.message}\n     → เปิด npm run dev ไว้หรือยัง? หรือ url=... ถูกไหม?`);
  process.exit(1);
}
let passed = 0, failed = 0, skipped = 0;
for (const t of tests) {
  try {
    await t.fn();
    passed++;
    console.log(`  ✅ ${t.name}`);
  } catch (err) {
    if (err instanceof Skip) { skipped++; console.log(`  ⏭  ${t.name}\n     → ข้าม: ${err.message}`); }
    else { failed++; console.log(`  ❌ ${t.name}\n     → ${err.message}`); }
  }
}
// เก็บกวาดผู้ใช้ชั่วคราว
for (const id of created) await admin("DELETE", `/api/users/${id}`).catch(() => {});

console.log(`\nผ่าน ${passed} · ไม่ผ่าน ${failed} · ข้าม ${skipped}  (ทั้งหมด ${tests.length})`);
process.exit(failed ? 1 : 0);
