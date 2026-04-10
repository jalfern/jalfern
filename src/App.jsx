import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono">
        <div className="text-center space-y-8">
          <h1 className="text-2xl tracking-widest opacity-60">JALFERN.COM</h1>

          <p className="text-sm tracking-wide opacity-40">
            Jon's placeholder for fun stuff.
          </p>

          <nav className="flex flex-col gap-4 text-sm">
            <a
              href="https://www.linkedin.com/in/jon-alferness-b193a3/"
              className="opacity-30 hover:opacity-100 transition-opacity duration-300 tracking-wide"
            >
              Jon's background
            </a>
            <Link
              to="/retrogames"
              className="opacity-60 hover:opacity-100 transition-opacity duration-300 tracking-wide"
            >
              RetroGames exploration →
            </Link>
            <Link
              to="/retrogames/games"
              className="opacity-40 hover:opacity-100 transition-opacity duration-300 tracking-wide text-xs"
            >
              Games list →
            </Link>
          </nav>
        </div>

        <Routes>
          <Route path="/retrogames" element={<RetroGames />} />
          <Route path="/retrogames/games" element={<GamesList />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App