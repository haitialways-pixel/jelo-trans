import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'

export default function AboutPage() {
  return (
    <div className="bg-[#0a0a0a] text-white">
      <Navbar />
      <div className="pt-20">
        <div className="max-w-4xl mx-auto px-6 pt-12 pb-20">
          <div className="text-[#c5a26f] text-xs tracking-[4px]">ESTABLISHED 2017</div>
          <h1 className="text-7xl tracking-[-3.2px] font-semibold mt-2">The Phalo Transportation Standard</h1>
          <p className="text-2xl text-[#a1a1aa] mt-6 max-w-3xl">We exist for one reason: to deliver the most refined, reliable, and discreet ground transportation experience in Central Florida.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-px bg-white/10">
          <div className="relative">
            <img src="/images/IMG_20250715_143940795.jpg" alt="Phalo Transportation Chauffeur" className="w-full h-full object-cover" />
          </div>
          <div className="relative">
            <img src="/images/IMG_20250715_144007014_HDR.jpg" alt="Phalo Transportation Chauffeurs" className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-20 text-lg text-[#d1d5db] leading-relaxed space-y-8">
          <p>Phalo Transportation was founded with a simple belief: that every client deserves to feel like the most important person in the world the moment they step into one of our vehicles.</p>
          <p>Our chauffeurs are not just drivers — they are ambassadors. Background-checked, professionally trained, and genuinely passionate about white-glove service.</p>
          <p>We operate a meticulously maintained fleet with an obsessive attention to detail that our clients notice immediately.</p>
        </div>
      </div>
      <Footer />
    </div>
  )
}
