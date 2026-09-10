-- FindTheVet 2026-09-10 — ให้หมอซ่อนโปรไฟล์จากหน้าค้นหาชั่วคราวได้ (ไม่ลบข้อมูล)
alter table public.vet_profiles
  add column if not exists is_hidden boolean not null default false;

comment on column public.vet_profiles.is_hidden is
  'true = ซ่อนโปรไฟล์จากหน้าค้นหาหมอสาธารณะชั่วคราว (ข้อมูลยังอยู่ครบ)';
