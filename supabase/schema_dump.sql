-- ============================================================================
-- FULL SCHEMA SNAPSHOT — pg_dump --schema-only of the production DB
-- (vvcdyhpukzubrdjwdkyz, ap-northeast-1), taken 2026-07-05.
--
-- This is a REFERENCE snapshot, not an incremental migration — do not run
-- this against the existing production DB (it will fail on `CREATE SCHEMA
-- public` / duplicate objects). Use it to see the true current state of
-- every table/function/trigger/policy, and to diff against when writing
-- new incremental migration files (like migration_clinic_edit_requests.sql).
--
-- Re-generate anytime with:
--   pg_dump "host=aws-1-ap-northeast-1.pooler.supabase.com port=5432 \
--     dbname=postgres user=postgres.vvcdyhpukzubrdjwdkyz sslmode=require" \
--     --schema=public --schema-only --no-owner --no-privileges
-- ============================================================================

--
-- PostgreSQL database dump
--

\restrict vv74223VkMppW5VQXKPeqCKpe7zRAO9iHxEwIQboKJMvcD37LXMAo8VPc4xImPK

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: accept_vet_link(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_vet_link(p_request_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_caller uuid := auth.uid(); v_req pet_ownership_requests;
begin
  select * into v_req from pet_ownership_requests where id=p_request_id;
  if not found then raise exception 'request not found'; end if;
  if v_req.target_owner_id is distinct from v_caller then raise exception 'not authorized'; end if;
  update pet_ownership_requests set status='approved' where id=p_request_id;
  update pets set owner_id=v_caller where id=v_req.pet_id;
end; $$;


--
-- Name: admin_decide_claim(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_decide_claim(p_request_id uuid, p_decision text, p_note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_caller uuid := auth.uid(); v_role text; v_req pet_ownership_requests;
begin
  select role into v_role from profiles where id = v_caller;
  if v_role is null or v_role not in ('admin','super_admin') then raise exception 'not authorized'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
  update pet_ownership_requests
     set status=p_decision, admin_note=p_note, reviewed_by=v_caller, reviewed_at=now()
   where id=p_request_id returning * into v_req;
  if not found then raise exception 'request not found'; end if;
  if p_decision='approved' then update pets set owner_id=v_req.requester_id where id=v_req.pet_id; end if;
end; $$;


--
-- Name: admin_decide_clinic_edit(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_decide_clinic_edit(p_request_id uuid, p_decision text, p_note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'owner'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: notify_admins_clinic_resubmit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_admins_clinic_resubmit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if new.status = 'pending' and old.status is distinct from 'pending' then
    insert into notifications (user_id, title, body, link)
    select p.id, 'คลินิก/รพ. ส่งข้อมูลแก้ไขใหม่',
           coalesce(new.name, 'มีคลินิกส่งข้อมูลแก้ไขรอตรวจสอบ'), '/admin/dashboard'
    from profiles p where p.role in ('admin','super_admin');
  end if;
  return new;
end; $$;


--
-- Name: notify_admins_new_claim(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_admins_new_claim() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare pet_name text;
begin
  if new.vet_initiator_id is null then
    select name into pet_name from pets where id = new.pet_id;
    insert into notifications (user_id, title, body, link)
    select p.id, 'คำขอเชื่อมสัตว์เลี้ยงใหม่',
           coalesce('สัตว์เลี้ยง: ' || pet_name, 'มีคำขอเชื่อมสัตว์เลี้ยงรอตรวจสอบ'),
           '/admin/ownership'
    from profiles p where p.role in ('admin', 'super_admin');
  end if;
  return new;
end;
$$;


--
-- Name: notify_admins_new_clinic_edit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_admins_new_clinic_edit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare v_clinic text;
begin
  select name into v_clinic from clinics where id = new.clinic_id;
  insert into notifications (user_id, title, body, link)
  select pr.id, 'คำขอแก้ข้อมูล รพ./คลินิก',
         coalesce('คลินิก: ' || v_clinic, 'มีคำขอแก้ข้อมูลรอตรวจสอบ'), '/admin/feedback'
  from profiles pr where pr.role in ('admin','super_admin');
  return new;
end; $$;


--
-- Name: notify_admins_new_feedback(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_admins_new_feedback() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into notifications (user_id, title, body, link)
  select p.id, 'Feedback ใหม่', left(new.message, 100), '/admin/feedback'
  from profiles p where p.role in ('admin', 'super_admin');
  return new;
end;
$$;


--
-- Name: search_unlinked_pets(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_unlinked_pets(q text) RETURNS TABLE(id uuid, name text, species text, breed text, gender text, neutered boolean, photo_url text, medical_tags text[], birthdate date, visits bigint, created_by_vet text, latest_clinic text, latest_date date)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    p.id, p.name, p.species, p.breed, p.gender, p.neutered, p.photo_url,
    p.medical_tags, p.birthdate,
    (select count(*) from opd_records o where o.pet_id = p.id),
    (select pr.full_name from opd_records o join profiles pr on pr.id = o.vet_id
       where o.pet_id = p.id order by o.record_date asc, o.created_at asc limit 1),
    (select c.name from opd_records o join clinics c on c.id = o.clinic_id
       where o.pet_id = p.id order by o.record_date desc, o.created_at desc limit 1),
    (select o.record_date from opd_records o
       where o.pet_id = p.id order by o.record_date desc, o.created_at desc limit 1)
  from pets p
  where p.owner_id is null and p.name ilike '%' || q || '%'
  order by p.name limit 10;
$$;


--
-- Name: sync_user_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_user_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: appointment_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    type text DEFAULT 'text'::text,
    proposed_datetime timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT appointment_messages_type_check CHECK ((type = ANY (ARRAY['text'::text, 'time_proposal'::text, 'time_accepted'::text, 'time_rejected'::text])))
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    pet_name text NOT NULL,
    pet_type text NOT NULL,
    pet_age text,
    symptoms text NOT NULL,
    preferred_datetime timestamp with time zone NOT NULL,
    location_lat double precision NOT NULL,
    location_lng double precision NOT NULL,
    location_address text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    pet_id uuid,
    had_acupuncture_before boolean DEFAULT false NOT NULL,
    session_number integer DEFAULT 1 NOT NULL,
    pet_photo_url text,
    preferred_vet_id uuid,
    proposed_datetime timestamp with time zone,
    CONSTRAINT appointments_status_check CHECK ((status = ANY (ARRAY['open'::text, 'accepted'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    appointment_id uuid NOT NULL,
    vet_id uuid NOT NULL,
    acupuncture_fee numeric(10,2) NOT NULL,
    travel_fee numeric(10,2) NOT NULL,
    distance_km numeric(10,2) NOT NULL,
    total_fee numeric(10,2) NOT NULL,
    deposit_amount numeric(10,2) NOT NULL,
    deposit_paid boolean DEFAULT false,
    deposit_paid_at timestamp with time zone,
    status text DEFAULT 'pending_payment'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    cancelled_by text,
    cancelled_at timestamp with time zone,
    platform_fee numeric(10,2) DEFAULT 0,
    vet_payout numeric(10,2),
    remaining_paid boolean DEFAULT false,
    remaining_paid_at timestamp with time zone,
    CONSTRAINT bookings_cancelled_by_check CHECK ((cancelled_by = ANY (ARRAY['owner'::text, 'vet'::text]))),
    CONSTRAINT bookings_status_check CHECK ((status = ANY (ARRAY['pending_payment'::text, 'confirmed'::text, 'awaiting_confirmation'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: clinic_edit_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_edit_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    requester_id uuid DEFAULT auth.uid() NOT NULL,
    proposed jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_note text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT clinic_edit_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: clinic_managers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_managers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid,
    vet_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: clinic_specialties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_specialties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid,
    opening_hours jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    specialty_type_id uuid
);


--
-- Name: clinics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    name_en text,
    type text DEFAULT 'clinic'::text NOT NULL,
    phone text,
    line_id text,
    facebook text,
    website text,
    province text NOT NULL,
    district text,
    sub_district text,
    address_detail text,
    opening_hours jsonb DEFAULT '{}'::jsonb,
    license_doc_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    reject_reason text,
    owner_vet_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    equipment text[] DEFAULT '{}'::text[] NOT NULL,
    location_name text,
    location_lat double precision,
    location_lng double precision,
    is_24_hours boolean DEFAULT false NOT NULL,
    photo_url text,
    CONSTRAINT clinics_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT clinics_type_check CHECK ((type = ANY (ARRAY['clinic'::text, 'hospital'::text])))
);


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    message text NOT NULL,
    image_url text,
    status text DEFAULT 'pending'::text,
    admin_note text,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    CONSTRAINT feedback_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'acknowledged'::text, 'resolved'::text])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    booking_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: opd_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opd_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pet_id uuid NOT NULL,
    vet_id uuid NOT NULL,
    clinic_id uuid,
    record_date date DEFAULT CURRENT_DATE NOT NULL,
    weight numeric(5,2),
    cc text,
    hx text,
    pe text,
    diff_dx text,
    dx text,
    tx text,
    rx text,
    ce text,
    next_appointment date,
    photo1_url text,
    photo1_caption text,
    photo2_url text,
    photo2_caption text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: pet_breeds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_breeds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    species text NOT NULL,
    name text NOT NULL,
    name_en text
);


--
-- Name: pet_medical_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_medical_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pet_id uuid NOT NULL,
    record_date date DEFAULT CURRENT_DATE NOT NULL,
    title text NOT NULL,
    description text,
    vet_name text,
    clinic_name text,
    created_at timestamp with time zone DEFAULT now(),
    next_appointment date
);


--
-- Name: pet_ownership_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_ownership_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pet_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    proof_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_note text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    vet_initiator_id uuid,
    target_owner_id uuid,
    CONSTRAINT pet_ownership_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: pet_parasite_controls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_parasite_controls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pet_id uuid NOT NULL,
    control_date date DEFAULT CURRENT_DATE NOT NULL,
    product_name text NOT NULL,
    next_due_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: pet_vaccines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_vaccines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pet_id uuid NOT NULL,
    vaccine_date date DEFAULT CURRENT_DATE NOT NULL,
    vaccine_name text NOT NULL,
    next_due_date date,
    clinic_name text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: pets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    name text NOT NULL,
    species text DEFAULT 'สุนัข'::text NOT NULL,
    breed text,
    gender text DEFAULT 'ไม่ระบุ'::text,
    birthdate date,
    photo_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    medical_tags text[] DEFAULT '{}'::text[],
    neutered boolean DEFAULT false
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    role text NOT NULL,
    full_name text NOT NULL,
    phone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    telegram_chat_id text,
    line_id text,
    address text,
    email text,
    provider text,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'vet'::text, 'admin'::text, 'super_admin'::text])))
);


--
-- Name: public_changelog; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_changelog AS
 SELECT id,
    admin_note AS summary,
    COALESCE(resolved_at, created_at) AS resolved_at
   FROM public.feedback
  WHERE ((status = 'resolved'::text) AND (admin_note IS NOT NULL) AND (length(TRIM(BOTH FROM admin_note)) > 0));


--
-- Name: specialty_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.specialty_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name_th text NOT NULL,
    name_en text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: vet_patient_discharges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vet_patient_discharges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vet_id uuid NOT NULL,
    pet_id uuid NOT NULL,
    reason text NOT NULL,
    note text,
    discharged_at timestamp with time zone DEFAULT now(),
    CONSTRAINT vet_patient_discharges_reason_check CHECK ((reason = ANY (ARRAY['recovered'::text, 'deceased'::text, 'lost_contact'::text])))
);


--
-- Name: vet_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vet_profiles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    bio text,
    license_number text,
    acupuncture_fee numeric(10,2) DEFAULT 0 NOT NULL,
    travel_rate numeric(10,2) DEFAULT 5 NOT NULL,
    location_lat double precision,
    location_lng double precision,
    location_name text,
    is_available boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now(),
    university text,
    graduation_year text,
    additional_education text[] DEFAULT '{}'::text[],
    is_verified boolean DEFAULT false,
    title text,
    full_name_en text,
    status text DEFAULT 'pending'::text NOT NULL,
    reject_reason text,
    license_doc_url text,
    show_phone boolean DEFAULT true NOT NULL,
    verified_by uuid,
    verified_at timestamp with time zone,
    CONSTRAINT vet_profiles_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: vet_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vet_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vet_id uuid,
    place_name text NOT NULL,
    sub_district text,
    district text,
    province text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    slots jsonb DEFAULT '[]'::jsonb,
    clinic_phone text,
    clinic_id uuid
);


--
-- Name: vet_specialties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vet_specialties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vet_id uuid,
    specialty_type_id uuid
);


--
-- Name: appointment_messages appointment_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_messages
    ADD CONSTRAINT appointment_messages_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_appointment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_appointment_id_key UNIQUE (appointment_id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: clinic_edit_requests clinic_edit_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_edit_requests
    ADD CONSTRAINT clinic_edit_requests_pkey PRIMARY KEY (id);


--
-- Name: clinic_managers clinic_managers_clinic_id_vet_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_managers
    ADD CONSTRAINT clinic_managers_clinic_id_vet_id_key UNIQUE (clinic_id, vet_id);


--
-- Name: clinic_managers clinic_managers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_managers
    ADD CONSTRAINT clinic_managers_pkey PRIMARY KEY (id);


--
-- Name: clinic_specialties clinic_specialties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_specialties
    ADD CONSTRAINT clinic_specialties_pkey PRIMARY KEY (id);


--
-- Name: clinics clinics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: opd_records opd_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opd_records
    ADD CONSTRAINT opd_records_pkey PRIMARY KEY (id);


--
-- Name: pet_breeds pet_breeds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_breeds
    ADD CONSTRAINT pet_breeds_pkey PRIMARY KEY (id);


--
-- Name: pet_breeds pet_breeds_species_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_breeds
    ADD CONSTRAINT pet_breeds_species_name_key UNIQUE (species, name);


--
-- Name: pet_medical_records pet_medical_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_medical_records
    ADD CONSTRAINT pet_medical_records_pkey PRIMARY KEY (id);


--
-- Name: pet_ownership_requests pet_ownership_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_ownership_requests
    ADD CONSTRAINT pet_ownership_requests_pkey PRIMARY KEY (id);


--
-- Name: pet_parasite_controls pet_parasite_controls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_parasite_controls
    ADD CONSTRAINT pet_parasite_controls_pkey PRIMARY KEY (id);


--
-- Name: pet_vaccines pet_vaccines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_vaccines
    ADD CONSTRAINT pet_vaccines_pkey PRIMARY KEY (id);


--
-- Name: pets pets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pets
    ADD CONSTRAINT pets_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: specialty_types specialty_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialty_types
    ADD CONSTRAINT specialty_types_pkey PRIMARY KEY (id);


--
-- Name: vet_patient_discharges vet_patient_discharges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vet_patient_discharges
    ADD CONSTRAINT vet_patient_discharges_pkey PRIMARY KEY (id);


--
-- Name: vet_patient_discharges vet_patient_discharges_vet_id_pet_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vet_patient_discharges
    ADD CONSTRAINT vet_patient_discharges_vet_id_pet_id_key UNIQUE (vet_id, pet_id);


--
-- Name: vet_profiles vet_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vet_profiles
    ADD CONSTRAINT vet_profiles_pkey PRIMARY KEY (id);


--
-- Name: vet_profiles vet_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vet_profiles
    ADD CONSTRAINT vet_profiles_user_id_key UNIQUE (user_id);


--
-- Name: vet_schedules vet_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vet_schedules
    ADD CONSTRAINT vet_schedules_pkey PRIMARY KEY (id);


--
-- Name: vet_specialties vet_specialties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vet_specialties
    ADD CONSTRAINT vet_specialties_pkey PRIMARY KEY (id);


--
-- Name: vet_specialties vet_specialties_vet_id_specialty_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vet_specialties
    ADD CONSTRAINT vet_specialties_vet_id_specialty_type_id_key UNIQUE (vet_id, specialty_type_id);


--
-- Name: notifications_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: clinics trg_notify_admins_clinic_resubmit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_admins_clinic_resubmit AFTER UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.notify_admins_clinic_resubmit();


--
-- Name: pet_ownership_requests trg_notify_admins_new_claim; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_admins_new_claim AFTER INSERT ON public.pet_ownership_requests FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_claim();


--
-- Name: clinic_edit_requests trg_notify_admins_new_clinic_edit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_admins_new_clinic_edit AFTER INSERT ON public.clinic_edit_requests FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_clinic_edit();


--
-- Name: feedback trg_notify_admins_new_feedback; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_admins_new_feedback AFTER INSERT ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_feedback();


--
-- Name: vet_profiles vet_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER vet_profiles_updated_at BEFORE UPDATE ON public.vet_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: appointment_messages appointment_messages_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_messages
    ADD CONSTRAINT appointment_messages_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: appointment_messages appointment_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_messages
    ADD CONSTRAINT appointment_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id);


--
-- Name: appointments appointments_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_preferred_vet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_preferred_vet_id_fkey FOREIGN KEY (preferred_vet_id) REFERENCES public.profiles(id);


--
-- Name: bookings bookings_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_vet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_vet_id_fkey FOREIGN KEY (vet_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: clinic_edit_requests clinic_edit_requests_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_edit_requests
    ADD CONSTRAINT clinic_edit_requests_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: clinic_edit_requests clinic_edit_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_edit_requests
    ADD CONSTRAINT clinic_edit_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: clinic_edit_requests clinic_edit_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_edit_requests
    ADD CONSTRAINT clinic_edit_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);


--
-- Name: clinic_managers clinic_managers_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_managers
    ADD CONSTRAINT clinic_managers_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: clinic_managers clinic_managers_vet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_managers
    ADD CONSTRAINT clinic_managers_vet_id_fkey FOREIGN KEY (vet_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: clinic_specialties clinic_specialties_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_specialties
    ADD CONSTRAINT clinic_specialties_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: clinic_specialties clinic_specialties_specialty_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_specialties
    ADD CONSTRAINT clinic_specialties_specialty_type_id_fkey FOREIGN KEY (specialty_type_id) REFERENCES public.specialty_types(id) ON DELETE CASCADE;


--
-- Name: clinics clinics_owner_vet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_owner_vet_id_fkey FOREIGN KEY (owner_vet_id) REFERENCES auth.users(id);


--
-- Name: feedback feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: messages messages_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: opd_records opd_records_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opd_records
    ADD CONSTRAINT opd_records_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id);


--
-- Name: opd_records opd_records_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opd_records
    ADD CONSTRAINT opd_records_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: opd_records opd_records_vet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opd_records
    ADD CONSTRAINT opd_records_vet_id_fkey FOREIGN KEY (vet_id) REFERENCES public.profiles(id);


--
-- Name: pet_medical_records pet_medical_records_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_medical_records
    ADD CONSTRAINT pet_medical_records_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: pet_ownership_requests pet_ownership_requests_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_ownership_requests
    ADD CONSTRAINT pet_ownership_requests_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: pet_ownership_requests pet_ownership_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_ownership_requests
    ADD CONSTRAINT pet_ownership_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id);


--
-- Name: pet_ownership_requests pet_ownership_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_ownership_requests
    ADD CONSTRAINT pet_ownership_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: pet_ownership_requests pet_ownership_requests_target_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_ownership_requests
    ADD CONSTRAINT pet_ownership_requests_target_owner_id_fkey FOREIGN KEY (target_owner_id) REFERENCES auth.users(id);


--
-- Name: pet_ownership_requests pet_ownership_requests_vet_initiator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_ownership_requests
    ADD CONSTRAINT pet_ownership_requests_vet_initiator_id_fkey FOREIGN KEY (vet_initiator_id) REFERENCES auth.users(id);


--
-- Name: pet_parasite_controls pet_parasite_controls_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_parasite_controls
    ADD CONSTRAINT pet_parasite_controls_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: pet_vaccines pet_vaccines_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_vaccines
    ADD CONSTRAINT pet_vaccines_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: pets pets_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pets
    ADD CONSTRAINT pets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: vet_patient_discharges vet_patient_discharges_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vet_patient_discharges
    ADD CONSTRAINT vet_patient_discharges_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: vet_patient_discharges vet_patient_discharges_vet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vet_patient_discharges
    ADD CONSTRAINT vet_patient_discharges_vet_id_fkey FOREIGN KEY (vet_id) REFERENCES public.profiles(id);


--
-- Name: vet_profiles vet_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vet_profiles
    ADD CONSTRAINT vet_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vet_profiles vet_profiles_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vet_profiles
    ADD CONSTRAINT vet_profiles_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES auth.users(id);


--
-- Name: vet_schedules vet_schedules_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vet_schedules
    ADD CONSTRAINT vet_schedules_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE SET NULL;


--
-- Name: vet_schedules vet_schedules_vet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vet_schedules
    ADD CONSTRAINT vet_schedules_vet_id_fkey FOREIGN KEY (vet_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vet_specialties vet_specialties_specialty_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vet_specialties
    ADD CONSTRAINT vet_specialties_specialty_type_id_fkey FOREIGN KEY (specialty_type_id) REFERENCES public.specialty_types(id) ON DELETE CASCADE;


--
-- Name: vet_specialties vet_specialties_vet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vet_specialties
    ADD CONSTRAINT vet_specialties_vet_id_fkey FOREIGN KEY (vet_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: pets Allow viewing unowned pets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow viewing unowned pets" ON public.pets FOR SELECT USING ((owner_id IS NULL));


--
-- Name: pet_ownership_requests Owner can update vet-initiated requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can update vet-initiated requests" ON public.pet_ownership_requests FOR UPDATE TO authenticated USING ((target_owner_id = auth.uid()));


--
-- Name: pet_ownership_requests Owner sees vet-initiated requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner sees vet-initiated requests" ON public.pet_ownership_requests FOR SELECT TO authenticated USING ((target_owner_id = auth.uid()));


--
-- Name: feedback admin can do all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin can do all" ON public.feedback TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));


--
-- Name: vet_profiles admin can update vet profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin can update vet profiles" ON public.vet_profiles FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: pet_ownership_requests admin manage requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage requests" ON public.pet_ownership_requests TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: specialty_types admin manage specialty types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage specialty types" ON public.specialty_types USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: clinics admin read all clinics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin read all clinics" ON public.clinics FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));


--
-- Name: vet_profiles admin read all vet_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin read all vet_profiles" ON public.vet_profiles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));


--
-- Name: clinics admin_select_clinics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_select_clinics ON public.clinics FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: vet_profiles admin_select_vet_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_select_vet_profiles ON public.vet_profiles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: clinics admin_update_clinics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_update_clinics ON public.clinics FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: vet_profiles admin_update_vet_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_update_vet_profiles ON public.vet_profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: appointment_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointment_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments appointments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointments_insert ON public.appointments FOR INSERT WITH CHECK ((auth.uid() = owner_id));


--
-- Name: appointments appointments_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointments_select_owner ON public.appointments FOR SELECT USING ((auth.uid() = owner_id));


--
-- Name: appointments appointments_select_vet; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointments_select_vet ON public.appointments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'vet'::text)))));


