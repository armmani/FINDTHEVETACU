'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { geocodeAddress, PLATFORM_ACUPUNCTURE_FEE, PLATFORM_RATE_LABEL } from '@/lib/distance'
import toast from 'react-hot-toast'
import { MapPin, Save, Info, Search, Send, ShieldCheck, ShieldX, Lock, Calendar, Plus, Trash2, Pencil, X } from 'lucide-react'
import { getProvinces, getDistricts, getSubDistricts } from '@/lib/thaiAddress'
import dynamic from 'next/dynamic'
import PhotoUpload from '@/components/PhotoUpload'

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false })

const UNIVERSITIES = [
  'จุฬาลงกรณ์มหาวิทยาลัย',
  'มหาวิทยาลัยเกษตรศาสตร์',
  'มหาวิทยาลัยมหิดล',
  'มหาวิทยาลัยเทคโนโลยีมหานคร',
  'มหาวิทยาลัยเชียงใหม่',
  'มหาวิทยาลัยขอนแก่น',
  'มหาวิทยาลัยมหาสารคาม',
  'มหาวิทยาลัยเทคโนโลยีราชมงคลตะวันออก',
  'มหาวิทยาลัยเวสเทิร์น',
  'มหาวิทยาลัยเทคโนโลยีราชมงคลศรีวิชัย',
  'มหาวิทยาลัยวลัยลักษณ์',
  'มหาวิทยาลัยสงขลานครินทร์',
  'อื่นๆ',
]

const DAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

interface Slot {
  day: number
  start_time: string
  end_time: string
}

interface VetSchedule {
  id: string
  place_name: string
  clinic_phone: string | null
  sub_district: string | null
  district: string | null
  province: string
  slots: Slot[]
}

function formatLicense(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 10)
  let r = d.slice(0, 2)
  if (d.length > 2) r += '-' + d.slice(2, 6)
  if (d.length > 6) r += '/' + d.slice(6, 10)
  return r
}

const ADDITIONAL_EDU_OPTIONS = [
  { key: 'internship', label: 'Internship (ฝึกอบรมพิเศษ)' },
  { key: 'certificate', label: 'Certificate (ใบรับรองเฉพาะทาง)' },
  { key: 'resident', label: 'Resident (ผู้เชี่ยวชาญ)' },
  { key: 'postgrad', label: 'PostGrad (บัณฑิตศึกษา)' },
  { key: 'phd', label: 'Ph.D. (ปริญญาเอก)' },
  { key: 'other', label: 'อื่นๆ' },
]

