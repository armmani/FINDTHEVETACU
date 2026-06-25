'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, CheckCircle, XCircle, ExternalLink, MapPin, Phone, Clock, Building2, Globe, Save, PlayCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { notifyAdmin } from '@/lib/telegram'

const DAY_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

interface ClinicDetail {
  id: string
  name: string
  name_en: string | null
  type: 'clinic' | 'hospital'
  phone: string | null
  line_id: string | null
  facebook: string | null
  website: string | null
  province: string
  district: string | null
  sub_district: string | null
  address_detail: string | null
  opening_hours: Record<string, { open: string; close: string }> | null
  status: string
  reject_reason: string | null
  license_doc_url: string | null
  created_at: string
  owner: { full_name: string; phone: string | null; email: string | null; line_id: string | null } | null
  clinic_specialties: { specialty_types: { name_th: string; name_en: string } | null }[]
}

export default function AdminClinicDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [clinic, setClinic] = useState<ClinicDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [ownerId, setOwnerId] = useState<string | null>(null)

  // editable fields
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [phone, setPhone] = useState('')
  const [lineId, setLineId] = useState('')
  const [facebook, setFacebook] = useState('')
  const [website, setWebsite] = useState('')
  const [province, setProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [subDistrict, setSubDistrict] = useState('')
  const [address, setAddress] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('clinics')
        .select('*, clinic_specialties(specialty_types(name_th, name_en))')
        .eq('id', id)
        .single()

      if (data) {
        const c = data as any
        // ดึง owner แยก
        if (c.owner_vet_id) {
          const { data: ownerData } = await supabase
            .from('profiles').select('full_name, phone, email, line_id').eq('id', c.owner_vet_id).single()
          c.owner = ownerData
        }
        setClinic(c)
        setOwnerId(c.owner_vet_id)
        setName(c.name || '')
        setNameEn(c.name_en || '')
        setPhone(c.phone || '')
        setLineId(c.line_id || '')
        setFacebook(c.facebook || '')
        setWebsite(c.website || '')
        setProvince(c.province || '')
        setDistrict(c.district || '')
        setSubDistrict(c.sub_district || '')
        setAddress(c.address_detail || '')
        setRejectReason(c.reject_reason || '')
      }
      setLoading(false)
    }
    load()
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('clinics').update({
      name: name.trim(),
      name_en: nameEn.trim() || null,
      phone: phone.trim() || null,
      line_id: lineId.trim() || null,
      facebook: facebook.trim() || null,
      website: website.trim() || null,
      province: province.trim(),
      district: district.trim() || null,
      sub_district: subDistrict.trim() || null,
      address_detail: address.trim() || null,
    }).eq('id', id)
    if (error) toast.error('บันทึกไม่สำเร็จ')
    else toast.success('บันทึกแล้ว')
    setSaving(false)
  }

  const notifyOwner = async (message: string) => {
    if (!ownerId) return
    const { data } = await supabase.from('profiles').select('telegram_chat_id').eq('id', ownerId).single()
    const chatId = (data as any)?.telegram_chat_id
    if (!chatId) return
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message }),
    })
  }

  const handleStartReview = async () => {
    setReviewing(true)
    const { error } = await supabase.from('clinics').update({ status: 'reviewing' }).eq('id', id)
    if (error) { toast.error('Error: ' + error.message); console.error('START_REVIEW_ERROR', error); setReviewing(false); return }
    await notifyOwner(`🔍 <b>FindTheVet — Admin รับเรื่องแล้ว</b>\n\n<b>${clinic?.name}</b> กำลังถูกตรวจสอบโดย Admin\nกรุณารอผลการตรวจสอบ ระหว่างนี้จะยังแก้ไขข้อมูลไม่ได้`)
    toast.success('เปลี่ยนสถานะเป็นกำลังตรวจสอบแล้ว')
    setClinic(prev => prev ? { ...prev, status: 'reviewing' } : prev)
    setReviewing(false)
  }

  const handleApprove = async (approve: boolean) => {
    if (!approve && !rejectReason.trim()) {
      toast.error('กรุณาระบุเหตุผลที่ไม่อนุมัติ')
      return
    }
    setApproving(true)
    const { error } = await supabase.from('clinics').update({
      status: approve ? 'approved' : 'rejected',
      reject_reason: approve ? null : rejectReason.trim(),
    }).eq('id', id)
    if (error) { toast.error('Error: ' + error.message); console.error('CLINIC_APPROVE_ERROR', error); setApproving(false); return }

    if (approve) {
      await notifyOwner(`✅ <b>FindTheVet — คลินิกได้รับการยืนยัน!</b>\n\n<b>${clinic?.name}</b> ผ่านการตรวจสอบแล้ว\nตอนนี้คลินิกของคุณแสดงในระบบ FindTheVet แล้วครับ`)
    } else {
      await notifyOwner(`❌ <b>FindTheVet — คลินิกไม่ผ่านการตรวจสอบ</b>\n\n<b>${clinic?.name}</b>\n\n<b>เหตุผล:</b> ${rejectReason.trim()}\n\nกรุณาแก้ไขข้อมูลแล้วส่งใหม่ได้เลยครับ`)
    }

    toast.success(approve ? 'อนุมัติคลินิกแล้ว' : 'ปฏิเสธคลินิกแล้ว')
    router.push('/admin/dashboard')
  }

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
  if (!clinic) return <div className="text-center py-20 text-gray-400">ไม่พบข้อมูลคลินิก</div>

  const statusColor = clinic.status === 'approved' ? 'bg-green-100 text-green-700'
    : clinic.status === 'rejected' ? 'bg-red-100 text-red-600'
    : 'bg-amber-100 text-amber-700'
  const statusLabel = clinic.status === 'approved' ? 'อนุมัติแล้ว'
    : clinic.status === 'rejected' ? 'ไม่อนุมัติ' : 'รอตรวจสอบ'

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">รายละเอียดคลินิก</h1>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* ผู้ส่ง */}
      <div className="card bg-amber-50 dark:bg-amber-900/20 border border-amber-100">
        <p className="text-sm font-semibold text-amber-700 mb-1">ส่งโดย</p>
        <p className="font-medium">{(clinic.owner as any)?.full_name || '-'}</p>
        {(clinic.owner as any)?.phone && <p className="text-sm text-gray-500 mt-0.5">📞 {(clinic.owner as any).phone}</p>}
        {(clinic.owner as any)?.email && <p className="text-sm text-gray-500 mt-0.5">✉️ {(clinic.owner as any).email}</p>}
        {(clinic.owner as any)?.line_id && <p className="text-sm text-gray-500 mt-0.5">💬 LINE: {(clinic.owner as any).line_id}</p>}
        <p className="text-xs text-gray-400 mt-1">
          {new Date(clinic.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </div>

      {/* ใบอนุญาต */}
      {clinic.license_doc_url && (
        <div className="card">
          <p className="text-sm font-semibold mb-2">ใบอนุญาตดำเนินการสถานพยาบาลสัตว์</p>
          <a href={clinic.license_doc_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-500 hover:underline font-medium">
            <ExternalLink className="w-4 h-4" /> เปิดดูเอกสาร
          </a>
        </div>
      )}

      {/* แก้ไขข้อมูล */}
      <div className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary-500" /> ข้อมูลทั่วไป
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">ประเภท</label>
            <input value={clinic.type === 'clinic' ? 'คลินิก' : 'โรงพยาบาลสัตว์'} disabled className="input bg-gray-50" />
          </div>
          <div>
            <label className="label">ชื่อ (ภาษาไทย)</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">ชื่อ (ภาษาอังกฤษ)</label>
            <input value={nameEn} onChange={e => setNameEn(e.target.value)} className="input" placeholder="ไม่บังคับ" />
          </div>
        </div>

        <h2 className="font-semibold flex items-center gap-2 pt-2">
          <Phone className="w-4 h-4 text-primary-500" /> ช่องทางติดต่อ
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">เบอร์โทร</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">LINE ID</label>
            <input value={lineId} onChange={e => setLineId(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Facebook</label>
            <input value={facebook} onChange={e => setFacebook(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Website</label>
            <input value={website} onChange={e => setWebsite(e.target.value)} className="input" />
          </div>
        </div>

        <h2 className="font-semibold flex items-center gap-2 pt-2">
          <MapPin className="w-4 h-4 text-primary-500" /> ที่อยู่
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">จังหวัด</label>
            <input value={province} onChange={e => setProvince(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">อำเภอ/เขต</label>
            <input value={district} onChange={e => setDistrict(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">ตำบล/แขวง</label>
            <input value={subDistrict} onChange={e => setSubDistrict(e.target.value)} className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">รายละเอียดที่อยู่</label>
            <input value={address} onChange={e => setAddress(e.target.value)} className="input" />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="btn-primary flex items-center gap-2 w-full justify-center">
          <Save className="w-4 h-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
        </button>
      </div>

      {/* เวลาเปิด */}
      {clinic.opening_hours && Object.keys(clinic.opening_hours).length > 0 && (
        <div className="card">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary-500" /> เวลาเปิด-ปิด
          </h2>
          <div className="space-y-1">
            {[1,2,3,4,5,6,0].map(d => {
              const h = clinic.opening_hours![d.toString()]
              if (!h) return null
              return (
                <div key={d} className="flex justify-between text-sm">
                  <span className="text-gray-500 w-28">{DAY_TH[d]}</span>
                  <span className="font-medium">{h.open} – {h.close}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* แผนกเฉพาะทาง */}
      {clinic.clinic_specialties?.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-2">แผนกเฉพาะทาง</h2>
          <div className="flex flex-wrap gap-2">
            {clinic.clinic_specialties.map((sp, i) => (
              <span key={i} className="text-sm bg-primary-50 text-primary-700 border border-primary-100 px-3 py-1 rounded-full">
                {sp.specialty_types?.name_th}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status actions */}
      <div className="card border-2 border-dashed border-gray-200 space-y-3">
        <h2 className="font-semibold">ผลการตรวจสอบ</h2>

        {clinic.status === 'pending' && (
          <button onClick={handleStartReview} disabled={reviewing}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors">
            <PlayCircle className="w-4 h-4" /> {reviewing ? 'กำลังอัปเดต...' : 'รับเรื่อง — เริ่มตรวจสอบ'}
          </button>
        )}

        {(clinic.status === 'reviewing' || clinic.status === 'approved' || clinic.status === 'rejected') && (
          <>
            <div>
              <label className="label">เหตุผลหากไม่อนุมัติ</label>
              <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                className="input" placeholder="เช่น ใบอนุญาตไม่ถูกต้อง / ข้อมูลไม่ครบ" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleApprove(true)} disabled={approving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors">
                <CheckCircle className="w-4 h-4" /> ยืนยัน
              </button>
              <button onClick={() => handleApprove(false)} disabled={approving}
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