--
-- Name: appointments appointments_update_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointments_update_owner ON public.appointments FOR UPDATE USING ((auth.uid() = owner_id));


--
-- Name: appointments appointments_update_vet; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointments_update_vet ON public.appointments FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'vet'::text)))));


--
-- Name: appointment_messages apt_msg_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY apt_msg_insert ON public.appointment_messages FOR INSERT WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.id = appointment_messages.appointment_id) AND ((a.owner_id = auth.uid()) OR (a.preferred_vet_id = auth.uid())))))));


--
-- Name: appointment_messages apt_msg_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY apt_msg_select ON public.appointment_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.id = appointment_messages.appointment_id) AND ((a.owner_id = auth.uid()) OR (a.preferred_vet_id = auth.uid()))))));


--
-- Name: profiles authenticated_read_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_profiles ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: vet_profiles authenticated_read_vet_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_vet_profiles ON public.vet_profiles FOR SELECT TO authenticated USING (true);


--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings bookings_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bookings_insert ON public.bookings FOR INSERT WITH CHECK (((auth.uid() = vet_id) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'vet'::text))))));


--
-- Name: bookings bookings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bookings_select ON public.bookings FOR SELECT USING (((auth.uid() = vet_id) OR (EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.id = bookings.appointment_id) AND (a.owner_id = auth.uid()))))));


