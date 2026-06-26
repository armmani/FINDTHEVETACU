'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

interface SaveButtonProps {
  onSave: () => Promise<void>
  className?: string
  idleLabel?: string
  savingLabel?: string
  savedLabel?: string
  disabled?: boolean
  type?: 'button' | 'submit'
  icon?: React.ReactNode
}

export default function SaveButton({
  onSave,
  className = 'btn-primary',
  idleLabel = 'บันทึก',
  savingLabel = 'กำลังบันทึก...',
  savedLabel = 'บันทึกแล้ว',
  disabled = false,
  type = 'button',
  icon,
}: SaveButtonProps) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const handle = async (e: React.MouseEvent | React.FormEvent) => {
    if (type === 'submit') (e as React.FormEvent).preventDefault?.()
    if (state !== 'idle' || disabled) return
    setState('saving')
    try {
      await onSave()
      setState('saved')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('idle')
    }
  }

  return (
    <button
      type={type}
      onClick={type === 'button' ? handle : undefined}
      onSubmit={type === 'submit' ? handle : undefined}
      disabled={state !== 'idle' || disabled}
      className={`${className} flex items-center justify-center gap-2 transition-all disabled:opacity-60`}
    >
      {state === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
      {state === 'saved' && <Check className="w-4 h-4" />}
      {icon && state === 'idle' && icon}
      {state === 'saving' ? savingLabel : state === 'saved' ? savedLabel : idleLabel}
    </button>
  )
}
