'use client'

import LoadingScreen from '@/components/LoadingScreen'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { geocodeAddress, PLATFORM_ACUPUNCTURE_FEE, PLATFORM_RATE_LABEL } from '@/lib/distance'
import toast from 'react-hot-toast'
import { MapPin, Save, Info, Search, Send, ShieldCheck, ShieldX, Lock, Calendar, ExternalLink, X, Check } from 'lucide-react'
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

const DAY_MAP: Record<string, string> = { '1': 'จันทร์', '2': 'อังคาร', '3': 'พุธ', '4': 'พฤหัสบดี', '5': 'ศุกร์', '6': 'เสาร์', '0': 'อาทิตย์' }
const DAY_ORDER = ['1', '2', '3', '4', '5', '6', '0']

interface ClinicOption {
  id: string
  name: string
  type: string
  phone: string | null
  province: string | null
  district: string | null
  sub_district: string | null
}

interface VetSchedule {
  id: string
  clinic_id: string | null
  place_name: string
  clinic_phone: string | null
  province: string | null
  district: string | null
  sub_district: string | null
  slots: { day: number; start_time: string; end_time: string }[]
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
  const [saved, setSaved] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const markSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }
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
  const [vetSchedules, setVetSchedules] = useState<VetSchedule[]>([])
  const [allClinics, setAllClinics] = useState<ClinicOption[]>([])
  const [showAddSchedule, setShowAddSchedule] = useState(false)
  const [selectedClinicId, setSelectedClinicId] = useState('')
  const [clinicSearch, setClinicSearch] = useState('')
  const [newSlots, setNewSlots] = useState<Record<number, { open: string; close: string }>>({})
  const [savingSchedule, setSavingSchedule] = useState(false)

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

    const [{ data: schedulesData }, { data: clinicsData }] = await Promise.all([
      supabase.from('vet_schedules').select('*').eq('vet_id', user.id).order('created_at'),
      supabase.from('clinics').select('id, name, type, phone, province, district, sub_district').eq('status', 'approved').order('name'),
    ])
    setVetSchedules((schedulesData as VetSchedule[]) || [])
    setAllClinics((clinicsData as ClinicOption[]) || [])

    setLoading(false)
  }

  const toggleSlotDay = (day: number) => {
    setNewSlots(prev => {
      if (prev[day]) { const n = { ...prev }; delete n[day]; return n }
      return { ...prev, [day]: { open: '09:00', close: '17:00' } }
    })
  }

  const handleAddSchedule = async () => {
    if (!selectedClinicId) { toast.error('กรุณาเลือกสถานที่'); return }
    if (Object.keys(newSlots).length === 0) { toast.error('กรุณาเลือกวันออกตรวจอย่างน้อย 1 วัน'); return }
    const clinic = allClinics.find(c => c.id === selectedClinicId)
    if (!clinic) return
    setSavingSchedule(true)
    const slots = Object.entries(newSlots).map(([day, t]) => ({
      day: Number(day), start_time: t.open + ':00', end_time: t.close + ':00',
    }))
    const { data, error } = await supabase.from('vet_schedules').insert({
      vet_id: userId,
      clinic_id: clinic.id,
      place_name: clinic.name,
      clinic_phone: clinic.phone,
      province: clinic.province,
      district: clinic.district,
      sub_district: clinic.sub_district,
      slots,
    }).select().single()
    if (error) { toast.error('บันทึกไม่สำเร็จ'); setSavingSchedule(false); return }
    setVetSchedules(prev => [...prev, data as VetSchedule])
    setShowAddSchedule(false)
    setSelectedClinicId('')
    setClinicSearch('')
    setNewSlots({})
    toast.success('เพิ่มตารางออกตรวจแล้ว')
    setSavingSchedule(false)
  }

  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm('ลบตารางออกตรวจนี้?')) return
    await supabase.from('vet_schedules').delete().eq('id', id)
    setVetSchedules(prev => prev.filter(s => s.id !== id))
    toast.success('ลบแล้ว')
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

    toast.success('บันทึกโปรไฟล์สำเร็จ!'); markSaved()
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

  if (loading) return <LoadingScreen />

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

        <button type="submit" disabled={saving || saved || vetStatus === 'reviewing'}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'บันทึกแล้ว' : saving ? 'กำลังบันทึก...' : vetStatus === 'reviewing' ? 'กำลังตรวจสอบ — ไม่สามารถแก้ไขได้' : vetStatus === 'rejected' ? 'บันทึกและส่งใหม่' : 'บันทึกโปรไฟล์'}
        </button>
      </form>

      {/* ตารางออกตรวจ */}
      <div className="card space-y-4 mt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> ตารางออกตรวจ
          </h2>
          {!showAddSchedule && (
            <button onClick={() => setShowAddSchedule(true)}
              className="text-xs text-primary-600 hover:underline flex items-center gap-1 font-medium">
              + เพิ่มสถานที่
            </button>
          )}
        </div>

        {/* ฟอร์มเพิ่มสถานที่ */}
        {showAddSchedule && (
          <div className="border border-primary-100 rounded-xl p-4 space-y-4 bg-primary-50/40">
            <p className="font-medium text-sm text-gray-700">เพิ่มสถานที่ออกตรวจ</p>

            {/* ค้นหาคลินิก */}
            <div className="space-y-2">
              <label className="label">ค้นหาสถานที่</label>
              <input
                className="input"
                placeholder="พิมพ์ชื่อคลินิก / จังหวัด..."
                value={clinicSearch}
                onChange={e => { setClinicSearch(e.target.value); setSelectedClinicId('') }}
              />
              {clinicSearch.length >= 1 && !selectedClinicId && (
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-white shadow-sm">
                  {allClinics
                    .filter(c => c.name.toLowerCase().includes(clinicSearch.toLowerCase()) || (c.province || '').includes(clinicSearch))
                    .slice(0, 20)
                    .map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { setSelectedClinicId(c.id); setClinicSearch(c.name) }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                        <p className="text-sm font-medium text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.type === 'hospital' ? 'โรงพยาบาลสัตว์' : 'คลินิก'} · {[c.district, c.province].filter(Boolean).join(', ')}</p>
                      </button>
                    ))}
                  {allClinics.filter(c => c.name.toLowerCase().includes(clinicSearch.toLowerCase()) || (c.province || '').includes(clinicSearch)).length === 0 && (
                    <p className="text-sm text-gray-400 px-4 py-3">ไม่พบสถานที่</p>
                  )}
                </div>
              )}
              {selectedClinicId && (
                <div className="flex items-center gap-2 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-primary-700 flex-1">{allClinics.find(c => c.id === selectedClinicId)?.name}</span>
                  <button onClick={() => { setSelectedClinicId(''); setClinicSearch('') }}
                    className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              )}
            </div>

            {/* เลือกวัน + เวลา */}
            <div className="space-y-2">
              <label className="label">วันและเวลาออกตรวจ</label>
              <div className="space-y-2">
                {DAY_ORDER.map(k => {
                  const day = Number(k)
                  const checked = !!newSlots[day]
                  return (
                    <div key={k} className={`flex items-center gap-3 rounded-lg px-3 py-2 border transition-colors ${checked ? 'border-primary-200 bg-primary-50' : 'border-gray-100 bg-gray-50'}`}>
                      <input type="checkbox" id={`day-${k}`} checked={checked} onChange={() => toggleSlotDay(day)}
                        className="rounded accent-primary-600 w-4 h-4 shrink-0" />
                      <label htmlFor={`day-${k}`} className="text-sm font-medium text-gray-700 w-20 shrink-0 cursor-pointer">{DAY_MAP[k]}</label>
                      {checked && (
                        <div className="flex items-center gap-2 flex-1">
                          <input type="time" value={newSlots[day].open}
                            onChange={e => setNewSlots(p => ({ ...p, [day]: { ...p[day], open: e.target.value } }))}
                            className="input py-1 text-sm" />
                          <span className="text-gray-400 text-sm shrink-0">–</span>
                          <input type="time" value={newSlots[day].close}
                            onChange={e => setNewSlots(p => ({ ...p, [day]: { ...p[day], close: e.target.value } }))}
                            className="input py-1 text-sm" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowAddSchedule(false); setSelectedClinicId(''); setClinicSearch(''); setNewSlots({}) }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">ยกเลิก</button>
              <button type="button" onClick={handleAddSchedule} disabled={savingSchedule}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-500 disabled:opacity-60">
                {savingSchedule ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        )}

        {/* รายการตารางออกตรวจ */}
        {vetSchedules.length === 0 && !showAddSchedule ? (
          <div className="text-center py-6 text-gray-400 text-sm">ยังไม่มีตารางออกตรวจ กด "+ เพิ่มสถานที่" เพื่อเริ่มต้น</div>
        ) : (
          <div className="space-y-3">
            {vetSchedules.map(s => (
              <div key={s.id} className="border border-gray-100 rounded-xl p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-800">{s.place_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[s.sub_district, s.district, s.province].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteSchedule(s.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0 mt-0.5">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {s.clinic_phone && <p className="text-xs text-gray-500">📞 {s.clinic_phone}</p>}
                {(s.slots || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[...s.slots].sort((a, b) => {
                      const order = [1,2,3,4,5,6,0]
                      return order.indexOf(a.day) - order.indexOf(b.day)
                    }).map((slot, i) => (
                      <span key={i} className="text-xs bg-primary-50 text-primary-700 border border-primary-100 px-2 py-0.5 rounded-full">
                        {DAY_MAP[String(slot.day)]} {slot.start_time.slice(0,5)}–{slot.end_time.slice(0,5)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
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
