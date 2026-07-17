-- ระบบขอเชื่อมโรงพยาบาล/คลินิก (สัตวแพทย์เจ้าของจริงขอรับเป็นเจ้าของคลินิกที่ import มา)
-- คล้าย pet_ownership_requests (migration_pets.sql) — clinics ที่ import มาจะไม่มี owner_vet_id
-- จนกว่าเจ้าของจริงจะสมัครและขอเชื่อม แล้วแอดมินตรวจสอบ/อนุมัติ

alter table public.clinics alter column owner_vet_id drop not null;

create table if not exists public.clinic_ownership_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  requester_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  proof_url text,
  status text not null default 'pending',
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.clinic_ownership_requests enable row level security;

create policy "insert own clinic claim" on public.clinic_ownership_requests
  for insert to authenticated with check (requester_id = auth.uid());

create policy "read own or admin clinic claim" on public.clinic_ownership_requests
  for select to authenticated using (
    requester_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin']))
  );

-- ไม่มี policy update/delete ให้ client โดยตรง — อนุมัติ/ปฏิเสธผ่าน admin_decide_clinic_claim (SECURITY DEFINER) เท่านั้น

create or replace function public.admin_decide_clinic_claim(
  p_request_id uuid, p_decision text, p_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller uuid := auth.uid(); v_role text; v_req clinic_ownership_requests; v_owner uuid;
begin
  select role into v_role from profiles where id = v_caller;
  if v_role is null or v_role not in ('admin','super_admin') then raise exception 'not authorized'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;

  update clinic_ownership_requests set status=p_decision, admin_note=p_note, reviewed_by=v_caller, reviewed_at=now()
    where id=p_request_id returning * into v_req;
  if not found then raise exception 'request not found'; end if;

  if p_decision = 'approved' then
    select owner_vet_id into v_owner from clinics where id = v_req.clinic_id;
    if v_owner is not null then raise exception 'clinic already claimed'; end if;
    update clinics set owner_vet_id = v_req.requester_id where id = v_req.clinic_id;
  end if;
end;
$function$;
