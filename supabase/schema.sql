-- ============================================================
-- VetAcupuncture Schema
-- รันใน Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- โปรไฟล์ผู้ใช้ (ทั้งเจ้าของสัตว์และหมอ)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role text not null check (role in ('owner', 'vet')),
  full_name text not null,
  phone text,
  avatar_url text,
  created_at timestamptz default now()
);

-- โปรไฟล์หมอ (ข้อมูลเพิ่มเติมสำหรับ role = 'vet')
create table public.vet_profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade unique not null,
  bio text,
  license_number text,                      -- เลขใบอนุญาต
  acupuncture_fee numeric(10,2) not null default 0,  -- ค่าฝังเข็ม (บาท)
  travel_rate numeric(10,2) not null default 5,      -- ค่าเดินทาง บาท/กม.
  location_lat double precision,
  location_lng double precision,
  location_name text,                       -- ชื่อที่ตั้ง เช่น "ลาดพร้าว กรุงเทพฯ"
  is_available boolean default true,        -- พร้อมรับงาน
  updated_at timestamptz default now()
);

-- คำขอนัดหมาย (สร้างโดยเจ้าของ)
create table public.appointments (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  pet_name text not null,
  pet_type text not null,                   -- สุนัข, แมว, กระต่าย ฯลฯ
  pet_age text,
  symptoms text not null,                   -- อาการ/เหตุผลที่ต้องการฝังเข็ม
  preferred_datetime timestamptz not null,  -- เวลาที่ต้องการ
  location_lat double precision not null,
  location_lng double precision not null,
  location_address text not null,
  status text not null default 'open'
    check (status in ('open', 'accepted', 'completed', 'cancelled')),
  created_at timestamptz default now()
);

-- การจองที่หมอตอบรับ
create table public.bookings (
  id uuid default uuid_generate_v4() primary key,
  appointment_id uuid references public.appointments(id) on delete cascade unique not null,
  vet_id uuid references public.profiles(id) on delete cascade not null,
  acupuncture_fee numeric(10,2) not null,
  travel_fee numeric(10,2) not null,
  distance_km numeric(10,2) not null,
  total_fee numeric(10,2) not null,
  deposit_amount numeric(10,2) not null,    -- 50% ของ total_fee
  deposit_paid boolean default false,
  deposit_paid_at timestamptz,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.vet_profiles enable row level security;
alter table public.appointments enable row level security;
alter table public.bookings enable row level security;

-- profiles: อ่านได้ทุกคน, แก้ไขได้เฉพาะตัวเอง
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- vet_profiles: อ่านได้ทุกคน, แก้ไขได้เฉพาะเจ้าของ
create policy "vet_profiles_select" on public.vet_profiles for select using (true);
create policy "vet_profiles_insert" on public.vet_profiles for insert
  with check (auth.uid() = user_id);
create policy "vet_profiles_update" on public.vet_profiles for update
  using (auth.uid() = user_id);

-- appointments: เจ้าของสร้าง/ดูของตัวเอง, หมอดูได้ทั้งหมดที่ open
create policy "appointments_select_owner" on public.appointments for select
  using (auth.uid() = owner_id);
create policy "appointments_select_vet" on public.appointments for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'vet'
    )
  );
create policy "appointments_insert" on public.appointments for insert
  with check (auth.uid() = owner_id);
create policy "appointments_update_owner" on public.appointments for update
  using (auth.uid() = owner_id);
create policy "appointments_update_vet" on public.appointments for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'vet'
    )
  );

-- bookings: หมอสร้าง, เจ้าของและหมอที่เกี่ยวข้องดูได้
create policy "bookings_select" on public.bookings for select
  using (
    auth.uid() = vet_id or
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.owner_id = auth.uid()
    )
  );
create policy "bookings_insert" on public.bookings for insert
  with check (
    auth.uid() = vet_id and
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'vet')
  );
create policy "bookings_update" on public.bookings for update
  using (
    auth.uid() = vet_id or
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.owner_id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

-- อัปเดต updated_at อัตโนมัติ
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger vet_profiles_updated_at
  before update on public.vet_profiles
  for each row execute procedure public.handle_updated_at();

-- สร้าง profile อัตโนมัติหลัง sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'owner'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
