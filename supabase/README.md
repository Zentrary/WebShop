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
| `favorites` | `id, user_id, product_id, created_at` (unique `user_id, product_id`, RLS owner-only) |
| `client_errors` | `id, user_id, area, code, created_at` (เขียนผ่าน RPC `report_client_error` เท่านั้น) |
| `login_attempts` | `key, hits, expires` (เขียนผ่าน RPC `login_allow` เท่านั้น, อ่านได้เฉพาะแอดมิน) |
| `owner_notifications` | `id, order_id, kind, created_at, seen_at` |
| `operation_status` | `name, last_success, affected` |

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
| `login_allow(bucket_key)` | boolean (สูงสุด 15 ครั้ง / 15 นาที ต่อ 1 bucket) |
| `report_client_error(p_area, p_code)` | void (จำกัด 1 ครั้ง/นาที และ 10 ครั้ง/วัน) |
| `delete_address(p_id)` | void (ลบได้เฉพาะที่อยู่ของตัวเอง) |
| `add_shipping_update(p_order_id, p_message, p_images)` | uuid (admin เท่านั้น, ≤ 4 รูป, ข้อความ ≤ 1,000 ตัว) |
| `restore_admin_backup(p_backup)` | jsonb (admin เท่านั้น, กู้คืนจากไฟล์ `zenmarket-data-v1`) |
| `expire_unpaid_orders()` | void (คืนสต็อกคำสั่งซื้อที่หมดเวลา) |

## ฟีเจอร์ที่เพิ่มล่าสุด

| ฟีเจอร์ | ที่มา |
|---|---|
| รายการโปรด (กดหัวใจ) | ตาราง `favorites` + RLS owner-only |
| จำกัดความพยายามเข้าสู่ระบบ | RPC `login_allow` (15 ครั้ง / 15 นาที) |
| รายงานข้อผิดพลาดฝั่งผู้ใช้ | RPC `report_client_error` + แสดงในหน้า Operations |
| เพิ่ม/ลบที่อยู่ | RPC `save_address` / `delete_address` |
| อัปเดตการจัดส่งพร้อมรูป | RPC `add_shipping_update` + bucket `shipping-updates` (private) |
| ยกเลิก/ยืนยันได้รับสินค้า | RPC `transition_order` (ลูกค้าเป็นเจ้าของคำสั่งซื้อ) |
| อัปโหลดโลโก้ร้าน | bucket `store-assets` (public) + คอลัมน์ `store_settings.logo_url` |
| สำรอง/กู้คืนข้อมูลจริง | RPC `get_admin_backup` + `restore_admin_backup` (เข้ารหัส AES-GCM ฝั่งเบราว์เซอร์) |

## Storage buckets

| Bucket | สาธารณะ | ใช้ทำอะไร |
|---|---|---|
| `product-images` | ✅ | รูปสินค้า |
| `store-assets` | ✅ | โลโก้ร้าน |
| `payment-slips` | ❌ | สลิปการชำระเงิน (ต้องใช้ signed URL) |
| `shipping-updates` | ❌ | รูปการจัดส่ง |

## ไฟล์ในโฟลเดอร์

- `migrations/001_initial_schema.sql`, `migrations/002_rls_policies.sql` — เอกสารสคีมายุคแรก (legacy) ใช้อ้างอิงประวัติเท่านั้น
- `migrations/003_public_read_policies.sql` — แก้ RLS ให้ anon อ่านสินค้า/รีวิวได้ (apply แล้ว)
- `migrations/004_admin_manage_reviews.sql` — ให้แอดมินแก้ไข/ลบรีวิวได้ (apply แล้ว)
- `migrations/005_add_favorites.sql` — ตาราง `favorites` + RLS owner-only (apply แล้ว)
- `migrations/006_restore_admin_backup.sql` — RPC `restore_admin_backup(jsonb)` กู้คืนข้อมูลจริงจากไฟล์สำรอง (apply แล้ว)
- `migrations/007_admin_read_login_attempts.sql` — ให้แอดมินอ่าน `login_attempts` ได้ (apply แล้ว)
- `admin-bootstrap.sql` — สคริปต์ตั้งค่าเจ้าของร้านเป็นแอดมินครั้งแรก
- `seed.sql` — ข้อมูลตัวอย่าง
- Edge function `username-login` ถูกลบแล้ว (เคยเรียกคอลัมน์ `profiles.user_name/email/role` ที่ไม่มีจริง และใช้ service role key ยืนยันรหัสผ่าน — ตอนนี้หน้าเว็บเรียก RPC `login_email` + `supabase.auth.signInWithPassword` โดยตรงแทน)