--
-- Name: bookings bookings_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bookings_update ON public.bookings FOR UPDATE USING (((auth.uid() = vet_id) OR (EXISTS ( SELECT 1
   FROM public.appointments a
  WHERE ((a.id = bookings.appointment_id) AND (a.owner_id = auth.uid()))))));


--
-- Name: clinic_edit_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinic_edit_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_managers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinic_managers ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_specialties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinic_specialties ENABLE ROW LEVEL SECURITY;

--
-- Name: clinics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_edit_requests insert own clinic edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert own clinic edit" ON public.clinic_edit_requests FOR INSERT TO authenticated WITH CHECK ((requester_id = auth.uid()));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_insert ON public.messages FOR INSERT WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM (public.bookings b
     JOIN public.appointments a ON ((a.id = b.appointment_id)))
  WHERE ((b.id = messages.booking_id) AND ((a.owner_id = auth.uid()) OR (b.vet_id = auth.uid())) AND (b.status = ANY (ARRAY['confirmed'::text, 'awaiting_confirmation'::text])))))));


--
-- Name: messages messages_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_select ON public.messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.bookings b
     JOIN public.appointments a ON ((a.id = b.appointment_id)))
  WHERE ((b.id = messages.booking_id) AND ((b.vet_id = auth.uid()) OR (a.owner_id = auth.uid()))))));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: opd_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.opd_records ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_managers owner manage managers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner manage managers" ON public.clinic_managers USING ((EXISTS ( SELECT 1
   FROM public.clinics
  WHERE ((clinics.id = clinic_managers.clinic_id) AND (clinics.owner_vet_id = auth.uid())))));


