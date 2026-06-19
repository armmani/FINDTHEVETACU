'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { geocodeAddress, PLATFORM_ACUPUNCTURE_FEE, PLATFORM_RATE_LABEL } from '@/lib/distance'
import toast from 'react-hot-toast'
import { MapPin, Save, Info, Search, Send, ShieldCheck, ShieldX, Lock, Calendar, Plus, Trash2 } from 'lucide-react'
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

interface VetSchedule {
  id: string
  place_name: string
  sub_district: string | null
  district: string | null
  province: string
  days: number[]
  start_time: string
  end_time: string
}

const ADDITIONAL_EDU_OPTIONS = [
  { key: 'internship', label: 'Internship (ฝึกอบรมพิเศษ)' },
  { key: 'certificate', label: 'Certificate (ใบรับรองเฉพาะทาง)' },
  { key: 'resident', label: 'Resident (ผู้เชี่ยวชาญ)' },
]

export default function VetProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [userId, setUserId] = useState<string>('')

  const [bio, setBio] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [university, setUniversity] = useState('')
  const [graduationYear, setGraduationYear] = useState('')
  const [additionalEdu, setAdditionalEdu] = useState<string[]>([])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [telegramChatId, setTelegramChatId] = useState('')
  const [testingTelegram, setTestingTelegram] = useState(false)
  const [locationName, setLocationName] = useState('')
  const [locationLat, setLocationLat] = useState<number | null>(null)
  const [locationLng, setLocationLng] = useState<number | null>(null)
  const [isAvailable, setIsAvailable] = useState(true)
  const [isVerified, setIsVerified] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [schedules, setSchedules] = useState<VetSchedule[]>([])
  const [showAddSchedule, setShowAddSchedule] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [newPlace, setNewPlace] = useState('')
  const [newSubDistrict, setNewSubDistrict] = useState('')
  const [newDistrict, setNewDistrict] = useState('')
  const [newProvince, setNewProvince] = useState('')
  const [newDays, setNewDays] = useState<number[]>([])
  const [newStartTime, setNewStartTime] = useState('09:00')
  const [newEndTime, setNewEndTime] = useState('17:00')

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const [{ data }, { data: profile }] = await Promise.all([
      supabase.from('vet_profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('profiles').select('telegram_chat_id, avatar_url').eq('id', user.id).single(),
    ])
    if (data) {
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
    }
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
    if (newDays.length === 0) { toast.error('กรุณาเลือกอย่างน้อย 1 วัน'); return }
    setSavingSchedule(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from('vet_schedules').insert({
      vet_id: user.id,
      place_name: newPlace.trim(),
      sub_district: newSubDistrict.trim() || null,
      district: newDistrict.trim() || null,
      province: newProvince.trim(),
      days: newDays.sort(),
      start_time: newStartTime,
      end_time: newEndTime,
    }).select().single()
    if (error) { toast.error('บันทึกไม่สำเร็จ'); setSavingSchedule(false); return }
    setSchedules(prev => [...prev, data as VetSchedule])
    setNewPlace(''); setNewSubDistrict(''); setNewDistrict(''); setNewProvince('')
    setNewDays([]); setNewStartTime('09:00'); setNewEndTime('17:00')
    setShowAddSchedule(false)
    toast.success('เพิ่มสถานที่ออกตรวจแล้ว')
    setSavingSchedule(false)
  }

  const handleDeleteSchedule = async (id: string) => {
    await supabase.from('vet_schedules').delete().eq('id', id)
    setSchedules(prev => prev.filter(s => s.id !== id))
    toast.success('ลบแล้ว')
  }

  const toggleDay = (d: number) => {
    setNewDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
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
    if (!locationLat || !locationLng) { toast.error('กรุณากดปุ่ม "ค้นหาพิกัด" ก่อนบันทึก'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await Promise.all([
      supabase.from('vet_profiles').upsert({
        user_id: user.id, bio, license_number: licenseNumber,
        university: university || null, graduation_year: graduationYear || null,
        additional_education: additionalEdu,
        acupuncture_fee: PLATFORM_ACUPUNCTURE_FEE, travel_rate: 8,
        location_name: locationName, location_lat: locationLat, location_lng: locationLng,
        is_available: isAvailable,
      }, { onConflict: 'user_id' }),
      supabase.from('profiles').update({
        telegram_chat_id: telegramChatId || null,
        avatar_url: avatarUrl || null,
      }).eq('id', user.id),
    ])

    toast.success('บันทึกโปรไฟล์สำเร็จ!')
    router.push('/vet/dashboard')
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
      <div className={`card mb-4 flex items-center gap-3 ${isVerified ? 'bg-green-50 border border-green-100' : 'bg-amber-50 border border-amber-100'}`}>
        {isVerified
          ? <ShieldCheck className="w-5 h-5 text-green-500 shrink-0" />
          : <ShieldX className="w-5 h-5 text-amber-500 shrink-0" />
        }
        <div className="flex-1">
          <p className={`font-semibold text-sm ${isVerified ? 'text-green-700' : 'text-amber-700'}`}>
            {isVerified ? 'ยืนยันตัวตนแล้ว' : 'รอการยืนยันตัวตน'}
          </p>
          <p className={`text-xs mt-0.5 ${isVerified ? 'text-green-600' : 'text-amber-600'}`}>
            {isVerified ? 'สามารถเปิดรับงานได้' : 'Admin กำลังตรวจสอบใบอนุญาต กรุณารอสักครู่'}
          </p>
        </div>
      </div>

      {/* สถานะรับงาน */}
      <div className={`card mb-4 flex items-center justify-between ${!isVerified ? 'opacity-50' : ''}`}>
        <div>
          <p className="font-semibold">สถานะรับงาน</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {!isVerified ? '🔒 ต้องยืนยันตัวตนก่อน' : isAvailable ? '🟢 พร้อมรับงานอยู่' : '🔴 ปิดรับงานอยู่'}
          </p>
        </div>
        <button type="button"
          onClick={isVerified ? handleToggleAvailable : () => toast.error('กรุณารอ Admin ยืนยันตัวตนก่อน')}
          className={`relative inline-flex w-12 h-6 rounded-full transition-colors focus:outline-none overflow-hidden shrink-0 ${isAvailable && isVerified ? 'bg-primary-500' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${isAvailable && isVerified ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>

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
              <label className="label">เลขใบอนุญาต (ไม่บังคับ)</label>
              <input type="text" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)}
                className="input" placeholder="เช่น 12345" />
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
                  body: JSON.stringify({ chat_id: telegramChatId, message: '✅ <b>VetAcu</b>\nเชื่อมต่อ Telegram สำเร็จแล้ว!' }),
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

        <button type="submit" disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}
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
              <div key={s.id} className="border border-gray-100 rounded-xl p-3 relative">
                <button onClick={() => handleDeleteSchedule(s.id)}
                  className="absolute top-2 right-2 text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
                <p className="font-medium text-gray-800 pr-6">{s.place_name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {[s.sub_district, s.district, s.province].filter(Boolean).join(' · ')}
                </p>
                <p className="text-sm text-primary-600 mt-1">
                  {s.days.map(d => DAY_LABELS[d]).join(', ')} · {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)} น.
                </p>
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
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label text-xs">แขวง/ตำบล</label>
                <input type="text" value={newSubDistrict} onChange={e => setNewSubDistrict(e.target.value)}
                  className="input text-sm" placeholder="แขวง/ตำบล" />
              </div>
              <div>
                <label className="label text-xs">เขต/อำเภอ</label>
                <input type="text" value={newDistrict} onChange={e => setNewDistrict(e.target.value)}
                  className="input text-sm" placeholder="เขต/อำเภอ" />
              </div>
              <div>
                <label className="label text-xs">จังหวัด *</label>
                <input type="text" value={newProvince} onChange={e => setNewProvince(e.target.value)}
                  className="input text-sm" placeholder="กรุงเทพฯ" />
              </div>
            </div>
            <div>
              <label className="label">วันที่ออกตรวจ</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {DAY_NAMES.map((name, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      newDays.includes(i)
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'border-gray-200 text-gray-500 hover:border-primary-300'
                    }`}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="label text-xs">เวลาเริ่ม</label>
                <input type="time" value={newStartTime} onChange={e => setNewStartTime(e.target.value)} className="input" />
              </div>
              <span className="mt-5 text-gray-400">–</span>
              <div className="flex-1">
                <label className="label text-xs">เวลาสิ้นสุด</label>
                <input type="time" value={newEndTime} onChange={e => setNewEndTime(e.target.value)} className="input" />
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
