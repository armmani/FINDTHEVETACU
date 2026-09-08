/** ประเภทงานที่หมอพาร์ทไทม์รับได้ — ใช้ร่วมกันระหว่างหน้าตั้งค่าโปรไฟล์กับบอร์ดหางาน */
export const JOB_TYPES = [
  { key: 'opd',        label: 'ตรวจ OPD / คลินิกทั่วไป' },
  { key: 'surgery',    label: 'ผ่าตัด' },
  { key: 'spay',       label: 'ทำหมัน' },
  { key: 'dental',     label: 'ทันตกรรม' },
  { key: 'imaging',    label: 'อัลตราซาวด์ / X-ray' },
  { key: 'lab',        label: 'แล็บ / ชันสูตร' },
  { key: 'acupuncture',label: 'ฝังเข็ม / เวชศาสตร์ฟื้นฟู' },
  { key: 'exotic',     label: 'สัตว์เอ็กโซติก' },
  { key: 'livestock',  label: 'ปศุสัตว์ / สัตว์ใหญ่' },
  { key: 'night',      label: 'เวรกลางคืน / ICU' },
  { key: 'mobile',     label: 'ออกตรวจนอกสถานที่' },
  { key: 'other',      label: 'อื่นๆ' },
] as const

export const JOB_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  JOB_TYPES.map(j => [j.key, j.label])
)

export interface PartTimeRow {
  vet_id: string
  is_open: boolean
  urgent_ok: boolean
  job_types: string[]
  provinces: string[]
  note: string | null
  rate_note: string | null
  updated_at: string | null
}
