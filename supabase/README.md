# Supabase — ZenMarket

โปรเจกต์จริง: **MarketWeb** — ref `njjrgklfjwgmtcoefctc` — https://njjrgklfjwgmtcoefctc.supabase.co

> ⚠️ **ไฟล์ในโฟลเดอร์นี้เป็นเอกสารประกอบเท่านั้น — ไม่ใช่แหล่งความจริงของฐานข้อมูล**
> โครงสร้างจริงของตาราง/ฟังก์ชันต่าง ๆ ถูกสร้างและปรับแต่งใน Supabase Dashboard โดยตรง
> ให้ถือ schema จริงเป็นหลัก และอ้างอิงจาก `information_schema.columns` + `pg_proc` เสมอ

## โครงสร้างจริง (สรุป)

| ตาราง | คอลัมน์สำคัญ |
|---|---|
| `products` | `id, name, sku, category (text), description, price, image_url, image_urls (text[]), stock, active, created_at` |
| `categories` | `name, created_at` (ไม่มี `id`/`slug`) |
| `orders` | `id, user_id, items (jsonb), subtotal, shipping, total, address, recipient, phone, promptpay_id, recipient_name, status, slip_path, tracking, request_id, created_at, paid_at, shipped_at, delivered_at, payment_due_at, expired_at` |
| `profiles` | `id, first_name, last_name, nickname, phone, age, username, created_at` (email อยู่ใน `auth.users`) |
| `store_settings` | singleton เดียว: `promptpay_id, recipient_name, shop_name, tagline, logo_url, contact_email, contact_phone, contact_address, about_text, shipping_note, shipping_fee, free_shipping_threshold, facebook_url, instagram_url, line_url` |
| `product_reviews` | `id, order_id, product_id, reviewer_name, product_name, rating, comment, created_at, updated_at` |
| `customer_addresses` | `id, user_id, label, recipient, phone, address, is_default, created_at` |
| `store_admin` | `singleton, user_id` (ตรวจสิทธิ์แอดมินด้วย `is_admin()`) |
| `order_shipping_updates` | `id, order_id, message, image_paths, created_at` |

สถานะออเดอร์: `pending → review → paid → shipped → delivered` (มี `cancelled`)

## RPC ที่แอปใช้

| ฟังก์ชัน | ลายเซ็น |
|---|---|
| `get_storefront()` | → jsonb ข้อมูลร้าน (public) |
| `get_home_reviews()` | → jsonb รีวิว 4★ ขึ้นไป 6 รายการ |
| `get_admin_dashboard()` | → jsonb สถิติแดชบอร์ด (admin เท่านั้น) |
| `get_admin_backup()` | → jsonb ข้อมูลทั้งหมด (admin เท่านั้น) |
| `create_order(cart, delivery, request_key)` | → orders |
| `login_email(login_name)` | → email |
| `save_profile(p_first_name, p_last_name, p_nickname, p_phone, p_age, p_username)` | void |
| `save_address(p_id, p_label, p_recipient, p_phone, p_address, p_default)` | uuid |
| `attach_slip(order_id, object_path)` | void (bucket `payment-slips`, path `<user_id>/<order_id>/<file>`) |
| `save_review(p_order_id, p_product_id, p_rating, p_comment)` | void (สถานะต้องเป็น `delivered`) |
| `transition_order(order_id, next_status, tracking_number)` | void |
| `ship_order_with_update(p_order_id, p_tracking, p_message, p_images)` | void |
| `get_order_reviews(p_order_id)` | jsonb |
| `is_admin()` | boolean |

## Storage buckets

| Bucket | สาธารณะ | ใช้ทำอะไร |
|---|---|---|
| `product-images` | ✅ | รูปสินค้า |
| `store-assets` | ✅ | โลโก้ร้าน |
| `payment-slips` | ❌ | สลิปการชำระเงิน (ต้องใช้ signed URL) |
| `shipping-updates` | ❌ | รูปการจัดส่ง |

## ไฟล์ในโฟลเดอร์

- `migrations/001_initial_schema.sql`, `migrations/002_rls_policies.sql` — เอกสารสคีมายุคแรก (legacy) ใช้อ้างอิงประวัติเท่านั้น
- `migrations/003_public_read_policies.sql` — migration ล่าสุดที่ถูก apply แล้ว (แก้ RLS ให้ anon อ่านสินค้า/รีวิวได้)
- `admin-bootstrap.sql` — สคริปต์ตั้งค่าเจ้าของร้านเป็นแอดมินครั้งแรก
- `seed.sql` — ข้อมูลตัวอย่าง
- Edge function `username-login` ถูกลบแล้ว (เคยเรียกคอลัมน์ `profiles.user_name/email/role` ที่ไม่มีจริง และใช้ service role key ยืนยันรหัสผ่าน — ตอนนี้หน้าเว็บเรียก RPC `login_email` + `supabase.auth.signInWithPassword` โดยตรงแทน)
