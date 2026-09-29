'use client'

import { useActionState } from 'react'
import { submitContact, type ContactState } from './actions'
import { BRAND_PHONE_DISPLAY, BRAND_PHONE_TEL } from '@/lib/site'

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContact, null as ContactState | null)

  if (state?.ok) {
    return (
      <div className="float-card p-10 md:p-12">
        <p className="font-display text-2xl text-on-surface">Message sent.</p>
        <p className="text-on-surface-variant mt-4 leading-relaxed">
          Thank you — our concierge will reply shortly. For anything urgent, call or text{' '}
          <a href={BRAND_PHONE_TEL} className="text-gold hover:underline">
            {BRAND_PHONE_DISPLAY}
          </a>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="float-card p-10 md:p-12">
      <form action={action} className="space-y-6 max-w-lg">
        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          <label htmlFor="company_url">Company website</label>
          <input id="company_url" name="company_url" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <input name="name" type="text" required placeholder="Your name" className="w-full px-5 py-4 text-base" />
        <input
          name="email"
          type="email"
          required
          placeholder="Email address"
          className="w-full px-5 py-4 text-base"
        />
        <input name="phone" type="tel" required placeholder="Phone number" className="w-full px-5 py-4 text-base" />
        <textarea
          name="message"
          required
          minLength={10}
          placeholder="How can we assist you?"
          rows={5}
          className="w-full px-5 py-4 text-base resize-y"
        />
        {state?.error && (
          <p className="text-red-200 text-sm bg-red-950/50 border border-red-800/60 rounded-xl px-4 py-3">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className="btn-cta w-full py-4 rounded-full text-sm tracking-widest">
          {pending ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </div>
  )
}
