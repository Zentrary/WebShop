# ควรเพิ่มระบบความปลอดภัยอีกไหม? — ตรวจสด 24 พ.ย. 2026

> ตรวจจากของจริง: ฐานข้อมูล Supabase `njjrgklfjwgmtcoefctc` (RLS / policy / function / storage),
> Auth config ของโปรเจกต์, `vercel.json`, โค้ดใน `src/`, `npm audit`, CI
> เอกสารคู่กัน: [`security.md`](./security.md) = สิ่งที่มีอยู่แล้วและช่องโหว่ที่ปิดไปแล้ว

## สรุปสั้น (อ่านแค่บรรทัดนี้ก็ได้)

**ฐานรากแน่นกว่าร้านเล็กทั่วไปแล้ว — ไม่ต้องรื้อ ไม่ต้องใส่ของเพิ่มแบบเหวี่ยงแห**
แต่ยังมี **4 จุดที่ยัง "เปิดประตู" จริง** เรียงตามความคุ้มค่า:

| # | งาน | ใครทำ | เวลา | ลดความเสี่ยง |
| --- | --- | --- | --- | --- |
| 1 | ตั้งนโยบายรหัสผ่าน 10 ตัว + กันรหัสที่รั่วแล้ว (HIBP) | เจ้าของร้าน (คลิกใน dashboard) | 2 นาที | 🔴 สูงสุด |
| 2 | ต่อ SMTP จริง + เปิดอีเมลแจ้ง "รหัสผ่านถูกเปลี่ยน" | เจ้าของร้าน | 15 นาที | 🔴 สูง |
| 3 | MFA (TOTP) สำหรับแอดมิน + บังคับตอนเข้า `/admin` | **ผมเขียนโค้ดให้ได้** | ~1–2 ชม. | 🟠 สูง |
| 4 | เปิดแคปชา (Turnstile) ให้ครบ **สองฝั่ง** | เจ้าของร้าน + ผมใส่ env | 20 นาที | 🟡 กลาง |

ที่เหลือ (WAF, audit log, backup อัตโนมัติ, CI audit) = ควรมีแต่ยังไม่เร่ง ดูท้ายไฟล์

---

## 1) เรื่องแคปชา โดยตรงกับคำถาม

**มีโค้ดอยู่แล้วในเว็บ แต่ยังไม่ทำงาน** — `src/core/captcha.js` โหลด Cloudflare Turnstile และผูกไว้กับ
4 ฟอร์มแล้ว (เข้าสู่ระบบ / สมัคร / ลืมรหัสผ่าน / ตั้งรหัสใหม่) แต่บรรทัดนี้ทำให้มันเงียบสนิท:

```js
turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
if (!turnstileSiteKey) return false;   // ไม่มี key = ข้ามแคปชาไปเลย
```

และฝั่ง Supabase ก็ยังปิดอยู่เช่นกัน: `security_captcha_enabled = false`, `security_captcha_secret = null`

### ถ้าจะเปิด ต้องเปิด **ทั้งสองฝั่ง** พร้อมกัน

| ฝั่ง | สิ่งที่ต้องใส่ | ถ้าใส่ข้างเดียวจะเกิดอะไร |
| --- | --- | --- |
| เว็บ (Vercel env) | `VITE_TURNSTILE_SITE_KEY` | เห็นกล่องแคปชา แต่เซิร์ฟเวอร์ไม่ตรวจ → ยิง REST ตรงข้ามได้เลย |
| Supabase (Auth → Attack Protection) | เปิด CAPTCHA + secret | บังคับตรวจทุกครั้ง (signup / signin / OTP / reset) |

พูดอีกแบบ: **แคปชาที่ตรวจแค่ฝั่งเบราว์เซอร์ = ของประดับ** ตัวจริงคือ Supabase เป็นคนตรวจ token กับ Cloudflare

### แคปชาช่วยร้านนี้จริงแค่ไหน

- ✅ **ช่วย**: กันสมัครปลอมทีละหลายพันบัญชี, กันการยิงรหัสผ่านอัตโนมัติ (credential stuffing) ที่วิ่งเข้า GoTrue ตรง ๆ ซึ่งตอนนี้ไม่มีอะไรกันนอกจาก rate limit ในตัว Supabase
- ❌ **ไม่ได้ช่วย**: กัน "สั่งซื้อปลอม" หรือ "สแปมรีวิว" เพราะเว็บนี้อนุญาตให้ `anon` **เขียนไม่ได้เลย** — `orders` เขียนผ่าน `create_order` ที่ต้องล็อกอิน + จำกัด 3 ครั้ง/15 นาที, รีวิว/ที่อยู่ผ่าน RPC ที่ต้องมี JWT, หน้า "ติดต่อ" เป็นแค่ลิงก์ ไม่มีฟอร์ม

> สรุป: เปิดก็ดีและฟรี แต่ **อย่าเพิ่งไปเปิดก่อนข้อ 1–2** เพราะถ้าระบบอีเมลยังส่งไม่ได้
> ผู้ใช้จริงจะเจอแคปชาแล้วยังสมัครไม่สำเร็จ = เสียลูกค้าโดยไม่ได้อะไรกลับมา

