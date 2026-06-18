import { createClient } from '@/lib/supabase'

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

export async function notifyAdmin(message: string) {
  const chatId = process.env.NEXT_PUBLIC_ADMIN_TELEGRAM_CHAT_ID
  if (!chatId) return
  await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message }),
  })
}
