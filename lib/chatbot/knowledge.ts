// Knowledge base for the LLM-free vector chatbot.
//
// Each entry is matched to the user's message by semantic similarity on its `triggers`.
// The winning entry either returns a fixed `answer` (FAQ) or runs a SAFE, read-only
// `action` at runtime. There is deliberately NO action that creates reservations or
// issues refunds — those intents route to `escalate` (human phone + management notice).

export const HUMAN_PHONE = '(678) 478-3506'
export const HUMAN_EMAIL = 'concierge@phalotransportation.com'

/** The only things the assistant is allowed to DO — all read-only / low-risk. */
export type ChatAction =
  | 'list_fleet' // describe vehicles + live prices (from DB)
  | 'estimate_price' // vehicle + hours -> price (from DB)
  | 'check_availability' // vehicle + date -> free? (RPC)
  | 'lookup_booking' // booking number + phone -> status (RPC)
  | 'escalate' // hand off to a human + notify management (NEVER writes a booking/refund)

/** Short-term conversation memory: slots the assistant remembers across turns. */
export type ChatContext = {
  vehicleId?: string
  vehicleName?: string
  hours?: number
}

export type KnowledgeEntry = {
  id: string
  category: 'booking' | 'fleet' | 'pricing' | 'service' | 'policy' | 'contact' | 'action'
  /** Example phrasings — these get embedded and matched against the user's message. */
  triggers: string[]
  /** Static FAQ answer. Ignored if `action` is set. */
  answer?: string
  /** Dynamic handler. Takes precedence over `answer`. */
  action?: ChatAction
}

