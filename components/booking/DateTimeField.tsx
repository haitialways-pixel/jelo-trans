'use client'

// A clean date + time picker that blocks past dates and produces the combined
// "YYYY-MM-DDTHH:mm" string the booking expects (same shape as datetime-local).

type Props = { value: string; onChange: (v: string) => void }

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 15-minute time slots, displayed in 12h AM/PM.
const TIMES = (() => {
  const arr: { v: string; l: string }[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      const v = `${pad(h)}:${pad(m)}`
      const ampm = h < 12 ? 'AM' : 'PM'
      const h12 = h % 12 === 0 ? 12 : h % 12
      arr.push({ v, l: `${h12}:${pad(m)} ${ampm}` })
    }
  }
  return arr
})()

export function DateTimeField({ value, onChange }: Props) {
  const [date, time] = value ? value.split('T') : ['', '']

  function setDate(d: string) {
    onChange(d ? `${d}T${time || '10:00'}` : '')
  }
  function setTime(t: string) {
    onChange(`${date || todayStr()}T${t}`)
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
              <label className="text-xs text-primary ml-1 font-medium">Pickup date</label>
        <input
          type="date"
          min={todayStr()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full p-4 rounded-2xl mt-1"
        />
      </div>
      <div>
              <label className="text-xs text-primary ml-1 font-medium">Pickup time</label>
        <select
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full p-4 rounded-2xl mt-1"
        >
          <option value="">Select time</option>
          {TIMES.map((t) => (
            <option key={t.v} value={t.v}>
              {t.l}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
