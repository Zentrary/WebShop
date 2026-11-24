# ZenMarket DOM Tests

ชุดทดสอบระดับ “หน้าเว็บจริง” ที่โหลดไฟล์ HTML จริงและโมดูล JS จริงของแอปเข้า `jsdom`
แล้วสั่งงานเหมือนผู้ใช้จริง (คลิก กรอกฟอร์ม submit ฯลฯ) โดย mock `supabase-js` ไว้

> ต้องการ `jsdom` ซึ่งเป็น devDependency — ถ้ายังไม่มี ให้รัน `npm install` ก่อน

## รันเทสต์

```bash
npm test          # รันทั้งหมด
npm run test:dom  # เหมือนกัน
```

ผลลัพธ์:

```
===== สรุปการทดสอบ =====
  ✓ admin        pass=  9  fail=0
  ✓ backup       pass= 16  fail=0
  ✓ customer     pass= 22  fail=0
  ✓ store        pass= 16  fail=0
  รวม: pass=63 fail=0
```

## ไฟล์ในชุด

| ไฟล์ | สิ่งที่ทดสอบ |
|---|---|
| `harness.mjs` | โหลดหน้า HTML + โมดูลจริงเข้า jsdom, stub browser globals, mock localStorage |
| `loader.mjs` | ESM loader hooks: แปลง `/src/...` → ไฟล์จริง, mock `@supabase/supabase-js`, แทน `import.meta.env` |
| `supabase-mock.mjs` | mock client ของ Supabase (auth / from / rpc / storage) พร้อมบันทึก `calls` |
| `test_admin.mjs` | ตั้งค่าร้าน: ค่าจัดส่ง 0 ต้องไม่กลายเป็น 50, threshold 0 ต้องถูกปฏิเสธ, ค่าว่างต้องถูกปฏิเสธ, PromptPay 10/13 หลัก |
| `test_customer.mjs` | checkout: guest เจอ gate, member สร้างออเดอร์, เบอร์ 9/10 หลักถูก normalize, เบอร์/ที่อยู่ผิดถูกบล็อก, `pattern` ตรงกับ CHECK ของ DB |
| `test_backup.mjs` | สำรอง/กู้คืน: 2 ขั้น (ตัวอย่าง → ยืนยัน), ไฟล์ผิด format ถูกปฏิเสธ, ยกเลิกไม่กู้คืน, error จาก RPC แสดงผู้ใช้ |
| `test_store.mjs` | หน้าร้าน: quick-add เพิ่มลงตะกร้า, สินค้าหมดสต็อก/inactive ถูกบล็อก, กดสองครั้งรวมจำนวน, หัวใจรายการโปรด (member เท่านั้น) |

## เครื่องมือเสริม

```bash
npm run lint:undef   # ตรวจว่าไม่มีการเรียกฟังก์ชันที่ไม่ได้ import (จับ bug ที่ node --check จับไม่ได้)
```

`scripts/scan-no-undef.mjs` จับ bug ประเภท “เรียกฟังก์ชันที่ไม่ได้ import” ซึ่งทำให้
หน้า admin พังตอนบันทึกค่า PromptPay (เคยเกิดจริงระหว่างงานนี้)
