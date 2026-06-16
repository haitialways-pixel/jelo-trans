'use client'

import { useState, useRef, useEffect } from 'react'
import { MapPin, Loader2 } from 'lucide-react'

type Props = {
  placeholder: string
  value: string
  onChange: (v: string) => void
}

type Suggestion = { label: string }

export function AddressAutocomplete({ placeholder, value, onChange }: Props) {
  const [input, setInput] = useState(value || '')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function handleInput(v: string) {
    setInput(v)
    onChange(v) // keep the form in sync even without picking a suggestion
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.trim().length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 300)
  }

  async function fetchSuggestions(q: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      
      const sugg: Suggestion[] = data.suggestions || []
      setSuggestions(sugg)
      setOpen(sugg.length > 0)
    } catch {
      setSuggestions([])
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  function pick(s: Suggestion) {
    setInput(s.label)
    onChange(s.label)
    setOpen(false)
    setSuggestions([])
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={input}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
        className="w-full p-4 rounded-2xl bg-[#111] border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-[#c5a26f]"
      />
      {loading && (
        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c5a26f] animate-spin" />
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-[#111] border border-[#2a2a2a] rounded-2xl overflow-hidden shadow-2xl">
          {suggestions.map((s, i) => (
            <li
              key={i}
              onClick={() => pick(s)}
              className="flex items-start gap-2 px-4 py-3 text-sm text-white hover:bg-[#c5a26f]/10 cursor-pointer border-b border-white/5 last:border-0"
            >
              <MapPin className="w-4 h-4 text-[#c5a26f] mt-0.5 shrink-0" />
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
