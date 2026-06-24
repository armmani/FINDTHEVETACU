'use client'

import { useState } from 'react'
import { X, CreditCard, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { calcPlatformFee } from '@/lib/distance'
import { notifyUser } from '@/lib/telegram'
import toast from 'react-hot-toast'
import type { Booking } from '@/lib/types'

interface FinalPaymentModalProps {
  booking: Booking
  petName?: string
  onClose: () => void
  onSuccess: () => void
}

export default function FinalPaymentModal({ booking, petName, onClose, onSuccess }: FinalPaymentModalProps) {
  const [loading, setLoading] = useState(false)
  const [paid, setPaid] = useState(false)
  const supabase = createClient()

  const remaining = booking.total_fee - booking.deposit_amount
  const platformFee = calcPlatformFee(booking.total_fee) // 5% ของ total
  const vetPayout = booking.total_fee - platformFee       // หมอได้รับหลังหัก Platform Fee

  const handlePay = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1500)) // mock payment delay

    const { error } = await supabase.from('bookings').update({
      status: 'completed',
      remaining_paid: true,
      remaining_paid_at: new Date().toISOString(),
      platform_fee: platformFee,
      vet_payout: vetPayout,
    }).eq('id', booking.id)

    if (error) {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setLoading(false)
      return
    }

    await supabase.from('appointments')
      .update({ status: 'completed' })
      .eq('id', booking.appointment_id)

    // แจ้งเตือนหมอ
    notifyUser(booking.vet_id, `🎉 <b>TH AcuPETure — การรักษาเสร็จสมบูรณ์!</b>\n\nเจ้าของยืนยันและชำระเงินครบสำหรับ <b>${petName || 'สัตว์เลี้ยง'}</b>\nคุณจะได้รับ ${vetPayout.toLocaleString()} บาท (หลังหัก Platform Fee 5%)`)

    setPaid(true)
    setLoading(false)
    toast.success('ชำระเงินสำเร็จ! ขอบคุณที่ใช้บริการ')
    setTimeout(onSuccess, 1500)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">ยืนยันและชำระส่วนที่เหลือ</h2>
          {!loading && !paid && <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>}
        </div>

        <div className="p-6">
          {paid ? (
            <div className="text-center py-6">
              <CheckCircle className="w-16 h-16 text-primary-500 mx-auto mb-3" />
              <p className="text-lg font-semibold text-primary-700">ชำระเงินสำเร็จ!</p>
              <p className="text-gray-500 text-sm mt-1">การรักษาเสร็จสมบูรณ์</p>
            </div>
          ) : (
            <>
              {/* สรุปค่าใช้จ่าย */}
              <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>ค่าฝังเข็ม + ค่าเดินทาง</span>
                  <span>{booking.total_fee.toLocaleString()} บาท</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>มัดจำที่ชำระแล้ว</span>
                  <span className="text-green-600">-{booking.deposit_amount.toLocaleString()} บาท</span>
                </div>
                <div className="flex justify-between font-semibold text-base border-t pt-2">
                  <span>ยอดที่ต้องชำระ</span>
                  <span>{remaining.toLocaleString()} บาท</span>
                </div>
              </div>

              {/* แสดงการกระจายเงิน */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-xs text-blue-700 space-y-1">
                <p className="font-semibold mb-2">รายละเอียดการกระจายเงิน (รวมมัดจำ)</p>
                <div className="flex justify-between">
                  <span>หมอได้รับทั้งหมด</span>
                  <span className="font-medium">{vetPayout.toLocaleString()} บาท</span>
                </div>
                <div className="flex justify-between text-blue-500">
                  <span>Platform Fee (5%)</span>
                  <span>{platformFee.toLocaleString()} บาท</span>
                </div>
              </div>

              {/* Mock payment */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 mb-5">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-3">
                  <CreditCard className="w-4 h-4" />
                  <span>ระบบทดสอบ — ไม่มีการชำระเงินจริง</span>
                </div>
                <div className="space-y-2">
                  <input className="input" placeholder="หมายเลขบัตร: 4242 4242 4242 4242" disabled />
                  <div className="grid grid-cols-2 gap-2">
                    <input className="input" placeholder="MM/YY: 12/28" disabled />
                    <input className="input" placeholder="CVV: 123" disabled />
                  </div>
                </div>
              </div>

              <button onClick={handlePay} disabled={loading} className="btn-primary w-full py-3 text-base">
                {loading ? 'กำลังดำเนินการ...' : `ชำระ ${remaining.toLocaleString()} บาท`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
