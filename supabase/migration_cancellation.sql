-- เพิ่ม column สำหรับระบบยกเลิกและชำระส่วนที่เหลือ
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_by text CHECK (cancelled_by IN ('owner', 'vet')),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS platform_fee numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vet_payout numeric(10,2),
  ADD COLUMN IF NOT EXISTS remaining_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS remaining_paid_at timestamptz;

-- อัปเดต status constraint ให้รองรับ awaiting_confirmation
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending_payment', 'confirmed', 'awaiting_confirmation', 'completed', 'cancelled'));