---

## 2) สิ่งที่ตรวจแล้วว่า "ดีอยู่แล้ว" (ไม่ต้องแตะ)

| หัวข้อ | ผลตรวจสด |
| --- | --- |
| RLS | เปิดครบ **16/16** ตารางใน `public`, มี policy รวม 22 ตัว |
| สิทธิ์ `anon` | มีแค่ `SELECT` — และตารางที่ grant ให้ (`coupons`, `favorites`, `store_settings`) มี policy ที่ปิดไว้ → คืน 0 แถว ไม่รั่ว |
| ตารางที่เขียนตรงจาก client | **ไม่มีเลย** (`orders`, `profiles`, `customer_addresses`, `product_reviews` ไม่มี INSERT/UPDATE policy) → ต้องผ่าน RPC เท่านั้น |
| SECURITY DEFINER | 30/30 ฟังก์ชัน pin `search_path` แล้ว (กัน search_path hijack) |
| ฟังก์ชันเฉพาะแอดมิน | `get_admin_backup`, `restore_admin_backup`, `get_admin_dashboard`, `get_sales_report` ตรวจ `is_admin()` ในฟังก์ชันเองทุกตัว (ไม่ใช่พึ่ง UI) |
| `is_admin()` | อ่านจากตาราง `store_admin` ตาม `auth.uid()` — ปลอมไม่ได้ |
| Storage | `payment-slips` + `shipping-updates` = **private**, policy ผูกเจ้าของ/แอดมิน, จำกัด mime เป็น jpeg/png/webp และขนาดไฟล์ |
| ส่วนหัว HTTP | CSP (ไม่มี `unsafe-inline`), `frame-ancestors 'none'`, HSTS, nosniff, COOP/CORP, `base-uri`, `form-action 'self'` |
| Dependency | `npm audit --omit=dev` → **0 ช่องโหว่** (Runtime deps มี 4 ตัว) |
| นโยบายรหัสผ่านฝั่ง Auth | ❌ **6 ตัวอักษร, ไม่เช็ค HIBP** ← จุดอ่อนที่สุดที่เหลือ ดูข้อ 1 |
| Session | refresh token rotation เปิด, JWT 1 ชม., ไม่มี inactivity timeout |
| งานประจำ | pg_cron `zenmarket-expire-unpaid-orders` ทำงานทุกนาที ✅ |
| ร่องรอยการยิง | `login_attempts` ตอนนี้ 1 bucket, hits = 1 → **ยังไม่มีคนยิงบอทเข้าเว็บ** |

---

## 3) สี่งานที่ควรทำ (พร้อมวิธีทำ)

### งาน 1 — นโยบายรหัสผ่าน (เจ้าของร้าน, 2 นาที) 🔴

ตอนนี้: `password_min_length = 6`, `password_hibp_enabled = false`, ไม่บังคับชนิดตัวอักษร
แปลว่า `123456` สมัครได้ และรหัสที่เคยรั่วจากเว็บอื่นก็ใช้ได้

Supabase Dashboard → **Authentication → Sign In / Providers → Password** :

- [ ] Minimum password length → **10**
- [ ] Require characters → ตัวอักษร + ตัวเลข (เลือกได้)
- [ ] **Prevent use of leaked passwords** (HIBP) → เปิด
- [ ] **Require reauthentication before password update** → เปิด (กันคนที่ขโมย session ไปเปลี่ยนรหัส)
- [ ] Session inactivity timeout → 7 วัน (ถ้าอยากให้ต้องล็อกอินใหม่)

> หมายเหตุ: ตั้งฝั่งเซิร์ฟเวอร์เท่านั้นจึงจะมีผลจริง — ฝั่งเว็บแค่โชว์ hint ไม่นับเป็นการป้องกัน

### งาน 2 — อีเมลจริง + แจ้งเตือนเมื่อบัญชีถูกแตะ (เจ้าของร้าน, 15 นาที) 🔴

ตอนนี้ `rate_limit_email_sent = 2` ต่อชั่วโมง และใช้ SMTP ของ Supabase
→ ลูกค้าลืมรหัสผ่านแล้ว **กดขอรีเซ็ตไม่ได้จริง** (นี่คือช่องที่ทำให้คนหาทางลัด/ทักแชทขอรหัสจากแอดมิน = ความเสี่ยงสังคมวิศวกรรม)

- [ ] Authentication → Emails → **Custom SMTP** (Resend / Brevo / Gmail app password ก็ได้ ฟรี)
- [ ] Authentication → Notifications → เปิด **Password changed** และ **Email changed**
      (เปิดฟรี ไม่ต้องเขียนโค้ด — ถ้าโดนยึดบัญชีจะได้อีเมลเตือนทันที)

### งาน 3 — MFA สำหรับแอดมิน (ผมเขียนให้) 🟠

