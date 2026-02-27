function App() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono">
      <div className="text-center space-y-8">
        <h1 className="text-2xl tracking-widest opacity-60">JALFERN.COM</h1>

        <p className="text-sm tracking-wide opacity-40">
          Jon's placeholder for fun stuff.
        </p>

        <nav className="flex flex-col gap-4 text-sm">
          <a
            href="#"
            className="opacity-30 cursor-default tracking-wide"
            onClick={(e) => e.preventDefault()}
          >
            Jon's background
          </a>
          <a
            href="/retrogames"
            className="opacity-60 hover:opacity-100 transition-opacity duration-300 tracking-wide"
          >
            RetroGames exploration →
          </a>
          <a
            href="/retrogames/games"
            className="opacity-40 hover:opacity-100 transition-opacity duration-300 tracking-wide text-xs"
          >
            Games list →
          </a>
        </nav>
      </div>
    </div>
  )
}

export default App