export const KNOWLEDGE: KnowledgeEntry[] = [
  // ---------------------------------------------------------------- Booking
  {
    id: 'how_to_book',
    category: 'booking',
    triggers: [
      'book',
      'reservation',
      'how do I book',
      'how to make a reservation',
      'I want to reserve a car',
      'book a ride',
      'make a booking',
      'reserve a vehicle',
    ],
    answer:
      'Booking takes about a minute on our Reserve page: choose your trip details, pick a vehicle, and confirm. You’ll receive a booking number by email right away. Ready? Head to the Reserve page (/book).',
  },
  {
    id: 'what_info_needed',
    category: 'booking',
    triggers: [
      'what do I need to book',
      'what information is required to reserve',
      'do you need my flight number',
      'what details for booking',
    ],
    answer:
      'Just your pickup and drop-off, date and time, the vehicle, and your name, email and phone. For airport pickups, your flight info helps us track arrivals.',
  },
  {
    id: 'manage_or_cancel',
    category: 'policy',
    triggers: [
      'cancel',
      'manage',
      'modify',
      'how do I cancel my booking',
      'change my reservation',
      'where do I manage my booking',
      'view my reservation',
      'cancel a ride',
    ],
    answer:
      'You can view or cancel your reservation on the Manage Booking page (/manage-booking) using your booking number and phone number. Need a change we can’t do online? I can connect you with our team.',
  },

  // ---------------------------------------------------------------- Fleet & pricing (live from DB)
  {
    id: 'fleet_overview',
    category: 'fleet',
    triggers: [
      'fleet',
      'cars',
      'vehicles',
      'what vehicles do you have',
      'show me your fleet',
      'what cars are available',
      'do you have a limo',
      'do you have an SUV or sprinter',
      'list your vehicles',
    ],
    action: 'list_fleet',
  },
  {
    id: 'price_estimate',
    category: 'pricing',
    triggers: [
      'price',
      'cost',
      'quote',
      'how much does it cost',
      'what are your rates',
      'price for the escalade',
      'how much for 3 hours',
      'estimate the price',
      'what’s the hourly rate',
    ],
    action: 'estimate_price',
  },
  {
    id: 'pricing_general',
    category: 'pricing',
    triggers: [
      'pricing',
      'how does pricing work',
      'is gratuity included',
      'are there hidden fees',
      'how is the fare calculated',
    ],
    answer:
      'Pricing is per trip: a base rate by vehicle (sedans from $95, SUVs from $125, Sprinter from $185) plus mileage from $3 to $4.50 per mile. Gratuity for your chauffeur is arranged at payment — it is not added automatically. No surge, no surprises. Want an estimate for a specific vehicle and distance?',
  },

  // ---------------------------------------------------------------- Availability & lookup (RPC)
  {
    id: 'check_availability',
    category: 'action',
    triggers: [
      'availability',
      'available',
      'is the escalade available on',
      'do you have anything free on saturday',
      'check availability for',
      'is a vehicle available that date',
    ],
    action: 'check_availability',
  },
  {
    id: 'lookup_booking',
    category: 'action',
    triggers: [
      'status',
      'lookup',
      'check my reservation status',
      'look up my booking',
      'find my booking',
      'what’s the status of my reservation',
      'my booking number is',
    ],
    action: 'lookup_booking',
  },

  // ---------------------------------------------------------------- Services / occasions
  {
    id: 'airport_transfers',
    category: 'service',
    triggers: [
      'airport',
      'flight',
      'mco',
      'do you do airport pickups',
      'MCO airport transfer',
      'pickup from Orlando airport',
      'ride to the airport',
      'meet and greet at the airport',
    ],
    answer:
      'Yes — Orlando International (MCO) and Executive Airport transfers are one of our specialties, including meet & greet and flight tracking. Tell me your date and group size and I’ll suggest the right vehicle.',
  },
  {
    id: 'weddings_events',
    category: 'service',
    triggers: [
      'wedding',
      'prom',
      'event',
      'do you do weddings',
      'transportation for my wedding',
      'limo for prom',
      'party bus for an event',
      'celebration transportation',
    ],
    answer:
      'Absolutely — weddings, proms, and celebrations are a signature service (our Executive Stretch is a favorite). For tailored event quotes I can connect you with our concierge team.',
  },
  {
    id: 'corporate',
    category: 'service',
    triggers: [
      'corporate',
      'business',
      'executive',
      'corporate travel',
      'executive car service',
      'hourly charter for meetings',
      'business client transportation',
    ],
    answer:
      'We offer hourly executive charters for corporate travel and client entertainment, with professional chauffeurs and discreet service. Want an hourly estimate?',
  },
  {
    id: 'areas_served',
    category: 'service',
    triggers: [
      'area',
      'city',
      'location',
      'what areas do you serve',
      'do you go to Disney',
      'do you cover Port Canaveral',
      'service area',
      'do you drive to the cruise port',
    ],
    answer:
      'We cover the greater Orlando area — MCO & Executive airports, Walt Disney World, Universal, the convention center, and Port Canaveral cruise terminals. Going somewhere specific? Just ask.',
  },

  // ---------------------------------------------------------------- Contact / hours
  {
    id: 'contact_hours',
    category: 'contact',
    triggers: [
      'contact',
      'phone',
      'call',
      'human',
      'agent',
      'how do I contact you',
      'what is your phone number',
      'are you open 24 7',
      'talk to a person',
      'talk to a human',
      'speak to a human',
      'speak to someone',
      'live agent',
      'real person',
      'customer service',
    ],
    answer: `Our concierge is available 24/7 at ${HUMAN_PHONE} (call or text), or ${HUMAN_EMAIL}. I can also pass your request to the team directly — just say the word.`,
  },
  {
    id: 'payment',
    category: 'policy',
    triggers: [
      'how do I pay',
      'do you take credit cards',
      'when do I pay',
      'payment options',
      'is payment online',
    ],
    answer:
      'Payment is arranged with our team — we’ll confirm the details after your reservation. If you’d like, I can have someone reach out to finalize payment.',
  },

  // ---------------------------------------------------------------- Escalation (sensitive / out of scope)
  // These intents must NEVER be auto-executed. They hand off to a human and notify management.
  {
    id: 'escalate_book_for_me',
    category: 'action',
    triggers: [
      'book it for me',
      'make the reservation for me',
      'just reserve it for me now',
      'can you book this',
      'complete the booking for me',
    ],
    action: 'escalate',
  },
  {
    id: 'escalate_refund_or_dispute',
    category: 'action',
    triggers: [
      'I want a refund',
      'refund my payment',
      'I want my money back',
      'dispute a charge',
      'I have a complaint',
      'cancel and refund me',
    ],
    action: 'escalate',
  },
  {
    id: 'escalate_custom_quote',
    category: 'action',
    triggers: [
      'I need a custom quote',
      'large group of 30 people',
      'multi day booking',
      'special arrangement',
      'corporate account setup',
      'wedding package details',
    ],
    action: 'escalate',
  },
]
