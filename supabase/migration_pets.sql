-- Migration: เพิ่มตาราง pets และอัปเดต appointments
-- รันใน Supabase SQL Editor

-- 1. ตาราง pets (โปรไฟล์สัตว์เลี้ยง)
create table if not exists public.pets (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  type text not null,
  age text not null,
  note text,                        -- ข้อมูลเพิ่มเติม เช่น โรคประจำตัว
  created_at timestamptz default now()
);

alter table public.pets enable row level security;

create policy "pets_select_owner" on public.pets for select using (auth.uid() = owner_id);
create policy "pets_select_vet" on public.pets for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'vet')
);
create policy "pets_insert" on public.pets for insert with check (auth.uid() = owner_id);
create policy "pets_update" on public.pets for update using (auth.uid() = owner_id);
create policy "pets_delete" on public.pets for delete using (auth.uid() = owner_id);

-- 2. เพิ่ม columns ใน appointments
alter table public.appointments
  add column if not exists pet_id uuid references public.pets(id) on delete set null,
  add column if not exists had_acupuncture_before boolean not null default false,
  add column if not exists session_number int not null default 1;

-- อัปเดต age ให้บังคับ (ถ้ายังไม่ได้ทำ)
-- (ข้อมูลเก่าที่ไม่มี age จะยังอยู่ได้ เพราะเราจัดการใน app แทน)
