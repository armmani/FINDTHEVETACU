'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Lock, Clock, CheckCircle, XCircle, AlertCircle, Save, Camera } from 'lucide-react'
import { getProvinces, getDistricts, getSubDistricts } from '@/lib/thaiAddress'
import { notifyAdmin } from '@/lib/telegram'
import { compressImage } from '@/lib/compressImage'

const DAYS = [
  { key: '1', label: 'จันทร์' }, { key: '2', label: 'อังคาร' },
  { key: '3', label: 'พุธ' }, { key: '4', label: 'พฤหัสบดี' },
  { key: '5', label: 'ศุกร์' }, { key: '6', label: 'เสาร์' },
  { key: '0', label: 'อาทิตย์' },
]

const STATUS_CONFIG = {
  pending:   { label: 'รอตรวจสอบ',      icon: Clock,        color: 'text-amber-600 bg-amber-50 border-amber-200' },
  reviewing: { label: 'กำลังตรวจสอบ',   icon: AlertCircle,  color: 'text-blue-600 bg-blue-50 border-blue-200' },
  approved:  { label: 'ยืนยันแล้ว',      icon: CheckCircle,  color: 'text-green-600 bg-green-50 border-green-200' },
  rejected:  { label: 'ไม่ผ่าน',         icon: XCircle,      color: 'text-red-500 bg-red-50 border-red-200' },
}

interface DayHours { open: string; close: string }

