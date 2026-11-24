# ความปลอดภัยของข้อมูลลูกค้า (Security model)

> อัปเดต 24 พ.ย. 2026 — หลังตรวจฐานข้อมูลจริง (Supabase project `njjrgklfjwgmtcoefctc`)

## หลักคิดสำคัญ (ตอบคำถามเรื่อง F12)

`anon key` ที่ฝังอยู่ในเว็บ **ไม่ใช่ความลับ** — มันคือกุญแจสาธารณะของ Supabase
คนที่เปิด F12 เห็นค่านั้นเป็นเรื่องปกติ และ **ไม่มีวิธีซ่อนมัน** (ถ้าซ่อน เว็บก็เรียก API ไม่ได้)

สิ่งที่กันข้อมูลจริงคือ **RLS (Row Level Security) ในฐานข้อมูล** ซึ่งทำงานก่อนส่งข้อมูลออกไป
ต่อให้ยิง REST ตรง ๆ ด้วย anon key + JWT ของตัวเอง ก็ได้กลับมาแค่แถวที่ policy อนุญาต
พูดง่าย ๆ: "ซ่อนกุญแจ" ไม่ช่วย "ล็อกประตูให้ถูกบาน" ต่างหากที่ช่วย

## สิ่งที่ตรวจแล้วว่าแน่นอยู่แล้ว

| หัวข้อ | สถานะ |
| --- | --- |
| RLS เปิดทุกตารางใน `public` (16 ตาราง) | ✅ |
| `profiles` / `orders` / `customer_addresses` / `favorites` | เห็นเฉพาะแถวของตัวเอง หรือแอดมิน — ✅ |
| `store_admin`, `owner_notifications`, `login_attempts`, `client_errors`, `operation_status` | แอดมินเท่านั้น — ✅ |
| `coupons` | แอดมินเท่านั้น (ลูกค้าใช้ผ่าน `check_coupon`) — ✅ |
| `products` (เฉพาะ `active`), `categories`, `site_pages`, `product_reviews` | อ่านสาธารณะตามที่ควรเป็น — ✅ |
| ตารางที่เขียนผ่าน RPC เท่านั้น (`orders`, `profiles`, `customer_addresses`, ...) | ไม่มี policy เขียนตรง — ✅ |
| RPC ที่ต้องมีสิทธิ์ (`review_slip`, `get_admin_backup`, `get_sales_report`, `transition_order`, `add_shipping_update`, `restore_admin_backup`) | ตรวจ `is_admin()` ทุกตัว — ✅ |
| `create_order` | คิดราคา/ตัดสต็อกใน DB, จำกัด 3 ครั้ง/15 นาที — ✅ |
| `attach_slip` | บังคับ path `uid/order/...` + ตรวจสถานะ — ✅ |
| Storage buckets | slips/shipping ตั้ง private + policy แยกเจ้าของ แอดมินเท่านั้นที่เขียน — ✅ |
| ส่วนหัวความปลอดภัย (`vercel.json`) | CSP, `frame-ancestors 'none'`, nosniff, HSTS, Referrer-Policy — ✅ |
| Refresh token rotation | เปิดอยู่, JWT อายุ 1 ชั่วโมง — ✅ |

## ช่องโหว่ที่พบและปิดแล้ว

### 1. ไล่เก็บอีเมลลูกค้าผ่าน `login_email` (ระดับสูง)
`public.login_email(login_name text)` เป็นฟังก์ชันที่ให้ `anon` เรียกได้ และคืน
**อีเมลของบัญชีใดก็ได้เมื่อรู้ชื่อผู้ใช้** โดยไม่ต้องรู้รหัสผ่าน
→ ใครก็ตามสามารถไล่ยิง REST เพื่อเก็บอีเมลลูกค้าทั้งร้านได้ (user enumeration + PII)

**แก้แล้ว** (`011_secure_login_lookup.sql`): เพิ่มพารามิเตอร์รหัสผ่าน, ตรวจ bcrypt
กับ `auth.users.encrypted_password`, จำกัด 20 ครั้ง/15 นาทีต่อชื่อผู้ใช้,
ไม่พบผู้ใช้ก็ยังคำนวณ bcrypt หลอกเพื่อไม่ให้เวลาตอบต่างกัน, ฝั่งเว็บส่งรหัสผ่านไปด้วยทุกครั้ง
(`src/pages/customer/account.js`, `src/pages/admin/login.js`)

