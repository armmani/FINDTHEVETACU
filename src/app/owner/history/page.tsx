'use client'

import LoadingScreen from '@/components/LoadingScreen'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Calendar, MapPin, PawPrint, User } from 'lucide-react'
import { AppointmentBadge } from '@/components/StatusBadge'

interface HistoryItem {
  id: string
  pet_name: string
  pet_type: string
  pet_age: string
  symptoms: string
  preferred_datetime: string
  location_address: string
  status: string
  had_acupuncture_before: boolean
  session_number: number
  vet_name: string | null
  vet_phone: string | null
  total_fee: number | null
  cancelled_by: string | null
}

export default function OwnerHistoryPage() {
  const supabase = createClient()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // ดึง appointments ที่ไม่ใช่ open
      const { data: apts } = await supabase
        .from('appointments')
        .select('*')
        .eq('owner_id', user.id)
        .neq('status', 'open')
        .order('preferred_datetime', { ascending: false })

      if (!apts?.length) { setHistory([]); setLoading(false); return }

      // ดึง bookings แยก
      const aptIds = apts.map(a => a.id)
      const { data: bookings } = await supabase
        .from('bookings')
        .select('appointment_id, vet_id, total_fee, cancelled_by')
        .in('appointment_id', aptIds)

      // ดึงชื่อหมอ
      const vetIds = Array.from(new Set((bookings || []).map(b => b.vet_id)))
      const { data: vetProfiles } = vetIds.length
        ? await supabase.from('profiles').select('id, full_name, phone').in('id', vetIds)
        : { data: [] }

      const vetMap = Object.fromEntries((vetProfiles || []).map(p => [p.id, p]))
      const bookingMap = Object.fromEntries(
        (bookings || []).map(b => [b.appointment_id, {
          vet_name: vetMap[b.vet_id]?.full_name || null,
          vet_phone: vetMap[b.vet_id]?.phone || null,
          total_fee: b.total_fee,
          cancelled_by: b.cancelled_by,
        }])
      )

      setHistory(apts.map(a => ({
        id: a.id,
        pet_name: a.pet_name,
        pet_type: a.pet_type,
        pet_age: a.pet_age,
        symptoms: a.symptoms,
        preferred_datetime: a.preferred_datetime,
        location_address: a.location_address,
        status: a.status,
        had_acupuncture_before: a.had_acupuncture_before,
        session_number: a.session_number,
        vet_name: bookingMap[a.id]?.vet_name || null,
        vet_phone: bookingMap[a.id]?.vet_phone || null,
        total_fee: bookingMap[a.id]?.total_fee || null,
        cancelled_by: bookingMap[a.id]?.cancelled_by || null,
      })))
      setLoading(false)
    }
    load()
  }, [])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

  // จัดกลุ่มตามสัตว์เลี้ยง
  const grouped = history.reduce<Record<string, HistoryItem[]>>((acc, item) => {
    const key = item.pet_name
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  if (loading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ประวัติการรักษา</h1>
        <p className="text-gray-500 text-sm mt-0.5">ประวัติการนัดหมายและหมอที่เคยรักษา</p>
      </div>

      {history.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <PawPrint className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>ยังไม่มีประวัติการรักษา</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([petName, items]) => (
            <div key={petName}>
              {/* หัวสัตว์เลี้ยง */}
              <div className="flex items-center gap-2 mb-3">
                <PawPrint className="w-5 h-5 text-primary-500" />
                <h2 className="text-lg font-bold">{petName}</h2>
                <span className="text-gray-400 text-sm">({items[0].pet_type} · {items[0].pet_age})</span>
                <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                  {items.filter(i => i.status === 'completed').length} ครั้งที่รักษาสำเร็จ
                </span>
              </div>

              <div className="space-y-3 ml-2">
                {items.map(item => (
                  <div key={item.id} className="card border-l-4 border-l-primary-200">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                            ครั้งที่ {item.session_number}
                          </span>
                          <AppointmentBadge status={item.status as any} />
                          {item.status === 'cancelled' && item.cancelled_by && (
                            <span className="text-xs text-gray-400">
                              (ยกเลิกโดย{item.cancelled_by === 'owner' ? 'เจ้าของ' : 'หมอ'})
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.symptoms}</p>

                        <div className="space-y-1 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            {formatDate(item.preferred_datetime)}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="line-clamp-1">{item.location_address}</span>
                          </div>
                        </div>
                      </div>

                      {/* ข้อมูลหมอ */}
                      {item.vet_name ? (
                        <div className="bg-gray-50 rounded-xl p-3 text-sm min-w-[160px]">
                          <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                            <User className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">หมอที่รักษา</span>
                          </div>
                          <p className="font-semibold text-gray-800">{item.vet_name}</p>
                          {item.vet_phone && (
                            <p className="text-xs text-gray-400 mt-0.5">📞 {item.vet_phone}</p>
                          )}
                          {item.total_fee && (
                            <p className="text-xs text-primary-600 mt-1 font-medium">
                              {item.total_fee.toLocaleString()} บาท
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 italic">ยังไม่มีหมอรับ</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
