'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { geocodeAddress } from '@/lib/distance'
import { MapPin, ArrowLeft, PawPrint, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import type { Pet } from '@/lib/types'
import dynamic from 'next/dynamic'

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false })

const PET_TYPES = ['สุนัข', 'แมว', 'กระต่าย', 'นก', 'สัตว์เลื้อยคลาน', 'อื่นๆ']

export default function NewRequestPage() {
  const router = useRouter()
  const supabase = createClient()
  const [geocoding, setGeocoding] = useState(false)

  // ข้อมูลสัตว์
  const [myPets, setMyPets] = useState<Pet[]>([])
  const [selectedPetId, setSelectedPetId] = useState<string>('new')
  const [petName, setPetName] = useState('')
  const [petType, setPetType] = useState('สุนัข')
  const [petAge, setPetAge] = useState('')
  const [petNote, setPetNote] = useState('')

  // ข้อมูลนัด
  const [symptoms, setSymptoms] = useState('')
  const [hadAcupunctureBefore, setHadAcupunctureBefore] = useState(false)
  const [sessionNumber, setSessionNumber] = useState(1)
  const [preferredDatetime, setPreferredDatetime] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [locationLat, setLocationLat] = useState<number | null>(null)
  const [locationLng, setLocationLng] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadMyPets()
  }, [])

  const handleGeocode = async () => {
    if (!locationAddress.trim()) { toast.error('กรุณาพิมพ์ที่อยู่ก่อน'); return }
    setGeocoding(true)
    const result = await geocodeAddress(locationAddress)
    if (result) {
      setLocationLat(result.lat)
      setLocationLng(result.lng)
      toast.success('พบพิกัดแล้ว ✓')
    } else {
      toast.error('หาพิกัดไม่พบ ลองพิมพ์ให้ละเอียดขึ้น')
    }
    setGeocoding(false)
  }

  // เมื่อเลือกสัตว์เลี้ยงที่มีอยู่แล้ว
  useEffect(() => {
    if (selectedPetId === 'new') {
      setPetName(''); setPetType('สุนัข'); setPetAge(''); setPetNote('')
      setHadAcupunctureBefore(false); setSessionNumber(1)
      return
    }
    const pet = myPets.find(p => p.id === selectedPetId)
    if (pet) {
      setPetName(pet.name); setPetType(pet.type); setPetAge(pet.age); setPetNote(pet.note || '')
      // นับจำนวนครั้งที่เคยนัดกับสัตว์ตัวนี้
      countPastSessions(pet.id)
    }
  }, [selectedPetId])

  const loadMyPets = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('pets').select('*').eq('owner_id', user.id).order('name')
    setMyPets(data || [])
  }

  const countPastSessions = async (petId: string) => {
    const { count } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('pet_id', petId)
      .neq('status', 'cancelled')
    const next = (count || 0) + 1
    setSessionNumber(next)
    setHadAcupunctureBefore((count || 0) > 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!locationLat || !locationLng) {
      toast.error('กรุณากดปุ่ม "ค้นหา" เพื่อระบุพิกัดที่อยู่ก่อน')
      return
    }
    if (!petAge.trim()) { toast.error('กรุณาใส่อายุสัตว์เลี้ยง'); return }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    let petId = selectedPetId === 'new' ? null : selectedPetId

    // ถ้าเพิ่มสัตว์ใหม่ → สร้างก่อน
    if (selectedPetId === 'new') {
      const { data: newPet, error: petErr } = await supabase
        .from('pets')
        .insert({ owner_id: user.id, name: petName, type: petType, age: petAge, note: petNote || null })
        .select()
        .single()
      if (petErr || !newPet) {
        toast.error('เพิ่มสัตว์เลี้ยงไม่สำเร็จ'); setLoading(false); return
      }
      petId = newPet.id
      // นับ session
      const { count } = await supabase.from('appointments').select('*', { count: 'exact', head: true })
        .eq('pet_id', petId).neq('status', 'cancelled')
      setSessionNumber((count || 0) + 1)
      setHadAcupunctureBefore((count || 0) > 0)
    }

    const { error } = await supabase.from('appointments').insert({
      owner_id: user.id,
      pet_id: petId,
      pet_name: petName,
      pet_type: petType,
      pet_age: petAge,
      symptoms,
      had_acupuncture_before: hadAcupunctureBefore,
      session_number: sessionNumber,
      preferred_datetime: new Date(preferredDatetime).toISOString(),
      location_lat: locationLat,
      location_lng: locationLng,
      location_address: locationAddress,
    })

    if (error) { toast.error('เกิดข้อผิดพลาด: ' + error.message); setLoading(false); return }

    toast.success('สร้างคำขอสำเร็จ รอหมอตอบรับ!')
    router.push('/owner/dashboard')
  }

  const minDatetime = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/owner/dashboard" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">นัดหมายใหม่</h1>
          <p className="text-gray-500 text-sm">กรอกข้อมูลเพื่อหาหมอฝังเข็ม</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* เลือกสัตว์เลี้ยง */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <PawPrint className="w-4 h-4 text-primary-600" /> สัตว์เลี้ยง
          </h2>

          {myPets.length > 0 && (
            <div className="mb-4">
              <label className="label">เลือกสัตว์เลี้ยงของฉัน</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {myPets.map(pet => (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => setSelectedPetId(pet.id)}
                    className={`p-3 rounded-xl border-2 text-left text-sm transition-colors ${
                      selectedPetId === pet.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{pet.name}</div>
                    <div className="text-gray-400 text-xs">{pet.type} · {pet.age}</div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedPetId('new')}
                  className={`p-3 rounded-xl border-2 text-sm transition-colors flex items-center gap-1 justify-center ${
                    selectedPetId === 'new'
                      ? 'border-primary-500 bg-primary-50 text-primary-600'
                      : 'border-dashed border-gray-300 text-gray-400 hover:border-gray-400'
                  }`}
                >
                  <Plus className="w-4 h-4" /> เพิ่มใหม่
                </button>
              </div>
            </div>
          )}

          {/* ฟอร์มข้อมูลสัตว์ */}
          {selectedPetId === 'new' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">ชื่อสัตว์เลี้ยง *</label>
                  <input type="text" value={petName} onChange={e => setPetName(e.target.value)}
                    className="input" placeholder="เช่น บัดดี้" required />
                </div>
                <div>
                  <label className="label">ประเภท *</label>
                  <select value={petType} onChange={e => setPetType(e.target.value)} className="input">
                    {PET_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">อายุ *</label>
                  <input type="text" value={petAge} onChange={e => setPetAge(e.target.value)}
                    className="input" placeholder="เช่น 3 ปี" required />
                </div>
              </div>
              <div>
                <label className="label">หมายเหตุ (โรคประจำตัว ฯลฯ)</label>
                <input type="text" value={petNote} onChange={e => setPetNote(e.target.value)}
                  className="input" placeholder="ไม่บังคับ" />
              </div>
            </div>
          )}

          {selectedPetId !== 'new' && (
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
              {myPets.find(p => p.id === selectedPetId)?.note && (
                <p>📝 {myPets.find(p => p.id === selectedPetId)?.note}</p>
              )}
            </div>
          )}
        </div>

        {/* ประวัติฝังเข็ม */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-3">ประวัติการฝังเข็ม</h2>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium">เคยฝังเข็มมาก่อนหรือยัง?</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !hadAcupunctureBefore
                setHadAcupunctureBefore(next)
                if (!next) setSessionNumber(1)
              }}
              className={`relative inline-flex w-12 h-6 rounded-full transition-colors overflow-hidden shrink-0 ${hadAcupunctureBefore ? 'bg-primary-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${hadAcupunctureBefore ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          {hadAcupunctureBefore && (
            <div>
              <label className="label">ครั้งที่ *</label>
              <input
                type="number"
                value={sessionNumber}
                onChange={e => setSessionNumber(parseInt(e.target.value) || 1)}
                className="input"
                min="2"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                {selectedPetId !== 'new' ? '* คำนวณอัตโนมัติจากประวัติ' : '* กรอกครั้งที่กำลังจะทำ'}
              </p>
            </div>
          )}

          {!hadAcupunctureBefore && (
            <p className="text-sm text-gray-400">ครั้งที่ 1 (ครั้งแรก)</p>
          )}
        </div>

        {/* อาการ */}
        <div className="card">
          <label className="label">อาการ / เหตุผลที่ต้องการฝังเข็ม *</label>
          <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)}
            className="input resize-none" rows={3}
            placeholder="เช่น ขาหลังอ่อนแรง เดินลำบาก..." required />
        </div>

        {/* เวลา + สถานที่ */}
        <div className="card space-y-4">
          <div>
            <label className="label">วันและเวลาที่ต้องการ *</label>
            <input type="datetime-local" value={preferredDatetime}
              onChange={e => setPreferredDatetime(e.target.value)}
              className="input" min={minDatetime} required />
          </div>
          <div>
            <label className="label flex items-center gap-1">
              <MapPin className="w-4 h-4" /> ที่อยู่ที่ต้องการให้หมอมา *
            </label>
            <div className="flex gap-2">
              <input type="text" value={locationAddress}
                onChange={e => { setLocationAddress(e.target.value); setLocationLat(null); setLocationLng(null) }}
                className="input flex-1" placeholder="เช่น สุขุมวิท 71 กรุงเทพ" required />
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
                  <MapPicker
                    lat={locationLat}
                    lng={locationLng}
                    onMove={(lat, lng) => { setLocationLat(lat); setLocationLng(lng) }}
                  />
                </div>
                <a
                  href={`https://www.google.com/maps?q=${locationLat},${locationLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs text-primary-600 mt-1 hover:underline"
                >
                  เปิดใน Google Maps →
                </a>
              </>
            ) : (
              <p className="text-xs text-gray-400 mt-1">พิมพ์ที่อยู่แล้วกด "ค้นหา"</p>
            )}
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
          {loading ? 'กำลังสร้างคำขอ...' : 'ส่งคำขอนัดหมาย'}
        </button>
      </form>
    </div>
  )
}