export default function EditClinicPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [status, setStatus] = useState<string>('')
  const [rejectReason, setRejectReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ownerName, setOwnerName] = useState('')
  const [editRequested, setEditRequested] = useState(false)

  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [type, setType] = useState<'clinic' | 'hospital'>('clinic')
  const [phone, setPhone] = useState('')
  const [lineId, setLineId] = useState('')
  const [facebook, setFacebook] = useState('')
  const [website, setWebsite] = useState('')
  const [province, setProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [subDistrict, setSubDistrict] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [openingHours, setOpeningHours] = useState<Record<string, DayHours>>({})
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('full_name_th').eq('id', user.id).single()
      setOwnerName((profile as any)?.full_name_th || '')

      const { data } = await supabase.from('clinics').select('*').eq('id', id).eq('owner_vet_id', user.id).single()
      if (!data) { router.push('/clinic/manage'); return }

      setStatus(data.status)
      setRejectReason(data.reject_reason)
      setName(data.name || '')
      setNameEn(data.name_en || '')
      setType(data.type || 'clinic')
      setPhone(data.phone || '')
      setLineId(data.line_id || '')
      setFacebook(data.facebook || '')
      setWebsite(data.website || '')
      setProvince(data.province || '')
      setDistrict(data.district || '')
      setSubDistrict(data.sub_district || '')
      setAddressDetail(data.address_detail || '')
      setOpeningHours(data.opening_hours || {})
      setPhotoUrl(data.photo_url || null)
      setLoading(false)
    }
    load()
  }, [id])

  const toggleDay = (day: string) => {
    setOpeningHours(prev => {
      if (prev[day]) { const n = { ...prev }; delete n[day]; return n }
      return { ...prev, [day]: { open: '08:00', close: '17:00' } }
    })
  }

  const updateDayHours = (day: string, field: 'open' | 'close', val: string) => {
    setOpeningHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }))
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('กรุณากรอกชื่อคลินิก'); return }
    setSaving(true)

    const wasRejected = status === 'rejected'

    let updatedPhotoUrl = photoUrl
    if (newPhotoFile) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const compressed = await compressImage(newPhotoFile, { maxWidthPx: 1200, qualityJpeg: 0.85, maxSizeKB: 400 })
        const photoPath = `clinic-photos/${user.id}-${Date.now()}.jpg`
        const { error: photoErr } = await supabase.storage.from('clinic-docs').upload(photoPath, compressed)
        if (!photoErr) {
          const { data: photoUrlData } = supabase.storage.from('clinic-docs').getPublicUrl(photoPath)
          updatedPhotoUrl = photoUrlData.publicUrl
        }
      }
    }

    const { error } = await supabase.from('clinics').update({
      name: name.trim(),
      name_en: nameEn.trim() || null,
      phone: phone.trim() || null,
      line_id: lineId.trim() || null,
      facebook: facebook.trim() || null,
      website: website.trim() || null,
      province,
      district: district || null,
      sub_district: subDistrict || null,
      address_detail: addressDetail.trim() || null,
      opening_hours: openingHours,
      photo_url: updatedPhotoUrl,
      ...(wasRejected || (status === 'approved' && editRequested) ? { status: 'pending', reject_reason: null } : {}),
    }).eq('id', id)

    if (!error) setPhotoUrl(updatedPhotoUrl)

    if (error) { toast.error('บันทึกไม่สำเร็จ'); setSaving(false); return }

    if (wasRejected || (status === 'approved' && editRequested)) {
      notifyAdmin(`🔄 <b>FindTheVet — ส่งข้อมูลใหม่</b>\n\n<b>${name.trim()}</b> แก้ไขและส่งข้อมูลใหม่อีกครั้ง\nกรุณาตรวจสอบใน Admin Dashboard`)
      setStatus('pending')
      setRejectReason(null)
      setEditRequested(false)
    }

    toast.success('บันทึกสำเร็จ')
    setSaving(false)
  }

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>

  const isLocked = status === 'reviewing' || (status === 'approved' && !editRequested)
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
  const StatusIcon = cfg?.icon

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">แก้ไขคลินิก</h1>
        {cfg && (
          <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${cfg.color}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {cfg.label}
          </span>
        )}
      </div>

      {/* Status banners */}
      {status === 'reviewing' && (
        <div className="card bg-blue-50 border border-blue-200 flex items-start gap-3">
          <Lock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-700 text-sm">Admin กำลังตรวจสอบข้อมูลอยู่</p>
            <p className="text-blue-600 text-xs mt-0.5">ไม่สามารถแก้ไขข้อมูลได้ในขณะนี้ กรุณารอผล</p>
          </div>
        </div>
      )}
      {status === 'approved' && !editRequested && (
        <div className="card bg-green-50 border border-green-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-700 text-sm">คลินิกนี้ได้รับการยืนยันแล้ว</p>
              <p className="text-green-600 text-xs mt-0.5">หากแก้ไขข้อมูล ระบบจะส่ง Admin ตรวจสอบใหม่อีกครั้ง</p>
            </div>
          </div>
          <button
            onClick={() => setEditRequested(true)}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition-colors">
            ขอแก้ไขข้อมูล
          </button>
        </div>
      )}
      {status === 'approved' && editRequested && (
        <div className="card bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-700 text-sm">กำลังแก้ไขข้อมูล</p>
            <p className="text-amber-600 text-xs mt-0.5">เมื่อบันทึก ระบบจะส่งข้อมูลให้ Admin ตรวจสอบใหม่</p>
          </div>
        </div>
      )}
      {status === 'rejected' && rejectReason && (
        <div className="card bg-red-50 border border-red-200 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700 text-sm">ไม่ผ่านการตรวจสอบ</p>
            <p className="text-red-600 text-xs mt-1">{rejectReason}</p>
            <p className="text-red-500 text-xs mt-1">แก้ไขข้อมูลแล้วกด "บันทึกและส่งใหม่" ได้เลย</p>
          </div>
        </div>
      )}

      {/* รูปภาพ */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-700">รูปภาพคลินิก / โรงพยาบาล</h2>
        {(photoPreview || photoUrl) ? (
          <img src={photoPreview || photoUrl!} alt="รูปคลินิก" className="w-full max-h-48 object-cover rounded-xl border border-gray-200" />
        ) : (
          <div className="w-full h-32 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-sm">
            <Camera className="w-6 h-6 mr-2" /> ยังไม่มีรูปภาพ
          </div>
        )}
        {!isLocked && (
          <>
            <input type="file" accept="image/*"
              onChange={e => {
                const file = e.target.files?.[0] || null
                setNewPhotoFile(file)
                if (file) setPhotoPreview(URL.createObjectURL(file))
                else setPhotoPreview(null)
              }}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100" />
            {newPhotoFile && <p className="text-xs text-green-600">✓ {newPhotoFile.name}</p>}
          </>
        )}
      </div>

      {/* ข้อมูลพื้นฐาน */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">ข้อมูลพื้นฐาน</h2>
        <div>
          <label className="label">ประเภท</label>
          <div className="flex gap-2">
            {[{ v: 'clinic', l: 'คลินิก' }, { v: 'hospital', l: 'โรงพยาบาลสัตว์' }].map(t => (
              <button key={t.v} disabled={isLocked} onClick={() => setType(t.v as any)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  type === t.v ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 text-gray-600'
                } ${isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary-400'}`}>
                {t.l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">ชื่อ (ภาษาไทย) *</label>
          <input disabled={isLocked} className="input disabled:opacity-60 disabled:cursor-not-allowed" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">ชื่อ (ภาษาอังกฤษ)</label>
          <input disabled={isLocked} className="input disabled:opacity-60 disabled:cursor-not-allowed" value={nameEn} onChange={e => setNameEn(e.target.value)} />
        </div>
      </div>

      {/* ช่องทางติดต่อ */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">ช่องทางติดต่อ</h2>
        {[
          { label: 'เบอร์โทรศัพท์', val: phone, set: setPhone },
          { label: 'LINE ID', val: lineId, set: setLineId },
          { label: 'Facebook', val: facebook, set: setFacebook },
          { label: 'Website', val: website, set: setWebsite },
        ].map(f => (
          <div key={f.label}>
            <label className="label">{f.label}</label>
            <input disabled={isLocked} className="input disabled:opacity-60 disabled:cursor-not-allowed" value={f.val} onChange={e => f.set(e.target.value)} />
          </div>
        ))}
      </div>

      {/* ที่อยู่ */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">ที่อยู่</h2>
        <div>
          <label className="label">จังหวัด *</label>
          <select disabled={isLocked} className="input disabled:opacity-60 disabled:cursor-not-allowed" value={province}
            onChange={e => { setProvince(e.target.value); setDistrict(''); setSubDistrict('') }}>
            <option value="">-- เลือกจังหวัด --</option>
            {getProvinces().map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        {province && (
          <div>
            <label className="label">อำเภอ/เขต</label>
            <select disabled={isLocked} className="input disabled:opacity-60 disabled:cursor-not-allowed" value={district}
              onChange={e => { setDistrict(e.target.value); setSubDistrict('') }}>
              <option value="">-- เลือกอำเภอ --</option>
              {getDistricts(province).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        {district && (
          <div>
            <label className="label">ตำบล/แขวง</label>
            <select disabled={isLocked} className="input disabled:opacity-60 disabled:cursor-not-allowed" value={subDistrict}
              onChange={e => setSubDistrict(e.target.value)}>
              <option value="">-- เลือกตำบล --</option>
              {getSubDistricts(province, district).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">รายละเอียดที่อยู่</label>
          <input disabled={isLocked} className="input disabled:opacity-60 disabled:cursor-not-allowed" value={addressDetail} onChange={e => setAddressDetail(e.target.value)} />
        </div>
      </div>

      {/* เวลาเปิด-ปิด */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-700">เวลาเปิด-ปิด</h2>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(d => (
            <button key={d.key} disabled={isLocked} onClick={() => toggleDay(d.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                openingHours[d.key] ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 text-gray-500'
              } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}>
              {d.label}
            </button>
          ))}
        </div>
        {DAYS.filter(d => openingHours[d.key]).map(d => (
          <div key={d.key} className="flex items-center gap-2 text-sm">
            <span className="w-16 text-gray-600 shrink-0">{d.label}</span>
            <input type="time" disabled={isLocked} value={openingHours[d.key].open}
              onChange={e => updateDayHours(d.key, 'open', e.target.value)}
              className="input w-28 disabled:opacity-60" />
            <span className="text-gray-400">–</span>
            <input type="time" disabled={isLocked} value={openingHours[d.key].close}
              onChange={e => updateDayHours(d.key, 'close', e.target.value)}
              className="input w-28 disabled:opacity-60" />
          </div>
        ))}
      </div>

      {!isLocked && (
        <button onClick={handleSave} disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'กำลังบันทึก...' : (status === 'rejected' || editRequested) ? 'บันทึกและส่งตรวจสอบใหม่' : 'บันทึกการแก้ไข'}
        </button>
      )}
    </div>
  )
}