--
-- Name: pet_ownership_requests owner manage own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner manage own requests" ON public.pet_ownership_requests TO authenticated USING ((requester_id = auth.uid())) WITH CHECK ((requester_id = auth.uid()));


--
-- Name: clinic_specialties owner manage specialties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner manage specialties" ON public.clinic_specialties USING ((EXISTS ( SELECT 1
   FROM public.clinics
  WHERE ((clinics.id = clinic_specialties.clinic_id) AND ((clinics.owner_vet_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.clinic_managers
          WHERE ((clinic_managers.clinic_id = clinics.id) AND (clinic_managers.vet_id = auth.uid())))))))));


--
-- Name: pet_medical_records owner medical; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner medical" ON public.pet_medical_records USING ((EXISTS ( SELECT 1
   FROM public.pets
  WHERE ((pets.id = pet_medical_records.pet_id) AND (pets.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.pets
  WHERE ((pets.id = pet_medical_records.pet_id) AND (pets.owner_id = auth.uid())))));


--
-- Name: clinics owner or manager update clinic; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner or manager update clinic" ON public.clinics FOR UPDATE USING (((owner_vet_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.clinic_managers
  WHERE ((clinic_managers.clinic_id = clinic_managers.id) AND (clinic_managers.vet_id = auth.uid()))))));


