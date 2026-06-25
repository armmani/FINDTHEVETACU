/** ตัดเอาแค่ตัวเลขออกมา */
export function digitsOnly(v: string) {
  return v.replace(/\D/g, '').slice(0, 10)
}

/**
 * แปลงตัวเลข → XX-XXX-XXXX (9 หลัก) หรือ XXX-XXX-XXXX (10 หลัก)
 * ระหว่างพิมพ์ยังไม่ครบก็แสดงเท่าที่มี
 */
export function formatPhone(digits: string): string {
  const d = digitsOnly(digits)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`
  // ถ้ายังไม่รู้ว่า 9 หรือ 10 หลัก (กรอกไม่ถึง 10) → ใช้ pattern 9 หลักไปก่อน
  // พอถึง 10 หลัก switch เป็น XXX-XXX-XXXX
  if (d.length < 10) {
    return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`
  }
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
}

/** ดึงตัวเลขล้วนออกมาเพื่อเก็บใน state / DB */
export function unformatPhone(formatted: string): string {
  return digitsOnly(formatted)
}
