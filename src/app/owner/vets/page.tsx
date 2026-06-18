'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Stethoscope, MapPin, ExternalLink, ShieldCheck } from 'lucide-react'

interface VetInfo {
  user_id: string
  bio: string | null
  license_number: string | null
  additional_education: string[]
  is_available: boolean
  location_name: string | null
  full_name: string
  avatar_url: string | null
}

const EDU_LABELS: Record<string, string> = {
  internship: 'Internship',
  certificate: 'Certificate',
  resident: 'Resident',
}

const VERIFY_URL = 'http://209.15.98.88/index.php?option=com_content&view=article&id=183'

export default function OwnerVetsPage() {
  const supabase = createClient()
  const [vets, setVets] = useState<VetInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('vet_profiles')
        .select(`
          user_id, bio, license_number, additional_education, is_available, location_name,
          profiles!inner(full_name, avatar_url)
        `)
        .order('is_available', { ascending: false })

      const mapped = (data || []).map((v: any) => ({
        ...v,
        full_name: v.profiles?.full_name || '',
        avatar_url: v.profiles?.avatar_url || null,
      }))
      setVets(mapped)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">รายชื่อสัตวแพทย์</h1>
        <p className="text-gray-500 text-sm mt-0.5">สัตวแพทย์ที่ลงทะเบียนในระบบ VetAcu</p>
      </div>

      {/* กล่องวิธีตรวจสอบใบอนุญาต */}
      <div className="card bg-blue-50 border border-blue-100 mb-5 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-1">วิธีตรวจสอบใบอนุญาตประกอบวิชาชีพ</p>
          <p className="text-blue-600 mb-2">พิมพ์ชื่อหรือนามสกุลของหมอที่เว็บสัตวแพทยสภา เพื่อยืนยันว่าเป็นสัตวแพทย์ที่ได้รับใบอนุญาตจริง</p>
          <a
            href={VERIFY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium underline hover:text-blue-900"
          >
            ไปที่เว็บสัตวแพทยสภา <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {vets.length === 0 ? (
        <div className="card text-center text-gray-400 py-12">
          <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>ยังไม่มีหมอลงทะเบียน</p>
        </div>
      ) : (
        <div className="space-y-4">
          {vets.map(vet => (
            <div key={vet.user_id} className="card">
              <div className="flex gap-4">
                {/* รูป */}
                <div className="shrink-0">
                  {vet.avatar_url ? (
                    <img src={vet.avatar_url} alt={vet.full_name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-100" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xl font-bold">
                      {vet.full_name[0] || 'H'}
                    </div>
                  )}
                </div>

                {/* ข้อมูล */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{vet.full_name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      vet.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {vet.is_available ? '🟢 รับงาน' : '🔴 ไม่ว่าง'}
                    </span>
                  </div>

                  {/* เลขใบอนุญาต */}
                  {vet.license_number && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="text-sm text-gray-600">ใบอนุญาต: <span className="font-medium">{vet.license_number}</span></span>
                      <a
                        href={VERIFY_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
                      >
                        ตรวจสอบ <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {/* ที่ตั้ง */}
                  {vet.location_name && (
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{vet.location_name}</span>
                    </div>
                  )}

                  {/* การศึกษาเพิ่มเติม */}
                  {vet.additional_education?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {vet.additional_education.map(k => (
                        <span key={k} className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                          {EDU_LABELS[k] || k}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* bio */}
                  {vet.bio && (
                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">{vet.bio}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