--
-- Name: pet_parasite_controls owner parasites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner parasites" ON public.pet_parasite_controls USING ((EXISTS ( SELECT 1
   FROM public.pets
  WHERE ((pets.id = pet_parasite_controls.pet_id) AND (pets.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.pets
  WHERE ((pets.id = pet_parasite_controls.pet_id) AND (pets.owner_id = auth.uid())))));


--
-- Name: pets owner pets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner pets" ON public.pets USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));


--
-- Name: clinics owner read own clinics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner read own clinics" ON public.clinics FOR SELECT USING ((owner_vet_id = auth.uid()));


--
-- Name: pet_vaccines owner vaccines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner vaccines" ON public.pet_vaccines USING ((EXISTS ( SELECT 1
   FROM public.pets
  WHERE ((pets.id = pet_vaccines.pet_id) AND (pets.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.pets
  WHERE ((pets.id = pet_vaccines.pet_id) AND (pets.owner_id = auth.uid())))));


--
-- Name: clinics owner_update_clinics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_update_clinics ON public.clinics FOR UPDATE TO authenticated USING ((owner_vet_id = auth.uid())) WITH CHECK ((owner_vet_id = auth.uid()));


--
-- Name: pet_breeds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pet_breeds ENABLE ROW LEVEL SECURITY;

