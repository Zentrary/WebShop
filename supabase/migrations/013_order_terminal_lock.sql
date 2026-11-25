-- คำสั่งซื้อที่ปิดแล้ว (ส่งถึงมือแล้ว / ยกเลิกแล้ว) ต้องแก้ไม่ได้อีก
-- ฟังก์ชันเดิมถูกสร้างผ่าน dashboard จึงบันทึกเวอร์ชันที่บังคับใช้จริงไว้ที่นี่

create or replace function public.transition_order(order_id uuid, next_status text, tracking_number text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o orders;
  item jsonb;
begin
  select * into o from orders where id = order_id for update;
  if not found or auth.uid() is null or not (is_admin() or o.user_id = auth.uid()) then
    raise exception 'ไม่มีสิทธิ์';
  end if;

  if o.status in ('delivered', 'cancelled') then
    raise exception 'คำสั่งซื้อนี้ปิดแล้ว ไม่สามารถเปลี่ยนสถานะได้';
  end if;

  if next_status = 'cancelled' and (o.status = 'pending' or (is_admin() and o.status = 'review')) then
    for item in select value from jsonb_array_elements(o.items) order by value ->> 'id' loop
      update products set stock = stock + (item ->> 'quantity')::integer where id = (item ->> 'id')::uuid;
    end loop;
  elsif is_admin() and next_status = 'paid' and o.status = 'review' then
    null;
  elsif is_admin() and next_status = 'shipped' and o.status = 'paid' and length(trim(tracking_number)) between 1 and 100 then
    null;
  elsif next_status = 'delivered' and o.status = 'shipped' and o.user_id = auth.uid() then
    null;
  else
    raise exception 'ไม่สามารถเปลี่ยนสถานะนี้ได้';
  end if;

  update orders
  set status = next_status,
      tracking = case when next_status = 'shipped' then trim(tracking_number) else tracking end,
      paid_at = case when next_status = 'paid' then now() else paid_at end,
      shipped_at = case when next_status = 'shipped' then now() else shipped_at end,
      delivered_at = case when next_status = 'delivered' then now() else delivered_at end
  where id = order_id;
end $function$;

create or replace function public.add_shipping_update(p_order_id uuid, p_message text, p_images text[])
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o orders;
  path text;
  images text[] = coalesce(p_images, '{}');
  result uuid;
  body text = btrim(coalesce(p_message, ''));
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'สำหรับเจ้าของร้านเท่านั้น';
  end if;

  select * into o from orders where id = p_order_id for update;
  if not found or o.status not in ('paid', 'shipped') then
    raise exception 'เพิ่มอัปเดตได้เฉพาะคำสั่งซื้อที่ยังอยู่ระหว่างการจัดส่ง';
  end if;

  if cardinality(images) > 4 or array_position(images, null) is not null or length(coalesce(p_message, '')) > 1000 or (body = '' and cardinality(images) = 0) then
    raise exception 'ระบุข้อความ หรือแนบรูปไม่เกิน 4 รูป พร้อมข้อความไม่เกิน 1,000 ตัวอักษร';
  end if;

  foreach path in array images loop
    if path !~ ('^' || o.id::text || '/[0-9a-f-]{36}\.(jpeg|png|webp)$') or not exists (select 1 from storage.objects where bucket_id = 'shipping-updates' and name = path) then
      raise exception 'ไม่พบรูปของคำสั่งซื้อนี้ หรือรูปไม่ถูกต้อง';
    end if;
  end loop;

  insert into order_shipping_updates (order_id, message, image_paths)
  values (o.id, coalesce(nullif(body, ''), 'อัปเดตการจัดส่งจากร้าน'), images)
  returning id into result;

  return result;
end $function$;
