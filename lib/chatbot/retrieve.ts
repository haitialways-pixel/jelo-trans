import { KNOWLEDGE, type KnowledgeEntry } from './knowledge'

// LLM-free retrieval. v2 engine = TF-IDF cosine over unigrams + bigrams + stemming + fuzzy matching
// Pure JS, zero download, runs instantly in the browser. The neural-embedding upgrade
// later drops into THIS SAME `retrieve()` interface — nothing else has to change.

const STOP = new Set([
  'the', 'a', 'an', 'to', 'for', 'of', 'do', 'does', 'i', 'you', 'my', 'is', 'are', 'it',
  'on', 'in', 'and', 'or', 'can', 'what', 'how', 'your', 'me', 'we', 'at', 'this', 'that',
  'with', 'from', 'have', 'need', 'want', 'be', 'will', 'would', 'should', 'about',
  // French stop words
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
  'est', 'sont', 'pour', 'sur', 'dans', 'et', 'ou', 'qui', 'que', 'quoi'
])

// Synonyms map including common English variations and French equivalents
const SYNONYMS: Record<string, string> = {
  'car': 'vehicle',
  'cars': 'vehicle',
  'suv': 'vehicle',
  'suvs': 'vehicle',
  'limo': 'vehicle',
  'van': 'vehicle',
  'auto': 'vehicle',
  'voiture': 'vehicle',
  'voitures': 'vehicle',
  'cost': 'price',
  'rate': 'price',
  'rates': 'price',
  'fee': 'price',
  'fees': 'price',
  'charge': 'price',
  'money': 'price',
  'pay': 'price',
  'prix': 'price',
  'tarif': 'price',
  'combien': 'price',
  'reserve': 'book',
  'reservation': 'book',
  'schedule': 'book',
  'reserver': 'book',
  'réservation': 'book',
  'cancel': 'manage',
  'change': 'manage',
  'modify': 'manage',
  'annuler': 'manage',
  'modifier': 'manage',
  'talk': 'contact',
  'speak': 'contact',
  'call': 'contact',
  'human': 'person',
  'agent': 'person',
  'representative': 'person',
  'parler': 'contact',
  'humain': 'person'
}

function stem(w: string): string {
  let s = w
  if (s.endsWith('ies') && s.length > 4) s = s.slice(0, -3) + 'y'
  else if (s.endsWith('es') && s.length > 3 && !s.endsWith('les')) s = s.slice(0, -2)
  else if (s.endsWith('s') && s.length > 3 && !s.endsWith('ss')) s = s.slice(0, -1)
  
  if (s.endsWith('ing') && s.length > 4) s = s.slice(0, -3)
  else if (s.endsWith('ed') && s.length > 4) s = s.slice(0, -2)
  return s
}

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[a.length][b.length]
}

// 1. Build the vocabulary of known unigrams to help with typo correction
const KNOWN_WORDS = new Set<string>()
for (const entry of KNOWLEDGE) {
  const words = entry.triggers.flatMap(t => t.toLowerCase().match(/[a-z0-9àâäéèêëîïôöùûüç]+/g) ?? [])
  for (const w of words) {
    if (!STOP.has(w)) {
      const resolved = SYNONYMS[w] || w
      KNOWN_WORDS.add(stem(resolved))
    }
  }
}

function fuzzyCorrect(w: string): string {
  if (KNOWN_WORDS.has(w)) return w
  let best = w
  let minD = 999
  const threshold = w.length > 5 ? 2 : 1
  for (const kw of KNOWN_WORDS) {
    if (Math.abs(kw.length - w.length) > threshold) continue
    const d = levenshtein(w, kw)
    if (d < minD && d <= threshold) {
      minD = d
      best = kw
    }
  }
  return best
}

function tokenize(s: string, correctTypos = false): string[] {
  const rawWords = (s.toLowerCase().match(/[a-z0-9àâäéèêëîïôöùûüç]+/g) ?? []).filter((t) => t.length > 1 && !STOP.has(t))
  
  // Apply synonyms and stem
  const stems = rawWords.map(w => {
    const resolved = SYNONYMS[w] || w
    let st = stem(resolved)
    // Only fuzzy correct longer words from user input to avoid false positives on short words
    if (correctTypos && st.length > 3) {
      st = fuzzyCorrect(st)
    }
    return st
  })

  // Add bigrams to capture context (e.g. "how much", "book ride")
  const tokens = [...stems]
  for (let i = 0; i < stems.length - 1; i++) {
    tokens.push(`${stems[i]}_${stems[i+1]}`)
  }
  return tokens
}

type Doc = { entry: KnowledgeEntry; tf: Map<string, number>; norm: number }

const docs: Doc[] = []
const df = new Map<string, number>()

for (const entry of KNOWLEDGE) {
  const tokens = entry.triggers.flatMap(t => tokenize(t, false))
  const tf = new Map<string, number>()
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
  for (const t of new Set(tokens)) df.set(t, (df.get(t) ?? 0) + 1)
  docs.push({ entry, tf, norm: 0 })
}

const N = docs.length
const idf = (t: string) => Math.log((N + 1) / ((df.get(t) ?? 0) + 1)) + 1

for (const d of docs) {
  let sum = 0
  for (const [t, f] of d.tf) {
    const w = f * idf(t)
    sum += w * w
  }
  d.norm = Math.sqrt(sum) || 1
}

export type RetrieveResult = { entry: KnowledgeEntry; score: number }

/** Best-matching knowledge entry for a user message, with a 0..1-ish confidence score. */
export function retrieve(query: string): RetrieveResult {
  const tokens = tokenize(query, true)
  const qtf = new Map<string, number>()
  for (const t of tokens) qtf.set(t, (qtf.get(t) ?? 0) + 1)

  let qnorm = 0
  for (const [t, f] of qtf) {
    const w = f * idf(t)
    qnorm += w * w
  }
  qnorm = Math.sqrt(qnorm) || 1

  let best: RetrieveResult = { entry: docs[0].entry, score: 0 }
  for (const d of docs) {
    let dot = 0
    for (const [t, f] of qtf) {
      const dfreq = d.tf.get(t)
      if (dfreq) dot += f * idf(t) * (dfreq * idf(t))
    }
    const score = dot / (qnorm * d.norm)
    if (score > best.score) best = { entry: d.entry, score }
  }
  return best
}

// Below this confidence we DON'T guess — we hand off to a human (escalate).
export const CONFIDENCE_THRESHOLD = 0.1
