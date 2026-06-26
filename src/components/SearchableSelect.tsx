'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, X, PenLine } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  sublabel?: string
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  notInListLabel?: string
  freeTextPlaceholder?: string
  loading?: boolean
  className?: string
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'ค้นหา...',
  notInListLabel = 'ไม่มีในระบบ — กรอกเอง',
  freeTextPlaceholder = 'กรอกชื่อ...',
  loading = false,
  className = '',
}: SearchableSelectProps) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [isFreeText, setIsFreeText] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // sync when parent clears/sets value externally
  useEffect(() => {
    if (!isFreeText) setQuery(value)
  }, [value, isFreeText])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        // if user typed but didn't select, reset query to last confirmed value
        if (!isFreeText) setQuery(value)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [value, isFreeText])

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase()) ||
    (o.sublabel && o.sublabel.toLowerCase().includes(query.toLowerCase()))
  )

  const select = (opt: SelectOption) => {
    onChange(opt.label)
    setQuery(opt.label)
    setOpen(false)
    setIsFreeText(false)
  }

  const clear = () => {
    onChange('')
    setQuery('')
    setIsFreeText(false)
  }

  const goFreeText = () => {
    setIsFreeText(true)
    setOpen(false)
    onChange('')
    setQuery('')
  }

  const backToSearch = () => {
    setIsFreeText(false)
    onChange('')
    setQuery('')
  }

  // free text mode
  if (isFreeText) {
    return (
      <div className={`relative ${className}`}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="input pr-8"
          placeholder={freeTextPlaceholder}
          autoFocus
        />
        <button
          type="button"
          onClick={backToSearch}
          title="ค้นหาในระบบ"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-500"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div className="relative">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="input pr-8"
          placeholder={loading ? 'กำลังโหลด...' : placeholder}
          disabled={loading}
          autoComplete="off"
        />
        {query ? (
          <button type="button" onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        ) : (
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        )}
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-3 text-sm text-gray-400 text-center">กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">ไม่พบ "{query}"</div>
          ) : (
            filtered.map(opt => (
              <button key={opt.value} type="button" onClick={() => select(opt)}
                className="w-full text-left px-3 py-2.5 hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors text-sm flex items-baseline gap-2">
                <span>{opt.label}</span>
                {opt.sublabel && <span className="text-xs text-gray-400 -ml-1">{opt.sublabel}</span>}
              </button>
            ))
          )}
          <button type="button" onClick={goFreeText}
            className="w-full text-left px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <PenLine className="w-3.5 h-3.5 text-gray-400" />
            {notInListLabel}
          </button>
        </div>
      )}
    </div>
  )
}
