-- ============================================================
-- FindTheVet — 2026-09-08
-- ปิดไม่ให้ role anon (คนที่ยังไม่ล็อกอิน) อ่าน profiles / vet_profiles
--
-- ปัญหาเดิม: policy 2 ตัวนี้เขียนเป็น USING (true) เฉยๆ ไม่มี TO authenticated
-- แปลว่าเปิดให้ทุก role รวม anon — และ anon key อยู่ใน JS bundle ที่ส่งให้ browser
-- ทุกคน เท่ากับใครก็ดึงชื่อ/เบอร์/อีเมล/ที่อยู่ของสมาชิกทั้ง 89 คนได้จากภายนอก
-- และทำให้สวิตช์ show_phone / show_line / show_facebook ของหมอไม่มีผลจริง
--
-- ยืนยันหลังรัน: ยิง REST ด้วย anon key ได้ [] ทั้งสองตาราง
-- ส่วน clinics / specialty_types / vet_schedules ที่ตั้งใจให้ public ยังอ่านได้ตามเดิม
-- ============================================================

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists vet_profiles_select on public.vet_profiles;
create policy vet_profiles_select on public.vet_profiles
  for select to authenticated using (true);

-- หมายเหตุ: ยังเหลือช่องว่างระดับคอลัมน์ — ผู้ใช้ที่ล็อกอินแล้ว (สมัครบัญชีเจ้าของ
-- ก็ได้) ยังยิง API อ่าน profiles.phone / line_id / facebook_url ที่หมอปิดสวิตช์ไว้ได้
-- เพราะ RLS คุมได้ทีละแถว ไม่ใช่ทีละคอลัมน์ ถ้าต้องการปิดจริงต้องแยกคอลัมน์ติดต่อ
-- ออกเป็นตาราง profile_contacts แล้วให้หน้าโปรไฟล์สาธารณะอ่านผ่าน view ที่ mask
-- ตามสวิตช์ให้ตั้งแต่ฝั่ง DB
