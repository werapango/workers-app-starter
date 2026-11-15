-- ผู้ใช้ + session (มากับ starter)
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,                       -- "salt:hash" ไม่ใช่รหัสผ่านจริง
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token      TEXT    PRIMARY KEY,                    -- ค่าสุ่ม 32 ไบต์ เดาไม่ได้
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT    NOT NULL                        -- ISO 8601 (UTC)
);
