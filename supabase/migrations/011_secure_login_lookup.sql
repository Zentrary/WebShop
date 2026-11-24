-- 011 — ปิดช่องโหว่ "ใครก็ดึงอีเมลลูกค้าออกไปได้" (user enumeration)
--
-- ปัญหาเดิม: public.login_email(login_name text) เป็น SECURITY DEFINER ที่ให้สิทธิ์
-- anon เรียกได้ และ **คืนอีเมลของบัญชีใดก็ได้เมื่อรู้ชื่อผู้ใช้** โดยไม่ต้องรู้รหัสผ่าน
-- ใครเปิด F12 แล้วยิง REST ก็ไล่เก็บอีเมลลูกค้าทั้งร้านได้ (และยังเดาได้ว่ามีบัญชีนี้จริง)
--
-- วิธีแก้: เพิ่มพารามิเตอร์รหัสผ่าน และตรวจกับ bcrypt hash ของจริงใน auth.users
-- (pgcrypto อยู่ในสคีมา extensions) → คืนอีเมลเฉพาะเมื่อ "ชื่อผู้ใช้ + รหัสผ่าน" ถูกต้อง
-- พร้อมจำกัดจำนวนครั้งต่อชื่อผู้ใช้ผ่านตาราง login_attempts ที่มีอยู่แล้ว
-- และถ้าไม่พบผู้ใช้ก็ยังคำนวณ bcrypt หลอกหนึ่งครั้งเพื่อไม่ให้เวลาตอบต่างกันมาก

create or replace function public.login_email(login_name text, login_password text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_hits integer;
  v_name text := lower(btrim(coalesce(login_name, '')));
begin
  if v_name = '' or coalesce(login_password, '') = '' then
    return null;
  end if;

  -- เพดานการเดา: 20 ครั้ง / 15 นาที ต่อชื่อผู้ใช้ (ใช้ตารางเดียวกับหน้า login)
  insert into login_attempts(key, hits, expires)
  values ('lookup:' || left(v_name, 80), 1, now() + interval '15 minutes')
  on conflict (key) do update set
    hits = case when login_attempts.expires < now() then 1 else login_attempts.hits + 1 end,
    expires = case when login_attempts.expires < now() then now() + interval '15 minutes'
                   else login_attempts.expires end
  returning hits into v_hits;

  if v_hits > 20 then
    return null;
  end if;

  select u.email::text into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = v_name
    and u.encrypted_password is not null
    and u.encrypted_password = extensions.crypt(login_password, u.encrypted_password)
  limit 1;

  if v_email is null then
    -- ทำงานเท่ากันทั้งกรณี "ไม่มีผู้ใช้" และ "รหัสผ่านผิด" (ลด timing oracle)
    perform extensions.crypt(login_password, extensions.crypt('dummy', extensions.gen_salt('bf')));
  end if;

  return v_email;
end $$;

comment on function public.login_email(text, text) is
  'คืนอีเมลสำหรับเข้าสู่ระบบ เฉพาะเมื่อชื่อผู้ใช้และรหัสผ่านถูกต้อง (กันการไล่เก็บอีเมล)';

revoke all on function public.login_email(text, text) from public;
grant execute on function public.login_email(text, text) to anon, authenticated;

-- login_allow: กันการยัด key ยาวผิดปกติลงตาราง login_attempts
create or replace function public.login_allow(bucket_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if coalesce(btrim(bucket_key), '') = '' or length(bucket_key) > 120 then
    return false;
  end if;
  insert into login_attempts(key, hits, expires)
  values (bucket_key, 1, now() + interval '15 minutes')
  on conflict (key) do update set
    hits = case when login_attempts.expires < now() then 1 else login_attempts.hits + 1 end,
    expires = case when login_attempts.expires < now() then now() + interval '15 minutes'
                   else login_attempts.expires end
  returning hits into n;
  delete from login_attempts where expires < now() - interval '1 day';
  return n <= 15;
end $$;
