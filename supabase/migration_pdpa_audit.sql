-- ============================================================
-- FindTheVet — PDPA + audit log + security (2026-09-10)
-- ============================================================

-- ------------------------------------------------------------
-- 1) บันทึกหลักฐานการยินยอม PDPA (proof of consent)
-- ------------------------------------------------------------
create table if not exists public.consent_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete cascade,
  policy_version text not null default '2026-09-10',
  method       text,               -- 'email' | 'google'
  user_agent   text,
  created_at   timestamptz default now()
);
create index if not exists consent_logs_user_idx on public.consent_logs (user_id, created_at desc);

alter table public.consent_logs enable row level security;

-- ผู้ใช้เห็น consent ของตัวเอง / เพิ่มของตัวเองได้
drop policy if exists consent_logs_own on public.consent_logs;
create policy consent_logs_own on public.consent_logs for select to authenticated
  using (user_id = auth.uid());
drop policy if exists consent_logs_insert on public.consent_logs;
create policy consent_logs_insert on public.consent_logs for insert to authenticated
  with check (user_id = auth.uid());
-- แอดมินดูได้ทั้งหมด
drop policy if exists consent_logs_admin on public.consent_logs;
create policy consent_logs_admin on public.consent_logs for select to authenticated
  using (public.is_admin_user());


-- ------------------------------------------------------------
-- helper: ผู้ใช้ปัจจุบันเป็นแอดมินหรือไม่
-- ------------------------------------------------------------
create or replace function public.is_admin_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;


-- ------------------------------------------------------------
-- 2) คำขอลบบัญชี / ลบข้อมูล (สิทธิ์ตาม PDPA)
--    ไม่ลบทันที — สร้างคำขอให้แอดมินตรวจแล้วดำเนินการ
-- ------------------------------------------------------------
create table if not exists public.account_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  reason       text,
  status       text not null default 'pending'
                 check (status in ('pending', 'done', 'rejected', 'cancelled')),
  requested_at timestamptz default now(),
  handled_at   timestamptz,
  handled_by   uuid references public.profiles(id) on delete set null,
  constraint account_deletion_one_open unique (user_id, status)
);

alter table public.account_deletion_requests enable row level security;

drop policy if exists adr_own on public.account_deletion_requests;
create policy adr_own on public.account_deletion_requests for select to authenticated
  using (user_id = auth.uid());
drop policy if exists adr_insert on public.account_deletion_requests;
create policy adr_insert on public.account_deletion_requests for insert to authenticated
  with check (user_id = auth.uid());
-- ยกเลิกคำขอของตัวเองได้ (เปลี่ยน status เป็น cancelled)
drop policy if exists adr_cancel on public.account_deletion_requests;
create policy adr_cancel on public.account_deletion_requests for update to authenticated
  using (user_id = auth.uid());
-- แอดมินเห็น/จัดการได้ทั้งหมด
drop policy if exists adr_admin on public.account_deletion_requests;
create policy adr_admin on public.account_deletion_requests for all to authenticated
  using (public.is_admin_user()) with check (public.is_admin_user());


-- ------------------------------------------------------------
-- 3) Audit log — บันทึกการกระทำสำคัญ (ใครทำอะไรกับข้อมูลใคร)
--    เขียนผ่าน service role จาก API เท่านั้น อ่านได้เฉพาะแอดมิน
-- ------------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,               -- คนที่ทำ
  action      text not null,      -- เช่น 'clinic.approve', 'vet.reject', 'clinic.update'
  entity      text,               -- ตาราง/ประเภท เช่น 'clinics'
  entity_id   text,               -- id ของสิ่งที่ถูกกระทำ
  meta        jsonb,              -- รายละเอียดเพิ่มเติม
  created_at  timestamptz default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx  on public.audit_logs (entity, entity_id);

alter table public.audit_logs enable row level security;

-- อ่านได้เฉพาะแอดมิน; insert ทำผ่าน service role (bypass RLS) ไม่ต้องมี policy insert
drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using (public.is_admin_user());