ฝั่ง Supabase เปิด TOTP ไว้แล้ว (`mfa_totp_enroll_enabled = true`) แต่ในเว็บ **ไม่มี UI เลย**
(`grep -r "mfa\|totp" src` = ไม่พบ) → แอดมินคนเดียวของร้านล็อกอินด้วยรหัสผ่านเดี่ยว แต่มีสิทธิ์เห็นทุกอย่าง:
ออเดอร์ทั้งหมด, ที่อยู่/เบอร์ลูกค้า, สลิปโอนเงิน, และกด export backup ทั้งฐานได้

ถ้าทำ ผมจะเพิ่ม:
- หน้า **บัญชี → ความปลอดภัย**: ผูกแอป Authenticator (QR + รหัส 6 หลัก), ดู/ถอด factor
- ด่านบังคับ: บัญชีที่เป็นแอดมินและยังไม่ผ่าน `aal2` → เด้งไปหน้ายืนยันก่อนเข้า `/admin` ทุกครั้ง
- ข้อความไทย/อังกฤษครบ + ทดสอบกับ mock เหมือนรอบก่อน ๆ

### งาน 4 — เปิดแคปชาจริง (20 นาที) 🟡

- [ ] Cloudflare Dashboard → Turnstile → Add site (`webshop-tau-ebon.vercel.app` + `localhost`) → ได้ Site key + Secret
- [ ] Vercel → Project → Settings → Environment Variables → `VITE_TURNSTILE_SITE_KEY` = site key → Redeploy
      (ช่อง env มีรออยู่แล้วใน `.env.example` และ CSP ใน `vercel.json` อนุญาต `challenges.cloudflare.com` ไว้แล้ว — ไม่ต้องแก้โค้ด)
- [ ] Supabase → Authentication → Attack Protection → Enable CAPTCHA, provider **Turnstile**, ใส่ secret

---

## 4) ควรมีแต่ยังไม่เร่ง (ทำเมื่อร้านเริ่มมีคนรู้จัก)

| งาน | ทำไมยังไม่เร่ง | หมายเหตุ |
| --- | --- | --- |
| Backup ออฟไซต์ / PITR | มีปุ่ม export ในการ์ดแอดมินอยู่แล้ว + ข้อมูลยังน้อย | Free plan ไม่มี PITR; ถ้าขึ้น Pro เปิด PITR = คุ้มที่สุด |
| Admin audit log | แอดมินมีคนเดียว | ตาราง `admin_audit(who, action, target, at)` + หน้าในหลังบ้าน (ผมทำได้ ~1 ชม.) |
| Edge rate limit / WAF | Vercel WAF ต้อง Pro; app-level มีอยู่แล้ว (`login_allow` 15/15 นาที, `create_order` 3/15 นาที) | ค่อยเปิดเมื่อมีทราฟฟิคจริง หรือโดนสแปม |
| CI `npm audit` + Dependabot | ตอนนี้ 0 ช่องโหว่ | 15 นาที ทำได้ทันทีถ้าอยาก |
| `/.well-known/security.txt` | เป็นพิธีกรรมมากกว่าป้องกัน | 5 นาที |
| Revoke grant ที่ไม่ใช้ (`coupons`/`favorites`/`store_settings` ให้ `anon`) | policy ปิดอยู่แล้ว จึงไม่รั่ว | เก็บไว้ทำตอนปรับสิทธิ์ครั้งหน้า |
| เปลี่ยน JWT จาก localStorage → httpOnly cookie | Supabase JS ออกแบบมาอย่างนี้ CSP ก็คุม inline script หมดแล้ว | ถ้าจะทำต้องมี backend เล็ก ๆ (Vercel Function) — งานใหญ่ ไม่คุ้มตอนนี้ |

---

## 5) สิ่งที่ **ไม่ต้อง** ทำ (ตอบตรง ๆ)

- ❌ ไม่ต้องย้ายไป backend เอง / เขียน auth ใหม่ — ของที่ Supabase ให้มาแข็งกว่าที่เราจะเขียนเอง
- ❌ ไม่ต้องซ่อน `anon key` — มันคือกุญแจสาธารณะ สิ่งที่กันคือ RLS (มีแล้ว)
- ❌ ไม่ต้องใส่แคปชาทุกฟอร์ม — ฟอร์มที่ `anon` เขียนไม่ได้ ไม่ได้ประโยชน์อะไร
- ❌ ไม่ต้องซื้อ security scanner รายเดือนตอนนี้ — พื้นที่เสี่ยงจริงเหลือแค่เรื่องบัญชี/รหัสผ่าน

---

## ลำดับที่แนะนำจริง ๆ

1. **งาน 1 + 2 (เจ้าของร้าน, 20 นาทีรวม)** → ปิดความเสี่ยงใหญ่สุดได้ทันทีโดยไม่ต้องเขียนโค้ด
2. **งาน 3 (ผมเขียน MFA)** → ปิดความเสี่ยง "แอดมินถูกยึด = ร้านพังทั้งร้าน"
3. **งาน 4 (แคปชา)** → ทำหลังอีเมลใช้งานได้จริง
4. ที่เหลือ = เก็บกวาดตามโอกาส
