const QWEN_STEPS = [
  { src: '/pelicans/qwen-v01.jpg', label: 'v01', note: 'first blockout: cropped framing, doubled neck, leg too thick' },
  { src: '/pelicans/qwen-v03.jpg', label: 'v03', note: 'full body framed, sky band fixed, clouds no longer discs' },
  { src: '/pelicans/qwen-v05.jpg', label: 'v05', note: 'head turned, legs jointed, folded wing starts to read' },
  { src: '/pelicans/qwen-v08.jpg', label: 'v08', note: 'splayed tail feathers, lined mouth, wing on the grip' },
  { src: '/pelicans/qwen-v10.jpg', label: 'v10', note: 'tessellation + full smooth: faceting gone at full res' },
]

function A({ href, children }) {
  return (
    <a href={href} className="underline decoration-white/30 underline-offset-4 hover:decoration-white">
      {children}
    </a>
  )
}

function Stat({ k, v }) {
  return (
    <div className="border-t border-white/15 pt-2">
      <div className="text-[10px] uppercase tracking-widest opacity-40">{k}</div>
      <div className="text-sm mt-1">{v}</div>
    </div>
  )
}

function Section({ kicker, title, children }) {
  return (
    <section className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] opacity-40">{kicker}</div>
        <h2 className="text-xl sm:text-2xl mt-2 tracking-wide">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export default function Pelicans() {
  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-black text-white font-mono">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 pb-32 space-y-20">
        <header className="space-y-6">
          <a href="/" className="text-xs tracking-widest opacity-40 hover:opacity-100 transition-opacity">
            ← JALFERN.COM
          </a>
          <h1 className="text-3xl sm:text-4xl tracking-wide leading-tight">
            Pelicans riding bicycles, in 3D
          </h1>
          <div className="space-y-4 text-sm leading-relaxed opacity-80 max-w-2xl">
            <p>
              Simon Willison's <A href="https://github.com/simonw/pelican-bicycle">benchmark</A> asks
              a model to <em>"Generate an SVG of a pelican riding a bicycle."</em> I wanted to see what
              happens when you hand the model Blender instead of SVG, and let it look at its own renders.
            </p>
            <p>
              Two experiments below: a still built start to finish by a quantized Qwen model running on my
              desk with no human in the loop, and a 15-second animated sequel built by Claude. Everything
              in both is generated from Python. No downloaded models, textures or image assets.
            </p>
          </div>
        </header>

        <Section kicker="01 · The original" title="Qwen, running locally, one line of prompt">
          <figure className="space-y-3">
            <img
              src="/pelicans/qwen-final.jpg"
              alt="A white cartoon pelican with a pink throat pouch riding a teal bicycle under a pale sky"
              className="w-full rounded-sm"
            />
            <figcaption className="text-xs opacity-50">
              Final render: 1600×1200, Cycles, 96 samples + denoise. Every object comes from one bpy script.
            </figcaption>
          </figure>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat k="Model" v="Qwen3.8 Flash-Next, 5-bit" />
            <Stat k="Hardware" v="Mac Studio M3 Ultra" />
            <Stat k="Human feedback" v="None" />
            <Stat k="Iterations" v="13 previews + final" />
          </div>

          <div className="space-y-4 text-sm leading-relaxed opacity-80 max-w-2xl">
            <p>
              The model runs in oMLX on a Mac Studio in my office, driven by
              the <A href="https://github.com/badlogic/pi">pi</A> coding agent. The prompt was one line,
              roughly "make a 3D pelican on a bike", plus a thin Blender skill: where the Blender binary lives,
              how to run a script headless, save the .blend before rendering.
            </p>
            <p>
              From there it ran its own loop: write the scene script, render a cheap one-second preview, look
              at the image with its own vision, fix whatever looked most wrong, repeat. There was no target
              image and nobody telling it what was off. It decided when it was done: 13 iterations in about
              half an hour, then a final full-resolution render.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {QWEN_STEPS.map(s => (
              <figure key={s.label} className="space-y-2">
                <img src={s.src} alt={`Iteration ${s.label}`} className="w-full rounded-sm" />
                <figcaption className="text-[11px] leading-snug opacity-60">
                  <span className="opacity-100 text-white">{s.label}</span> · {s.note}
                </figcaption>
              </figure>
            ))}
            <figure className="space-y-2">
              <img src="/pelicans/qwen-final.jpg" alt="Final render" className="w-full rounded-sm" />
              <figcaption className="text-[11px] leading-snug opacity-60">
                <span className="opacity-100 text-white">final</span> · Cycles on the Metal GPU
              </figcaption>
            </figure>
          </div>
          <p className="text-xs opacity-50 max-w-2xl">
            The captions are the model's own, from the contact sheet it generated for its README.
          </p>

          <div className="space-y-4 text-sm leading-relaxed opacity-80 max-w-2xl">
            <p>
              What it caught on its own: a neck arc that read as a handle, a flattened cloud that read as a
              UFO, legs that looked like wooden pegs, a wing that floated under the belly like a fin, and
              polygon faceting that only showed at full resolution. What it never caught: there's no saddle,
              so the bird hovers over the top tube. It only ever judged itself from the one three-quarter
              camera angle that hides that.
            </p>
            <p>
              The polish gap to a hosted frontier model is real, mostly lighting and materials. On the part
              that takes understanding the subject (that pouch is unmistakably a pelican's), a 5-bit model
              on a desk holds up.
            </p>
            <p>
              Code, previews and the editable .blend:{' '}
              <A href="https://github.com/jalfern/pelican-on-a-bicycle">jalfern/pelican-on-a-bicycle</A>
            </p>
          </div>
        </Section>

        <Section kicker="02 · The sequel" title="A skeleton with a flaming torch gives chase">
          <figure className="space-y-3">
            <video
              src="/pelicans/chase.mp4"
              poster="/pelicans/chase-poster.jpg"
              controls
              playsInline
              loop
              preload="metadata"
              className="w-full rounded-sm bg-neutral-900 aspect-video"
            />
            <figcaption className="text-xs opacity-50">
              15 seconds, 1920×1080, 24 fps. Sound on. Rendered in Blender on the same Mac Studio.
            </figcaption>
          </figure>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat k="Model" v="Claude (Anthropic)" />
            <Stat k="Scene code" v="~1,500 lines of bpy" />
            <Stat k="Frames" v="360, EEVEE" />
            <Stat k="Audio" v="Synthesized, no samples" />
          </div>

          <div className="space-y-4 text-sm leading-relaxed opacity-80 max-w-2xl">
            <p>
              The prompt, verbatim: <em>"produce a 15 second animation rendered in blender of a skeleton with a
              flaming torch running after a pelican riding a bicycle. they should be in a scary woods
              environment."</em>
            </p>
            <p>
              Claude drove the Blender install on my Mac and wrote a single script that builds everything:
              a skeleton animated in code, its own pelican and bike, a dead forest, ground fog, the torch
              flame and embers, and a sequence of camera shots. Like Qwen, it checked its work visually:
              side and front turnarounds to catch feet missing the pedals, lighting experiments, and contact
              sheets of each preview pass before committing to the final render.
            </p>
            <p>
              The soundtrack is generated too. The scene script exports an event list (every footfall, every
              look back over the shoulder, every camera cut) and a second script synthesizes the audio from it
              in numpy: wind, a tension drone, a torch roar that swells as the flame nears the camera, bony
              footfalls that land on the frames where the skeleton's feet hit the dirt, tyre noise and freewheel
              ticks, pelican honks, and a jaw-chattering laugh at the end. No recorded samples.
            </p>
            <p>
              It wasn't frictionless. Midway through, the session lost its context and had to pick the work
              back up from the script and logs it had left on disk.
            </p>
          </div>

          <figure className="space-y-2">
            <img
              src="/pelicans/chase-checks.jpg"
              alt="Grey untextured check renders of the pelican on the bike from the side and front"
              className="w-full rounded-sm"
             
            />
            <figcaption className="text-xs opacity-50">Turnaround checks for pedal and grip contact.</figcaption>
          </figure>
          <figure className="space-y-2">
            <img
              src="/pelicans/chase-sheet.jpg"
              alt="Twelve frames from the final animation"
              className="w-full rounded-sm"
             
            />
            <figcaption className="text-xs opacity-50">Contact sheet of the final render.</figcaption>
          </figure>
        </Section>

        <footer className="text-xs opacity-40 leading-relaxed max-w-2xl space-y-2 border-t border-white/10 pt-6">
          <p>
            Thanks to Simon Willison for the <A href="https://simonwillison.net/tags/pelican-riding-a-bicycle/">pelican</A>.
          </p>
          <p>Jon Alferness · 2026</p>
        </footer>
      </div>
    </div>
  )
}
