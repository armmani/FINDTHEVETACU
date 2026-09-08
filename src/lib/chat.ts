import { createClient } from '@/lib/supabase'

/**
 * เปิดห้องแชทกับผู้ใช้อีกคน (ถ้ามีอยู่แล้วจะคืนห้องเดิม)
 * คืน conversation id หรือ null ถ้าเปิดไม่ได้ (เช่น อีกฝ่ายปิดรับแชท)
 */
export async function openConversation(otherUserId: string): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    other_user_id: otherUserId,
  })
  if (error || !data) return null
  return data as string
}

/** นับข้อความที่ยังไม่ได้อ่านทั้งหมดของผู้ใช้ปัจจุบัน */
export async function countUnread(userId: string): Promise<number> {
  const supabase = createClient()
  const { count } = await supabase
    .from('direct_messages')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
    .neq('sender_id', userId)
  return count || 0
}
