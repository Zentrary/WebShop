-- 006: RPC กู้คืนข้อมูลจากไฟล์สำรอง (restore_admin_backup)
-- ใช้ร่วมกับ RPC get_admin_backup (รูปแบบ zenmarket-data-v1) ที่หน้าแอดมินดาวน์โหลดและเข้ารหัสไว้
-- เฉพาะเจ้าของร้าน (is_admin) เท่านั้นที่เรียกได้
--
-- หมายเหตุ (แก้บั๊กจริงที่พบตอนทดสอบ round-trip):
--   1. products.image_urls / order_shipping_updates.image_paths เป็น text[]
--      → ต้องแปลงจาก jsonb ด้วย array(select jsonb_array_elements_text(...)) ไม่ใช่ coalesce(...,'[]'::jsonb)
--   2. orders.request_id เป็น uuid → ต้อง cast ชัดเจน
--   3. orders.payment_due_at เป็น NOT NULL → ต้องมี fallback
--   4. products.sku / profiles.username เป็น UNIQUE → ต้องปลดล็อกค่าของแถวอื่นที่ชนกันก่อน
--   5. product_reviews(order_id, product_id) และ orders(user_id, request_id) เป็น UNIQUE
--      → ลบแถวที่ชนกันแต่ id ต่างกันก่อน insert

