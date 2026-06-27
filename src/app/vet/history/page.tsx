'use client'

import LoadingScreen from '@/components/LoadingScreen'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Calendar, MapPin, TrendingUp, Wallet, PawPrint } from 'lucide-react'
import { BookingBadge } from '@/components/StatusBadge'
import type { Booking, Appointment } from '@/lib/types'

interface HistoryBooking extends Booking {
  appointments: Appointment & {
    owner_profile: { full_name: string; phone: string | null }
  }
}

export default function VetHistoryPage() {
  const supabase = createClient()
  const [bookings, setBookings] = useState<HistoryBooking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('bookings')
        .select(`
          *,
          appointments (
            pet_name, pet_type, pet_age, preferred_datetime, location_address,
            owner_profile:owner_id (full_name, phone)
          )
        `)
        .eq('vet_id', user.id)
        .in('status', ['confirmed', 'awaiting_confirmation', 'completed', 'cancelled'])
        .order('created_at', { ascending: false })

      setBookings((data as HistoryBooking[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  // คำนวณสรุปรายรับ
  const completed = bookings.filter(b => b.status === 'completed')
  const cancelledByOwner = bookings.filter(b => b.status === 'cancelled' && b.cancelled_by === 'owner')
  const cancelledByVet = bookings.filter(b => b.status === 'cancelled' && b.cancelled_by === 'vet')

  const totalGross = completed.reduce((s, b) => s + b.total_fee, 0)
  const totalPlatformFee = completed.reduce((s, b) => s + (b.platform_fee || 0), 0)
  const totalNetIncome = completed.reduce((s, b) => s + (b.vet_payout || 0), 0)
  const incomeFromCancellations = cancelledByOwner.reduce((s, b) => s + (b.vet_payout || 0), 0)
  const totalPayout = totalNetIncome + incomeFromCancellations

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

  if (loading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ประวัติการรักษาและรายรับ</h1>

      {/* สรุปรายรับ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center py-4">
          <PawPrint className="w-6 h-6 text-primary-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-800">{completed.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">รักษาสำเร็จ</p>
        </div>
        <div className="card text-center py-4">
          <TrendingUp className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-800">{totalGross.toLocaleString()} บาท</p>
          <p className="text-xs text-gray-500 mt-0.5">รายรับรวม (gross)</p>
        </div>
        <div className="card text-center py-4">
          <Wallet className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-800">{totalPlatformFee.toLocaleString()} บาท</p>
          <p className="text-xs text-gray-500 mt-0.5">Platform Fee 5%</p>
        </div>
        <div className="card text-center py-4 bg-primary-50 border border-primary-100">
          <Wallet className="w-6 h-6 text-primary-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-primary-700">{totalPayout.toLocaleString()} บาท</p>
          <p className="text-xs text-primary-600 mt-0.5">รายรับสุทธิ</p>
        </div>
      </div>

      {/* รายรับเพิ่มเติมจากการยกเลิก */}
      {incomeFromCancellations > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700 flex items-center gap-3">
          <span className="text-2xl">💰</span>
          <div>
            <p className="font-semibold">รายรับจากการยกเลิกโดยเจ้าของ</p>
            <p className="text-amber-600">ได้รับมัดจำ {cancelledByOwner.length} ครั้ง รวม {incomeFromCancellations.toLocaleString()} บาท (หลังหัก 5%)</p>
          </div>
        </div>
      )}

      {/* ประวัติแต่ละรายการ */}
      {bookings.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <PawPrint className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>ยังไม่มีประวัติการรักษา</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-700">รายการทั้งหมด</h2>
          {bookings.map(booking => {
            const apt = booking.appointments as any
            const isCompleted = booking.status === 'completed'
            const isCancelledByOwner = booking.status === 'cancelled' && booking.cancelled_by === 'owner'
            const isCancelledByVet = booking.status === 'cancelled' && booking.cancelled_by === 'vet'

            return (
              <div key={booking.id} className="card">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold">{apt?.pet_name}</span>
                      <span className="text-gray-400 text-sm">({apt?.pet_type} · {apt?.pet_age})</span>
                      <BookingBadge status={booking.status} />
                    </div>
                    <div className="text-sm text-gray-500 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {apt?.preferred_datetime ? formatDate(apt.preferred_datetime) : '-'}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {apt?.location_address}
                      </div>
                      <p>เจ้าของ: <span className="text-gray-700">{apt?.owner_profile?.full_name || '-'}</span>
                        {apt?.owner_profile?.phone && <span className="text-gray-400"> · {apt.owner_profile.phone}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-sm min-w-[130px]">
                    <div className="text-gray-500">ค่าบริการ {booking.total_fee.toLocaleString()} บาท</div>
                    {isCompleted && (
                      <>
                        <div className="text-red-400 text-xs">Platform Fee -{(booking.platform_fee || 0).toLocaleString()} บาท</div>
                        <div className="font-bold text-primary-700 text-base mt-0.5">
                          รับสุทธิ {(booking.vet_payout || 0).toLocaleString()} บาท
                        </div>
                      </>
                    )}
                    {isCancelledByOwner && (
                      <>
                        <div className="text-xs text-amber-600">เจ้าของยกเลิก — ได้มัดจำ</div>
                        <div className="font-bold text-amber-700 mt-0.5">
                          {(booking.vet_payout || 0).toLocaleString()} บาท
                        </div>
                      </>
                    )}
                    {isCancelledByVet && (
                      <div className="text-xs text-gray-400 mt-1">คุณยกเลิก — คืนเงินเจ้าของ</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* สรุปท้าย */}
      {bookings.length > 0 && (
        <div className="card bg-gray-50 text-sm space-y-1">
          <p className="font-semibold text-gray-700 mb-2">สรุปรวม</p>
          <div className="flex justify-between text-gray-600">
            <span>รักษาสำเร็จ {completed.length} ครั้ง</span>
            <span>{totalGross.toLocaleString()} บาท</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>ได้จากเจ้าของยกเลิก {cancelledByOwner.length} ครั้ง</span>
            <span>{cancelledByOwner.reduce((s, b) => s + b.deposit_amount, 0).toLocaleString()} บาท</span>
          </div>
          <div className="flex justify-between text-red-400">
            <span>Platform Fee รวม</span>
            <span>-{totalPlatformFee.toLocaleString()} บาท</span>
          </div>
          <div className="flex justify-between font-bold text-primary-700 text-base border-t pt-2 mt-1">
            <span>รายรับสุทธิรวมทั้งหมด</span>
            <span>{totalPayout.toLocaleString()} บาท</span>
          </div>
        </div>
      )}
    </div>
  )
}
