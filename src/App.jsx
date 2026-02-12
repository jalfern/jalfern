import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PongGame from './components/PongGame'
import SpaceInvadersGame from './components/SpaceInvadersGame'
import PacmanGame from './components/PacmanGame'
import { audioController } from './utils/AudioController'

function App() {
  const [muted, setMuted] = useState(true)

  const toggleMute = () => {
    const newMuted = !muted
    setMuted(newMuted)
    audioController.init()
    audioController.setMuted(newMuted)
  }

  return (
    <BrowserRouter>
      <div className="w-full h-screen bg-white overflow-hidden relative">
        <Routes>
          <Route path="/" element={<PongGame />} />
          <Route path="/invaders" element={<SpaceInvadersGame />} />
          <Route path="/pacman" element={<PacmanGame />} />
        </Routes>

        {/* Mute Toggle */}
        <button
          onClick={toggleMute}
          className="fixed bottom-8 right-8 text-black opacity-20 hover:opacity-100 transition-opacity duration-300 z-50 p-2"
        >
          {muted ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.75-4.75a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.75-4.75H4.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 1 .75-.75h2.25Z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.75-4.75a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.75-4.75H4.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 1 .75-.75h2.25Z" />
            </svg>
          )}
        </button>

        {/* Optional overlay for the domain name, subtle and unobtrusive */}
        <div className="fixed bottom-8 left-0 right-0 text-center pointer-events-none opacity-20 hover:opacity-100 transition-opacity duration-500">
          <h1 className="text-black font-mono text-sm tracking-widest">
            JALFERN.COM
          </h1>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
