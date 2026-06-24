'use client'

import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { calcPlatformFee } from '@/lib/distance'
import { notifyUser } from '@/lib/telegram'
import toast from 'react-hot-toast'
import type { Booking } from '@/lib/types'

interface CancelModalProps {
  booking: Booking
  cancelledBy: 'owner' | 'vet'
  ownerUserId?: string
  petName?: string
  onClose: () => void
  onSuccess: () => void
}

export default function CancelModal({ booking, cancelledBy, ownerUserId, petName, onClose, onSuccess }: CancelModalProps) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const isOwnerCancel = cancelledBy === 'owner'

  // คำนวณเงินที่แต่ละฝ่ายได้รับ
  const platformFee = isOwnerCancel ? calcPlatformFee(booking.deposit_amount) : 0
  const vetPayout = isOwnerCancel ? booking.deposit_amount - platformFee : 0
  const ownerRefund = isOwnerCancel ? 0 : booking.deposit_amount

  const handleCancel = async () => {
    setLoading(true)

    const { error: bookingErr } = await supabase.from('bookings').update({
      status: 'cancelled',
      cancelled_by: cancelledBy,
      cancelled_at: new Date().toISOString(),
      platform_fee: platformFee,
      vet_payout: isOwnerCancel ? vetPayout : 0,
    }).eq('id', booking.id)

    if (bookingErr) {
      toast.error('เกิดข้อผิดพลาด: ' + bookingErr.message)
      setLoading(false)
      return
    }

    // อัปเดต appointment กลับเป็น open เพื่อให้หมอคนอื่นรับได้ (เฉพาะ vet ยกเลิก)
    if (!isOwnerCancel) {
      await supabase.from('appointments')
        .update({ status: 'open' })
        .eq('id', booking.appointment_id)
    } else {
      await supabase.from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', booking.appointment_id)
    }

    // แจ้งเตือนฝ่ายตรงข้าม
    const name = petName || 'สัตว์เลี้ยง'
    if (isOwnerCancel) {
      // เจ้าของยกเลิก → แจ้งหมอ
      notifyUser(booking.vet_id, `❌ <b>THacuPETure — เจ้าของยกเลิกนัด</b>\n\nเจ้าของยกเลิกนัดสำหรับ <b>${name}</b>\nคุณได้รับเงินมัดจำ ${vetPayout.toLocaleString()} บาท (หลังหัก Platform Fee)`)
    } else if (ownerUserId) {
      // หมอยกเลิก → แจ้งเจ้าของ
      notifyUser(ownerUserId, `❌ <b>THacuPETure — หมอยกเลิกงาน</b>\n\nหมอยกเลิกนัดสำหรับ <b>${name}</b>\nเงินมัดจำ ${ownerRefund.toLocaleString()} บาท จะถูกคืนให้คุณ`)
    }

    toast.success(isOwnerCancel ? 'ยกเลิกนัดแล้ว' : 'ยกเลิกงานแล้ว')
    setLoading(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            {isOwnerCancel ? 'ยกเลิกนัดหมาย' : 'ยกเลิกงาน'}
          </h2>
          {!loading && <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>}
        </div>

        <div className="p-5 space-y-4">
          <div className={`rounded-xl p-4 text-sm space-y-2 ${isOwnerCancel ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'}`}>
            {isOwnerCancel ? (
              <>
                <p className="font-semibold text-red-700">⚠️ เงินมัดจำจะตกเป็นของหมอ</p>
                <div className="text-red-600 space-y-1">
                  <div className="flex justify-between">
                    <span>มัดจำที่ชำระ</span>
                    <span>{booking.deposit_amount.toLocaleString()} บาท</span>
                  </div>
                  <div className="flex justify-between text-xs text-red-400">
                    <span>หัก Platform Fee (5%)</span>
                    <span>-{platformFee.toLocaleString()} บาท</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-red-200 pt-1 mt-1">
                    <span>หมอได้รับ</span>
                    <span>{vetPayout.toLocaleString()} บาท</span>
                  </div>
                  <div className="flex justify-between font-semibold text-red-700">
                    <span>คุณได้รับคืน</span>
                    <span>0 บาท</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="font-semibold text-amber-700">ℹ️ เงินมัดจำจะถูกคืนให้เจ้าของเต็มจำนวน</p>
                <div className="text-amber-600 space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>เจ้าของได้รับคืน</span>
                    <span>{ownerRefund.toLocaleString()} บาท</span>
                  </div>
                  <div className="flex justify-between text-xs text-amber-500">
                    <span>Platform Fee</span>
                    <span>0 บาท (ไม่หัก)</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <p className="text-sm text-gray-500 text-center">การยกเลิกไม่สามารถย้อนกลับได้</p>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={onClose} disabled={loading} className="btn-secondary py-2.5">
              ไม่ยกเลิก
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 font-medium text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'กำลังดำเนินการ...' : 'ยืนยันยกเลิก'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
