-- ============================================================
-- FindTheVet — migration 2026-09-08
-- 1) ช่องทางติดต่อของหมอ + สวิตช์เปิด/ปิดรายช่องทาง
-- 2) ระบบแชทตรง 1:1 (หมอ ↔ เจ้าของ, หมอ ↔ หมอ)
-- 3) สถานะ "หมอพาร์ทไทม์" ที่หมอด้วยกันเท่านั้นที่เห็น
-- ============================================================

-- ------------------------------------------------------------
-- 1) ช่องทางติดต่อ
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists facebook_url text;

alter table public.vet_profiles
  add column if not exists show_line     boolean not null default false,
  add column if not exists show_facebook boolean not null default false,
  add column if not exists allow_chat    boolean not null default true;

comment on column public.vet_profiles.show_phone    is 'แสดงเบอร์โทรในโปรไฟล์สาธารณะ';
comment on column public.vet_profiles.show_line     is 'แสดง LINE ID ในโปรไฟล์สาธารณะ';
comment on column public.vet_profiles.show_facebook is 'แสดง Facebook ในโปรไฟล์สาธารณะ';
comment on column public.vet_profiles.allow_chat    is 'อนุญาตให้คนอื่นทักแชทในระบบ';


-- ------------------------------------------------------------
-- helper: ผู้ใช้ปัจจุบันเป็นสัตวแพทย์/แอดมินหรือไม่
-- ------------------------------------------------------------
create or replace function public.is_vet_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('vet', 'admin', 'super_admin')
  );
$$;


-- ------------------------------------------------------------
-- 2) ระบบแชทตรง 1:1
-- ------------------------------------------------------------
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  user_a          uuid not null references public.profiles(id) on delete cascade,
  user_b          uuid not null references public.profiles(id) on delete cascade,
  last_message    text,
  last_sender_id  uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz default now(),
  created_at      timestamptz default now(),
  -- เก็บคู่สนทนาแบบเรียง id เสมอ กันห้องซ้ำ (a↔b กับ b↔a คือห้องเดียวกัน)
  constraint conversations_pair_order check (user_a < user_b),
  constraint conversations_pair_unique unique (user_a, user_b)
);

create index if not exists conversations_user_a_idx on public.conversations (user_a, last_message_at desc);
create index if not exists conversations_user_b_idx on public.conversations (user_b, last_message_at desc);

create table if not exists public.direct_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  content         text not null,
  read_at         timestamptz,
  created_at      timestamptz default now()
);

create index if not exists direct_messages_convo_idx  on public.direct_messages (conversation_id, created_at);
create index if not exists direct_messages_unread_idx on public.direct_messages (conversation_id, sender_id) where read_at is null;

alter table public.conversations   enable row level security;
alter table public.direct_messages enable row level security;

-- เห็นเฉพาะห้องที่ตัวเองอยู่
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations for select to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations for update to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b)
  with check (auth.uid() = user_a or auth.uid() = user_b);

-- อ่านข้อความเฉพาะห้องที่ตัวเองอยู่
drop policy if exists direct_messages_select on public.direct_messages;
create policy direct_messages_select on public.direct_messages for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  ));

-- ส่งได้เฉพาะในนามตัวเอง และเฉพาะห้องที่ตัวเองอยู่
drop policy if exists direct_messages_insert on public.direct_messages;
create policy direct_messages_insert on public.direct_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

-- อัปเดตได้เฉพาะการ mark ว่าอ่านแล้ว (ของฝั่งตรงข้าม)
drop policy if exists direct_messages_update on public.direct_messages;
create policy direct_messages_update on public.direct_messages for update to authenticated
  using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

-- เปิด/หาห้องแชทกับอีกคน — เช็ค allow_chat ของหมอฝั่งปลายทางให้ด้วย
create or replace function public.get_or_create_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  lo       uuid;
  hi       uuid;
  convo_id uuid;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if other_user_id is null or other_user_id = me then
    raise exception 'invalid target user';
  end if;
  if not exists (select 1 from public.profiles where id = other_user_id) then
    raise exception 'user not found';
  end if;

  -- หมอที่ปิดรับแชทไว้ ทักไม่ได้ (ยกเว้นเขาทักมาก่อนแล้ว = มีห้องอยู่แล้ว)
  if exists (
    select 1 from public.vet_profiles
    where user_id = other_user_id and allow_chat = false
  ) and not exists (
    select 1 from public.conversations
    where (user_a = least(me, other_user_id) and user_b = greatest(me, other_user_id))
  ) then
    raise exception 'user does not accept chat';
  end if;

  lo := least(me, other_user_id);
  hi := greatest(me, other_user_id);

  select id into convo_id from public.conversations where user_a = lo and user_b = hi;
  if convo_id is null then
    insert into public.conversations (user_a, user_b) values (lo, hi) returning id into convo_id;
  end if;

  return convo_id;
end;
$$;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- อัปเดตข้อความล่าสุดของห้องอัตโนมัติ เอาไว้โชว์ในหน้ากล่องข้อความ
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set last_message    = left(new.content, 200),
         last_sender_id  = new.sender_id,
         last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists direct_messages_touch_convo on public.direct_messages;
create trigger direct_messages_touch_convo
  after insert on public.direct_messages
  for each row execute function public.touch_conversation();

-- แชทแบบ live
alter publication supabase_realtime add table public.direct_messages;


-- ------------------------------------------------------------
-- 3) หมอพาร์ทไทม์ / รับงานนอก — เห็นเฉพาะในหมู่หมอกันเอง
--    แยกตารางออกมาต่างหาก เพราะ vet_profiles ให้ทุกคนที่ล็อกอินอ่านได้
-- ------------------------------------------------------------
create table if not exists public.vet_part_time (
  vet_id      uuid primary key references public.profiles(id) on delete cascade,
  is_open     boolean not null default false,
  urgent_ok   boolean not null default false,
  job_types   text[]  not null default '{}',
  provinces   text[]  not null default '{}',
  note        text,
  rate_note   text,
  updated_at  timestamptz default now()
);

comment on table public.vet_part_time is 'สถานะรับงานพาร์ทไทม์ของหมอ — อ่านได้เฉพาะ role vet/admin';

alter table public.vet_part_time enable row level security;

-- หมอ/แอดมินเท่านั้นที่เห็นบอร์ดนี้
drop policy if exists vet_part_time_select on public.vet_part_time;
create policy vet_part_time_select on public.vet_part_time for select to authenticated
  using (public.is_vet_user());

-- แก้ได้เฉพาะแถวของตัวเอง
drop policy if exists vet_part_time_write on public.vet_part_time;
create policy vet_part_time_write on public.vet_part_time for all to authenticated
  using (vet_id = auth.uid())
  with check (vet_id = auth.uid() and public.is_vet_user());
