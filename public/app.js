// ฝั่ง client ของ starter — HTML/CSS/JS ธรรมดา ไม่ใช้ framework
// โครง: 1 หน้า (index.html) แบ่งเป็นหลาย "view" สลับด้วย #hash ใน URL
// วิธีเพิ่มหน้าของโจทย์: เพิ่ม <section id="view-xxx"> + เมนู <a href="#xxx"> ใน index.html
//                        แล้วเพิ่มฟังก์ชันโหลดข้อมูลใน VIEWS ด้านล่าง

const $ = (sel, root = document) => root.querySelector(sel);
let me = null; // ผู้ใช้ที่ล็อกอินอยู่ { id, username, role }

// ───── เรียก API: ส่ง/รับ JSON · cookie session ถูกส่งไปให้อัตโนมัติ ─────
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`), { status: res.status });
  return data;
}

// แสดงข้อความใต้ฟอร์ม
function say(el, text, ok = false) {
  el.textContent = text;
  el.className = "msg " + (ok ? "ok" : "bad");
}

// กัน HTML แปลกปลอมจากข้อมูลผู้ใช้ (ป้องกัน XSS)
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

// ───── สลับหน้า ─────
function show(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  $(`#view-${name}`)?.classList.remove("hidden");
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${name}`));
}

// หน้าที่ต้องล็อกอินก่อน: ชื่อ view → ฟังก์ชันโหลดข้อมูลของหน้านั้น
const VIEWS = {
  home: loadHome,
  users: loadUsers,
  password: async () => {},
  // ⬇ เพิ่มหน้าของโจทย์ตรงนี้ เช่น  cars: loadCars,
};

async function route() {
  if (!me) return;
  let name = location.hash.slice(1) || "home";
  if (!VIEWS[name] || (name === "users" && me.role !== "admin")) name = "home";
  show(name);
  try { await VIEWS[name](); } catch (err) { if (err.status === 401) boot(); }
}
window.addEventListener("hashchange", route);

// ───── เริ่มต้น: ถามเซิร์ฟเวอร์ว่าต้องตั้งค่าครั้งแรกไหม / ล็อกอินอยู่ไหม ─────
async function boot() {
  me = null;
  $("#nav").classList.add("hidden");
  try {
    const { needsSetup } = await api("GET", "/api/auth/setup");
    if (needsSetup) return show("setup");
  } catch (err) {
    // ฐานข้อมูลยังไม่พร้อม → ให้ดูสถานะที่ /api/health
    show("home");
    $("#helloName").textContent = "";
    return loadHome();
  }
  try {
    me = await api("GET", "/api/auth/me");
  } catch {
    return show("login");
  }
  $("#who").textContent = `👤 ${me.username} (${me.role})`;
  $("#helloName").textContent = me.username;
  document.querySelectorAll("[data-admin]").forEach((el) => el.classList.toggle("hidden", me.role !== "admin"));
  $("#nav").classList.remove("hidden");
  route();
}

// ───── ตั้งค่าครั้งแรก / ล็อกอิน / ออกจากระบบ ─────
$("#setupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await api("POST", "/api/auth/setup", { username: f.get("username"), password: f.get("password") });
    e.target.reset();
    boot();
  } catch (err) { say($(".msg", e.target), err.message); }
});

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await api("POST", "/api/auth/login", { username: f.get("username"), password: f.get("password") });
    e.target.reset();
    say($(".msg", e.target), "");
    boot();
  } catch (err) { say($(".msg", e.target), err.message); }
});

$("#logoutBtn").addEventListener("click", async () => {
  await api("POST", "/api/auth/logout");
  location.hash = "";
  boot();
});

// ───── หน้าหลัก: แสดงสถานะเซิร์ฟเวอร์ ─────
async function loadHome() {
  const el = $("#health");
  try {
    const data = await api("GET", "/api/health");
    el.textContent = JSON.stringify(data, null, 2);
    el.className = "status " + (data.db === "ready" ? "ok" : "bad");
  } catch (err) {
    el.textContent = "เรียก API ไม่ได้: " + err.message;
    el.className = "status bad";
  }
}

// ───── จัดการผู้ใช้ (admin) — ตัวอย่างหน้า CRUD ที่หน้าของโจทย์เลียนแบบได้ ─────
async function loadUsers() {
  const list = await api("GET", "/api/users");
  $("#userRows").innerHTML = list.map((u) => `
    <tr>
      <td>${esc(u.username)}${u.id === me.id ? ' <span class="muted">(คุณ)</span>' : ""}</td>
      <td>
        <select data-role="${u.id}">
          <option value="user" ${u.role === "user" ? "selected" : ""}>user</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
        </select>
      </td>
      <td class="muted">${esc(u.created_at)}</td>
      <td>
        <button class="ghost" data-reset="${u.id}">ตั้งรหัสใหม่</button>
        <button class="danger" data-del="${u.id}" ${u.id === me.id ? "disabled" : ""}>ลบ</button>
      </td>
    </tr>`).join("");
}

$("#userForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await api("POST", "/api/users", { username: f.get("username"), password: f.get("password"), role: f.get("role") });
    e.target.reset();
    say($("#userMsg"), "เพิ่มผู้ใช้แล้ว", true);
    loadUsers();
  } catch (err) { say($("#userMsg"), err.message); }
});

$("#userRows").addEventListener("change", async (e) => {
  const id = e.target.dataset.role;
  if (!id) return;
  try {
    await api("PUT", `/api/users/${id}`, { role: e.target.value });
    say($("#userMsg"), "บันทึก role แล้ว", true);
  } catch (err) { say($("#userMsg"), err.message); }
  loadUsers();
});

$("#userRows").addEventListener("click", async (e) => {
  const resetId = e.target.dataset.reset, delId = e.target.dataset.del;
  try {
    if (resetId) {
      const password = prompt("รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)");
      if (!password) return;
      await api("PUT", `/api/users/${resetId}`, { password });
      say($("#userMsg"), "ตั้งรหัสใหม่แล้ว (ผู้ใช้นั้นต้องล็อกอินใหม่)", true);
    }
    if (delId && confirm("ลบผู้ใช้นี้?")) {
      await api("DELETE", `/api/users/${delId}`);
      say($("#userMsg"), "ลบแล้ว", true);
      loadUsers();
    }
  } catch (err) { say($("#userMsg"), err.message); }
});

// ───── เปลี่ยนรหัสผ่านของตัวเอง ─────
$("#passwordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await api("PUT", "/api/auth/password", { current_password: f.get("current_password"), new_password: f.get("new_password") });
    e.target.reset();
    say($(".msg", e.target), "เปลี่ยนรหัสผ่านแล้ว", true);
  } catch (err) { say($(".msg", e.target), err.message); }
});

boot();
