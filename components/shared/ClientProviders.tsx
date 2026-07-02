'use client'

import dynamic from 'next/dynamic'

const ChatWidgetGate = dynamic(
  () => import('@/components/chatbot/ChatWidgetGate').then((m) => ({ default: m.ChatWidgetGate })),
  { ssr: false },
)

const Toaster = dynamic(
  () => import('sonner').then((m) => ({ default: m.Toaster })),
  { ssr: false },
)

export function ClientProviders() {
  return (
    <>
      <ChatWidgetGate />
      <Toaster position="top-center" richColors />
    </>
  )
}