export default function VetProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [userId, setUserId] = useState<string>('')

  const [title, setTitle] = useState('')
  const [fullName, setFullName] = useState('')
  const [fullNameEn, setFullNameEn] = useState('')
  const [bio, setBio] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [university, setUniversity] = useState('')
  const [graduationYear, setGraduationYear] = useState('')
  const [additionalEdu, setAdditionalEdu] = useState<string[]>([])
  const [specialtyTypes, setSpecialtyTypes] = useState<{ id: string; name_th: string; name_en: string }[]>([])
  const [vetSpecialties, setVetSpecialties] = useState<string[]>([])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [telegramChatId, setTelegramChatId] = useState('')
  const [testingTelegram, setTestingTelegram] = useState(false)
  const [locationName, setLocationName] = useState('')
  const [locationLat, setLocationLat] = useState<number | null>(null)
  const [locationLng, setLocationLng] = useState<number | null>(null)
  const [isAvailable, setIsAvailable] = useState(true)
  const [isVerified, setIsVerified] = useState(false)
  const [vetStatus, setVetStatus] = useState<'pending' | 'reviewing' | 'approved' | 'rejected'>('pending')
  const [rejectReason, setRejectReason] = useState<string | null>(null)
  const [licenseDocUrl, setLicenseDocUrl] = useState<string | null>(null)
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [schedules, setSchedules] = useState<VetSchedule[]>([])
  const [showAddSchedule, setShowAddSchedule] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [newPlace, setNewPlace] = useState('')
  const [newClinicPhone, setNewClinicPhone] = useState('')
  const [newSubDistrict, setNewSubDistrict] = useState('')
  const [newDistrict, setNewDistrict] = useState('')
  const [newProvince, setNewProvince] = useState('')
  const [newSlots, setNewSlots] = useState<Slot[]>([{ day: 1, start_time: '09:00', end_time: '17:00' }])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPlace, setEditPlace] = useState('')
  const [editClinicPhone, setEditClinicPhone] = useState('')
  const [editSubDistrict, setEditSubDistrict] = useState('')
  const [editDistrict, setEditDistrict] = useState('')
  const [editProvince, setEditProvince] = useState('')
  const [editSlots, setEditSlots] = useState<Slot[]>([])
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const [{ data }, { data: profile }, { data: spTypes }, { data: vetSp }] = await Promise.all([
      supabase.from('vet_profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('profiles').select('full_name, telegram_chat_id, avatar_url').eq('id', user.id).single(),
      supabase.from('specialty_types').select('*').order('name_th'),
      supabase.from('vet_specialties').select('specialty_type_id').eq('vet_id', user.id),
    ])
    setSpecialtyTypes((spTypes || []) as any)
    setVetSpecialties((vetSp || []).map((s: any) => s.specialty_type_id))
    if (data) {
      setTitle(data.title || '')
      setFullNameEn(data.full_name_en || '')
      setBio(data.bio || '')
      setLicenseNumber(data.license_number || '')
      setUniversity(data.university || '')
      setGraduationYear(data.graduation_year || '')
      setAdditionalEdu(data.additional_education || [])
      setLocationName(data.location_name || '')
      setLocationLat(data.location_lat)
      setLocationLng(data.location_lng)
      setIsAvailable(data.is_available)
      setIsVerified(data.is_verified || false)
      setVetStatus(data.status || 'pending')
      setRejectReason(data.reject_reason || null)
      setLicenseDocUrl(data.license_doc_url || null)
    }
    setFullName((profile as any)?.full_name || '')
    setTelegramChatId((profile as any)?.telegram_chat_id || '')
    setAvatarUrl((profile as any)?.avatar_url || null)

    const { data: schData } = await supabase
      .from('vet_schedules')
      .select('*')
      .eq('vet_id', user.id)
      .order('created_at', { ascending: true })
    setSchedules((schData as VetSchedule[]) || [])

    setLoading(false)
  }

  const handleAddSchedule = async () => {
    if (!newPlace.trim() || !newProvince.trim()) { toast.error('กรุณากรอกชื่อสถานที่และจังหวัด'); return }
    if (newSlots.length === 0) { toast.error('กรุณาเพิ่มอย่างน้อย 1 วัน/เวลา'); return }
    setSavingSchedule(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from('vet_schedules').insert({
      vet_id: user.id,
      place_name: newPlace.trim(),
      clinic_phone: newClinicPhone.trim() || null,
      sub_district: newSubDistrict || null,
      district: newDistrict || null,
      province: newProvince,
      slots: newSlots,
    }).select().single()
    if (error) { toast.error('บันทึกไม่สำเร็จ'); setSavingSchedule(false); return }
    setSchedules(prev => [...prev, data as VetSchedule])
    setNewPlace(''); setNewClinicPhone(''); setNewSubDistrict(''); setNewDistrict(''); setNewProvince('')
    setNewSlots([{ day: 1, start_time: '09:00', end_time: '17:00' }])
    setShowAddSchedule(false)
    toast.success('เพิ่มสถานที่ออกตรวจแล้ว')
    setSavingSchedule(false)
  }

  const handleDeleteSchedule = async (id: string) => {
    await supabase.from('vet_schedules').delete().eq('id', id)
    setSchedules(prev => prev.filter(s => s.id !== id))
    toast.success('ลบแล้ว')
  }

  const startEdit = (s: VetSchedule) => {
    setEditingId(s.id)
    setEditPlace(s.place_name)
    setEditClinicPhone(s.clinic_phone || '')
    setEditSubDistrict(s.sub_district || '')
    setEditDistrict(s.district || '')
    setEditProvince(s.province)
    setEditSlots(s.slots || [])
  }

  const handleSaveEdit = async () => {
    if (!editPlace.trim() || !editProvince.trim()) { toast.error('กรุณากรอกชื่อสถานที่และจังหวัด'); return }
    if (editSlots.length === 0) { toast.error('กรุณาเพิ่มอย่างน้อย 1 วัน/เวลา'); return }
    setSavingEdit(true)
    const { error } = await supabase.from('vet_schedules').update({
      place_name: editPlace.trim(),
      clinic_phone: editClinicPhone.trim() || null,
      sub_district: editSubDistrict || null,
      district: editDistrict || null,
      province: editProvince,
      slots: editSlots,
    }).eq('id', editingId!)
    if (error) { toast.error('บันทึกไม่สำเร็จ'); setSavingEdit(false); return }
    setSchedules(prev => prev.map(s => s.id === editingId ? {
      ...s, place_name: editPlace, clinic_phone: editClinicPhone.trim() || null,
      sub_district: editSubDistrict || null,
      district: editDistrict || null, province: editProvince, slots: editSlots,
    } : s))
    setEditingId(null)
    toast.success('แก้ไขแล้ว')
    setSavingEdit(false)
  }

  const updateEditSlot = (i: number, field: keyof Slot, value: string | number) => {
    setEditSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  const updateSlot = (i: number, field: keyof Slot, value: string | number) => {
    setNewSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  const removeSlot = (i: number) => {
    setNewSlots(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleGeocode = async () => {
    if (!locationName.trim()) { toast.error('กรุณาพิมพ์ที่อยู่ก่อน'); return }
    setGeocoding(true)
    const result = await geocodeAddress(locationName)
    if (result) {
      setLocationLat(result.lat); setLocationLng(result.lng)
      toast.success('พบพิกัดแล้ว ✓')
    } else {
      toast.error('หาพิกัดไม่พบ ลองพิมพ์ที่อยู่ให้ละเอียดขึ้น')
    }
    setGeocoding(false)
  }

  const handleToggleAvailable = async () => {
    const newVal = !isAvailable
    setIsAvailable(newVal)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('vet_profiles').update({ is_available: newVal }).eq('user_id', user.id)
    toast.success(newVal ? 'เปิดรับงานแล้ว' : 'ปิดรับงานแล้ว')
  }

  const toggleEdu = (key: string) => {
    setAdditionalEdu(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (licenseNumber.replace(/\D/g, '').length < 10) { toast.error('กรุณากรอกเลขใบอนุญาตให้ครบ (xx-xxxx/xxxx)'); return }
    if (!locationLat || !locationLng) { toast.error('กรุณากดปุ่ม "ค้นหาพิกัด" ก่อนบันทึก'); return }
    if (!licenseDocUrl && !licenseFile) { toast.error('กรุณาแนบรูปใบประกอบวิชาชีพหรือบัตรประจำตัวสัตวแพทย์'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // upload license doc ถ้ามีไฟล์ใหม่
    let finalDocUrl = licenseDocUrl
    if (licenseFile) {
      const { compressImage } = await import('@/lib/compressImage')
      const compressed = await compressImage(licenseFile, { maxWidthPx: 1600, qualityJpeg: 0.8, maxSizeKB: 500 })
      const isImg = compressed.type.startsWith('image/')
      const path = `vet-licenses/${user.id}-${Date.now()}.${isImg ? 'jpg' : licenseFile.name.split('.').pop()}`
      const { error: uploadErr } = await supabase.storage.from('clinic-docs').upload(path, compressed)
      if (uploadErr) { toast.error('อัปโหลดไฟล์ไม่สำเร็จ'); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('clinic-docs').getPublicUrl(path)
      finalDocUrl = urlData.publicUrl
      setLicenseDocUrl(finalDocUrl)
    }

    const wasRejected = vetStatus === 'rejected'

    // บันทึก specialties — ลบเก่าแล้ว insert ใหม่
    await supabase.from('vet_specialties').delete().eq('vet_id', user.id)
    if (vetSpecialties.length > 0) {
      await supabase.from('vet_specialties').insert(
        vetSpecialties.map(id => ({ vet_id: user.id, specialty_type_id: id }))
      )
    }

    await Promise.all([
      supabase.from('vet_profiles').upsert({
        user_id: user.id, title: title || null, full_name_en: fullNameEn.trim() || null, bio, license_number: licenseNumber,
        university: university || null, graduation_year: graduationYear || null,
        additional_education: additionalEdu,
        acupuncture_fee: PLATFORM_ACUPUNCTURE_FEE, travel_rate: 8,
        location_name: locationName, location_lat: locationLat, location_lng: locationLng,
        is_available: isAvailable,
        license_doc_url: finalDocUrl,
        ...(wasRejected ? { status: 'pending', reject_reason: null } : {}),
      }, { onConflict: 'user_id' }),
      supabase.from('profiles').update({
        full_name: fullName.trim() || null,
        telegram_chat_id: telegramChatId || null,
        avatar_url: avatarUrl || null,
      }).eq('id', user.id),
    ])

    if (wasRejected) {
      const { notifyAdmin } = await import('@/lib/telegram')
      notifyAdmin(`🔄 <b>FindTheVet — หมอส่งข้อมูลใหม่</b>\n\n<b>${fullName}</b> แก้ไขและส่งข้อมูลใหม่อีกครั้ง\nกรุณาตรวจสอบใน Admin Dashboard`)
      setVetStatus('pending')
      setRejectReason(null)
    }

    toast.success('บันทึกโปรไฟล์สำเร็จ!')
    router.push('/home')
    setSaving(false)
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return }
    if (newPassword !== confirmPassword) { toast.error('รหัสผ่านไม่ตรงกัน'); return }
    setChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) toast.error('เปลี่ยนรหัสผ่านไม่สำเร็จ')
    else { toast.success('เปลี่ยนรหัสผ่านแล้ว!'); setNewPassword(''); setConfirmPassword('') }
    setChangingPassword(false)
  }

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">ตั้งค่าโปรไฟล์หมอ</h1>
        <p className="text-gray-500 text-sm mt-0.5">กำหนดค่าบริการและที่ตั้งของคุณ</p>
      </div>

      {/* สถานะการยืนยัน */}
      {vetStatus === 'approved' && (
        <div className="card mb-4 flex items-center gap-3 bg-green-50 border border-green-100">
          <ShieldCheck className="w-5 h-5 text-green-500 shrink-0" />
          <div>
            <p className="font-semibold text-sm text-green-700">ยืนยันตัวตนแล้ว</p>
            <p className="text-xs mt-0.5 text-green-600">สามารถเปิดรับงานได้</p>
          </div>
        </div>
      )}
      {vetStatus === 'reviewing' && (
        <div className="card mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200">
          <Lock className="w-5 h-5 text-blue-500 shrink-0" />
          <div>
            <p className="font-semibold text-sm text-blue-700">Admin กำลังตรวจสอบอยู่</p>
            <p className="text-xs mt-0.5 text-blue-600">ไม่สามารถแก้ไขข้อมูลได้ในขณะนี้ กรุณารอผล</p>
          </div>
        </div>
      )}
      {vetStatus === 'pending' && (
        <div className="card mb-4 flex items-center gap-3 bg-amber-50 border border-amber-100">
          <ShieldX className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="font-semibold text-sm text-amber-700">รอการยืนยันตัวตน</p>
            <p className="text-xs mt-0.5 text-amber-600">Admin จะตรวจสอบเอกสารของคุณภายใน 1-2 วันทำการ</p>
          </div>
        </div>
      )}
      {vetStatus === 'rejected' && (
        <div className="card mb-4 flex items-start gap-3 bg-red-50 border border-red-200">
          <ShieldX className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-red-700">ไม่ผ่านการตรวจสอบ</p>
            {rejectReason && <p className="text-xs mt-1 text-red-600">{rejectReason}</p>}
            <p className="text-xs mt-1 text-red-500">แก้ไขข้อมูลแล้วกด "บันทึกและส่งใหม่" ได้เลย</p>
          </div>
        </div>
      )}

      {/* สถานะรับงาน — ซ่อนไว้ก่อน */}

      <form onSubmit={handleSave} className="space-y-5">

        {/* รูปโปรไฟล์ */}
        <div className="card flex flex-col items-center">
          <h2 className="font-semibold text-gray-800 mb-4 self-start">รูปโปรไฟล์</h2>
          {userId && (
            <PhotoUpload
              bucket="avatars"
              currentUrl={avatarUrl}
              userId={userId}
              onUploaded={url => setAvatarUrl(url)}
              size="lg"
              shape="circle"
              label="คลิกเพื่อเปลี่ยนรูป"
            />
          )}
        </div>

        {/* ข้อมูลทั่วไป */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-3">ข้อมูลทั่วไป</h2>
          <div className="space-y-3">
            <div>
              <label className="label">ชื่อ-นามสกุล (ภาษาไทย)</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                className="input" placeholder="สมชาย ใจดี" />
            </div>
            <div>
              <label className="label">คำนำหน้าชื่อ</label>
              <div className="flex gap-2">
                {['น.สพ.', 'สพ.ญ.'].map(t => (
                  <button key={t} type="button" onClick={() => setTitle(t)}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      title === t
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">ชื่อภาษาอังกฤษ <span className="text-gray-400 font-normal">(แสดงเมื่อเลือกภาษา EN)</span></label>
              <input type="text" value={fullNameEn} onChange={e => setFullNameEn(e.target.value)}
                className="input" placeholder="e.g. Somchai Jaidee" />
            </div>
            <div>
              <label className="label">เลขใบอนุญาต <span className="text-red-500">*</span></label>
              <input type="text" value={licenseNumber}
                onChange={e => setLicenseNumber(formatLicense(e.target.value))}
                className="input tracking-widest font-mono"
                placeholder="01-1234/2567"
                maxLength={12} />
            </div>
            <div>
              <label className="label">แนะนำตัวเอง</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)}
                className="input resize-none" rows={3} placeholder="ประสบการณ์ ความเชี่ยวชาญ ฯลฯ" />
            </div>
          </div>
        </div>

        {/* การศึกษา */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-3">การศึกษา</h2>
          <div className="space-y-3">
            <div>
              <label className="label">สถาบันที่จบการศึกษา</label>
              <select value={university} onChange={e => setUniversity(e.target.value)} className="input">
                <option value="">-- เลือกมหาวิทยาลัย --</option>
                {UNIVERSITIES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">รุ่นที่จบ / ปีที่จบ</label>
              <input type="text" value={graduationYear} onChange={e => setGraduationYear(e.target.value)}
                className="input" placeholder="เช่น รุ่น 72 หรือ 2563" />
            </div>
            <div>
              <label className="label">การศึกษาเพิ่มเติม</label>
              <div className="space-y-2 mt-1">
                {ADDITIONAL_EDU_OPTIONS.map(opt => (
                  <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={additionalEdu.includes(opt.key)}
                      onChange={() => toggleEdu(opt.key)}
                      className="w-4 h-4 accent-primary-500"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* สาขาที่สนใจ / ชำนาญ */}
        {specialtyTypes.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-3">สาขาที่สนใจ / ชำนาญ</h2>
            <div className="flex flex-wrap gap-2">
              {specialtyTypes.map(sp => {
                const selected = vetSpecialties.includes(sp.id)
                return (
                  <button key={sp.id} type="button"
                    onClick={() => setVetSpecialties(prev =>
                      selected ? prev.filter(id => id !== sp.id) : [...prev, sp.id]
                    )}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      selected
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-gray-300 text-gray-600 hover:border-primary-400'
                    }`}>
                    {sp.name_th}
                    <span className="text-xs ml-1 opacity-70">/ {sp.name_en}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ค่าบริการ */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-3">ค่าบริการ</h2>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-semibold mb-1">อัตราค่าบริการ (กำหนดโดยแพลตฟอร์ม)</p>
              <div className="space-y-0.5 text-blue-600">
                <p>ค่าฝังเข็ม: <span className="font-bold text-blue-800">{PLATFORM_ACUPUNCTURE_FEE.toLocaleString()} บาท / ครั้ง</span></p>
                <p>ค่าเดินทาง: <span className="font-medium">{PLATFORM_RATE_LABEL}</span></p>
              </div>
              <p className="mt-2 text-xs text-blue-500">อัตรานี้กำหนดกลางเพื่อป้องกันการตัดราคา</p>
            </div>
          </div>
        </div>

        {/* ที่ตั้ง */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-3">ที่ตั้งของคุณ</h2>
          <label className="label flex items-center gap-1"><MapPin className="w-4 h-4" /> ที่อยู่ปัจจุบัน</label>
          <div className="flex gap-2">
            <input type="text" value={locationName}
              onChange={e => { setLocationName(e.target.value); setLocationLat(null); setLocationLng(null) }}
              className="input flex-1" placeholder="เช่น สยาม กรุงเทพ หรือ ลาดพร้าว 71" required />
            <button type="button" onClick={handleGeocode} disabled={geocoding}
              className="btn-secondary flex items-center gap-1 shrink-0">
              <Search className="w-4 h-4" />
              {geocoding ? '...' : 'ค้นหา'}
            </button>
          </div>
          {locationLat && locationLng ? (
            <>
              <p className="text-xs text-primary-600 mt-1">✓ พบพิกัดแล้ว — ลากหมุดเพื่อปรับตำแหน่งให้ตรง</p>
              <div className="mt-2 rounded-xl overflow-hidden border border-gray-200">
                <MapPicker lat={locationLat} lng={locationLng}
                  onMove={(lat, lng) => { setLocationLat(lat); setLocationLng(lng) }} />
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400 mt-1">พิมพ์ที่อยู่แล้วกด "ค้นหา" เพื่อระบุพิกัด</p>
          )}
        </div>

        {/* Telegram */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-3">การแจ้งเตือน Telegram</h2>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 space-y-2 mb-3">
            <p className="font-semibold">วิธีหา Chat ID</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-600">
              <li>เปิด Telegram ค้นหา <strong>@VETACU_BOT</strong> แล้วกด Start</li>
              <li>ไปที่ <strong>@userinfobot</strong> แล้วกด Start</li>
              <li>คัดลอก <strong>ID</strong> ที่ได้มาวางด้านล่าง</li>
            </ol>
          </div>
          <label className="label">Telegram Chat ID</label>
          <div className="flex gap-2">
            <input type="text" value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)}
              className="input flex-1" placeholder="เช่น 123456789" />
            <button type="button" disabled={testingTelegram}
              onClick={async () => {
                if (!telegramChatId.trim()) { toast.error('กรุณากรอก Chat ID ก่อน'); return }
                setTestingTelegram(true)
                const res = await fetch('/api/notify', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chat_id: telegramChatId, message: '✅ <b>FindTheVet</b>\nเชื่อมต่อ Telegram สำเร็จแล้ว!' }),
                })
                const data = await res.json()
                if (data.ok) toast.success('ส่งทดสอบแล้ว ตรวจสอบ Telegram!')
                else toast.error('ส่งไม่ได้ ตรวจสอบ Chat ID อีกครั้ง')
                setTestingTelegram(false)
              }}
              className="btn-secondary flex items-center gap-1 shrink-0">
              <Send className="w-4 h-4" />
              {testingTelegram ? '...' : 'ทดสอบ'}
            </button>
          </div>
        </div>

        {/* เอกสารยืนยันตัวตน */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-800">เอกสารยืนยันตัวตน *</h2>
          <p className="text-xs text-gray-500">อัปโหลดรูปใบประกอบวิชาชีพ หรือบัตรประจำตัวสัตวแพทย์</p>
          {licenseDocUrl && (
            <a href={licenseDocUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-500 hover:underline">
              ดูเอกสารที่อัปโหลดแล้ว →
            </a>
          )}
          <input type="file" accept="image/*,.pdf"
            disabled={vetStatus === 'reviewing'}
            onChange={e => setLicenseFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100 disabled:opacity-50" />
          {licenseFile && <p className="text-xs text-green-600">✓ {licenseFile.name}</p>}
        </div>

        <button type="submit" disabled={saving || vetStatus === 'reviewing'}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          <Save className="w-4 h-4" />
          {saving ? 'กำลังบันทึก...' : vetStatus === 'reviewing' ? 'กำลังตรวจสอบ — ไม่สามารถแก้ไขได้' : vetStatus === 'rejected' ? 'บันทึกและส่งใหม่' : 'บันทึกโปรไฟล์'}
        </button>
      </form>

      {/* ตารางออกตรวจ */}
      <div className="card space-y-4 mt-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> ตารางออกตรวจ
        </h2>
        <p className="text-xs text-gray-400 -mt-2">เพิ่มคลินิก/โรงพยาบาลที่คุณออกตรวจ เพื่อให้เจ้าของสัตว์เลี้ยงรู้ว่าคุณอยู่ที่ไหนบ้าง</p>

        {schedules.length > 0 && (
          <div className="space-y-3">
            {schedules.map(s => (
              <div key={s.id} className="border border-gray-100 rounded-xl p-3">
                {editingId === s.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="label text-xs">ชื่อคลินิก / โรงพยาบาล</label>
                      <input type="text" value={editPlace} onChange={e => setEditPlace(e.target.value)} className="input text-sm" />
                    </div>
                    <div>
                      <label className="label text-xs">เบอร์โทรคลินิก / โรงพยาบาล</label>
                      <input type="tel" value={editClinicPhone} onChange={e => setEditClinicPhone(e.target.value)} className="input text-sm" placeholder="02-xxx-xxxx" />
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="label text-xs">จังหวัด *</label>
                        <select value={editProvince} onChange={e => { setEditProvince(e.target.value); setEditDistrict(''); setEditSubDistrict('') }} className="input text-sm">
                          <option value="">-- เลือกจังหวัด --</option>
                          {getProvinces().map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">เขต/อำเภอ</label>
                        <select value={editDistrict} onChange={e => { setEditDistrict(e.target.value); setEditSubDistrict('') }} className="input text-sm" disabled={!editProvince}>
                          <option value="">-- เลือกเขต/อำเภอ --</option>
                          {editProvince && getDistricts(editProvince).map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">แขวง/ตำบล</label>
                        <select value={editSubDistrict} onChange={e => setEditSubDistrict(e.target.value)} className="input text-sm" disabled={!editDistrict}>
                          <option value="">-- เลือกแขวง/ตำบล --</option>
                          {editDistrict && getSubDistricts(editProvince, editDistrict).map(sub => <option key={sub} value={sub}>{sub}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="label text-xs">วัน / เวลา</label>
                      <div className="space-y-2">
                        {editSlots.map((slot, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <select value={slot.day} onChange={e => updateEditSlot(i, 'day', Number(e.target.value))} className="input flex-1 text-sm">
                              {DAY_NAMES.map((name, d) => <option key={d} value={d}>{name}</option>)}
                            </select>
                            <input type="time" value={slot.start_time} onChange={e => updateEditSlot(i, 'start_time', e.target.value)} className="input w-28 text-sm" />
                            <span className="text-gray-400">–</span>
                            <input type="time" value={slot.end_time} onChange={e => updateEditSlot(i, 'end_time', e.target.value)} className="input w-28 text-sm" />
                            {editSlots.length > 1 && (
                              <button type="button" onClick={() => setEditSlots(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => setEditSlots(prev => [...prev, { day: 1, start_time: '09:00', end_time: '17:00' }])}
                          className="text-sm text-primary-600 hover:underline flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5" /> เพิ่มวัน/เวลา
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} disabled={savingEdit} className="btn-primary flex-1 text-sm py-2">
                        {savingEdit ? 'กำลังบันทึก...' : 'บันทึก'}
                      </button>
                      <button onClick={() => setEditingId(null)} className="btn-secondary flex-1 text-sm py-2">ยกเลิก</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800">{s.place_name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {[s.sub_district, s.district, s.province].filter(Boolean).join(' · ')}
                        </p>
                        {s.clinic_phone && (
                          <p className="text-sm text-gray-500 mt-0.5">📞 {s.clinic_phone}</p>
                        )}
                        <div className="mt-1 space-y-0.5">
                          {(s.slots || []).map((slot, i) => (
                            <p key={i} className="text-sm text-primary-600">
                              {DAY_NAMES[slot.day]} · {slot.start_time.slice(0,5)}–{slot.end_time.slice(0,5)} น.
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => startEdit(s)} className="text-gray-300 hover:text-primary-500 transition-colors p-1">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteSchedule(s.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {showAddSchedule ? (
          <div className="border border-dashed border-primary-200 rounded-xl p-4 space-y-3 bg-primary-50/30">
            <div>
              <label className="label">ชื่อคลินิก / โรงพยาบาล</label>
              <input type="text" value={newPlace} onChange={e => setNewPlace(e.target.value)}
                className="input" placeholder="เช่น คลินิกสัตว์รักษ์, รพ.สัตว์จุฬา" />
            </div>
            <div>
              <label className="label">เบอร์โทรคลินิก / โรงพยาบาล</label>
              <input type="tel" value={newClinicPhone} onChange={e => setNewClinicPhone(e.target.value)}
                className="input" placeholder="02-xxx-xxxx" />
            </div>
            <div className="space-y-2">
              <div>
                <label className="label text-xs">จังหวัด *</label>
                <select value={newProvince} onChange={e => { setNewProvince(e.target.value); setNewDistrict(''); setNewSubDistrict('') }}
                  className="input text-sm">
                  <option value="">-- เลือกจังหวัด --</option>
                  {getProvinces().map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">เขต/อำเภอ</label>
                <select value={newDistrict} onChange={e => { setNewDistrict(e.target.value); setNewSubDistrict('') }}
                  className="input text-sm" disabled={!newProvince}>
                  <option value="">-- เลือกเขต/อำเภอ --</option>
                  {newProvince && getDistricts(newProvince).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">แขวง/ตำบล</label>
                <select value={newSubDistrict} onChange={e => setNewSubDistrict(e.target.value)}
                  className="input text-sm" disabled={!newDistrict}>
                  <option value="">-- เลือกแขวง/ตำบล --</option>
                  {newDistrict && getSubDistricts(newProvince, newDistrict).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">วัน / เวลาออกตรวจ</label>
              <div className="space-y-2 mt-1">
                {newSlots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select value={slot.day} onChange={e => updateSlot(i, 'day', Number(e.target.value))}
                      className="input flex-1 text-sm">
                      {DAY_NAMES.map((name, d) => <option key={d} value={d}>{name}</option>)}
                    </select>
                    <input type="time" value={slot.start_time}
                      onChange={e => updateSlot(i, 'start_time', e.target.value)}
                      className="input w-28 text-sm" />
                    <span className="text-gray-400 shrink-0">–</span>
                    <input type="time" value={slot.end_time}
                      onChange={e => updateSlot(i, 'end_time', e.target.value)}
                      className="input w-28 text-sm" />
                    {newSlots.length > 1 && (
                      <button type="button" onClick={() => removeSlot(i)}
                        className="text-gray-300 hover:text-red-400 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button"
                  onClick={() => setNewSlots(prev => [...prev, { day: 1, start_time: '09:00', end_time: '17:00' }])}
                  className="text-sm text-primary-600 hover:underline flex items-center gap-1 mt-1">
                  <Plus className="w-3.5 h-3.5" /> เพิ่มวัน/เวลา
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddSchedule} disabled={savingSchedule}
                className="btn-primary flex-1">{savingSchedule ? 'กำลังบันทึก...' : 'บันทึก'}</button>
              <button onClick={() => setShowAddSchedule(false)} className="btn-secondary flex-1">ยกเลิก</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddSchedule(true)}
            className="btn-secondary w-full flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> เพิ่มสถานที่ออกตรวจ
          </button>
        )}
      </div>

      {/* เปลี่ยนรหัสผ่าน */}
      <div className="card space-y-4 mt-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <Lock className="w-4 h-4" /> เปลี่ยนรหัสผ่าน
        </h2>
        <div>
          <label className="label">รหัสผ่านใหม่</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
            className="input" placeholder="อย่างน้อย 6 ตัวอักษร" />
        </div>
        <div>
          <label className="label">ยืนยันรหัสผ่านใหม่</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            className="input" placeholder="พิมพ์รหัสผ่านอีกครั้ง" />
        </div>
        <button onClick={handleChangePassword} disabled={changingPassword || !newPassword}
          className="btn-primary w-full flex items-center justify-center gap-2">
          <Lock className="w-4 h-4" />
          {changingPassword ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน'}
        </button>
      </div>
    </div>
  )
}
