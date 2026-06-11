'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MessageCircle, X, Send } from 'lucide-react'
import { retrieve, CONFIDENCE_THRESHOLD } from '@/lib/chatbot/retrieve'
import { runChatAction } from '@/lib/chatbot/actions'
import { HUMAN_PHONE, type ChatContext } from '@/lib/chatbot/knowledge'

type Msg = {
  role: 'user' | 'bot'
  text: string
  link?: { href: string; label: string }
}

const QUICK = ['Our fleet', 'How much is it?', 'Airport transfer', 'Talk to a human']

const GREETING: Msg = {
  role: 'bot',
  text:
    "Hi! I’m the Phalo Transportation concierge assistant. Ask about our fleet, pricing, airport transfers, or your booking — and for anything complex I’ll connect you with our team.",
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<ChatContext>({})
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function send(text: string) {
    const q = text.trim()
    if (!q || loading) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: q }])
    setLoading(true)
    try {
      const { entry, score } = retrieve(q)
      let result: { text: string; link?: { href: string; label: string }; context?: ChatContext }
      if (score < CONFIDENCE_THRESHOLD) {
        result = await runChatAction('escalate', q, context)
      } else if (entry.action) {
        result = await runChatAction(entry.action, q, context)
      } else {
        result = { text: entry.answer ?? '' }
      }
      if (result.context) setContext((c) => ({ ...c, ...result.context }))
      setMessages((m) => [...m, { role: 'bot', text: result.text, link: result.link }])
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'bot', text: `Sorry, something went wrong on my end. You can reach us directly at ${HUMAN_PHONE}.` },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full btn-gold flex items-center justify-center shadow-xl"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-2xl">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="text-xs tracking-[3px] text-[#c5a26f]">PHALO TRANSPORTATION CONCIERGE</div>
            <div className="text-sm text-[#a1a1aa]">Assistant · instant replies</div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                <div
                  className={`inline-block max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === 'user' ? 'bg-[#c5a26f] text-black' : 'bg-white/5 text-white'
                  }`}
                >
                  {m.text}
                  {m.link && (
                    <Link
                      href={m.link.href}
                      className="mt-2 block font-medium text-[#c5a26f] underline underline-offset-2"
                    >
                      {m.link.label} →
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {loading && <div className="text-xs tracking-widest text-[#666]">typing…</div>}
            <div ref={endRef} />
          </div>

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 px-4 pb-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#a1a1aa] hover:border-[#c5a26f] hover:text-white"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="flex gap-2 border-t border-white/10 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="flex-1 rounded-full bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#666]"
            />
            <button
              type="submit"
              disabled={loading}
              aria-label="Send"
              className="btn-gold flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
