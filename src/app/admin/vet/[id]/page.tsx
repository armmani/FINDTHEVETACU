'use client'

import LoadingScreen from '@/components/LoadingScreen'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, CheckCircle, XCircle, ExternalLink, PlayCircle, ShieldCheck, ShieldX } from 'lucide-react'
import toast from 'react-hot-toast'
import { AdminDetailSkeleton } from '@/components/AdminSkeleton'
import { createNotification } from '@/lib/notifications'

const STATUS_CONFIG = {
  pending:   { label: 'รอตรวจสอบ',     color: 'text-amber-600 bg-amber-50 border-amber-200' },
  reviewing: { label: 'กำลังตรวจสอบ',  color: 'text-blue-600 bg-blue-50 border-blue-200' },
  approved:  { label: 'ยืนยันแล้ว',     color: 'text-green-600 bg-green-50 border-green-200' },
  rejected:  { label: 'ไม่ผ่าน',        color: 'text-red-500 bg-red-50 border-red-200' },
}

interface VetDetail {
  user_id: string
  status: string
  reject_reason: string | null
  license_doc_url: string | null
  license_number: string | null
  university: string | null
  graduation_year: string | null
  additional_education: string[]
  bio: string | null
  is_verified: boolean
  full_name: string
  email: string
  avatar_url: string | null
}

