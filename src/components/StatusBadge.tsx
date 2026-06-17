import type { AppointmentStatus, BookingStatus } from '@/lib/types'

const appointmentColors: Record<AppointmentStatus, string> = {
  open: 'bg-blue-100 text-blue-700',
  accepted: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const appointmentLabels: Record<AppointmentStatus, string> = {
  open: 'รอหมอตอบรับ',
  accepted: 'หมอตอบรับแล้ว',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
}

const bookingColors: Record<BookingStatus, string> = {
  pending_payment: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  awaiting_confirmation: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
}

const bookingLabels: Record<BookingStatus, string> = {
  pending_payment: 'รอชำระมัดจำ',
  confirmed: 'ยืนยันแล้ว',
  awaiting_confirmation: 'รอเจ้าของยืนยัน',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
}

export function AppointmentBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${appointmentColors[status]}`}>
      {appointmentLabels[status]}
    </span>
  )
}

export function BookingBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${bookingColors[status]}`}>
      {bookingLabels[status]}
    </span>
  )
}
