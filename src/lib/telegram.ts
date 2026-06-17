import { createClient } from '@/lib/supabase'

// ดึง telegram_chat_id ของ user แล้วส่งข้อความ (ถ้ามี)
export async function notifyUser(userId: string, message: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', userId)
    .single()

  const chatId = (data as any)?.telegram_chat_id
  if (!chatId) return

  await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message }),
  })
}