--
-- Name: pet_medical_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pet_medical_records ENABLE ROW LEVEL SECURITY;

--
-- Name: pet_ownership_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pet_ownership_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: pet_parasite_controls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pet_parasite_controls ENABLE ROW LEVEL SECURITY;

--
-- Name: pet_vaccines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pet_vaccines ENABLE ROW LEVEL SECURITY;

--
-- Name: pets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (true);


--
-- Name: profiles profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: clinics public read approved clinics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read approved clinics" ON public.clinics FOR SELECT USING ((status = 'approved'::text));


--
-- Name: pet_breeds public read breeds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read breeds" ON public.pet_breeds FOR SELECT USING (true);


--
-- Name: clinic_specialties public read specialties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read specialties" ON public.clinic_specialties FOR SELECT USING (true);


--
-- Name: specialty_types public read specialty types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read specialty types" ON public.specialty_types FOR SELECT USING (true);


--
-- Name: vet_specialties public read vet specialties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read vet specialties" ON public.vet_specialties FOR SELECT USING (true);


--
-- Name: vet_schedules public read vet_schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read vet_schedules" ON public.vet_schedules FOR SELECT USING (true);


--
-- Name: clinic_managers read managers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read managers" ON public.clinic_managers FOR SELECT USING (true);


--
-- Name: clinic_edit_requests read own or admin clinic edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read own or admin clinic edit" ON public.clinic_edit_requests FOR SELECT TO authenticated USING (((requester_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))))));


