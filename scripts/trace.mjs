// Traceability check — ตรวจว่า "ความต้องการ" ถูกตามรอยไปถึง "การทดสอบ" ครบไหม
//
//   npm run trace
//
// ตรวจ 3 อย่าง:
//   1) AC ทุกข้อใน SPEC.md มีเคสทดสอบใน scripts/smoke.mjs อย่างน้อย 1 เคส       (ขาด = ❌)
//   2) เคสทดสอบทุกเคสอ้าง AC ที่มีอยู่จริงใน SPEC.md                            (อ้างผิด = ❌)
//   3) FR ทุกข้อใน docs/SRS.md ถูกอ้างถึงใน SPEC.md                              (ขาด = ⚠ เตือน)
//
// AC ใน SPEC.md นับเฉพาะที่เขียนเป็นตัวหนา เช่น  - **AC-1.2** Given ... When ... Then ...
// FR ใน docs/SRS.md นับจากแถวตาราง เช่น         | FR-01 | ... |

import { readFileSync, existsSync } from "node:fs";

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const spec = read("SPEC.md");
const smoke = read("scripts/smoke.mjs");
const srs = read("docs/SRS.md");

const unique = (arr) => [...new Set(arr)];
const acDefined = unique([...spec.matchAll(/\*\*(AC-[A-Z0-9]+\.\d+)\*\*/g)].map((m) => m[1]));
const testNames = [...smoke.matchAll(/^\s*test\(\s*["'`]([^"'`]+)["'`]/gm)].map((m) => m[1]);
const acTested = new Map(); // AC → จำนวนเคส
const badRefs = [];
for (const name of testNames) {
  const ids = name.match(/AC-[A-Z0-9]+\.\d+/g) || [];
  if (ids.length === 0) badRefs.push(`เคส "${name}" ไม่ได้อ้าง AC`);
  for (const id of ids) {
    if (!acDefined.includes(id)) badRefs.push(`เคส "${name}" อ้าง ${id} ซึ่งไม่มีใน SPEC.md`);
    acTested.set(id, (acTested.get(id) || 0) + 1);
  }
}

const frDefined = unique([...srs.matchAll(/^\|\s*(FR-\d+)\s*\|/gm)].map((m) => m[1]));
const frMissing = frDefined.filter((fr) => !new RegExp(`\\b${fr}\\b`).test(spec));

// ───── รายงาน ─────
console.log("Traceability: SPEC.md (AC) → scripts/smoke.mjs (test)\n");
let missing = 0;
for (const ac of acDefined) {
  const n = acTested.get(ac) || 0;
  if (!n) missing++;
  console.log(`  ${n ? "✅" : "❌"} ${ac.padEnd(9)} ${n ? `${n} เคส` : "ยังไม่มีเคสทดสอบ"}`);
}
for (const msg of badRefs) console.log(`  ❌ ${msg}`);

if (frDefined.length) {
  console.log("\nTraceability: docs/SRS.md (FR) → SPEC.md\n");
  for (const fr of frDefined) console.log(`  ${frMissing.includes(fr) ? "⚠ " : "✅"} ${fr} ${frMissing.includes(fr) ? "ยังไม่ถูกอ้างใน SPEC.md" : ""}`);
}

const ok = missing === 0 && badRefs.length === 0;
console.log(`\nAC ทั้งหมด ${acDefined.length} · มีเคสทดสอบ ${acDefined.length - missing} · ขาด ${missing} · อ้างผิด ${badRefs.length}` +
  (frDefined.length ? ` · FR ที่ยังไม่ถูกอ้าง ${frMissing.length}/${frDefined.length}` : ""));
console.log(ok ? "✅ ตามรอยครบ" : "❌ ยังตามรอยไม่ครบ — เพิ่มเคสใน smoke.mjs หรือแก้รหัส AC ให้ตรงกัน");
process.exit(ok ? 0 : 1);
