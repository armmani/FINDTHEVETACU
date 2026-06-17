-- messages table สำหรับ chat ระหว่างเจ้าของและหมอ
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references public.bookings(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

-- เจ้าของและหมอที่เกี่ยวข้องกับ booking เท่านั้นที่ดูข้อความได้
create policy "messages_select" on public.messages for select
  using (
    exists (
      select 1 from public.bookings b
      join public.appointments a on a.id = b.appointment_id
      where b.id = booking_id
        and (b.vet_id = auth.uid() or a.owner_id = auth.uid())
    )
  );

-- ส่งข้อความได้เฉพาะ booking ที่ confirmed แล้ว
create policy "messages_insert" on public.messages for insert
  with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.bookings b
      join public.appointments a on a.id = b.appointment_id
      where b.id = booking_id
        and (b.vet_id = auth.uid() or a.owner_id = auth.uid())
        and b.status = 'confirmed'
    )
  );

-- เปิด Realtime สำหรับ messages (แชทแบบ live)
alter publication supabase_realtime add table public.messages;