export default function AdminVetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [vet, setVet] = useState<VetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', id)
        .single()

      const { data: vetData } = await supabase
        .from('vet_profiles')
        .select('*')
        .eq('user_id', id)
        .single()

      if (vetData && profile) {
        setVet({
          ...vetData,
          full_name: (profile as any).full_name || '',
          email: '',
          avatar_url: (profile as any).avatar_url || null,
        })
        setRejectReason(vetData.reject_reason || '')
      }
      setLoading(false)
    }
    load()
  }, [id])

  const notifyVet = async (message: string) => {
    const { data } = await supabase.from('profiles').select('telegram_chat_id').eq('id', id).single()
    const chatId = (data as any)?.telegram_chat_id
    if (!chatId) return
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message }),
    })
  }

  const handleStartReview = async () => {
    setActing(true)
    await supabase.from('vet_profiles').update({ status: 'reviewing' }).eq('user_id', id)
    await notifyVet(`🔍 <b>FindTheVet — Admin รับเรื่องแล้ว</b>\n\n<b>${vet?.full_name}</b> กำลังถูกตรวจสอบโดย Admin\nกรุณารอผลการตรวจสอบ ระหว่างนี้จะยังแก้ไขข้อมูลไม่ได้`)
    toast.success('เปลี่ยนสถานะเป็นกำลังตรวจสอบแล้ว')
    setVet(prev => prev ? { ...prev, status: 'reviewing' } : prev)
    setActing(false)
  }

  const handleApprove = async (approve: boolean) => {
    if (!approve && !rejectReason.trim()) { toast.error('กรุณาระบุเหตุผล'); return }
    setActing(true)
    const { data: { user: adminUser } } = await supabase.auth.getUser()
    await supabase.from('vet_profiles').update({
      status: approve ? 'approved' : 'rejected',
      is_verified: approve,
      reject_reason: approve ? null : rejectReason.trim(),
      verified_by: approve ? adminUser?.id ?? null : null,
      verified_at: approve ? new Date().toISOString() : null,
    }).eq('user_id', id)

    if (approve) {
      await notifyVet(`✅ <b>FindTheVet — ยืนยันตัวตนสำเร็จ!</b>\n\n<b>${vet?.full_name}</b> ผ่านการตรวจสอบแล้ว\nตอนนี้สามารถเปิดรับงานได้แล้วครับ`)
      await createNotification(id, '✅ ยืนยันตัวตนสำเร็จ!', 'โปรไฟล์ของคุณผ่านการตรวจสอบแล้ว ตอนนี้สามารถเปิดรับงานได้', '/vet/profile')
    } else {
      await notifyVet(`❌ <b>FindTheVet — ไม่ผ่านการตรวจสอบ</b>\n\n<b>${vet?.full_name}</b>\n\n<b>เหตุผล:</b> ${rejectReason.trim()}\n\nกรุณาแก้ไขข้อมูลแล้วส่งใหม่ได้เลยครับ`)
      await createNotification(id, '❌ ไม่ผ่านการตรวจสอบ', `เหตุผล: ${rejectReason.trim()} — กรุณาแก้ไขแล้วส่งใหม่`, '/vet/profile')
    }

    toast.success(approve ? 'ยืนยันตัวตนหมอแล้ว' : 'ปฏิเสธการสมัครแล้ว')
    router.push('/admin/dashboard')
  }

  if (loading) return <LoadingScreen />
  if (!vet) return <div className="text-center py-20 text-gray-400">ไม่พบข้อมูล</div>

  const cfg = STATUS_CONFIG[vet.status as keyof typeof STATUS_CONFIG]

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">รายละเอียดสัตวแพทย์</h1>
        {cfg && (
          <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${cfg.color}`}>
            {cfg.label}
          </span>
        )}
      </div>

      {/* ข้อมูลหมอ */}
      <div className="card flex items-center gap-4">
        {vet.avatar_url
          ? <img src={vet.avatar_url} className="w-16 h-16 rounded-full object-cover shrink-0" />
          : <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-xl shrink-0">{vet.full_name[0]}</div>
        }
        <div>
          <p className="font-bold text-lg">{vet.full_name}</p>
          {vet.license_number && <p className="text-sm text-gray-500">ใบอนุญาต: {vet.license_number}</p>}
          {vet.university && <p className="text-sm text-gray-500">{vet.university}{vet.graduation_year ? ` · รุ่น ${vet.graduation_year}` : ''}</p>}
          {vet.is_verified && (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
              <ShieldCheck className="w-3.5 h-3.5" /> ยืนยันแล้ว
            </span>
          )}
        </div>
      </div>

      {/* Bio */}
      {vet.bio && (
        <div className="card">
          <p className="text-sm font-semibold mb-1 text-gray-600">ประวัติ</p>
          <p className="text-sm text-gray-700">{vet.bio}</p>
        </div>
      )}

      {/* เอกสาร */}
      {vet.license_doc_url ? (
        <div className="card">
          <p className="text-sm font-semibold mb-2">เอกสารยืนยันตัวตน</p>
          <a href={vet.license_doc_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-500 hover:underline font-medium">
            <ExternalLink className="w-4 h-4" /> เปิดดูเอกสาร
          </a>
        </div>
      ) : (
        <div className="card bg-red-50 border border-red-100">
          <p className="text-sm text-red-500">ยังไม่มีเอกสารยืนยันตัวตน</p>
        </div>
      )}

      {/* Status actions */}
      <div className="card border-2 border-dashed border-gray-200 space-y-3">
        <h2 className="font-semibold">ผลการตรวจสอบ</h2>

        {vet.status === 'pending' && (
          <button onClick={handleStartReview} disabled={acting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors">
            <PlayCircle className="w-4 h-4" /> {acting ? 'กำลังอัปเดต...' : 'รับเรื่อง — เริ่มตรวจสอบ'}
          </button>
        )}

        {(vet.status === 'reviewing' || vet.status === 'approved' || vet.status === 'rejected') && (
          <>
            <div>
              <label className="label">เหตุผลหากไม่ผ่าน</label>
              <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                className="input" placeholder="เช่น เอกสารไม่ชัดเจน / ใบอนุญาตหมดอายุ" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleApprove(true)} disabled={acting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors">
                <CheckCircle className="w-4 h-4" /> ยืนยัน
              </button>
              <button onClick={() => handleApprove(false)} disabled={acting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors">
                <XCircle className="w-4 h-4" /> ไม่ผ่าน
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