--
-- Name: notifications service insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service insert" ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: specialty_types specialty admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "specialty admin write" ON public.specialty_types TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));


--
-- Name: specialty_types specialty read all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "specialty read all" ON public.specialty_types FOR SELECT USING (true);


--
-- Name: specialty_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.specialty_types ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback users can insert own feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can insert own feedback" ON public.feedback FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: feedback users can view own feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can view own feedback" ON public.feedback FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notifications users delete own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users delete own" ON public.notifications FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: notifications users read own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications users update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: clinics vet insert clinic; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vet insert clinic" ON public.clinics FOR INSERT WITH CHECK ((owner_vet_id = auth.uid()));


--
-- Name: opd_records vet insert opd; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vet insert opd" ON public.opd_records FOR INSERT TO authenticated WITH CHECK ((vet_id = auth.uid()));


--
-- Name: vet_patient_discharges vet manage discharges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vet manage discharges" ON public.vet_patient_discharges TO authenticated USING ((vet_id = auth.uid())) WITH CHECK ((vet_id = auth.uid()));


--
-- Name: vet_schedules vet manage own schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vet manage own schedules" ON public.vet_schedules USING ((auth.uid() = vet_id));


--
-- Name: vet_specialties vet manage own specialties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vet manage own specialties" ON public.vet_specialties USING ((vet_id = auth.uid()));


