'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Users, Stethoscope, CalendarCheck, XCircle, CheckCircle, ShieldCheck, ShieldX, Building2, Plus, Trash2, Eye, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

interface Stats {
  totalOwners: number
  totalVets: number
  totalBookings: number
  pendingBookings: number
  confirmedBookings: number
  completedBookings: number
  cancelledBookings: number
  totalRevenue: number
  totalPlatformFee: number
  totalPayout: number
}

interface OwnerRow {
  id: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  created_at: string
  email: string | null
}

interface VetRow {
  user_id: string
  university: string | null
  graduation_year: string | null
  additional_education: string[]
  is_available: boolean
  is_verified: boolean
  license_number: string | null
  license_doc_url: string | null
  full_name: string
  avatar_url: string | null
  status: string
  reject_reason: string | null
}

interface ClinicRow {
  id: string
  name: string
  type: string
  province: string
  phone: string | null
  status: string
  license_doc_url: string | null
  created_at: string
  owner_vet_id: string | null
  owner_name?: string
}

interface BookingRow {
  id: string
  status: string
  total_fee: number
  deposit_amount: number
  platform_fee: number
  vet_payout: number | null
  deposit_paid: boolean
  cancelled_by: string | null
  created_at: string
  appointments: {
    pet_name: string
    preferred_datetime: string
    profiles: { full_name: string }
  }
  vet_profile: { full_name: string } | null
}

