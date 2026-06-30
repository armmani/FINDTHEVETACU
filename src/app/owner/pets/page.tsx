'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Plus, PawPrint, ChevronRight, X, LinkIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import Image from 'next/image'
import SearchableSelect, { SelectOption } from '@/components/SearchableSelect'
import LoadingScreen from '@/components/LoadingScreen'

interface Pet {
  id: string
  name: string
  species: string
  breed: string | null
  gender: string
  birthdate: string | null
  photo_url: string | null
}

const SPECIES = ['สุนัข', 'แมว', 'กระต่าย', 'นก', 'ปลา', 'อื่นๆ']
const GENDERS = ['เพศผู้', 'เพศเมีย', 'ไม่ระบุ']

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

export default function PetsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [species, setSpecies] = useState('สุนัข')
  const [breed, setBreed] = useState('')
  const [gender, setGender] = useState('ไม่ระบุ')
  const [neutered, setNeutered] = useState(false)
  const [birthdate, setBirthdate] = useState('')

  const [breeds, setBreeds] = useState<SelectOption[]>([])
  const [loadingBreeds, setLoadingBreeds] = useState(false)

  useEffect(() => { load() }, [])

  useEffect(() => {
    const fetchBreeds = async () => {
      if (species === 'อื่นๆ') { setBreeds([]); return }
      setLoadingBreeds(true)
      setBreed('')
      const { data } = await supabase
        .from('pet_breeds')
        .select('id, name, name_en')
        .eq('species', species)
        .order('name')
      setBreeds((data || []).map((b: any) => ({ value: b.name, label: b.name_en ? `${b.name} / ${b.name_en}` : b.name })))
      setLoadingBreeds(false)
    }
    fetchBreeds()
  }, [species])

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('pets').select('*').eq('owner_id', user.id).order('created_at')
    setPets((data as Pet[]) || [])
    setLoading(false)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('กรุณาใส่ชื่อสัตว์เลี้ยง'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from('pets').insert({
      owner_id: user.id,
      name: name.trim(),
      species,
      breed: breed.trim() || null,
      gender,
      neutered,
      birthdate: birthdate || null,
    }).select().single()
    if (error) { toast.error('บันทึกไม่สำเร็จ'); setSaving(false); return }
    toast.success('เพิ่มสัตว์เลี้ยงแล้ว!')
    setName(''); setBreed(''); setGender('ไม่ระบุ'); setNeutered(false); setBirthdate('')
    setShowForm(false)
    setSaving(false)
    router.push(`/owner/pets/${(data as any).id}`)
  }

  if (loading) return <LoadingScreen />

  const speciesEmoji: Record<string, string> = {
    สุนัข: '🐕', แมว: '🐈', กระต่าย: '🐇', นก: '🐦', ปลา: '🐟', อื่นๆ: '🐾'
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">สัตว์เลี้ยงของฉัน</h1>
        <div className="flex items-center gap-2">
          <Link href="/owner/pets/claim" className="btn-secondary flex items-center gap-1.5 text-sm">
            <LinkIcon className="w-4 h-4" /> เชื่อมสัตว์เลี้ยง
          </Link>
          <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-2">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'ยกเลิก' : 'เพิ่มสัตว์เลี้ยง'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card">
          <h2 className="font-semibold mb-4">เพิ่มสัตว์เลี้ยงใหม่</h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">ชื่อสัตว์เลี้ยง *</label>
                <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="มะม่วง" required />
              </div>
              <div>
                <label className="label">ชนิด</label>
                <select value={species} onChange={e => setSpecies(e.target.value)} className="input">
                  {SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">สายพันธุ์</label>
                {species === 'อื่นๆ' ? (
                  <input value={breed} onChange={e => setBreed(e.target.value)} className="input" placeholder="ระบุสายพันธุ์" />
                ) : (
                  <SearchableSelect
                    value={breed}
                    onChange={setBreed}
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
                <select value={gender} onChange={e => setGender(e.target.value)} className="input">
                  {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">การทำหมัน</label>
              <div className="flex gap-2">
                {[{ v: false, label: 'ยังไม่ได้ทำหมัน' }, { v: true, label: 'ทำหมันแล้ว' }].map(opt => (
                  <button key={String(opt.v)} type="button" onClick={() => setNeutered(opt.v)}
                    className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors
                      ${neutered === opt.v
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">วันเกิด</label>
              <input type="date" value={birthdate} onChange={e => setBirthdate(e.target.value)} className="input" max={new Date().toISOString().split('T')[0]} />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </form>
        </div>
      )}

      {pets.length === 0 ? (
        <div className="card text-center py-14">
          <PawPrint className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">ยังไม่มีสัตว์เลี้ยง</p>
          <p className="text-sm text-gray-300 mt-1">กด "เพิ่มสัตว์เลี้ยง" เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pets.map(pet => (
            <button key={pet.id} onClick={() => router.push(`/owner/pets/${pet.id}`)}
              className="card text-left flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-primary-50 flex items-center justify-center shrink-0">
                {pet.photo_url
                  ? <Image src={pet.photo_url} alt={pet.name} width={56} height={56} className="w-full h-full object-cover" />
                  : <span className="text-2xl">{speciesEmoji[pet.species] || '🐾'}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{pet.name}</p>
                <p className="text-sm text-gray-500">{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</p>
                {pet.birthdate && (
                  <p className="text-xs text-gray-400 mt-0.5">อายุ {calcAge(pet.birthdate)}</p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
