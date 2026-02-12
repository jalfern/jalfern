import PongGame from '../components/PongGame'
import SpaceInvadersGame from '../components/SpaceInvadersGame'
import PacmanGame from '../components/PacmanGame'
import AsteroidsGame from '../components/AsteroidsGame'
import DonkeyKongGame from '../components/DonkeyKongGame'
import CentipedeGame from '../components/CentipedeGame'
import DefenderGame from '../components/DefenderGame'
import PitfallGame from '../components/PitfallGame'

// Game Registry
// Theme 'dark' = white text (background is black)
// Theme 'light' = black text (background is white)
export const GAMES = [
    { path: '/pong', component: PongGame, label: 'PONG', theme: 'light' },
    { path: '/invaders', component: SpaceInvadersGame, label: 'SPACE INVADERS', theme: 'light' },
    { path: '/pacman', component: PacmanGame, label: 'PAC-MAN', theme: 'light' },
    { path: '/asteroids', component: AsteroidsGame, label: 'ASTEROIDS', theme: 'dark' },
    { path: '/donkeykong', component: DonkeyKongGame, label: 'DONKEY KONG', theme: 'dark' },
    { path: '/centipede', component: CentipedeGame, label: 'CENTIPEDE', theme: 'dark' },
    { path: '/defender', component: DefenderGame, label: 'DEFENDER', theme: 'dark' },
    { path: '/pitfall', component: PitfallGame, label: 'PITFALL', theme: 'light' }
]
