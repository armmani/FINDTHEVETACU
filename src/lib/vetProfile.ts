export interface VetProfileCompleteness {
  license_number: string | null
  license_doc_url: string | null
  location_lat: number | null
}

// ครบเงื่อนไขขั้นต่ำที่ handleSave บังคับอยู่แล้ว (เลขใบอนุญาต, พิกัด, เอกสารยืนยันตัวตน)
export function isVetProfileIncomplete(vp: VetProfileCompleteness | null): boolean {
  if (!vp) return true
  return !vp.license_number || !vp.location_lat || !vp.license_doc_url
}