create or replace function public.restore_admin_backup(p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  n_products integer := 0;
  n_categories integer := 0;
  n_settings integer := 0;
  n_reviews integer := 0;
  n_addresses integer := 0;
  n_updates integer := 0;
  n_orders integer := 0;
  n_profiles integer := 0;
  row jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'สิทธิ์เฉพาะเจ้าของร้านเท่านั้น';
  end if;

  if p_backup is null then
    raise exception 'ไม่พบข้อมูลสำรอง';
  end if;
  if coalesce(p_backup->>'format','') <> 'zenmarket-data-v1' then
    raise exception 'รูปแบบไฟล์สำรองไม่ถูกต้อง';
  end if;

  -- หมวดหมู่
  for row in select * from jsonb_array_elements(coalesce(p_backup->'tables'->'categories','[]'::jsonb)) loop
    insert into public.categories(name, created_at)
    values (row->>'name', coalesce((row->>'created_at')::timestamptz, now()))
    on conflict (name) do update set created_at = excluded.created_at;
  end loop;
  select count(*) into n_categories from jsonb_array_elements(coalesce(p_backup->'tables'->'categories','[]'::jsonb));

  -- ปลดล็อก SKU ของสินค้าอื่นที่ชนกับ SKU ในไฟล์สำรอง (products.sku UNIQUE)
  update public.products p
     set sku = null
   where exists (
     select 1
       from jsonb_array_elements(coalesce(p_backup->'tables'->'products','[]'::jsonb)) b
      where b->>'sku' is not null
        and b->>'sku' <> ''
        and p.sku = b->>'sku'
        and p.id::text <> b->>'id'
   );

  -- ปลดล็อก username ของโปรไฟล์อื่นที่ชนกับไฟล์สำรอง (profiles.username UNIQUE)
  update public.profiles p
     set username = null
   where exists (
     select 1
       from jsonb_array_elements(coalesce(p_backup->'tables'->'profiles','[]'::jsonb)) b
      where b->>'username' is not null
        and b->>'username' <> ''
        and p.username = b->>'username'
        and p.id::text <> b->>'id'
   );

  -- ลบรีวิวที่ (order_id, product_id) ซ้ำกับไฟล์สำรองแต่ id ต่างกัน
  delete from public.product_reviews r
   where exists (
     select 1
       from jsonb_array_elements(coalesce(p_backup->'tables'->'product_reviews','[]'::jsonb)) b
      where (b->>'order_id')::uuid = r.order_id
        and (b->>'product_id')::uuid = r.product_id
        and (b->>'id')::uuid <> r.id
   );

  -- ลบคำสั่งซื้อที่ (user_id, request_id) ซ้ำกับไฟล์สำรองแต่ id ต่างกัน
  delete from public.orders o
   where exists (
     select 1
       from jsonb_array_elements(coalesce(p_backup->'tables'->'orders','[]'::jsonb)) b
      where (b->>'user_id')::uuid = o.user_id
        and (b->>'request_id')::uuid = o.request_id
        and (b->>'id')::uuid <> o.id
   );

  -- สินค้า
  for row in select * from jsonb_array_elements(coalesce(p_backup->'tables'->'products','[]'::jsonb)) loop
    insert into public.products(id, name, sku, category, description, price, image_url, stock, active, created_at, image_urls)
    values (
      (row->>'id')::uuid,
      row->>'name',
      nullif(row->>'sku',''),
      row->>'category',
      row->>'description',
      coalesce((row->>'price')::numeric,0),
      row->>'image_url',
      coalesce((row->>'stock')::integer,0),
      coalesce((row->>'active')::boolean,true),
      coalesce((row->>'created_at')::timestamptz, now()),
      case
        when jsonb_typeof(row->'image_urls') = 'array'
          then array(select jsonb_array_elements_text(row->'image_urls'))
        else '{}'::text[]
      end
    )
    on conflict (id) do update set
      name = excluded.name,
      sku = excluded.sku,
      category = excluded.category,
      description = excluded.description,
      price = excluded.price,
      image_url = excluded.image_url,
      stock = excluded.stock,
      active = excluded.active,
      image_urls = excluded.image_urls;
  end loop;
  select count(*) into n_products from jsonb_array_elements(coalesce(p_backup->'tables'->'products','[]'::jsonb));

  -- ข้อมูลร้าน (singleton)
  for row in select * from jsonb_array_elements(coalesce(p_backup->'tables'->'store_settings','[]'::jsonb)) loop
    update public.store_settings set
      promptpay_id = row->>'promptpay_id',
      recipient_name = row->>'recipient_name',
      shop_name = row->>'shop_name',
      tagline = row->>'tagline',
      logo_url = row->>'logo_url',
      contact_email = row->>'contact_email',
      contact_phone = row->>'contact_phone',
      contact_address = row->>'contact_address',
      about_text = row->>'about_text',
      shipping_note = row->>'shipping_note',
      shipping_fee = coalesce((row->>'shipping_fee')::numeric, shipping_fee),
      free_shipping_threshold = coalesce((row->>'free_shipping_threshold')::numeric, free_shipping_threshold),
      facebook_url = row->>'facebook_url',
      instagram_url = row->>'instagram_url',
      line_url = row->>'line_url'
    where singleton;
  end loop;
  select count(*) into n_settings from jsonb_array_elements(coalesce(p_backup->'tables'->'store_settings','[]'::jsonb));

  -- โปรไฟล์
  for row in select * from jsonb_array_elements(coalesce(p_backup->'tables'->'profiles','[]'::jsonb)) loop
    insert into public.profiles(id, first_name, last_name, nickname, phone, age, username, created_at)
    values (
      (row->>'id')::uuid,
      nullif(row->>'first_name',''),
      nullif(row->>'last_name',''),
      nullif(row->>'nickname',''),
      nullif(row->>'phone',''),
      nullif(row->>'age','')::integer,
      nullif(row->>'username',''),
      coalesce((row->>'created_at')::timestamptz, now())
    )
    on conflict (id) do update set
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      nickname = excluded.nickname,
      phone = excluded.phone,
      age = excluded.age,
      username = excluded.username;
  end loop;
  select count(*) into n_profiles from jsonb_array_elements(coalesce(p_backup->'tables'->'profiles','[]'::jsonb));

  -- ที่อยู่ลูกค้า
  for row in select * from jsonb_array_elements(coalesce(p_backup->'tables'->'customer_addresses','[]'::jsonb)) loop
    insert into public.customer_addresses(id, user_id, label, recipient, phone, address, is_default, created_at)
    values (
      (row->>'id')::uuid,
      (row->>'user_id')::uuid,
      row->>'label',
      row->>'recipient',
      row->>'phone',
      row->>'address',
      coalesce((row->>'is_default')::boolean,false),
      coalesce((row->>'created_at')::timestamptz, now())
    )
    on conflict (id) do update set
      label = excluded.label,
      recipient = excluded.recipient,
      phone = excluded.phone,
      address = excluded.address,
      is_default = excluded.is_default;
  end loop;
  select count(*) into n_addresses from jsonb_array_elements(coalesce(p_backup->'tables'->'customer_addresses','[]'::jsonb));

  -- คำสั่งซื้อ
  for row in select * from jsonb_array_elements(coalesce(p_backup->'tables'->'orders','[]'::jsonb)) loop
    insert into public.orders(
      id, user_id, items, subtotal, shipping, total, address, recipient, phone,
      promptpay_id, recipient_name, status, slip_path, tracking, request_id, created_at,
      paid_at, shipped_at, delivered_at, payment_due_at, expired_at)
    values (
      (row->>'id')::uuid,
      (row->>'user_id')::uuid,
      coalesce(row->'items','[]'::jsonb),
      coalesce((row->>'subtotal')::numeric,0),
      coalesce((row->>'shipping')::numeric,0),
      coalesce((row->>'total')::numeric,0),
      row->>'address',
      row->>'recipient',
      row->>'phone',
      row->>'promptpay_id',
      row->>'recipient_name',
      coalesce(row->>'status','pending'),
      row->>'slip_path',
      row->>'tracking',
      (row->>'request_id')::uuid,
      coalesce((row->>'created_at')::timestamptz, now()),
      nullif(row->>'paid_at','')::timestamptz,
      nullif(row->>'shipped_at','')::timestamptz,
      nullif(row->>'delivered_at','')::timestamptz,
      coalesce(nullif(row->>'payment_due_at','')::timestamptz, now()),
      nullif(row->>'expired_at','')::timestamptz
    )
    on conflict (id) do update set
      items = excluded.items,
      subtotal = excluded.subtotal,
      shipping = excluded.shipping,
      total = excluded.total,
      address = excluded.address,
      recipient = excluded.recipient,
      phone = excluded.phone,
      status = excluded.status,
      slip_path = excluded.slip_path,
      tracking = excluded.tracking;
  end loop;
  select count(*) into n_orders from jsonb_array_elements(coalesce(p_backup->'tables'->'orders','[]'::jsonb));

  -- รีวิว
  for row in select * from jsonb_array_elements(coalesce(p_backup->'tables'->'product_reviews','[]'::jsonb)) loop
    insert into public.product_reviews(id, order_id, product_id, reviewer_name, product_name, rating, comment, created_at, updated_at)
    values (
      (row->>'id')::uuid,
      (row->>'order_id')::uuid,
      (row->>'product_id')::uuid,
      row->>'reviewer_name',
      row->>'product_name',
      coalesce((row->>'rating')::integer,5),
      row->>'comment',
      coalesce((row->>'created_at')::timestamptz, now()),
      coalesce((row->>'updated_at')::timestamptz, now())
    )
    on conflict (id) do update set
      reviewer_name = excluded.reviewer_name,
      product_name = excluded.product_name,
      rating = excluded.rating,
      comment = excluded.comment,
      updated_at = excluded.updated_at;
  end loop;
  select count(*) into n_reviews from jsonb_array_elements(coalesce(p_backup->'tables'->'product_reviews','[]'::jsonb));

  -- อัปเดตการจัดส่ง
  for row in select * from jsonb_array_elements(coalesce(p_backup->'tables'->'order_shipping_updates','[]'::jsonb)) loop
    insert into public.order_shipping_updates(id, order_id, message, image_paths, created_at)
    values (
      (row->>'id')::uuid,
      (row->>'order_id')::uuid,
      row->>'message',
      case
        when jsonb_typeof(row->'image_paths') = 'array'
          then array(select jsonb_array_elements_text(row->'image_paths'))
        else '{}'::text[]
      end,
      coalesce((row->>'created_at')::timestamptz, now())
    )
    on conflict (id) do update set
      message = excluded.message,
      image_paths = excluded.image_paths;
  end loop;
  select count(*) into n_updates from jsonb_array_elements(coalesce(p_backup->'tables'->'order_shipping_updates','[]'::jsonb));

  return jsonb_build_object(
    'products', n_products,
    'categories', n_categories,
    'store_settings', n_settings,
    'profiles', n_profiles,
    'customer_addresses', n_addresses,
    'orders', n_orders,
    'product_reviews', n_reviews,
    'order_shipping_updates', n_updates
  );
end
$function$;

grant execute on function public.restore_admin_backup(jsonb) to authenticated;
