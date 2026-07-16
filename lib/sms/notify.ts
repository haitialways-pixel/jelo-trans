// Best-effort SMS notifications. Twilio is optional — if not configured, logs and returns false.
// Never throws; callers must treat SMS as auxiliary to email.

export type SmsResult = { sent: boolean; reason?: string }

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  )
}

export async function sendSms(input: { to: string; body: string }): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!sid || !token || !from) {
    console.info('[sms] Twilio not configured — skipping SMS', { to: input.to })
    return { sent: false, reason: 'Twilio not configured' }
  }

  const to = normalizePhone(input.to)
  if (!to) return { sent: false, reason: 'invalid phone number' }

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64')
    const params = new URLSearchParams({ To: to, From: from, Body: input.body })
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
    if (!res.ok) {
      const text = await res.text()
      console.warn('[sms] Twilio send failed:', text)
      return { sent: false, reason: 'Twilio API error' }
    }
    console.info('[sms] SMS sent', { to })
    return { sent: true }
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'send failed'
    console.warn('[sms] send error:', reason)
    return { sent: false, reason }
  }
}

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/[^0-9+]/g, '')
  if (!digits) return null
  return digits.startsWith('+') ? digits : `+1${digits}`
}