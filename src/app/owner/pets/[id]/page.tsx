'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Save, Trash2, Plus, X, Syringe, Bug, Stethoscope, PawPrint, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import Image from 'next/image'
import PhotoUpload from '@/components/PhotoUpload'
import SearchableSelect, { SelectOption } from '@/components/SearchableSelect'
import { useLang } from '@/contexts/LanguageContext'

const SPECIES = ['สุนัข', 'แมว', 'กระต่าย', 'นก', 'ปลา', 'อื่นๆ']
const GENDERS = ['เพศผู้', 'เพศเมีย', 'ไม่ระบุ']

type Tab = 'info' | 'medical' | 'vaccine' | 'parasite'

interface Pet {
  id: string; name: string; species: string; breed: string | null
  gender: string; birthdate: string | null; photo_url: string | null; notes: string | null
}
interface MedRecord { id: string; record_date: string; title: string; description: string | null; vet_name: string | null; clinic_name: string | null }
interface Vaccine { id: string; vaccine_date: string; vaccine_name: string; next_due_date: string | null; clinic_name: string | null; notes: string | null }
interface Parasite { id: string; control_date: string; product_name: string; next_due_date: string | null; notes: string | null }

function calcAge(birthdate: string): string {
  const birth = new Date(birthdate)
  const now = new Date()
  const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (totalMonths < 1) return 'แรกเกิด'
  if (totalMonths < 12) return `${totalMonths} เดือน`
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  return m > 0 ? `${y} ปี ${m} เดือน` : `${y} ปี`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface RawVet { id: string; full_name: string; vet_profiles: { title: string | null; full_name_en: string | null }[] }

export default function PetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { lang } = useLang()

  const [tab, setTab] = useState<Tab>('info')
  const [pet, setPet] = useState<Pet | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const markSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const [medRecords, setMedRecords] = useState<MedRecord[]>([])
  const [vaccines, setVaccines] = useState<Vaccine[]>([])
  const [parasites, setParasites] = useState<Parasite[]>([])

  const [showMedForm, setShowMedForm] = useState(false)
  const [showVacForm, setShowVacForm] = useState(false)
  const [showParaForm, setShowParaForm] = useState(false)

  // searchable options
  const [breeds, setBreeds] = useState<SelectOption[]>([])
  const [loadingBreeds, setLoadingBreeds] = useState(false)
  const [rawVets, setRawVets] = useState<RawVet[]>([])
  const [vets, setVets] = useState<SelectOption[]>([])
  const [clinics, setClinics] = useState<SelectOption[]>([])

  // med form state
  const [medDate, setMedDate] = useState(new Date().toISOString().split('T')[0])
  const [medTitle, setMedTitle] = useState('')
  const [medDesc, setMedDesc] = useState('')
  const [medVet, setMedVet] = useState('')
  const [medClinic, setMedClinic] = useState('')

  // vaccine form state
  const [vacDate, setVacDate] = useState(new Date().toISOString().split('T')[0])
  const [vacName, setVacName] = useState('')
  const [vacNext, setVacNext] = useState('')
  const [vacClinic, setVacClinic] = useState('')
  const [vacNotes, setVacNotes] = useState('')

  // parasite form state
  const [paraDate, setParaDate] = useState(new Date().toISOString().split('T')[0])
  const [paraProduct, setParaProduct] = useState('')
  const [paraNext, setParaNext] = useState('')
  const [paraNotes, setParaNotes] = useState('')

  useEffect(() => { load() }, [id])

  useEffect(() => {
    setVets(rawVets.map(u => {
      const vp = u.vet_profiles?.[0]
      const titleTh = vp?.title || ''
      const fullNameEn = vp?.full_name_en || ''
      if (lang === 'en' && fullNameEn) {
        const label = titleTh ? `${fullNameEn}, DVM` : fullNameEn
        return { value: u.id, label }
      }
      const label = titleTh ? `${titleTh} ${u.full_name}` : u.full_name
      return { value: u.id, label }
    }))
  }, [lang, rawVets])

  // load breeds whenever species changes
  useEffect(() => {
    if (!pet) return
    const fetchBreeds = async () => {
      if (pet.species === 'อื่นๆ') { setBreeds([]); return }
      setLoadingBreeds(true)
      const { data } = await supabase
        .from('pet_breeds')
        .select('id, name')
        .eq('species', pet.species)
        .order('name')
      setBreeds((data || []).map((b: any) => ({ value: b.id, label: b.name })))
      setLoadingBreeds(false)
    }
    fetchBreeds()
  }, [pet?.species])

  const load = async () => {
    const [{ data: p }, { data: m }, { data: v }, { data: pa }, { data: vetData }, { data: clinicData }] = await Promise.all([
      supabase.from('pets').select('*').eq('id', id).single(),
      supabase.from('pet_medical_records').select('*').eq('pet_id', id).order('record_date', { ascending: false }),
      supabase.from('pet_vaccines').select('*').eq('pet_id', id).order('vaccine_date', { ascending: false }),
      supabase.from('pet_parasite_controls').select('*').eq('pet_id', id).order('control_date', { ascending: false }),
      supabase.from('profiles').select('id, full_name, vet_profiles(title, full_name_en)').eq('role', 'vet').not('full_name', 'is', null).order('full_name'),
      supabase.from('clinics').select('id, name').eq('status', 'approved').order('name'),
    ])
    if (!p) { router.push('/owner/pets'); return }
    setPet(p as Pet)
    setMedRecords((m as MedRecord[]) || [])
    setVaccines((v as Vaccine[]) || [])
    setParasites((pa as Parasite[]) || [])
    setRawVets((vetData || []) as RawVet[])
    setClinics((clinicData || []).map((c: any) => ({ value: c.id, label: c.name })))
    setLoading(false)
  }

  const handleSavePet = async () => {
    if (!pet) return
    setSaving(true)
    const { error } = await supabase.from('pets').update({
      name: pet.name, species: pet.species, breed: pet.breed || null,
      gender: pet.gender, birthdate: pet.birthdate || null,
      notes: pet.notes || null, photo_url: pet.photo_url || null,
    }).eq('id', id)
    if (error) toast.error('บันทึกไม่สำเร็จ')
    else { toast.success('บันทึกแล้ว!'); markSaved() }
    setSaving(false)
  }

  const handleDeletePet = async () => {
    if (!confirm(`ลบ ${pet?.name} ออกจากระบบ? (ประวัติทั้งหมดจะถูกลบด้วย)`)) return
    setDeleting(true)
    await supabase.from('pets').delete().eq('id', id)
    toast.success('ลบแล้ว')
    router.push('/owner/pets')
  }

  const handleAddMed = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!medTitle.trim()) return
    const { data, error } = await supabase.from('pet_medical_records').insert({
      pet_id: id, record_date: medDate, title: medTitle.trim(),
      description: medDesc.trim() || null, vet_name: medVet.trim() || null, clinic_name: medClinic.trim() || null,
    }).select().single()
    if (error) { toast.error('บันทึกไม่สำเร็จ'); return }
    setMedRecords(prev => [data as MedRecord, ...prev])
    setMedTitle(''); setMedDesc(''); setMedVet(''); setMedClinic('')
    setMedDate(new Date().toISOString().split('T')[0])
    setShowMedForm(false)
    toast.success('บันทึกแล้ว')
  }

  const handleAddVac = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vacName.trim()) return
    const { data, error } = await supabase.from('pet_vaccines').insert({
      pet_id: id, vaccine_date: vacDate, vaccine_name: vacName.trim(),
      next_due_date: vacNext || null, clinic_name: vacClinic.trim() || null, notes: vacNotes.trim() || null,
    }).select().single()
    if (error) { toast.error('บันทึกไม่สำเร็จ'); return }
    setVaccines(prev => [data as Vaccine, ...prev])
    setVacName(''); setVacNext(''); setVacClinic(''); setVacNotes('')
    setVacDate(new Date().toISOString().split('T')[0])
    setShowVacForm(false)
    toast.success('บันทึกแล้ว')
  }

  const handleAddPara = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paraProduct.trim()) return
    const { data, error } = await supabase.from('pet_parasite_controls').insert({
      pet_id: id, control_date: paraDate, product_name: paraProduct.trim(),
      next_due_date: paraNext || null, notes: paraNotes.trim() || null,
    }).select().single()
    if (error) { toast.error('บันทึกไม่สำเร็จ'); return }
    setParasites(prev => [data as Parasite, ...prev])
    setParaProduct(''); setParaNext(''); setParaNotes('')
    setParaDate(new Date().toISOString().split('T')[0])
    setShowParaForm(false)
    toast.success('บันทึกแล้ว')
  }

  const deleteMed = async (rid: string) => {
    await supabase.from('pet_medical_records').delete().eq('id', rid)
    setMedRecords(prev => prev.filter(r => r.id !== rid))
  }
  const deleteVac = async (vid: string) => {
    await supabase.from('pet_vaccines').delete().eq('id', vid)
    setVaccines(prev => prev.filter(v => v.id !== vid))
  }
  const deletePara = async (pid: string) => {
    await supabase.from('pet_parasite_controls').delete().eq('id', pid)
    setParasites(prev => prev.filter(p => p.id !== pid))
  }

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
  if (!pet) return null

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'info', label: 'ข้อมูล', icon: <PawPrint className="w-4 h-4" /> },
    { key: 'medical', label: 'ประวัติการรักษา', icon: <Stethoscope className="w-4 h-4" />, count: medRecords.length },
    { key: 'vaccine', label: 'วัคซีน', icon: <Syringe className="w-4 h-4" />, count: vaccines.length },
    { key: 'parasite', label: 'ป้องกันปรสิต', icon: <Bug className="w-4 h-4" />, count: parasites.length },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/owner/pets')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">{pet.name}</h1>
        {pet.birthdate && (
          <span className="text-sm text-gray-400">อายุ {calcAge(pet.birthdate)}</span>
        )}
      </div>

      {/* tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
              ${tab === t.key ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full px-1.5">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: ข้อมูลสัตว์เลี้ยง */}
      {tab === 'info' && (
        <div className="card space-y-4">
          <div className="flex justify-center">
            <PhotoUpload
              bucket="pet-photos"
              currentUrl={pet.photo_url}
              userId={pet.id}
              onUploaded={url => setPet(prev => prev ? { ...prev, photo_url: url } : prev)}
              size="lg"
              shape="square"
              label="อัปโหลดรูปสัตว์เลี้ยง"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ชื่อ *</label>
              <input value={pet.name} onChange={e => setPet(p => p ? { ...p, name: e.target.value } : p)} className="input" />
            </div>
            <div>
              <label className="label">ชนิด</label>
              <select value={pet.species}
                onChange={e => setPet(p => p ? { ...p, species: e.target.value, breed: null } : p)}
                className="input">
                {SPECIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">สายพันธุ์</label>
              {pet.species === 'อื่นๆ' ? (
                <input
                  value={pet.breed || ''}
                  onChange={e => setPet(p => p ? { ...p, breed: e.target.value } : p)}
                  className="input"
                  placeholder="ระบุสายพันธุ์"
                />
              ) : (
                <SearchableSelect
                  value={pet.breed || ''}
                  onChange={v => setPet(p => p ? { ...p, breed: v } : p)}
                  options={breeds}
                  loading={loadingBreeds}
                  placeholder="ค้นหาสายพันธุ์..."
                  freeTextPlaceholder="ระบุสายพันธุ์..."
                  notInListLabel="ไม่มีในรายการ — กรอกเอง"
                />
              )}
            </div>
            <div>
              <label className="label">เพศ</label>
              <select value={pet.gender} onChange={e => setPet(p => p ? { ...p, gender: e.target.value } : p)} className="input">
                {GENDERS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">
              วันเกิด
              {pet.birthdate && <span className="text-gray-400 font-normal ml-2">(อายุ {calcAge(pet.birthdate)})</span>}
            </label>
            <input type="date" value={pet.birthdate || ''} onChange={e => setPet(p => p ? { ...p, birthdate: e.target.value } : p)} className="input" max={new Date().toISOString().split('T')[0]} />
          </div>
          <div>
            <label className="label">หมายเหตุ</label>
            <textarea value={pet.notes || ''} onChange={e => setPet(p => p ? { ...p, notes: e.target.value } : p)} className="input resize-none" rows={2} placeholder="โรคประจำตัว, อาหารที่แพ้, หมายเหตุอื่นๆ" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSavePet} disabled={saving || saved} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'บันทึกแล้ว' : saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button onClick={handleDeletePet} disabled={deleting} className="px-4 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tab: ประวัติการรักษา */}
      {tab === 'medical' && (
        <div className="space-y-4">
          <button onClick={() => setShowMedForm(v => !v)} className="btn-primary flex items-center gap-2">
            {showMedForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showMedForm ? 'ยกเลิก' : 'เพิ่มประวัติการรักษา'}
          </button>

          {showMedForm && (
            <div className="card">
              <form onSubmit={handleAddMed} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">วันที่รักษา</label>
                    <input type="date" value={medDate} onChange={e => setMedDate(e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="label">หัวข้อ / อาการ *</label>
                    <input value={medTitle} onChange={e => setMedTitle(e.target.value)} className="input" placeholder="ตรวจสุขภาพ, ผ่าตัด..." required />
                  </div>
                </div>
                <div>
                  <label className="label">รายละเอียด</label>
                  <textarea value={medDesc} onChange={e => setMedDesc(e.target.value)} className="input resize-none" rows={2} placeholder="อาการ การรักษา ยาที่ได้รับ..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">ชื่อสัตวแพทย์</label>
                    <SearchableSelect
                      value={medVet}
                      onChange={setMedVet}
                      options={vets}
                      placeholder="ค้นหาหมอในระบบ..."
                      freeTextPlaceholder="ชื่อสัตวแพทย์..."
                      notInListLabel="ไม่มีในระบบ — กรอกเอง"
                    />
                  </div>
                  <div>
                    <label className="label">คลินิก / โรงพยาบาล</label>
                    <SearchableSelect
                      value={medClinic}
                      onChange={setMedClinic}
                      options={clinics}
                      placeholder="ค้นหาคลินิกในระบบ..."
                      freeTextPlaceholder="ชื่อคลินิก..."
                      notInListLabel="ไม่มีในระบบ — กรอกเอง"
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full">บันทึก</button>
              </form>
            </div>
          )}

          {medRecords.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">ยังไม่มีประวัติการรักษา</div>
          ) : (
            <div className="space-y-3">
              {medRecords.map(r => (
                <div key={r.id} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{r.title}</span>
                        <span className="text-xs text-gray-400">{fmtDate(r.record_date)}</span>
                      </div>
                      {r.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{r.description}</p>}
                      {(r.vet_name || r.clinic_name) && (
                        <p className="text-xs text-gray-400 mt-1">
                          {r.vet_name && `🩺 ${r.vet_name}`}{r.vet_name && r.clinic_name && ' · '}{r.clinic_name && `🏥 ${r.clinic_name}`}
                        </p>
                      )}
                    </div>
                    <button onClick={() => deleteMed(r.id)} className="text-gray-300 hover:text-red-400 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: วัคซีน */}
      {tab === 'vaccine' && (
        <div className="space-y-4">
          <button onClick={() => setShowVacForm(v => !v)} className="btn-primary flex items-center gap-2">
            {showVacForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showVacForm ? 'ยกเลิก' : 'เพิ่มประวัติวัคซีน'}
          </button>

          {showVacForm && (
            <div className="card">
              <form onSubmit={handleAddVac} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">วันที่ฉีด</label>
                    <input type="date" value={vacDate} onChange={e => setVacDate(e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="label">ชื่อวัคซีน *</label>
                    <input value={vacName} onChange={e => setVacName(e.target.value)} className="input" placeholder="DHPPiL, พิษสุนัขบ้า..." required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">ฉีดครั้งถัดไป</label>
                    <input type="date" value={vacNext} onChange={e => setVacNext(e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="label">คลินิก</label>
                    <SearchableSelect
                      value={vacClinic}
                      onChange={setVacClinic}
                      options={clinics}
                      placeholder="ค้นหาคลินิกในระบบ..."
                      freeTextPlaceholder="ชื่อคลินิก..."
                      notInListLabel="ไม่มีในระบบ — กรอกเอง"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">หมายเหตุ</label>
                  <input value={vacNotes} onChange={e => setVacNotes(e.target.value)} className="input" placeholder="เลขที่ batch, ผลข้างเคียง..." />
                </div>
                <button type="submit" className="btn-primary w-full">บันทึก</button>
              </form>
            </div>
          )}

          {vaccines.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">ยังไม่มีประวัติวัคซีน</div>
          ) : (
            <div className="space-y-3">
              {vaccines.map(v => (
                <div key={v.id} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">💉 {v.vaccine_name}</span>
                        <span className="text-xs text-gray-400">{fmtDate(v.vaccine_date)}</span>
                      </div>
                      {v.next_due_date && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">🔔 นัดฉีดครั้งถัดไป: {fmtDate(v.next_due_date)}</p>
                      )}
                      {(v.clinic_name || v.notes) && (
                        <p className="text-xs text-gray-400 mt-1">
                          {v.clinic_name && `🏥 ${v.clinic_name}`}{v.clinic_name && v.notes && ' · '}{v.notes}
                        </p>
                      )}
                    </div>
                    <button onClick={() => deleteVac(v.id)} className="text-gray-300 hover:text-red-400 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: ป้องกันปรสิตภายนอก */}
      {tab === 'parasite' && (
        <div className="space-y-4">
          <button onClick={() => setShowParaForm(v => !v)} className="btn-primary flex items-center gap-2">
            {showParaForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showParaForm ? 'ยกเลิก' : 'เพิ่มประวัติป้องกันปรสิต'}
          </button>

          {showParaForm && (
            <div className="card">
              <form onSubmit={handleAddPara} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">วันที่ใช้ยา</label>
                    <input type="date" value={paraDate} onChange={e => setParaDate(e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="label">ชื่อยา / ผลิตภัณฑ์ *</label>
                    <input value={paraProduct} onChange={e => setParaProduct(e.target.value)} className="input" placeholder="Frontline, NexGard..." required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">ครั้งถัดไป</label>
                    <input type="date" value={paraNext} onChange={e => setParaNext(e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="label">หมายเหตุ</label>
                    <input value={paraNotes} onChange={e => setParaNotes(e.target.value)} className="input" placeholder="ขนาด, วิธีใช้..." />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full">บันทึก</button>
              </form>
            </div>
          )}

          {parasites.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">ยังไม่มีประวัติป้องกันปรสิต</div>
          ) : (
            <div className="space-y-3">
              {parasites.map(p => (
                <div key={p.id} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">🐛 {p.product_name}</span>
                        <span className="text-xs text-gray-400">{fmtDate(p.control_date)}</span>
                      </div>
                      {p.next_due_date && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">🔔 ครั้งถัดไป: {fmtDate(p.next_due_date)}</p>
                      )}
                      {p.notes && <p className="text-xs text-gray-400 mt-1">{p.notes}</p>}
                    </div>
                    <button onClick={() => deletePara(p.id)} className="text-gray-300 hover:text-red-400 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
