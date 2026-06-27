'use client'

import { useEffect, useState } from 'react'
import LoadingScreen from '@/components/LoadingScreen'
import { createClient } from '@/lib/supabase'
import { Building2, Plus, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, Eye } from 'lucide-react'
import Link from 'next/link'

interface Clinic {
  id: string
  name: string
  type: 'clinic' | 'hospital'
  province: string
  status: 'pending' | 'reviewing' | 'approved' | 'rejected'
  reject_reason: string | null
  created_at: string
}

const STATUS_CONFIG = {
  pending:   { label: 'รอตรวจสอบ',     icon: Clock,         color: 'text-amber-600 bg-amber-50' },
  reviewing: { label: 'กำลังตรวจสอบ',  icon: AlertCircle,   color: 'text-blue-600 bg-blue-50' },
  approved:  { label: 'ยืนยันแล้ว',     icon: CheckCircle,   color: 'text-green-600 bg-green-50' },
  rejected:  { label: 'ไม่ผ่าน',        icon: XCircle,       color: 'text-red-500 bg-red-50' },
}

const TYPE_LABELS = { clinic: 'คลินิก', hospital: 'โรงพยาบาลสัตว์' }

export default function ManageClinicsPage() {
  const supabase = createClient()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('clinics')
        .select('id, name, type, province, status, reject_reason, created_at')
        .eq('owner_vet_id', user.id)
        .order('created_at', { ascending: false })
      setClinics((data as Clinic[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingScreen />

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">คลินิกของฉัน</h1>
          <p className="text-gray-500 text-sm mt-0.5">จัดการข้อมูลคลินิกและโรงพยาบาลสัตว์</p>
        </div>
        <Link href="/clinic/manage/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> เพิ่มคลินิก
        </Link>
      </div>

      {clinics.length === 0 ? (
        <div className="card text-center py-14">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-600 mb-1">ยังไม่มีคลินิก</p>
          <p className="text-gray-400 text-sm mb-6">เพิ่มคลินิกหรือโรงพยาบาลสัตว์ที่คุณดูแลอยู่</p>
          <Link href="/clinic/manage/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> เพิ่มคลินิกแรก
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {clinics.map(clinic => {
            const cfg = STATUS_CONFIG[clinic.status]
            const Icon = cfg.icon
            return (
              <div key={clinic.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{clinic.name}</h3>
                      <span className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">
                        {TYPE_LABELS[clinic.type]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{clinic.province}</p>
                    <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-2 ${cfg.color}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </div>
                    {clinic.status === 'rejected' && clinic.reject_reason && (
                      <div className="mt-2 flex items-start gap-1.5 text-xs text-red-500 bg-red-50 rounded-lg p-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        {clinic.reject_reason}
                      </div>
                    )}
                  </div>
                  <Link href={`/clinic/manage/${clinic.id}`}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:underline shrink-0">
                    {clinic.status === 'reviewing' || clinic.status === 'approved'
                      ? <><Eye className="w-3.5 h-3.5" /> ดู</>
                      : <>แก้ไข <ChevronRight className="w-3.5 h-3.5" /></>
                    }
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
