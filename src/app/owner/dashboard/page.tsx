'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Plus, PawPrint, Calendar, MapPin, MessageCircle } from 'lucide-react'
import { AppointmentBadge, BookingBadge } from '@/components/StatusBadge'
import PaymentModal from '@/components/PaymentModal'
import CancelModal from '@/components/CancelModal'
import FinalPaymentModal from '@/components/FinalPaymentModal'
import type { Appointment, Booking } from '@/lib/types'

interface BookingWithVet extends Booking {
  vet_name?: string
  vet_phone?: string
}

interface AppointmentWithBooking extends Appointment {
  booking?: BookingWithVet
}

export default function OwnerDashboard() {
  const supabase = createClient()
  const [appointments, setAppointments] = useState<AppointmentWithBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [payingBooking, setPayingBooking] = useState<Booking | null>(null)
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null)
  const [finalPayBooking, setFinalPayBooking] = useState<Booking | null>(null)

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // ดึง appointments ก่อน
    const { data: apts } = await supabase
      .from('appointments')
      .select('*')
      .eq('owner_id', user.id)
      .order('preferred_datetime', { ascending: true })

    if (!apts?.length) { setAppointments([]); setLoading(false); return }

    // ดึง bookings แยก แล้วค่อย join เอง (ป้องกัน RLS nested query issue)
    const aptIds = apts.map(a => a.id)
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .in('appointment_id', aptIds)

    // ดึงชื่อหมอจาก profiles
    const vetIds = Array.from(new Set((bookings || []).map(b => b.vet_id)))
    const { data: vetProfiles } = vetIds.length
      ? await supabase.from('profiles').select('id, full_name, phone').in('id', vetIds)
      : { data: [] }

    const vetMap = Object.fromEntries((vetProfiles || []).map(p => [p.id, p]))
    const bookingMap = Object.fromEntries(
      (bookings || []).map(b => [b.appointment_id, {
        ...b,
        vet_name: vetMap[b.vet_id]?.full_name,
        vet_phone: vetMap[b.vet_id]?.phone,
      }])
    )

    setAppointments(apts.map(a => ({ ...a, booking: bookingMap[a.id] })))
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })

  if (loading) {
    return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">คำขอนัดหมายของฉัน</h1>
          <p className="text-gray-500 text-sm mt-0.5">ดูสถานะและจัดการการนัดหมาย</p>
        </div>
        <Link href="/owner/request/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          นัดหมายใหม่
        </Link>
      </div>

      {appointments.length === 0 ? (
        <div className="card text-center py-16">
          <PawPrint className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">ยังไม่มีคำขอนัดหมาย</p>
          <p className="text-gray-400 text-sm mt-1">กดปุ่มด้านบนเพื่อสร้างคำขอแรก</p>
          <Link href="/owner/request/new" className="btn-primary inline-flex items-center gap-2 mt-6">
            <Plus className="w-4 h-4" /> นัดหมายใหม่
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map(apt => {
            const booking = apt.booking
            const needsPayment = !!booking && !booking.deposit_paid && booking.status !== 'confirmed' && booking.status !== 'cancelled' && booking.status !== 'completed'

            return (
              <div key={apt.id} className="card">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-lg">{apt.pet_name}</span>
                      <span className="text-gray-400 text-sm">({apt.pet_type} · {apt.pet_age})</span>
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        ครั้งที่ {apt.session_number ?? 1}
                      </span>
                      {apt.had_acupuncture_before && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">เคยฝังเข็มแล้ว</span>
                      )}
                      <AppointmentBadge status={apt.status} />
                    </div>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{apt.symptoms}</p>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(apt.preferred_datetime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {apt.location_address}
                      </span>
                    </div>
                  </div>

                  {needsPayment && (
                    <button
                      onClick={() => setPayingBooking(booking)}
                      className="btn-primary shrink-0"
                    >
                      ชำระมัดจำ
                    </button>
                  )}
                </div>

                {/* Booking info */}
                {booking && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="text-sm">
                        <span className="text-gray-500">หมอ: </span>
                        <span className="font-medium">{booking.vet_name || 'ไม่ระบุ'}</span>
                        {booking.vet_phone && (
                          <span className="text-gray-400 ml-2">📞 {booking.vet_phone}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500">
                          รวม <span className="font-semibold text-gray-800">{booking.total_fee.toLocaleString()} บาท</span>
                          {' '}(มัดจำ {booking.deposit_amount.toLocaleString()} บาท)
                        </span>
                        <BookingBadge status={booking.status} />
                      </div>
                    </div>
                    {(booking.status === 'confirmed' || booking.status === 'awaiting_confirmation') && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/chat/${booking.id}`} className="btn-secondary inline-flex items-center gap-2 text-sm">
                          <MessageCircle className="w-4 h-4" />
                          แชทกับหมอ
                        </Link>
                        {booking.status === 'confirmed' && (
                          <button
                            onClick={() => setCancellingBooking(booking)}
                            className="text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-xl px-3 py-1.5 transition-colors"
                          >
                            ยกเลิกนัด
                          </button>
                        )}
                        {booking.status === 'awaiting_confirmation' && (
                          <button
                            onClick={() => setFinalPayBooking(booking)}
                            className="btn-primary text-sm inline-flex items-center gap-1"
                          >
                            ✓ ยืนยันและชำระส่วนที่เหลือ
                          </button>
                        )}
                      </div>
                    )}
                    {booking.status === 'cancelled' && booking.cancelled_by && (
                      <p className="mt-2 text-xs text-gray-400">
                        ยกเลิกโดย{booking.cancelled_by === 'owner' ? 'เจ้าของ' : 'หมอ'}
                        {booking.cancelled_by === 'vet' ? ' — เงินมัดจำถูกคืนให้คุณแล้ว' : ' — เงินมัดจำตกเป็นของหมอ'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {payingBooking && (() => {
        const apt = appointments.find(a => a.booking?.id === payingBooking.id)
        return (
          <PaymentModal
            booking={payingBooking}
            petName={apt?.pet_name}
            onClose={() => setPayingBooking(null)}
            onSuccess={() => { setPayingBooking(null); loadData() }}
          />
        )
      })()}
      {cancellingBooking && (() => {
        const apt = appointments.find(a => a.booking?.id === cancellingBooking.id)
        return (
          <CancelModal
            booking={cancellingBooking}
            cancelledBy="owner"
            petName={apt?.pet_name}
            onClose={() => setCancellingBooking(null)}
            onSuccess={() => { setCancellingBooking(null); loadData() }}
          />
        )
      })()}
      {finalPayBooking && (() => {
        const apt = appointments.find(a => a.booking?.id === finalPayBooking.id)
        return (
          <FinalPaymentModal
            booking={finalPayBooking}
            petName={apt?.pet_name}
            onClose={() => setFinalPayBooking(null)}
            onSuccess={() => { setFinalPayBooking(null); loadData() }}
          />
        )
      })()}
    </div>
  )
}
