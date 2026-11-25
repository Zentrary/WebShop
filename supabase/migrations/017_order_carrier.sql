-- 017_order_carrier.sql
-- เก็บ "ขนส่ง" ของแต่ละคำสั่งซื้อ เพื่อให้หน้าแอดมิน/หน้าลูกค้า
-- เปิดลิงก์หน้าตรวจสอบพัสดุของขนส่งนั้นได้ทันที (ฟรี ไม่ต้องใช้ API)
--
-- * orders.carrier = thailand_post | kex | flash | jt | spx | other (null = ยังไม่ระบุ)
-- * transition_order(...) รับ p_carrier เพิ่ม และแก้เลขพัสดุของออเดอร์ที่จัดส่งแล้วได้
--   (เดิมแก้ไม่ได้ ทำให้พิมพ์เลขผิดแล้วต้องปล่อยไว้)

alter table public.orders
  add column if not exists carrier text;

alter table public.orders
  drop constraint if exists orders_carrier_check;
alter table public.orders
  add constraint orders_carrier_check
  check (carrier is null or carrier in ('thailand_post', 'kex', 'flash', 'jt', 'spx', 'other'));

-- เปลี่ยนลายเซ็น (เพิ่ม p_carrier) ต้องทิ้งของเดิมก่อน ไม่ให้เหลือ overload ค้าง
drop function if exists public.transition_order(uuid, text, text);

create or replace function public.transition_order(
  order_id uuid,
  next_status text,
  tracking_number text default null,
  p_carrier text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o orders;
  item jsonb;
  new_tracking text := nullif(btrim(coalesce(tracking_number, '')), '');
begin
  select * into o from orders where id = order_id for update;
  if not found or auth.uid() is null or not (is_admin() or o.user_id = auth.uid()) then
    raise exception 'ไม่มีสิทธิ์';
  end if;

  if p_carrier is not null and p_carrier not in ('thailand_post', 'kex', 'flash', 'jt', 'spx', 'other') then
    raise exception 'ขนส่งไม่ถูกต้อง';
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
  elsif is_admin() and next_status = 'shipped' and o.status = 'paid'
        and length(coalesce(new_tracking, '')) between 1 and 100 then
    null;
  -- จัดส่งแล้วแต่แก้เลขพัสดุ/ขนส่งที่พิมพ์ผิด (ไม่เปลี่ยนสถานะ)
  elsif is_admin() and next_status = 'shipped' and o.status = 'shipped'
        and length(coalesce(new_tracking, o.tracking)) between 1 and 100 then
    null;
  elsif next_status = 'delivered' and o.status = 'shipped' and o.user_id = auth.uid() then
    null;
  else
    raise exception 'ไม่สามารถเปลี่ยนสถานะนี้ได้';
  end if;

  update orders
  set status = next_status,
      tracking = case when next_status = 'shipped' then coalesce(new_tracking, tracking) else tracking end,
      carrier = case when next_status = 'shipped' then coalesce(p_carrier, carrier) else carrier end,
      paid_at = case when next_status = 'paid' then now() else paid_at end,
      shipped_at = case when next_status = 'shipped' then coalesce(shipped_at, now()) else shipped_at end,
      delivered_at = case when next_status = 'delivered' then now() else delivered_at end
  where id = order_id;
end $function$;

revoke all on function public.transition_order(uuid, text, text, text) from public;
grant execute on function public.transition_order(uuid, text, text, text) to authenticated;
