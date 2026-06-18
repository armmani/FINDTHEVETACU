'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { calculateDistance, calcTravelFee, PLATFORM_ACUPUNCTURE_FEE } from '@/lib/distance'
import { Calendar, MapPin, PawPrint, Loader2, AlertCircle, MessageCircle, CheckCircle } from 'lucide-react'
import { AppointmentBadge, BookingBadge } from '@/components/StatusBadge'
import CancelModal from '@/components/CancelModal'
import { notifyUser } from '@/lib/telegram'
import toast from 'react-hot-toast'
import Link from 'next/link'
import type { Appointment, VetProfile, Booking } from '@/lib/types'

interface OpenRequest extends Omit<Appointment, 'profiles'> {
  profiles: { full_name: string; phone: string | null }
  estimatedFee?: number
  travelFee?: number
  distanceKm?: number
}

interface MyBooking extends Booking {
  appointments: Appointment & { profiles: { full_name: string } }
}

export default function VetDashboard() {
  const supabase = createClient()
  const [vetProfile, setVetProfile] = useState<VetProfile | null>(null)
  const [openRequests, setOpenRequests] = useState<OpenRequest[]>([])
  const [myBookings, setMyBookings] = useState<MyBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null)
  const [completing, setCompleting] = useState<string | null>(null)


  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: vp }, { data: open }, { data: mine }] = await Promise.all([
      supabase.from('vet_profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('appointments')
        .select('*, profiles:owner_id(full_name, phone)')
        .eq('status', 'open')
        .or(`preferred_vet_id.is.null,preferred_vet_id.eq.${user.id}`)
        .order('preferred_datetime', { ascending: true }),
      supabase.from('bookings')
        .select('*, appointments(*, profiles:owner_id(full_name, phone))')
        .eq('vet_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    setVetProfile(vp)
    setMyBookings((mine as MyBooking[]) || [])

    // คำนวณระยะทางสำหรับ open requests
    if (open && vp?.location_lat && vp?.location_lng) {
      const withFees = await Promise.all(
        (open as OpenRequest[]).map(async apt => {
          try {
            const result = await calculateDistance(
              vp.location_lat!,
              vp.location_lng!,
              apt.location_lat,
              apt.location_lng
            )
            const travelFee = calcTravelFee(result.distanceKm)
            return {
              ...apt,
              distanceKm: result.distanceKm,
              travelFee,
              estimatedFee: PLATFORM_ACUPUNCTURE_FEE + travelFee,
            }
          } catch {
            return apt
          }
        })
      )
      setOpenRequests(withFees)
    } else {
      setOpenRequests((open as OpenRequest[]) || [])
    }

    setLoading(false)
  }

  const handleAccept = async (apt: OpenRequest) => {
    if (!vetProfile) {
      toast.error('กรุณาตั้งค่าโปรไฟล์ก่อน')
      return
    }
    if (!vetProfile.location_lat) {
      toast.error('กรุณาตั้งค่าที่ตั้งในโปรไฟล์ก่อน')
      return
    }

    setAccepting(apt.id)

    const distanceKm = apt.distanceKm ?? 0
    const travelFee = apt.travelFee ?? calcTravelFee(distanceKm)
    const totalFee = PLATFORM_ACUPUNCTURE_FEE + travelFee
    const depositAmount = Math.round(totalFee / 2)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // ตรวจว่า appointment ยังเป็น open อยู่
    const { data: current } = await supabase
      .from('appointments')
      .select('status')
      .eq('id', apt.id)
      .single()

    if (current?.status !== 'open') {
      toast.error('คำขอนี้มีหมอรับไปแล้ว')
      setAccepting(null)
      loadData()
      return
    }

    const { error: bookingError } = await supabase.from('bookings').insert({
      appointment_id: apt.id,
      vet_id: user.id,
      acupuncture_fee: PLATFORM_ACUPUNCTURE_FEE,
      travel_fee: travelFee,
      distance_km: distanceKm,
      total_fee: totalFee,
      deposit_amount: depositAmount,
    })

    if (bookingError) {
      toast.error('เกิดข้อผิดพลาด: ' + bookingError.message)
      setAccepting(null)
      return
    }

    // อัปเดต appointment status เป็น accepted
    await supabase.from('appointments').update({ status: 'accepted' }).eq('id', apt.id)

    // แจ้งเตือนเจ้าของ
    notifyUser(apt.owner_id, `🐾 <b>VetAcu — หมอรับงานแล้ว!</b>\n\nหมอรับคำขอสำหรับ <b>${apt.pet_name}</b> แล้ว\nกรุณาเข้าแอปเพื่อชำระมัดจำเพื่อยืนยันการนัด`)

    toast.success('รับงานสำเร็จ! รอเจ้าของชำระมัดจำ')
    setAccepting(null)
    loadData()
  }

  const handleComplete = async (bookingId: string, appointmentId: string, ownerId: string, petName: string) => {
    setCompleting(bookingId)
    const { error } = await supabase.from('bookings')
      .update({ status: 'awaiting_confirmation' })
      .eq('id', bookingId)
    if (error) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      // แจ้งเตือนเจ้าของ
      notifyUser(ownerId, `✅ <b>VetAcu — รักษาเสร็จแล้ว!</b>\n\nหมอรักษา <b>${petName}</b> เสร็จแล้ว\nกรุณาเข้าแอปเพื่อยืนยันและชำระเงินส่วนที่เหลือ`)
      toast.success('รอเจ้าของยืนยันและชำระส่วนที่เหลือ')
      loadData()
    }
    setCompleting(null)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>

  if (!vetProfile?.location_lat) {
    return (
      <div className="card text-center py-12 max-w-md mx-auto">
        <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <p className="font-semibold text-lg mb-1">ยังไม่ได้ตั้งค่าโปรไฟล์</p>
        <p className="text-gray-500 text-sm mb-6">กรุณาตั้งค่าที่ตั้งและค่าบริการก่อนเริ่มรับงาน</p>
        <Link href="/vet/profile" className="btn-primary">ตั้งค่าโปรไฟล์</Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Open requests */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">คำขอที่รอหมอ</h1>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {openRequests.length} รายการ
          </span>
        </div>

        {openRequests.length === 0 ? (
          <div className="card text-center py-10">
            <PawPrint className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">ยังไม่มีคำขอในขณะนี้</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {openRequests.map(apt => (
              <div key={apt.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="font-semibold text-lg">{apt.pet_name}</span>
                    <span className="text-gray-400 text-sm ml-1">({apt.pet_type}{apt.pet_age ? `, ${apt.pet_age}` : ''})</span>
                  </div>
                  <AppointmentBadge status="open" />
                </div>

                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{apt.symptoms}</p>

                <div className="space-y-1.5 text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 shrink-0" />
                    {formatDate(apt.preferred_datetime)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span className="line-clamp-1">{apt.location_address}</span>
                  </div>
                </div>

                {/* ราคาประมาณ */}
                {apt.estimatedFee !== undefined ? (
                  <div className="bg-primary-50 rounded-xl p-3 mb-4 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>ค่าฝังเข็ม</span>
                      <span>{PLATFORM_ACUPUNCTURE_FEE.toLocaleString()} บาท</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>ค่าเดินทาง ({apt.distanceKm} กม. ไป-กลับ)</span>
                      <span>{apt.travelFee?.toLocaleString()} บาท</span>
                    </div>
                    <div className="flex justify-between font-semibold text-primary-700 border-t border-primary-100 mt-1 pt-1">
                      <span>รวม</span>
                      <span>{apt.estimatedFee.toLocaleString()} บาท</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm text-gray-400 text-center">
                    กำลังคำนวณระยะทาง...
                  </div>
                )}

                <div className="flex gap-2">
                  {apt.preferred_vet_id && (
                    <Link href={`/vet/appointment/${apt.id}`}
                      className="btn-secondary flex items-center gap-1.5 text-sm shrink-0">
                      <MessageCircle className="w-4 h-4" /> แชท
                    </Link>
                  )}
                  <button
                    onClick={() => handleAccept(apt)}
                    disabled={accepting === apt.id}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {accepting === apt.id ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> กำลังรับงาน...</>
                    ) : (
                      'รับงานนี้'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* My bookings */}
      {myBookings.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">งานที่รับแล้ว</h2>
          <div className="space-y-3">
            {myBookings.map(booking => {
              const apt = booking.appointments
              return (
                <div key={booking.id} className="card">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{apt.pet_name}</span>
                        <span className="text-gray-400 text-sm">({apt.pet_type})</span>
                      </div>
                      <div className="text-sm text-gray-500 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(apt.preferred_datetime)}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {apt.location_address}
                        </div>
                        <div className="text-gray-600">
                          เจ้าของ: {(apt.profiles as any)?.full_name}
                          {(apt.profiles as any)?.phone && ` · ${(apt.profiles as any).phone}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <BookingBadge status={booking.status} />
                      <div className="text-sm mt-2">
                        <span className="text-gray-500">รวม </span>
                        <span className="font-semibold">{booking.total_fee.toLocaleString()} บาท</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {booking.deposit_paid ? '✓ ชำระมัดจำแล้ว' : 'รอเจ้าของชำระมัดจำ'}
                      </div>
                      {(booking.status === 'confirmed' || booking.status === 'awaiting_confirmation') && (
                        <div className="flex flex-col gap-2 mt-2 items-end">
                          <Link href={`/chat/${booking.id}`} className="btn-secondary inline-flex items-center gap-1.5 text-sm">
                            <MessageCircle className="w-4 h-4" />
                            แชทกับเจ้าของ
                          </Link>
                          {booking.status === 'confirmed' && (
                            <>
                              <button
                                onClick={() => handleComplete(booking.id, booking.appointment_id, apt.owner_id, apt.pet_name)}
                                disabled={completing === booking.id}
                                className="btn-primary inline-flex items-center gap-1.5 text-sm"
                              >
                                {completing === booking.id
                                  ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังอัปเดต...</>
                                  : <><CheckCircle className="w-4 h-4" /> รักษาเสร็จแล้ว</>
                                }
                              </button>
                              <button
                                onClick={() => setCancellingBooking(booking)}
                                className="text-xs text-red-400 hover:text-red-600 transition-colors"
                              >
                                ยกเลิกงาน
                              </button>
                            </>
                          )}
                          {booking.status === 'awaiting_confirmation' && (
                            <p className="text-xs text-blue-500">รอเจ้าของยืนยันและชำระส่วนที่เหลือ</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {cancellingBooking && (() => {
        const apt = myBookings.find(b => b.id === cancellingBooking.id)?.appointments
        return (
          <CancelModal
            booking={cancellingBooking}
            cancelledBy="vet"
            ownerUserId={apt?.owner_id}
            petName={apt?.pet_name}
            onClose={() => setCancellingBooking(null)}
            onSuccess={() => { setCancellingBooking(null); loadData() }}
          />
        )
      })()}
    </div>
  )
}
