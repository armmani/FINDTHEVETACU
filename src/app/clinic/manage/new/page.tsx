'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getProvinces, getDistricts, getSubDistricts } from '@/lib/thaiAddress'
import { ArrowLeft, Search, MapPin } from 'lucide-react'
import { compressImage } from '@/lib/compressImage'
import { geocodeAddress } from '@/lib/distance'
import dynamic from 'next/dynamic'

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false })

const DAYS = [
  { key: '1', label: 'จันทร์' }, { key: '2', label: 'อังคาร' },
  { key: '3', label: 'พุธ' }, { key: '4', label: 'พฤหัสบดี' },
  { key: '5', label: 'ศุกร์' }, { key: '6', label: 'เสาร์' },
  { key: '0', label: 'อาทิตย์' },
]

interface DayHours { open: string; close: string }
interface SpecialtyType { id: string; name_th: string; name_en: string }
interface SelectedSpecialty { specialty_type_id: string; hours: Record<string, DayHours> }

export default function NewClinicPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [specialtyTypes, setSpecialtyTypes] = useState<SpecialtyType[]>([])

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
  const [is24Hours, setIs24Hours] = useState(false)
  const [selectedSpecialties, setSelectedSpecialties] = useState<SelectedSpecialty[]>([])
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const [locationName, setLocationName] = useState('')
  const [locationLat, setLocationLat] = useState<number | null>(null)
  const [locationLng, setLocationLng] = useState<number | null>(null)
  const [geocoding, setGeocoding] = useState(false)

  useEffect(() => {
    supabase.from('specialty_types').select('*').order('name_th')
      .then(({ data }) => setSpecialtyTypes(data || []))
  }, [])

  const handleGeocode = async () => {
    if (!locationName.trim()) { toast.error('กรุณาพิมพ์ที่อยู่ก่อน'); return }
    setGeocoding(true)
    const result = await geocodeAddress(locationName)
    if (result) { setLocationLat(result.lat); setLocationLng(result.lng); toast.success('พบพิกัดแล้ว') }
    else toast.error('ไม่พบพิกัด ลองพิมพ์ละเอียดขึ้น')
    setGeocoding(false)
  }

  const toggleDay = (day: string) => {
    setOpeningHours(prev => {
      if (prev[day]) { const n = { ...prev }; delete n[day]; return n }
      return { ...prev, [day]: { open: '08:00', close: '17:00' } }
    })
  }

  const updateDayHours = (day: string, field: 'open' | 'close', val: string) => {
    setOpeningHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }))
  }

  const toggleSpecialty = (id: string) => {
    setSelectedSpecialties(prev => {
      if (prev.find(s => s.specialty_type_id === id))
        return prev.filter(s => s.specialty_type_id !== id)
      return [...prev, { specialty_type_id: id, hours: {} }]
    })
  }

  const toggleSpecialtyDay = (id: string, day: string) => {
    setSelectedSpecialties(prev => prev.map(s => {
      if (s.specialty_type_id !== id) return s
      const h = { ...s.hours }
      if (h[day]) { delete h[day] } else { h[day] = { open: '08:00', close: '17:00' } }
      return { ...s, hours: h }
    }))
  }

  const updateSpecialtyHours = (id: string, day: string, field: 'open' | 'close', val: string) => {
    setSelectedSpecialties(prev => prev.map(s => {
      if (s.specialty_type_id !== id) return s
      return { ...s, hours: { ...s.hours, [day]: { ...s.hours[day], [field]: val } } }
    }))
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('กรุณากรอกชื่อคลินิก'); return }
    if (!province) { toast.error('กรุณาเลือกจังหวัด'); return }
    if (!licenseFile) { toast.error('กรุณาแนบใบอนุญาตดำเนินการสถานพยาบาลสัตว์'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const compressed = await compressImage(licenseFile, { maxWidthPx: 1600, qualityJpeg: 0.8, maxSizeKB: 500 })
    const isImg = compressed.type.startsWith('image/')
    const path = `clinic-licenses/${user.id}-${Date.now()}.${isImg ? 'jpg' : licenseFile.name.split('.').pop()}`
    const { error: uploadErr } = await supabase.storage.from('clinic-docs').upload(path, compressed)
    if (uploadErr) { toast.error('อัปโหลดไฟล์ไม่สำเร็จ'); setSaving(false); return }
    const { data: urlData } = supabase.storage.from('clinic-docs').getPublicUrl(path)

    const { data: clinic, error } = await supabase.from('clinics').insert({
      name: name.trim(),
      name_en: nameEn.trim() || null,
      type,
      phone: phone.trim() || null,
      line_id: lineId.trim() || null,
      facebook: facebook.trim() || null,
      website: website.trim() || null,
      province,
      district: district || null,
      sub_district: subDistrict || null,
      address_detail: addressDetail.trim() || null,
      opening_hours: is24Hours ? null : openingHours,
      is_24_hours: is24Hours,
      location_name: locationName.trim() || null,
      location_lat: locationLat,
      location_lng: locationLng,
      license_doc_url: urlData.publicUrl,
      owner_vet_id: user.id,
    }).select().single()

    if (error || !clinic) { toast.error('บันทึกไม่สำเร็จ'); setSaving(false); return }

    if (selectedSpecialties.length > 0) {
      await supabase.from('clinic_specialties').insert(
        selectedSpecialties.map(s => ({
          clinic_id: clinic.id,
          specialty_type_id: s.specialty_type_id,
          opening_hours: s.hours,
        }))
      )
    }

    toast.success('ส่งข้อมูลแล้ว รอ Admin ตรวจสอบ')
    router.push('/clinic/manage')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">เพิ่มคลินิก / โรงพยาบาลสัตว์</h1>
      </div>

      <div className="card bg-amber-50 border border-amber-100 text-sm text-amber-700 py-3 px-4">
        หลังบันทึก Admin จะตรวจสอบใบอนุญาตก่อนเปิดให้แสดงในระบบ (1-2 วันทำการ)
      </div>

      {/* ข้อมูลพื้นฐาน */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">ข้อมูลพื้นฐาน</h2>
        <div>
          <label className="label">ประเภท</label>
          <div className="flex gap-2">
            {[{ v: 'clinic', l: 'คลินิก' }, { v: 'hospital', l: 'โรงพยาบาลสัตว์' }].map(t => (
              <button key={t.v} onClick={() => setType(t.v as any)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  type === t.v ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 text-gray-600 hover:border-primary-400'
                }`}>
                {t.l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">ชื่อ (ภาษาไทย) *</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="เช่น คลินิกสัตว์เลี้ยงสุขใจ" />
        </div>
        <div>
          <label className="label">ชื่อ (ภาษาอังกฤษ)</label>
          <input className="input" value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="e.g. Happy Pet Clinic" />
        </div>
      </div>

      {/* ช่องทางติดต่อ */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">ช่องทางติดต่อ</h2>
        <div>
          <label className="label">เบอร์โทรศัพท์</label>
          <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="02-xxx-xxxx" />
        </div>
        <div>
          <label className="label">LINE ID</label>
          <input className="input" value={lineId} onChange={e => setLineId(e.target.value)} placeholder="@clinicline" />
        </div>
        <div>
          <label className="label">Facebook</label>
          <input className="input" value={facebook} onChange={e => setFacebook(e.target.value)} placeholder="https://facebook.com/..." />
        </div>
        <div>
          <label className="label">Website</label>
          <input className="input" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
        </div>
      </div>

      {/* ที่อยู่ */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">ที่อยู่</h2>
        <div>
          <label className="label">จังหวัด *</label>
          <select className="input" value={province} onChange={e => { setProvince(e.target.value); setDistrict(''); setSubDistrict('') }}>
            <option value="">-- เลือกจังหวัด --</option>
            {getProvinces().map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        {province && (
          <div>
            <label className="label">อำเภอ/เขต</label>
            <select className="input" value={district} onChange={e => { setDistrict(e.target.value); setSubDistrict('') }}>
              <option value="">-- เลือกอำเภอ --</option>
              {getDistricts(province).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        {district && (
          <div>
            <label className="label">ตำบล/แขวง</label>
            <select className="input" value={subDistrict} onChange={e => setSubDistrict(e.target.value)}>
              <option value="">-- เลือกตำบล --</option>
              {getSubDistricts(province, district).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">รายละเอียดที่อยู่</label>
          <input className="input" value={addressDetail} onChange={e => setAddressDetail(e.target.value)} placeholder="เลขที่, ซอย, ถนน" />
        </div>
        <div>
          <label className="label flex items-center gap-1"><MapPin className="w-4 h-4" /> พิกัดที่ตั้ง</label>
          <div className="flex gap-2">
            <input type="text" value={locationName}
              onChange={e => { setLocationName(e.target.value); setLocationLat(null); setLocationLng(null) }}
              className="input flex-1" placeholder="เช่น ลาดพร้าว 71 กรุงเทพ" />
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
      </div>

      {/* เวลาเปิด-ปิด */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-700">เวลาเปิด-ปิด</h2>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={is24Hours} onChange={e => setIs24Hours(e.target.checked)}
            className="w-4 h-4 rounded accent-primary-600" />
          <span className="text-sm font-medium text-gray-700">เปิด 24 ชั่วโมง</span>
        </label>
        {!is24Hours && (
          <>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(d => (
                <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    openingHours[d.key] ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 text-gray-500'
                  }`}>
                  {d.label}
                </button>
              ))}
            </div>
            {DAYS.filter(d => openingHours[d.key]).map(d => (
              <div key={d.key} className="flex items-center gap-2 text-sm">
                <span className="w-16 text-gray-600 shrink-0">{d.label}</span>
                <input type="time" value={openingHours[d.key].open}
                  onChange={e => updateDayHours(d.key, 'open', e.target.value)} className="input w-28" />
                <span className="text-gray-400">–</span>
                <input type="time" value={openingHours[d.key].close}
                  onChange={e => updateDayHours(d.key, 'close', e.target.value)} className="input w-28" />
              </div>
            ))}
          </>
        )}
        {is24Hours && (
          <p className="text-sm text-primary-600 bg-primary-50 rounded-lg px-3 py-2">🕐 เปิดให้บริการตลอด 24 ชั่วโมง</p>
        )}
      </div>

      {/* แผนกเฉพาะทาง */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-700">แผนกเฉพาะทาง</h2>
        {specialtyTypes.length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีแผนกในระบบ</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {specialtyTypes.map(sp => {
                const selected = selectedSpecialties.find(s => s.specialty_type_id === sp.id)
                return (
                  <button key={sp.id} onClick={() => toggleSpecialty(sp.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      selected ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 text-gray-500 hover:border-primary-400'
                    }`}>
                    {sp.name_th}
                  </button>
                )
              })}
            </div>

            {selectedSpecialties.map(sel => {
              const sp = specialtyTypes.find(s => s.id === sel.specialty_type_id)
              if (!sp) return null
              return (
                <div key={sel.specialty_type_id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-2">
                  <p className="font-medium text-sm">{sp.name_th} <span className="text-gray-400 text-xs">({sp.name_en})</span></p>
                  <p className="text-xs text-gray-500">เวลาเฉพาะแผนก (ถ้าต่างจากคลินิก)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS.map(d => (
                      <button key={d.key} onClick={() => toggleSpecialtyDay(sel.specialty_type_id, d.key)}
                        className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                          sel.hours[d.key] ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 text-gray-500'
                        }`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                  {DAYS.filter(d => sel.hours[d.key]).map(d => (
                    <div key={d.key} className="flex items-center gap-2 text-xs">
                      <span className="w-14 text-gray-600 shrink-0">{d.label}</span>
                      <input type="time" value={sel.hours[d.key].open}
                        onChange={e => updateSpecialtyHours(sel.specialty_type_id, d.key, 'open', e.target.value)}
                        className="input w-24 text-xs py-1" />
                      <span className="text-gray-400">–</span>
                      <input type="time" value={sel.hours[d.key].close}
                        onChange={e => updateSpecialtyHours(sel.specialty_type_id, d.key, 'close', e.target.value)}
                        className="input w-24 text-xs py-1" />
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ใบอนุญาต */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-700">ใบอนุญาตดำเนินการสถานพยาบาลสัตว์ *</h2>
        <p className="text-xs text-gray-500">อัปโหลดไฟล์ภาพหรือ PDF เพื่อให้ Admin ตรวจสอบ</p>
        <input type="file" accept="image/*,.pdf"
          onChange={e => setLicenseFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100" />
        {licenseFile && <p className="text-xs text-green-600">✓ {licenseFile.name}</p>}
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
        {saving ? 'กำลังส่ง...' : 'ส่งข้อมูลเพื่อรอการอนุมัติ'}
      </button>
    </div>
  )
}
