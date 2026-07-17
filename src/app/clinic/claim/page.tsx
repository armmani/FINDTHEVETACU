'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Search, Upload, X, ArrowLeft, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingScreen from '@/components/LoadingScreen'
import Image from 'next/image'

interface UnclaimedClinic {
  id: string
  name: string
  type: 'clinic' | 'hospital'
  province: string
  district: string | null
  phone: string | null
}

const TYPE_LABELS = { clinic: 'คลินิก', hospital: 'โรงพยาบาลสัตว์' }

function ClaimClinicInner() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const presetClinicId = searchParams.get('clinic_id')

  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UnclaimedClinic[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<UnclaimedClinic | null>(null)
  const [proofFile, setProofFile] = useState<{ file: File; preview: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [existingRequest, setExistingRequest] = useState(false)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const loadPreset = async () => {
      if (presetClinicId) {
        const { data } = await supabase
          .from('clinics')
          .select('id, name, type, province, district, phone')
          .eq('id', presetClinicId)
          .is('owner_vet_id', null)
          .eq('status', 'approved')
          .single()
        if (data) setSelected(data as UnclaimedClinic)
      }
      setLoading(false)
    }
    loadPreset()
  }, [presetClinicId])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    timer.current = setTimeout(async () => {
      const q = query.trim()
      const { data } = await supabase
        .from('clinics')
        .select('id, name, type, province, district, phone')
        .is('owner_vet_id', null)
        .eq('status', 'approved')
        .or(`name.ilike.%${q}%,province.ilike.%${q}%,district.ilike.%${q}%`)
        .limit(20)
      setResults((data as UnclaimedClinic[]) || [])
      setSearching(false)
    }, 350)
  }, [query])

  useEffect(() => {
    if (!selected) { setExistingRequest(false); return }
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('clinic_ownership_requests')
        .select('id')
        .eq('clinic_id', selected.id)
        .eq('requester_id', user.id)
        .eq('status', 'pending')
        .limit(1)
      setExistingRequest((data?.length ?? 0) > 0)
    }
    check()
  }, [selected])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) { toast.error('กรุณาเลือกคลินิก/โรงพยาบาล'); return }
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }

    let proof_url = null
    if (proofFile) {
      const { compressImage } = await import('@/lib/compressImage')
      const compressed = await compressImage(proofFile.file, { maxWidthPx: 1600, qualityJpeg: 0.8, maxSizeKB: 500 })
      const path = `clinic-claims/${user.id}-${selected.id}-${Date.now()}.jpg`
      const { data: up, error: upErr } = await supabase.storage
        .from('clinic-docs')
        .upload(path, compressed)
      if (!upErr && up) {
        proof_url = supabase.storage.from('clinic-docs').getPublicUrl(up.path).data.publicUrl
      }
    }

    const { error } = await supabase.from('clinic_ownership_requests').insert({
      clinic_id: selected.id,
      requester_id: user.id,
      proof_url,
    })
    setSubmitting(false)
    if (error) { toast.error('ส่งคำขอไม่สำเร็จ: ' + error.message); return }
    toast.success('ส่งคำขอแล้ว — แอดมินจะตรวจสอบและแจ้งผล')
    router.push('/clinic/manage')
  }

  if (loading) return <LoadingScreen />

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-600" /> ขอเชื่อมโรงพยาบาล/คลินิก
          </h1>
          <p className="text-sm text-gray-500">คลินิกที่มีอยู่แล้วในระบบแต่ยังไม่มีเจ้าของ</p>
        </div>
      </div>

      <div className="rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 text-sm text-blue-700 dark:text-blue-300 space-y-1">
        <p className="font-semibold">วิธีใช้งาน</p>
        <ol className="list-decimal pl-4 space-y-0.5 text-blue-600 dark:text-blue-400">
          <li>ค้นหาชื่อคลินิก/โรงพยาบาลของคุณ</li>
          <li>เลือกรายการที่ถูกต้อง</li>
          <li>แนบหลักฐาน (ใบอนุญาตประกอบกิจการ, รูปหน้าร้าน ฯลฯ)</li>
          <li>แอดมินจะตรวจสอบและเชื่อมบัญชีให้ภายใน 1-2 วัน</li>
        </ol>
      </div>

      {!selected ? (
        <div className="space-y-3">
          <div>
            <label className="label">ค้นหาชื่อคลินิก/โรงพยาบาล</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="พิมพ์ชื่อ หรือจังหวัด (อย่างน้อย 2 ตัวอักษร)"
                className="input pl-9" autoFocus />
            </div>
          </div>

          {searching && <p className="text-sm text-center text-gray-400">กำลังค้นหา...</p>}

          {results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">เลือกคลินิก/โรงพยาบาลของคุณ:</p>
              {results.map(c => (
                <button key={c.id} onClick={() => setSelected(c)}
                  className="card w-full text-left flex items-start gap-3 hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-sm text-gray-500">
                      {TYPE_LABELS[c.type]} · {[c.district, c.province].filter(Boolean).join(', ')}
                    </p>
                    {c.phone && <p className="text-xs text-gray-400 mt-0.5">{c.phone}</p>}
                    <p className="text-xs text-amber-500 mt-2">ยังไม่มีเจ้าของ</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-gray-400 text-sm">ไม่พบคลินิก/โรงพยาบาลชื่อ "{query}"</p>
              <p className="text-xs text-gray-300 mt-1">ถ้ายังไม่มีในระบบ ลองสร้างใหม่ที่หน้า "เพิ่มคลินิก" แทน</p>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800 flex items-center gap-3">
            <Building2 className="w-6 h-6 text-primary-600 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-primary-800 dark:text-primary-200">{selected.name}</p>
              <p className="text-xs text-primary-600 dark:text-primary-400">
                {TYPE_LABELS[selected.type]} · {[selected.district, selected.province].filter(Boolean).join(', ')}
              </p>
            </div>
            {!presetClinicId && (
              <button type="button" onClick={() => { setSelected(null); setProofFile(null) }}
                className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            )}
          </div>

          {existingRequest && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-700 dark:text-amber-300">
              คุณมีคำขอที่รอการตรวจสอบสำหรับคลินิกนี้อยู่แล้ว
            </div>
          )}

          <div>
            <label className="label">
              หลักฐานความเป็นเจ้าของ
              <span className="text-gray-400 font-normal ml-1">(ไม่บังคับ แต่ช่วยให้อนุมัติเร็วขึ้น)</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">เช่น ใบอนุญาตประกอบกิจการสถานพยาบาลสัตว์, รูปหน้าร้าน</p>
            <label className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer h-36 transition-colors overflow-hidden
              ${proofFile ? 'border-primary-300' : 'border-gray-200 hover:border-primary-300 dark:border-gray-700'}`}>
              {proofFile ? (
                <div className="relative w-full h-full">
                  <Image src={proofFile.preview} alt="proof" fill className="object-cover" />
                  <button type="button" onClick={e => { e.preventDefault(); setProofFile(null) }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow z-10">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-gray-300 mb-1" />
                  <span className="text-sm text-gray-400">อัพโหลดรูปหลักฐาน</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                setProofFile({ file, preview: URL.createObjectURL(file) })
                e.target.value = ''
              }} />
            </label>
          </div>

          <button type="submit" disabled={submitting || existingRequest} className="btn-primary w-full py-3">
            {submitting ? 'กำลังส่งคำขอ...' : 'ส่งคำขอเชื่อมโรงพยาบาล'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function ClaimClinicPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ClaimClinicInner />
    </Suspense>
  )
}