--
-- Name: opd_records vet select opd; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vet select opd" ON public.opd_records FOR SELECT TO authenticated USING (((vet_id = auth.uid()) OR (pet_id IN ( SELECT pets.id
   FROM public.pets
  WHERE (pets.owner_id = auth.uid())))));


--
-- Name: opd_records vet update opd; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vet update opd" ON public.opd_records FOR UPDATE TO authenticated USING ((vet_id = auth.uid()));


--
-- Name: vet_patient_discharges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vet_patient_discharges ENABLE ROW LEVEL SECURITY;

--
-- Name: vet_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vet_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: vet_profiles vet_profiles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vet_profiles_insert ON public.vet_profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: vet_profiles vet_profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vet_profiles_select ON public.vet_profiles FOR SELECT USING (true);


--
-- Name: vet_profiles vet_profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vet_profiles_update ON public.vet_profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: vet_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vet_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: vet_specialties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vet_specialties ENABLE ROW LEVEL SECURITY;

--
-- Name: pets vets insert pets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vets insert pets" ON public.pets FOR INSERT TO authenticated WITH CHECK (((owner_id = auth.uid()) OR ((owner_id IS NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['vet'::text, 'admin'::text]))))))));


--
-- Name: pets vets read all pets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vets read all pets" ON public.pets FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['vet'::text, 'admin'::text])))))));


--
-- PostgreSQL database dump complete
--

\unrestrict vv74223VkMppW5VQXKPeqCKpe7zRAO9iHxEwIQboKJMvcD37LXMAo8VPc4xImPK