export default function AdminDashboard() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats | null>(null)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [vets, setVets] = useState<VetRow[]>([])
  const [owners, setOwners] = useState<OwnerRow[]>([])
  const [clinics, setClinics] = useState<ClinicRow[]>([])
  const [specialtyTypes, setSpecialtyTypes] = useState<{ id: string; name_th: string; name_en: string }[]>([])
  const [newSpTh, setNewSpTh] = useState('')
  const [newSpEn, setNewSpEn] = useState('')
  const [savingSp, setSavingSp] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [verifying, setVerifying] = useState<string | null>(null)
  const [approvingClinic, setApprovingClinic] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})
  const [expandedClinic, setExpandedClinic] = useState<string | null>(null)
  const [expandedVet, setExpandedVet] = useState<string | null>(null)
  const [vetRejectReason, setVetRejectReason] = useState<Record<string, string>>({})
  const [approvingVet, setApprovingVet] = useState<string | null>(null)

  const handleAddSpecialty = async () => {
    if (!newSpTh.trim() || !newSpEn.trim()) { return }
    setSavingSp(true)
    const { data } = await supabase.from('specialty_types').insert({ name_th: newSpTh.trim(), name_en: newSpEn.trim() }).select().single()
    if (data) setSpecialtyTypes(prev => [...prev, data])
    setNewSpTh(''); setNewSpEn('')
    setSavingSp(false)
  }

  const handleDeleteSpecialty = async (id: string) => {
    await supabase.from('specialty_types').delete().eq('id', id)
    setSpecialtyTypes(prev => prev.filter(s => s.id !== id))
  }

  const adminUpdate = async (table: string, id: string, status: string, rejectReason?: string) => {
    const res = await fetch('/api/admin/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, id, status, rejectReason }),
    })
    if (!res.ok) {
      const { error } = await res.json()
      alert('Error: ' + error)
      return false
    }
    return true
  }

  const handleStartReview = async (clinicId: string) => {
    setApprovingClinic(clinicId)
    const ok = await adminUpdate('clinics', clinicId, 'reviewing')
    if (!ok) { setApprovingClinic(null); return }
    setClinics(prev => prev.map(c => c.id === clinicId ? { ...c, status: 'reviewing' } : c))
    setExpandedClinic(clinicId)
    setApprovingClinic(null)
  }

  const handleClinicApprove = async (clinicId: string, approve: boolean) => {
    setApprovingClinic(clinicId)
    const ok = await adminUpdate('clinics', clinicId, approve ? 'approved' : 'rejected', rejectReason[clinicId])
    if (!ok) { setApprovingClinic(null); return }
    setClinics(prev => prev.map(c => c.id === clinicId ? { ...c, status: approve ? 'approved' : 'rejected' } : c))
    setExpandedClinic(null)
    setApprovingClinic(null)
  }

  const handleVerify = async (vetId: string, currentVal: boolean) => {
    setVerifying(vetId)
    await supabase.from('vet_profiles').update({ is_verified: !currentVal }).eq('user_id', vetId)
    setVets(prev => prev.map(v => v.user_id === vetId ? { ...v, is_verified: !currentVal } : v))
    setVerifying(null)
  }

  const handleVetAction = async (vetId: string, approve: boolean) => {
    setApprovingVet(vetId)
    const ok = await adminUpdate('vet_profiles', vetId, approve ? 'approved' : 'rejected', vetRejectReason[vetId])
    if (!ok) { setApprovingVet(null); return }
    setVets(prev => prev.map(v => v.user_id === vetId
      ? { ...v, status: approve ? 'approved' : 'rejected', is_verified: approve, reject_reason: approve ? null : vetRejectReason[vetId] || null }
      : v))
    setExpandedVet(null)
    setApprovingVet(null)
  }

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [
      { count: ownerCount, data: ownerData },
      { count: vetCount },
      { data: allBookings },
      { data: vetData },
      { data: spData },
      { data: clinicData },
    ] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone, avatar_url, created_at', { count: 'exact' }).eq('role', 'owner').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'vet'),
      supabase.from('bookings').select(`
        *,
        appointments(pet_name, preferred_datetime, profiles:owner_id(full_name)),
        vet_profile:profiles!bookings_vet_id_fkey(full_name)
      `).order('created_at', { ascending: false }),
      supabase.from('vet_profiles').select(
        'user_id, university, graduation_year, additional_education, is_available, is_verified, license_number, license_doc_url, status, reject_reason'
      ),
      supabase.from('specialty_types').select('*').order('name_th'),
      supabase.from('clinics').select('id, name, type, province, phone, status, license_doc_url, created_at, owner_vet_id').order('created_at', { ascending: false }),
    ])

    // ดึง profiles ของ vet แยก
    const vetIds = (vetData || []).map((v: any) => v.user_id)
    let vetProfileMap: Record<string, { full_name: string; avatar_url: string | null }> = {}
    if (vetIds.length > 0) {
      const { data: vetProfiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', vetIds)
      ;(vetProfiles || []).forEach((p: any) => { vetProfileMap[p.id] = p })
    }
    const mappedVets = (vetData || []).map((v: any) => ({
      ...v,
      full_name: vetProfileMap[v.user_id]?.full_name || '',
      avatar_url: vetProfileMap[v.user_id]?.avatar_url || null,
      is_verified: v.is_verified || false,
      status: v.status || 'pending',
    }))
    setVets(mappedVets)

    const bk = allBookings || []

    const completed = bk.filter(b => b.status === 'completed')
    const totalRevenue = completed.reduce((s, b) => s + b.total_fee, 0)
    const totalPlatformFee = bk.reduce((s, b) => s + (b.platform_fee || 0), 0)
    const totalPayout = completed.reduce((s, b) => s + (b.vet_payout || 0), 0)

    setOwners((ownerData || []) as OwnerRow[])
    setSpecialtyTypes((spData || []) as any)
    const clinicList = (clinicData || []) as ClinicRow[]
    const ownerIds = Array.from(new Set(clinicList.map(c => c.owner_vet_id).filter(Boolean))) as string[]
    if (ownerIds.length > 0) {
      const { data: ownerProfiles } = await supabase.from('profiles').select('id, full_name').in('id', ownerIds)
      const ownerMap = Object.fromEntries((ownerProfiles || []).map(p => [p.id, p.full_name]))
      setClinics(clinicList.map(c => ({ ...c, owner_name: c.owner_vet_id ? ownerMap[c.owner_vet_id] : undefined })))
    } else {
      setClinics(clinicList)
    }

    setStats({
      totalOwners: ownerCount || 0,
      totalVets: vetCount || 0,
      totalBookings: bk.length,
      pendingBookings: bk.filter(b => b.status === 'pending_payment').length,
      confirmedBookings: bk.filter(b => b.status === 'confirmed' || b.status === 'awaiting_confirmation').length,
      completedBookings: completed.length,
      cancelledBookings: bk.filter(b => b.status === 'cancelled').length,
      totalRevenue,
      totalPlatformFee,
      totalPayout,
    })

    setBookings(bk as BookingRow[])
    setLoading(false)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })

  const statusLabel: Record<string, { label: string; color: string }> = {
    pending_payment: { label: 'รอชำระมัดจำ', color: 'bg-yellow-100 text-yellow-700' },
    confirmed: { label: 'ยืนยันแล้ว', color: 'bg-green-100 text-green-700' },
    awaiting_confirmation: { label: 'รอเจ้าของยืนยัน', color: 'bg-blue-100 text-blue-700' },
    completed: { label: 'เสร็จสมบูรณ์', color: 'bg-primary-100 text-primary-700' },
    cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-700' },
  }

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter)

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* User stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="text-3xl font-bold">{stats?.totalOwners}</p>
          <p className="text-sm text-gray-500">เจ้าของสัตว์</p>
        </div>
        <div className="card text-center">
          <Stethoscope className="w-8 h-8 text-primary-500 mx-auto mb-2" />
          <p className="text-3xl font-bold">{stats?.totalVets}</p>
          <p className="text-sm text-gray-500">สัตวแพทย์</p>
        </div>
        <div className="card text-center">
          <CalendarCheck className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-3xl font-bold">{stats?.completedBookings}</p>
          <p className="text-sm text-gray-500">รักษาสำเร็จ</p>
        </div>
        <div className="card text-center">
          <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-3xl font-bold">{stats?.cancelledBookings}</p>
          <p className="text-sm text-gray-500">ยกเลิก</p>
        </div>
      </div>


      {/* Specialty Types Management */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-primary-500" />
          จัดการแผนกเฉพาะทาง
        </h2>
        <div className="card space-y-4">
          <div className="flex gap-2">
            <input value={newSpTh} onChange={e => setNewSpTh(e.target.value)}
              placeholder="ชื่อภาษาไทย เช่น ฝังเข็ม" className="input flex-1" />
            <input value={newSpEn} onChange={e => setNewSpEn(e.target.value)}
              placeholder="English e.g. Acupuncture" className="input flex-1" />
            <button onClick={handleAddSpecialty} disabled={savingSp || !newSpTh || !newSpEn}
              className="btn-primary px-4 flex items-center gap-1 shrink-0">
              <Plus className="w-4 h-4" /> เพิ่ม
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {specialtyTypes.map(sp => (
              <div key={sp.id} className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm">
                <span>{sp.name_th}</span>
                <span className="text-blue-400 text-xs">/ {sp.name_en}</span>
                <button onClick={() => handleDeleteSpecialty(sp.id)}
                  className="text-blue-300 hover:text-red-500 transition-colors ml-1">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {specialtyTypes.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีแผนก</p>}
          </div>
        </div>
      </div>

      {/* All Clinics */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary-500" />
          รายชื่อคลินิก ({clinics.length})
          {clinics.filter(c => c.status === 'pending').length > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              รอตรวจสอบ {clinics.filter(c => c.status === 'pending').length}
            </span>
          )}
        </h2>
        {clinics.length === 0 ? (
          <div className="card text-center py-8 text-gray-400">ยังไม่มีคลินิกในระบบ</div>
        ) : (
          <div className="space-y-3">
            {clinics.map(clinic => {
              const statusColor = clinic.status === 'approved'
                ? 'border-l-primary-400 bg-primary-50/30'
                : clinic.status === 'rejected'
                ? 'border-l-red-400 bg-red-50/30'
                : clinic.status === 'reviewing'
                ? 'border-l-blue-400 bg-blue-50/30'
                : 'border-l-amber-400 bg-amber-50/30'
              const statusBadge = clinic.status === 'approved'
                ? 'bg-green-100 text-green-700'
                : clinic.status === 'rejected'
                ? 'bg-red-100 text-red-600'
                : clinic.status === 'reviewing'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700'
              const statusLabel = clinic.status === 'approved' ? 'ยืนยันแล้ว'
                : clinic.status === 'rejected' ? 'ไม่ผ่าน'
                : clinic.status === 'reviewing' ? 'กำลังตรวจสอบ'
                : 'รอตรวจสอบ'
              const isExpanded = expandedClinic === clinic.id
              const needsAction = clinic.status === 'pending' || clinic.status === 'reviewing'
              return (
                <div key={clinic.id} className={`card border-l-4 ${statusColor}`}>
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{clinic.name}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {clinic.type === 'clinic' ? 'คลินิก' : 'โรงพยาบาลสัตว์'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {clinic.province} · {clinic.owner_name || '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {needsAction && (
                        <button onClick={() => setExpandedClinic(isExpanded ? null : clinic.id)}
                          className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          ตรวจสอบ
                        </button>
                      )}
                      <Link href={`/admin/clinic/${clinic.id}`}
                        className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition-colors">
                        <Eye className="w-4 h-4" /> รายละเอียด
                      </Link>
                    </div>
                  </div>

                  {/* Expandable review panel */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                      {/* License doc */}
                      {clinic.license_doc_url ? (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-2">เอกสารใบอนุญาต</p>
                          {clinic.license_doc_url.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                            <img src={clinic.license_doc_url} alt="ใบอนุญาต"
                              className="max-h-96 rounded-lg border border-gray-200 object-contain bg-gray-50" />
                          ) : (
                            <a href={clinic.license_doc_url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                              <FileText className="w-4 h-4" /> เปิดเอกสาร PDF
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">ยังไม่มีเอกสารแนบ</p>
                      )}

                      {/* Start review button (for pending) */}
                      {clinic.status === 'pending' && (
                        <button onClick={() => handleStartReview(clinic.id)}
                          disabled={approvingClinic === clinic.id}
                          className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          เริ่มตรวจสอบ
                        </button>
                      )}

                      {/* Approve / Reject (for reviewing) */}
                      {clinic.status === 'reviewing' && (
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <button onClick={() => handleClinicApprove(clinic.id, true)}
                              disabled={approvingClinic === clinic.id}
                              className="flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors font-medium">
                              <CheckCircle className="w-4 h-4" /> ยืนยัน
                            </button>
                            <button onClick={() => handleClinicApprove(clinic.id, false)}
                              disabled={approvingClinic === clinic.id || !rejectReason[clinic.id]?.trim()}
                              className="flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors font-medium">
                              <XCircle className="w-4 h-4" /> ปฏิเสธ
                            </button>
                          </div>
                          <textarea
                            placeholder="ระบุเหตุผลปฏิเสธ (จำเป็นก่อนกดปฏิเสธ)"
                            value={rejectReason[clinic.id] || ''}
                            onChange={e => setRejectReason(prev => ({ ...prev, [clinic.id]: e.target.value }))}
                            rows={2}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Vet profiles */}
      <div>
        <h2 className="text-lg font-bold mb-4">
          รายชื่อสัตวแพทย์ ({vets.length})
          {vets.filter(v => v.status === 'pending' || v.status === 'reviewing').length > 0 && (
            <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              รอตรวจสอบ {vets.filter(v => v.status === 'pending' || v.status === 'reviewing').length}
            </span>
          )}
        </h2>
        {vets.length === 0 ? (
          <div className="card text-center py-8 text-gray-400">ยังไม่มีสัตวแพทย์ในระบบ</div>
        ) : (
          <div className="space-y-3">
            {vets.map(vet => {
              const vetStatusColor = vet.status === 'approved'
                ? 'border-l-primary-400 bg-primary-50/30'
                : vet.status === 'rejected'
                ? 'border-l-red-400 bg-red-50/30'
                : vet.status === 'reviewing'
                ? 'border-l-blue-400 bg-blue-50/30'
                : 'border-l-amber-400 bg-amber-50/30'
              const vetNeedsAction = vet.status === 'pending' || vet.status === 'reviewing'
              const isVetExpanded = expandedVet === vet.user_id
              return (
                <div key={vet.user_id} className={`card border-l-4 ${vetStatusColor}`}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {vet.avatar_url ? (
                        <img src={vet.avatar_url} alt={vet.full_name}
                          className="w-10 h-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold shrink-0 text-sm">
                          {vet.full_name?.[0] || 'H'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{vet.full_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            vet.status === 'approved' ? 'bg-green-100 text-green-700'
                            : vet.status === 'reviewing' ? 'bg-blue-100 text-blue-700'
                            : vet.status === 'rejected' ? 'bg-red-100 text-red-500'
                            : 'bg-amber-100 text-amber-700'
                          }`}>
                            {vet.status === 'approved' ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
                            {vet.status === 'approved' ? 'ยืนยันแล้ว' : vet.status === 'reviewing' ? 'กำลังตรวจสอบ' : vet.status === 'rejected' ? 'ไม่ผ่าน' : 'รอตรวจสอบ'}
                          </span>
                        </div>
                        {vet.license_number && (
                          <p className="text-xs text-gray-400 mt-0.5">ใบอนุญาต: {vet.license_number}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {vetNeedsAction && (
                        <button onClick={() => setExpandedVet(isVetExpanded ? null : vet.user_id)}
                          className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium transition-colors">
                          {isVetExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          ตรวจสอบ
                        </button>
                      )}
                      <Link href={`/admin/vet/${vet.user_id}`}
                        className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition-colors">
                        <Eye className="w-4 h-4" /> รายละเอียด
                      </Link>
                    </div>
                  </div>

                  {isVetExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                      {vet.license_doc_url ? (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-2">เอกสารใบอนุญาต</p>
                          {vet.license_doc_url.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                            <img src={vet.license_doc_url} alt="ใบอนุญาต"
                              className="max-h-96 rounded-lg border border-gray-200 object-contain bg-gray-50" />
                          ) : (
                            <a href={vet.license_doc_url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                              <FileText className="w-4 h-4" /> เปิดเอกสาร PDF
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">ยังไม่มีเอกสารแนบ</p>
                      )}
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleVetAction(vet.user_id, true)}
                            disabled={approvingVet === vet.user_id}
                            className="flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors font-medium">
                            <CheckCircle className="w-4 h-4" /> ยืนยัน
                          </button>
                          <button onClick={() => handleVetAction(vet.user_id, false)}
                            disabled={approvingVet === vet.user_id || !vetRejectReason[vet.user_id]?.trim()}
                            className="flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors font-medium">
                            <XCircle className="w-4 h-4" /> ปฏิเสธ
                          </button>
                        </div>
                        <textarea
                          placeholder="ระบุเหตุผลปฏิเสธ (จำเป็นก่อนกดปฏิเสธ)"
                          value={vetRejectReason[vet.user_id] || ''}
                          onChange={e => setVetRejectReason(prev => ({ ...prev, [vet.user_id]: e.target.value }))}
                          rows={2}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Owner list */}
      {owners.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-4">รายชื่อเจ้าของสัตว์ ({owners.length})</h2>
          <div className="space-y-2">
            {owners.map((o, i) => (
              <div key={o.id} className="card flex items-center gap-4 py-3">
                <span className="text-sm text-gray-300 w-6 text-right shrink-0">{i + 1}</span>
                {o.avatar_url ? (
                  <img src={o.avatar_url} alt={o.full_name}
                    className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0 text-sm">
                    {o.full_name?.[0] || '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800">{o.full_name || '-'}</p>
                  {o.phone && <p className="text-sm text-gray-500">📞 {o.phone}</p>}
                </div>
                <p className="text-xs text-gray-400 shrink-0">
                  {new Date(o.created_at).toLocaleDateString('th-TH', { dateStyle: 'short' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bookings table — hidden for now */}
      {false && <div>
        <h2 className="text-lg font-bold mb-4">รายการ Booking {filter !== 'all' && `(${statusLabel[filter]?.label})`}</h2>
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="card text-center py-8 text-gray-400">ไม่มีรายการ</div>
          ) : filtered.map(b => {
            const apt = b.appointments as any
            return (
              <div key={b.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-sm space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{apt?.pet_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabel[b.status]?.color}`}>
                        {statusLabel[b.status]?.label}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      เจ้าของ: {apt?.profiles?.full_name} · หมอ: {(b.vet_profile as any)?.full_name || '-'}
                    </div>
                    <div className="text-gray-400 text-xs">
                      นัด: {apt?.preferred_datetime ? formatDate(apt.preferred_datetime) : '-'} · สร้าง: {formatDate(b.created_at)}
                    </div>
                  </div>
                  <div className="text-right text-sm space-y-0.5">
                    <div className="font-semibold">{b.total_fee.toLocaleString()} บาท</div>
                    <div className="text-xs text-gray-400">
                      {b.deposit_paid ? `มัดจำ ${b.deposit_amount.toLocaleString()} บาท ✓` : 'ยังไม่ชำระมัดจำ'}
                    </div>
                    {b.platform_fee > 0 && (
                      <div className="text-xs text-green-600">Platform Fee: {b.platform_fee.toLocaleString()} บาท</div>
                    )}
                    {b.cancelled_by && (
                      <div className="text-xs text-red-400">ยกเลิกโดย{b.cancelled_by === 'owner' ? 'เจ้าของ' : 'หมอ'}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>}
    </div>
  )
}
