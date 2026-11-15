// ชนิดข้อมูลของ "สิ่งที่ Cloudflare ส่งมาให้ Worker" (bindings)
// DB มีหลังรัน  npx wrangler d1 create app-db --binding DB --update-config
export type Bindings = {
  DB: D1Database;
};

export type Role = "admin" | "user";

// ค่าที่ middleware requireAuth ฝากไว้ใน context ให้ route อื่นใช้
export type Variables = {
  userId: number;
  username: string;
  role: Role;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
