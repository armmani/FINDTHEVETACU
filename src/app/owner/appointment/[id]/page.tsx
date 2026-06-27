'use client'

import LoadingScreen from '@/components/LoadingScreen'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, PawPrint, Calendar, MapPin } from 'lucide-react'
import Link from 'next/link'
import AppointmentChat from '@/components/AppointmentChat'

export default function OwnerAppointmentPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const [apt, setApt] = useState<any>(null)
  const [vetName, setVetName] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const { data } = await supabase
      .from('appointments')
      .select('*, vet:preferred_vet_id(full_name)')
      .eq('id', id)
      .single()

    setApt(data)
    setVetName((data?.vet as any)?.full_name || '')
    setLoading(false)
  }

  const formatDT = (iso: string) =>
    new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

  if (loading) return <LoadingScreen />
  if (!apt) return <div className="text-center py-20 text-gray-400">ไม่พบข้อมูล</div>

  return (
    <div className="max-w-lg mx-auto h-[calc(100vh-7rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Link href="/owner/dashboard" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg">แชทกับหมอ</h1>
          <p className="text-sm text-gray-500">{vetName}</p>
        </div>
      </div>

      {/* Appointment info */}
      <div className="card mb-3 shrink-0 text-sm space-y-1.5">
        <div className="flex items-center gap-2 text-gray-700">
          <PawPrint className="w-4 h-4 text-primary-500" />
          <span className="font-medium">{apt.pet_name}</span>
          <span className="text-gray-400">· {apt.pet_type}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>
            นัดเดิม: {formatDT(apt.preferred_datetime)}
            {apt.proposed_datetime && apt.proposed_datetime !== apt.preferred_datetime && (
              <span className="ml-2 text-green-600 font-medium">→ ยืนยัน: {formatDT(apt.proposed_datetime)}</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span className="truncate">{apt.location_address}</span>
        </div>
      </div>

      {/* Chat */}
      <div className="card flex-1 p-0 overflow-hidden flex flex-col">
        <AppointmentChat
          appointmentId={id}
          currentUserId={currentUserId}
          role="owner"
          currentDatetime={apt.preferred_datetime}
          onTimeAccepted={newDT => setApt((prev: any) => ({ ...prev, proposed_datetime: newDT }))}
        />
      </div>
    </div>
  )
}