### 2. สิทธิ์ระดับตารางกว้างเกินจำเป็น
เช่น `anon` มี INSERT/UPDATE/DELETE บน `products` และทุกตารางมี `TRUNCATE/REFERENCES/TRIGGER`
(RLS ยังกันไว้ แต่ไม่มีเหตุผลให้สิทธิ์ค้าง) และ `create_order_reserved_internal`
(ทางลัดที่ข้ามเพดาน 3 ครั้ง/15 นาที) ถูกให้สิทธิ์ `authenticated` เรียกตรงได้

**แก้แล้ว** (`012_security_hardening.sql`): ตัดสิทธิ์ที่ไม่มีใครใช้, ให้เขียนได้เฉพาะตาราง
ที่หน้าแอดมินเขียนตรง (RLS + `is_admin()` ยังคุมอยู่), ปิดทางเรียกฟังก์ชันภายใน

### 3. ดึงข้อมูลส่วนตัวเกินจำเป็น
ฟอร์มเข้าสู่ระบบเคย `select('*')` จาก `profiles`
**แก้แล้ว**: ระบุคอลัมน์ที่ใช้จริง (`id, username, first_name, last_name, nickname, phone, age`)

## แนวทางเสริมที่แนะนำ (ยังไม่ได้ทำ — ต้องตัดสินใจ/มีสิทธิ์ระดับโปรเจกต์)

1. **Auth settings ใน Supabase Dashboard** (connector นี้ปรับไม่ได้)
   - `Password min length` 6 → **10** และกำหนดต้องมีตัวอักษร+ตัวเลข
   - เปิด **Leaked Password Protection** (ตรวจกับ HaveIBeenPwned)
   - เปิด **sessions inactivity timeout** (เช่น 7 วัน) ถ้าต้องการให้ออกจากระบบเอง
2. **MFA (TOTP) สำหรับบัญชีแอดมิน** — เปิดได้แล้วในโปรเจกต์ (`mfa_totp_*` = true) แต่ยังไม่มี UI ในหน้า admin
3. **Rate limit ที่ขอบ Vercel/WAF** — จำกัด IP ที่ยิง `/auth/v1/*` ถ้าถูก brute force หนัก ๆ
4. **แจ้งเตือนเมื่อมีคนพยายามล็อกอินผิดเยอะ** — ใช้ข้อมูลในตาราง `login_attempts` (มีอยู่แล้ว) ส่งอีเมล/LINE
5. **สำรองข้อมูลอัตโนมัติ** — ตอนนี้มีปุ่มสำรองในหน้าแอดมิน (`get_admin_backup`) ควรมี cron สำรองออกไปที่อื่นด้วย
6. **ตรวจ dependency** (`npm audit`) เป็นรอบ ๆ และตรึงเวอร์ชันใน `package-lock.json`

## สิ่งที่ "ทำไม่ได้" และไม่ควรเสียเวลาทำ

- ซ่อน anon key / ซ่อน API endpoint — ใครเปิด F12 ก็เห็น แต่ไม่เป็นไรถ้า RLS ถูก
- ซ่อนข้อมูลด้วย JavaScript ฝั่ง client — ทำได้แค่ซ่อนจากสายตา ไม่กันคนที่อ่าน network
- ป้องกันการ "ก๊อปข้อมูลที่ตัวเองมีสิทธิ์เห็น" — ทำได้แค่จำกัดสิทธิ์ + จำกัดอัตราการเรียก

## ไฟล์ที่เกี่ยวข้อง

- `supabase/migrations/011_secure_login_lookup.sql` — แก้ `login_email` + `login_allow`
- `supabase/migrations/012_security_hardening.sql` — ล็อกสิทธิ์ตาราง/ฟังก์ชัน
- `src/core/reveal.js`, `src/core/payment.js` — ส่วนแสดงผลที่เกี่ยวข้อง (รีวิว UI)
