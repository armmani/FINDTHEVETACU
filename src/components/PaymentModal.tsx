'use client'

import { useState } from 'react'
import { X, CreditCard, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { notifyUser } from '@/lib/telegram'
import toast from 'react-hot-toast'
import type { Booking } from '@/lib/types'

interface PaymentModalProps {
  booking: Booking
  petName?: string
  onClose: () => void
  onSuccess: () => void
}

export default function PaymentModal({ booking, petName, onClose, onSuccess }: PaymentModalProps) {
  const [loading, setLoading] = useState(false)
  const [paid, setPaid] = useState(false)
  const supabase = createClient()

  const handleMockPay = async () => {
    setLoading(true)
    // Mock: จำลองการชำระเงิน 1.5 วินาที
    await new Promise(r => setTimeout(r, 1500))

    const { error } = await supabase
      .from('bookings')
      .update({
        deposit_paid: true,
        deposit_paid_at: new Date().toISOString(),
        status: 'confirmed',
      })
      .eq('id', booking.id)

    if (error) {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setLoading(false)
      return
    }

    // อัปเดต status ของ appointment เป็น accepted
    await supabase
      .from('appointments')
      .update({ status: 'accepted' })
      .eq('id', booking.appointment_id)

    // แจ้งเตือนหมอ
    notifyUser(booking.vet_id, `💰 <b>THacuPETure — ชำระมัดจำแล้ว!</b>\n\nเจ้าของชำระมัดจำสำหรับ <b>${petName || 'สัตว์เลี้ยง'}</b> แล้ว ${booking.deposit_amount.toLocaleString()} บาท\nการนัดหมายได้รับการยืนยัน`)

    setPaid(true)
    setLoading(false)
    toast.success('ชำระมัดจำสำเร็จ!')
    setTimeout(onSuccess, 1500)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">ชำระมัดจำ</h2>
          {!loading && !paid && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6">
          {paid ? (
            <div className="text-center py-4">
              <CheckCircle className="w-16 h-16 text-primary-500 mx-auto mb-3" />
              <p className="text-lg font-semibold text-primary-700">ชำระเงินสำเร็จ!</p>
              <p className="text-gray-500 text-sm mt-1">กำลังอัปเดตสถานะ...</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">ค่าฝังเข็ม</span>
                  <span className="font-medium">{booking.acupuncture_fee.toLocaleString()} บาท</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ค่าเดินทาง ({booking.distance_km} กม.)</span>
                  <span className="font-medium">{booking.travel_fee.toLocaleString()} บาท</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>รวมทั้งหมด</span>
                  <span>{booking.total_fee.toLocaleString()} บาท</span>
                </div>
                <div className="bg-accent-500/10 rounded-lg p-2 flex justify-between font-bold text-accent-600">
                  <span>มัดจำ 50%</span>
                  <span>{booking.deposit_amount.toLocaleString()} บาท</span>
                </div>
              </div>

              {/* Mock payment info */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-3">
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

              <button
                onClick={handleMockPay}
                disabled={loading}
                className="btn-primary w-full py-3 text-base"
              >
                {loading ? 'กำลังดำเนินการ...' : `ชำระ ${booking.deposit_amount.toLocaleString()} บาท`}
              </button>
              <p className="text-center text-xs text-gray-400 mt-3">
                ส่วนที่เหลือ {(booking.total_fee - booking.deposit_amount).toLocaleString()} บาท ชำระวันที่นัดหมาย
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
