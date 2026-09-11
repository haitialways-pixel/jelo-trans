/**
 * Tax ID handling for 1099 contractors.
 * Never log the raw value. Never put it in audit_log. List APIs return last4 only to admin.
 */

export type TaxIdType = 'ssn' | 'ein'

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '')
}

function bytesToB64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export function taxIdLast4(raw: string): string {
  const d = digitsOnly(raw)
  return d.length >= 4 ? d.slice(-4) : d
}

export function maskTaxId(last4: string | null | undefined, type?: TaxIdType | null): string {
  const tail = (last4 ?? '').replace(/\D/g, '').slice(-4)
  if (!tail) return '—'
  if (type === 'ein') return `**-***${tail}`
  return `***-**-${tail}`
}

function getKeySecret(): string | null {
  const v = process.env.TAX_ID_ENCRYPTION_KEY?.trim()
  return v ? v : null
}

async function aesKey(): Promise<CryptoKey | null> {
  const secret = getKeySecret()
  if (!secret) return null
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

/** Encrypt a tax ID. Stores last4 always; ciphertext only when TAX_ID_ENCRYPTION_KEY is set. */
export async function sealTaxId(raw: string): Promise<{ last4: string; encrypted: string | null }> {
  const last4 = taxIdLast4(raw)
  const key = await aesKey()
  if (!key || !raw.trim()) return { last4, encrypted: null }
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(digitsOnly(raw.trim())),
  )
  const packed = new Uint8Array(iv.length + cipher.byteLength)
  packed.set(iv, 0)
  packed.set(new Uint8Array(cipher), iv.length)
  return { last4, encrypted: bytesToB64(packed) }
}

/** Admin 1099 print only. Returns null if no key or ciphertext. */
export async function unsealTaxId(encrypted: string | null | undefined): Promise<string | null> {
  if (!encrypted) return null
  const key = await aesKey()
  if (!key) return null
  try {
    const packed = b64ToBytes(encrypted)
    const iv = packed.subarray(0, 12)
    const data = packed.subarray(12)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

export function formatFullTaxIdForPdf(digits: string, type?: TaxIdType | null): string {
  const d = digitsOnly(digits)
  if (type === 'ein' && d.length === 9) return `${d.slice(0, 2)}-${d.slice(2)}`
  if (d.length === 9) return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
  return d
}
