-- ระบบขอแก้ไขข้อมูลคลินิก/รพ. (หมอคนไหนก็ขอแก้ รพ. ไหนก็ได้ ไม่ต้องเป็นเจ้าของ)
-- Synced from live production DB (vvcdyhpukzubrdjwdkyz) on 2026-07-05.
-- clinics / clinic_specialties / specialty_types tables already existed before this
-- migration and are not redefined here.

create table if not exists public.clinic_edit_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  requester_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  proposed jsonb not null,
  status text not null default 'pending',
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.clinic_edit_requests enable row level security;

-- ใครก็ได้ (ที่ login แล้ว) ส่งคำขอแก้ไขคลินิกไหนก็ได้ในระบบ ไม่ผูกกับ ownership
create policy "insert own clinic edit" on public.clinic_edit_requests
  for insert to authenticated
  with check (requester_id = auth.uid());

-- เห็นคำขอของตัวเอง หรือถ้าเป็นแอดมิน/super_admin เห็นได้ทุกคำขอ
create policy "read own or admin clinic edit" on public.clinic_edit_requests
  for select to authenticated
  using (
    (requester_id = auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = any (array['admin', 'super_admin'])
    )
  );

-- ไม่มี policy update/delete ให้ client โดยตรง — การอนุมัติ/ปฏิเสธทำผ่าน
-- admin_decide_clinic_edit (SECURITY DEFINER) เท่านั้น

create or replace function public.admin_decide_clinic_edit(
  p_request_id uuid, p_decision text, p_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller uuid := auth.uid(); v_role text; v_req clinic_edit_requests; p jsonb;
  v_specialty_ids uuid[]; v_hours jsonb;
begin
  select role into v_role from profiles where id = v_caller;
  if v_role is null or v_role not in ('admin','super_admin') then raise exception 'not authorized'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;

  update clinic_edit_requests set status=p_decision, admin_note=p_note, reviewed_by=v_caller, reviewed_at=now()
    where id=p_request_id returning * into v_req;
  if not found then raise exception 'request not found'; end if;

  if p_decision = 'approved' then
    p := v_req.proposed;
    update clinics c set
      name           = case when jsonb_exists(p,'name')           then coalesce(nullif(p->>'name',''), c.name) else c.name end,
      name_en        = case when jsonb_exists(p,'name_en')        then nullif(p->>'name_en','')  else c.name_en end,
      type           = case when jsonb_exists(p,'type')           then coalesce(nullif(p->>'type',''), c.type) else c.type end,
      phone          = case when jsonb_exists(p,'phone')          then nullif(p->>'phone','')    else c.phone end,
      line_id        = case when jsonb_exists(p,'line_id')        then nullif(p->>'line_id','')  else c.line_id end,
      facebook       = case when jsonb_exists(p,'facebook')       then nullif(p->>'facebook','') else c.facebook end,
      website        = case when jsonb_exists(p,'website')        then nullif(p->>'website','')  else c.website end,
      address_detail = case when jsonb_exists(p,'address_detail') then nullif(p->>'address_detail','') else c.address_detail end,
      photo_url      = case when jsonb_exists(p,'photo_url')      then nullif(p->>'photo_url','') else c.photo_url end,
      is_24_hours    = case when jsonb_exists(p,'is_24_hours')    then (p->>'is_24_hours')::boolean else c.is_24_hours end,
      opening_hours  = case when jsonb_exists(p,'opening_hours')
                              then (case when p->'opening_hours' = 'null'::jsonb then null else p->'opening_hours' end)
                            else c.opening_hours end
    where c.id = v_req.clinic_id;

    if jsonb_exists(p, 'specialty_type_ids') then
      select array_agg(x::uuid) into v_specialty_ids from jsonb_array_elements_text(p->'specialty_type_ids') as x;
      select opening_hours into v_hours from clinics where id = v_req.clinic_id;
      delete from clinic_specialties where clinic_id = v_req.clinic_id;
      if v_specialty_ids is not null and array_length(v_specialty_ids, 1) > 0 then
        insert into clinic_specialties (clinic_id, specialty_type_id, opening_hours)
        select v_req.clinic_id, sid, v_hours from unnest(v_specialty_ids) as sid;
      end if;
    end if;
  end if;
end;
$function$;

-- แจ้งเตือน in-app แอดมินทุกครั้งที่คลินิกถูกส่งกลับเป็น pending (เจ้าของแก้ไขข้อมูลตัวเองแล้ว resubmit)
create or replace function public.notify_admins_clinic_resubmit()
returns trigger
language plpgsql
security definer
as $function$
begin
  if new.status = 'pending' and old.status is distinct from 'pending' then
    insert into notifications (user_id, title, body, link)
    select p.id, 'คลินิก/รพ. ส่งข้อมูลแก้ไขใหม่',
           coalesce(new.name, 'มีคลินิกส่งข้อมูลแก้ไขรอตรวจสอบ'), '/admin/dashboard'
    from profiles p where p.role in ('admin','super_admin');
  end if;
  return new;
end; $function$;

drop trigger if exists trg_notify_admins_clinic_resubmit on public.clinics;
create trigger trg_notify_admins_clinic_resubmit
  after update on public.clinics
  for each row execute function notify_admins_clinic_resubmit();

-- ช่องทางสมัคร (Google / email) ของหมอ ใช้โชว์ badge ในหน้า super_admin dashboard
alter table public.profiles add column if not exists provider text;
