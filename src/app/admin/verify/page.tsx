'use client'

import LoadingScreen from '@/components/LoadingScreen'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { CheckCircle, XCircle, FileText, ChevronDown, ChevronUp, Eye, ShieldX } from 'lucide-react'
import Link from 'next/link'
import { AdminDashboardSkeleton } from '@/components/AdminSkeleton'

interface PendingClinic {
  id: string
  name: string
  type: string
  province: string
  status: string
  license_doc_url: string | null
  owner_name?: string
  owner_email?: string
}

interface PendingVet {
  user_id: string
  full_name: string
  license_number: string | null
  license_doc_url: string | null
  status: string
  avatar_url: string | null
}

export default function AdminVerifyPage() {
  const supabase = createClient()
  const [clinics, setClinics] = useState<PendingClinic[]>([])
  const [vets, setVets] = useState<PendingVet[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedClinic, setExpandedClinic] = useState<string | null>(null)
  const [expandedVet, setExpandedVet] = useState<string | null>(null)
  const [clinicReject, setClinicReject] = useState<Record<string, string>>({})
  const [vetReject, setVetReject] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)

    const [{ data: clinicData }, { data: vetData }] = await Promise.all([
      supabase.from('clinics').select('id, name, type, province, status, license_doc_url, owner_vet_id')
        .in('status', ['pending', 'reviewing']),
      supabase.from('vet_profiles').select('user_id, license_number, license_doc_url, status')
        .in('status', ['pending', 'reviewing']),
    ])

    const clinicOwnerIds = Array.from(new Set((clinicData || []).map((c: any) => c.owner_vet_id).filter(Boolean)))
    let ownerMap: Record<string, { full_name: string; email: string }> = {}
    if (clinicOwnerIds.length > 0) {
      const { data: owners } = await supabase.from('profiles').select('id, full_name, email').in('id', clinicOwnerIds as string[])
      ;(owners || []).forEach((o: any) => { ownerMap[o.id] = o })
    }

    const vetIds = (vetData || []).map((v: any) => v.user_id)
    let vetProfileMap: Record<string, { full_name: string; avatar_url: string | null }> = {}
    if (vetIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', vetIds)
      ;(profiles || []).forEach((p: any) => { vetProfileMap[p.id] = p })
    }

    setClinics((clinicData || []).map((c: any) => ({
      ...c,
      owner_name: ownerMap[c.owner_vet_id]?.full_name,
      owner_email: ownerMap[c.owner_vet_id]?.email,
    })))
    setVets((vetData || []).map((v: any) => ({
      ...v,
      full_name: vetProfileMap[v.user_id]?.full_name || '',
      avatar_url: vetProfileMap[v.user_id]?.avatar_url || null,
    })))
    setLoading(false)
  }

  const adminUpdate = async (table: string, id: string, status: string, rejectReason?: string) => {
    const res = await fetch('/api/admin/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, id, status, rejectReason }),
    })
    return res.ok
  }

  const handleClinic = async (clinicId: string, approve: boolean) => {
    const status = approve ? 'approved' : 'rejected'
    if (!approve && !clinicReject[clinicId]?.trim()) { alert('กรุณาระบุเหตุผล'); return }
    setBusy(clinicId)
    const ok = await adminUpdate('clinics', clinicId, status, clinicReject[clinicId])
    if (ok) setClinics(prev => prev.filter(c => c.id !== clinicId))
    setBusy(null)
  }

  const handleStartClinicReview = async (clinicId: string) => {
    setBusy(clinicId)
    const ok = await adminUpdate('clinics', clinicId, 'reviewing')
    if (ok) setClinics(prev => prev.map(c => c.id === clinicId ? { ...c, status: 'reviewing' } : c))
    setExpandedClinic(clinicId)
    setBusy(null)
  }

  const handleVet = async (vetId: string, approve: boolean) => {
    if (!approve && !vetReject[vetId]?.trim()) { alert('กรุณาระบุเหตุผล'); return }
    setBusy(vetId)
    const ok = await adminUpdate('vet_profiles', vetId, approve ? 'approved' : 'rejected', vetReject[vetId])
    if (ok) setVets(prev => prev.filter(v => v.user_id !== vetId))
    setBusy(null)
  }

  if (loading) return <LoadingScreen />

  const totalPending = clinics.length + vets.length

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">ตรวจสอบรายการ</h1>
        <p className="text-gray-500 text-sm mt-1">
          {totalPending === 0 ? 'ไม่มีรายการรอตรวจสอบ ✓' : `รอตรวจสอบ ${totalPending} รายการ`}
        </p>
      </div>

      {/* Clinics */}
      <div>
        <h2 className="font-bold text-lg mb-3">คลินิก / โรงพยาบาล ({clinics.length})</h2>
        {clinics.length === 0
          ? <div className="card text-center py-6 text-gray-400">ไม่มีรายการรอตรวจสอบ</div>
          : <div className="space-y-3">
              {clinics.map(clinic => {
                const isExp = expandedClinic === clinic.id
                return (
                  <div key={clinic.id} className={`card border-l-4 ${clinic.status === 'reviewing' ? 'border-l-blue-400' : 'border-l-amber-400'}`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{clinic.name}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{clinic.type === 'clinic' ? 'คลินิก' : 'โรงพยาบาล'}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${clinic.status === 'reviewing' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                            {clinic.status === 'reviewing' ? 'กำลังตรวจสอบ' : 'รอตรวจสอบ'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{clinic.province} · {clinic.owner_name || '-'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setExpandedClinic(isExp ? null : clinic.id)}
                          className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium">
                          {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} ตรวจสอบ
                        </button>
                        <Link href={`/admin/clinic/${clinic.id}`} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100">
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                    {isExp && (
                      <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                        {clinic.owner_email && <p className="text-sm text-gray-500">✉️ {clinic.owner_email}</p>}
                        {clinic.license_doc_url
                          ? clinic.license_doc_url.match(/\.(jpg|jpeg|png|webp)$/i)
                            ? <img src={clinic.license_doc_url} alt="ใบอนุญาต" className="max-h-80 rounded-lg border border-gray-200 object-contain bg-gray-50" />
                            : <a href={clinic.license_doc_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"><FileText className="w-4 h-4" /> เปิดเอกสาร PDF</a>
                          : <p className="text-sm text-gray-400 italic">ยังไม่มีเอกสารแนบ</p>
                        }
                        {clinic.status === 'pending' && (
                          <button onClick={() => handleStartClinicReview(clinic.id)} disabled={busy === clinic.id}
                            className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">เริ่มตรวจสอบ</button>
                        )}
                        {clinic.status === 'reviewing' && (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <button onClick={() => handleClinic(clinic.id, true)} disabled={busy === clinic.id}
                                className="flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 font-medium">
                                <CheckCircle className="w-4 h-4" /> ยืนยัน
                              </button>
                              <button onClick={() => handleClinic(clinic.id, false)} disabled={busy === clinic.id || !clinicReject[clinic.id]?.trim()}
                                className="flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 font-medium">
                                <XCircle className="w-4 h-4" /> ปฏิเสธ
                              </button>
                            </div>
                            <textarea placeholder="เหตุผลปฏิเสธ (จำเป็นก่อนกดปฏิเสธ)" rows={2}
                              value={clinicReject[clinic.id] || ''}
                              onChange={e => setClinicReject(p => ({ ...p, [clinic.id]: e.target.value }))}
                              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
        }
      </div>

      {/* Vets */}
      <div>
        <h2 className="font-bold text-lg mb-3">สัตวแพทย์ ({vets.length})</h2>
        {vets.length === 0
          ? <div className="card text-center py-6 text-gray-400">ไม่มีรายการรอตรวจสอบ</div>
          : <div className="space-y-3">
              {vets.map(vet => {
                const isExp = expandedVet === vet.user_id
                return (
                  <div key={vet.user_id} className={`card border-l-4 ${vet.status === 'reviewing' ? 'border-l-blue-400' : 'border-l-amber-400'}`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        {vet.avatar_url
                          ? <img src={vet.avatar_url} alt={vet.full_name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                          : <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold shrink-0">{vet.full_name?.[0] || 'H'}</div>
                        }
                        <div>
                          <p className="font-semibold">{vet.full_name}</p>
                          {vet.license_number && <p className="text-xs text-gray-400">ใบอนุญาต: {vet.license_number}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setExpandedVet(isExp ? null : vet.user_id)}
                          className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium">
                          {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} ตรวจสอบ
                        </button>
                        <Link href={`/admin/vet/${vet.user_id}`} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100">
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                    {isExp && (
                      <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                        {vet.license_doc_url
                          ? vet.license_doc_url.match(/\.(jpg|jpeg|png|webp)$/i)
                            ? <img src={vet.license_doc_url} alt="ใบอนุญาต" className="max-h-80 rounded-lg border border-gray-200 object-contain bg-gray-50" />
                            : <a href={vet.license_doc_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"><FileText className="w-4 h-4" /> เปิดเอกสาร PDF</a>
                          : <p className="text-sm text-gray-400 italic">ยังไม่มีเอกสารแนบ</p>
                        }
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <button onClick={() => handleVet(vet.user_id, true)} disabled={busy === vet.user_id}
                              className="flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 font-medium">
                              <CheckCircle className="w-4 h-4" /> ยืนยัน
                            </button>
                            <button onClick={() => handleVet(vet.user_id, false)} disabled={busy === vet.user_id || !vetReject[vet.user_id]?.trim()}
                              className="flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 font-medium">
                              <XCircle className="w-4 h-4" /> ปฏิเสธ
                            </button>
                          </div>
                          <textarea placeholder="เหตุผลปฏิเสธ (จำเป็นก่อนกดปฏิเสธ)" rows={2}
                            value={vetReject[vet.user_id] || ''}
                            onChange={e => setVetReject(p => ({ ...p, [vet.user_id]: e.target.value }))}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300" />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
        }
      </div>
    </div>
  )
}
