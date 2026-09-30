import { useEffect, useState } from 'react'

// Unlisted drafting board for the post-Walmart section of Jon's LinkedIn.
// Not linked from the home page; marked noindex.
// Anything in [[double brackets]] is a gap Jon still needs to fill.

const ENTRIES = [
  {
    id: 'woolworths',
    status: 'ongoing',
    title: 'Non-Executive Director',
    company: 'Woolworths Group',
    dates: 'Mar 2026 – Present',
    location: 'Sydney, Australia',
    body: `Board member at Woolworths Group (ASX: WOW), one of Australia's largest retailers. I bring a product and technology lens to the board's work on digital, data and AI, including how agentic commerce will change the way people shop for groceries.`,
  },
  {
    id: 'advising',
    status: 'ongoing',
    title: 'Advisor',
    company: 'Alferness Advising',
    dates: 'Jan 2025 – Present',
    location: 'San Francisco Bay Area',
    body: `Advising founders, CEOs and boards on product strategy, AI and growth.

Clients and advisees: [[Company A]], [[Company B]], [[Company C]]

On the side I run a small lab at jalfern.com, testing how far open models running on one desk can go. So far: a GPU ray tracer, a shelf of retro arcade games and 3D pelicans on bicycles, each built mostly by a local Qwen model with light supervision. Write-ups at jalfern.com.`,
  },
  {
    id: 'beast',
    status: 'done',
    title: 'Strategic Advisor',
    company: 'Beast Industries (MrBeast)',
    dates: '[[2025]] – [[2026]]',
    location: 'Remote',
    body: `Advised MrBeast's company on building new businesses beyond content, including financial services and mobile (MVNO). The work covered strategy, acquisition evaluation and product plans for new verticals.`,
  },
  {
    id: 'basebase',
    status: 'done',
    title: 'Co-founder & CEO',
    company: 'BaseBase',
    dates: '[[2025]] – [[2026]]',
    location: 'San Francisco Bay Area',
    body: `Co-founded BaseBase with former colleagues to build a multiplayer, multi-agent platform that lives inside Slack. Its agents follow what is happening across a team and act on it, starting with revenue operations teams at mid-market companies. I stepped aside from the CEO role in 2026 and remain an investor and advisor.`,
  },
]

const NOTES = [
  {
    k: 'Why four entries, not one',
    v: `Each company gets its own entry so Woolworths, Beast Industries and BaseBase show their logos and link to their pages. The advising entry holds everything else. Current roles first, finished ones below, then Walmart.`,
  },
  {
    k: 'The physical-AI startup: my vote is leave it off for now',
    v: `You haven't said yes to being CEO, the investor meetings are the week of Oct 13, and you told Frank you want market signal first. A "founding" line now tells the PayPal, Chime and Postman folks you have one foot out the door, and it gets ahead of Frank's own announcement. Add it the day you commit. If you want a hint anyway, the safest version is one line inside the advising entry: "Also working with a team on an early-stage physical-AI company."`,
  },
  {
    k: 'Alferness Advising only works with names in it',
    v: `A named consultancy with no clients reads as "between jobs". With Beast pulled out into its own entry, the list needs two or three real names you're allowed to share, even small ones. If there aren't enough, drop "Alferness Advising" and just call the entry "Independent Advisor".`,
  },
  {
    k: 'Beast specifics',
    v: `"Financial services and mobile (MVNO)" is more specific than most advisors would write. Worth a quick check that none of it is still under NDA or unannounced.`,
  },
  {
    k: 'Before LinkedIn points here',
    v: `The home page still says "Jon's placeholder for fun stuff" and links out to LinkedIn. If LinkedIn starts sending people to jalfern.com, the landing page needs one sentence on who you are, plus the ray tracer and retro games write-ups next to the pelicans. That's the next task after this one.`,
  },
]

function Gap({ text }) {
  // Render [[gaps]] highlighted so they're easy to spot.
  const parts = text.split(/(\[\[[^\]]+\]\])/g)
  return parts.map((p, i) =>
    p.startsWith('[[') ? (
      <span key={i} className="bg-amber-300/20 text-amber-200 px-1 rounded-sm">
        {p.slice(2, -2)}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text.replace(/\[\[|\]\]/g, ''))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked; ignore */
    }
  }
  return (
    <button
      onClick={onCopy}
      className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity border border-white/20 px-2 py-1 rounded-sm"
    >
      {copied ? 'Copied' : 'Copy text'}
    </button>
  )
}

function Entry({ e }) {
  return (
    <article className="border-t border-white/15 pt-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base sm:text-lg tracking-wide">
            <Gap text={e.title} />
          </h3>
          <div className="text-sm opacity-70">
            <Gap text={e.company} />
          </div>
          <div className="text-xs opacity-40 mt-1">
            <Gap text={e.dates} /> · {e.location}
          </div>
        </div>
        <CopyButton text={e.body} />
      </div>
      <div className="text-sm leading-relaxed opacity-80 whitespace-pre-line max-w-2xl">
        <Gap text={e.body} />
      </div>
      <div className="text-[10px] tracking-widest opacity-30">
        {e.body.replace(/\[\[|\]\]/g, '').length} / 2,000 characters
      </div>
    </article>
  )
}

export default function LinkedInDraft() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = 'LinkedIn draft · jalfern'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      document.title = prevTitle
      meta.remove()
    }
  }, [])

  const ongoing = ENTRIES.filter(e => e.status === 'ongoing')
  const done = ENTRIES.filter(e => e.status === 'done')

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-black text-white font-mono">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 pb-32 space-y-16">
        <header className="space-y-5">
          <a href="/" className="text-xs tracking-widest opacity-40 hover:opacity-100 transition-opacity">
            ← JALFERN.COM
          </a>
          <div className="text-[11px] uppercase tracking-[0.25em] opacity-40">Drafting board · v1 · Sep 30 2026</div>
          <h1 className="text-3xl sm:text-4xl tracking-wide leading-tight">LinkedIn: since Walmart</h1>
          <p className="text-sm leading-relaxed opacity-70 max-w-2xl">
            Draft of the Experience entries after Walmart, in the order they'd appear on the profile.{' '}
            <span className="bg-amber-300/20 text-amber-200 px-1 rounded-sm">Highlighted</span> bits are gaps
            to fill before anything goes to LinkedIn.
          </p>
        </header>

        <section className="space-y-8">
          <div className="text-[11px] uppercase tracking-[0.25em] opacity-40">Current</div>
          {ongoing.map(e => <Entry key={e.id} e={e} />)}
        </section>

        <section className="space-y-8">
          <div className="text-[11px] uppercase tracking-[0.25em] opacity-40">Finished</div>
          {done.map(e => <Entry key={e.id} e={e} />)}
          <div className="border-t border-white/15 pt-5 text-sm opacity-40">
            Walmart · EVP & Chief Product Officer · unchanged
          </div>
        </section>

        <section className="space-y-6">
          <div className="text-[11px] uppercase tracking-[0.25em] opacity-40">Notes & open calls</div>
          {NOTES.map(n => (
            <div key={n.k} className="border-t border-white/15 pt-4 space-y-2">
              <h3 className="text-sm tracking-wide">{n.k}</h3>
              <p className="text-sm leading-relaxed opacity-70 max-w-2xl">{n.v}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
