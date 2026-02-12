import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PongGame from './components/PongGame'
import SpaceInvadersGame from './components/SpaceInvadersGame'

function App() {
  return (
    <BrowserRouter>
      <div className="w-full h-screen bg-white overflow-hidden">
        <Routes>
          <Route path="/" element={<PongGame />} />
          <Route path="/invaders" element={<SpaceInvadersGame />} />
        </Routes>

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
