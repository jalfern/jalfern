import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import PongGame from './components/PongGame'
import SpaceInvadersGame from './components/SpaceInvadersGame'
import PacmanGame from './components/PacmanGame'
import AsteroidsGame from './components/AsteroidsGame'
import { audioController } from './utils/AudioController'

const GAMES = [
  { path: '/pong', component: PongGame, label: 'PONG' },
  { path: '/invaders', component: SpaceInvadersGame, label: 'SPACE INVADERS' },
  { path: '/pacman', component: PacmanGame, label: 'PAC-MAN' },
  { path: '/asteroids', component: AsteroidsGame, label: 'ASTEROIDS' }
]

function RandomHome() {
  const [GameComponent, setGameComponent] = useState(null)

  useEffect(() => {
    const randomGame = GAMES[Math.floor(Math.random() * GAMES.length)]
    setGameComponent(() => randomGame.component)
  }, [])

  if (!GameComponent) return null
  return <GameComponent />
}

function Layout({ children }) {
  const location = useLocation()
  let label = 'JALFERN.COM'

  // Determine label based on path or random home
  // If home, we might want to know which one is rendering, but simple "JALFERN.COM" is fine or generic.
  // Actually user asked for "name of the game". 
  // Since RandomHome renders a game, maybe we should just overlay the label based on what it *looks* like?
  // Or: RandomHome could update a context?
  // Let's keep it simple: Map known routes to names. For Home, we display "ARCHADE".

  if (location.pathname === '/pong') label = 'PONG'
  else if (location.pathname === '/invaders') label = 'SPACE INVADERS'
  else if (location.pathname === '/pacman') label = 'PAC-MAN'
  else if (location.pathname === '/asteroids') label = 'ASTEROIDS'
  else label = 'JALFERN.COM / RANDOM'

  return (
    <div className="w-full h-screen bg-white overflow-hidden relative">
      {children}

      {/* Footer Label */}
      <div className="fixed bottom-8 left-0 right-0 text-center pointer-events-none opacity-40 hover:opacity-100 transition-opacity duration-500">
        <h1 className="text-black font-mono text-sm tracking-widest border-b-2 border-transparent hover:border-black inline-block pb-1">
          {label}
        </h1>
      </div>
    </div>
  )
}

function App() {
  const [muted, setMuted] = useState(true)

  const toggleMute = () => {
    const newMuted = !muted
    setMuted(newMuted)
    audioController.init()
    audioController.setMuted(newMuted)
    if (!newMuted) {
      setTimeout(() => audioController.playTone(440, 0.1, 'sine'), 100)
    }
  }

  // Mobile Audio Unlock
  useEffect(() => {
    const unlockAudio = () => {
      audioController.init()
      if (audioController.ctx && audioController.ctx.state === 'suspended') {
        audioController.ctx.resume()
      }
    }
    window.addEventListener('touchstart', unlockAudio, { once: true })
    window.addEventListener('click', unlockAudio, { once: true })
    return () => {
      window.removeEventListener('touchstart', unlockAudio)
      window.removeEventListener('click', unlockAudio)
    }
  }, [])

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<RandomHome />} />
          <Route path="/pong" element={<PongGame />} />
          <Route path="/invaders" element={<SpaceInvadersGame />} />
          <Route path="/pacman" element={<PacmanGame />} />
          <Route path="/asteroids" element={<AsteroidsGame />} />
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
      </Layout>
    </BrowserRouter>
  )
}

export default App
