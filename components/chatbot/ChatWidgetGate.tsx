'use client'

import { usePathname } from 'next/navigation'
import { ChatWidget } from './ChatWidget'

/** The customer concierge chatbot is hidden on the staff/manager area. */
export function ChatWidgetGate() {
  const pathname = usePathname()
  if (pathname?.startsWith('/manager')) return null
  return <ChatWidget />
}
