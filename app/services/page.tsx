import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import Link from 'next/link'

const services = [
  { title: "MCO Airport Transfers", desc: "Flight tracking, meet & greet, and seamless transfers from Orlando International Airport.", price: "from $95 + mileage" },
  { title: "Private Aviation", desc: "Discreet service at Orlando Executive Airport and other private terminals.", price: "from $115 + mileage" },
  { title: "Weddings & Celebrations", desc: "Premium SUVs and Sprinters with champagne service for your special day.", price: "from $185 + mileage" },
  { title: "Corporate & Executive", desc: "Full-day charters, client entertainment, and reliable multi-stop schedules.", price: "from $145 + mileage" },
  { title: "Prom & Special Events", desc: "Safe, glamorous transportation for the most memorable nights.", price: "from $145 + mileage" },
  { title: "Nights Out", desc: "Downtown Orlando, concerts, and nightlife. Return when you're ready.", price: "from $125 + mileage" },
]

export default function ServicesPage() {
  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen">
      <Navbar />
      <div className="pt-20 max-w-5xl mx-auto px-6 pb-20">
        <h1 className="text-7xl tracking-[-3px] font-semibold pt-10">Services &amp; Occasions</h1>
        <p className="text-2xl text-[#a1a1aa] mt-3">Whatever the reason for your journey, we will make it exceptional.</p>

        <div className="mt-14 grid gap-4">
          {services.map((s, i) => (
            <div key={i} className="card p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="text-3xl tracking-[-1.2px] font-semibold">{s.title}</div>
                <p className="text-[#a1a1aa] mt-2 max-w-xl">{s.desc}</p>
              </div>
              <div className="text-right">
                <div className="text-[#c5a26f] text-sm tracking-widest mb-1">STARTING AT</div>
                <div className="text-3xl tabular-nums">{s.price}</div>
                <Link href="/book" className="mt-4 inline-block text-sm tracking-widest underline underline-offset-4 hover:text-[#c5a26f]">BOOK THIS SERVICE →</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  )
}
