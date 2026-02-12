import { useEffect, useRef } from 'react'
import { audioController } from '../utils/AudioController'

const PacmanGame = () => {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        let animationFrameId

        // Grid Constants
        // 0: Empty, 1: Wall, 2: Dot, 3: Power Pellet
        const map = [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 3, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 1],
            [1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1],
            [1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1],
            [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
            [1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1],
            [1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1],
            [1, 1, 1, 1, 1, 2, 1, 1, 1, 0, 1, 0, 1, 1, 1, 2, 1, 1, 1, 1, 1],
            [0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0],
            [1, 1, 1, 1, 1, 2, 1, 0, 1, 1, 0, 1, 1, 0, 1, 2, 1, 1, 1, 1, 1],
            [0, 2, 2, 2, 2, 2, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 2, 2, 2, 2, 0],
            [1, 1, 1, 1, 1, 2, 1, 0, 1, 1, 1, 1, 1, 0, 1, 2, 1, 1, 1, 1, 1],
            [0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0],
            [1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1],
            [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
            [1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1],
            [1, 2, 2, 2, 1, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1],
            [1, 1, 1, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 1, 1, 1],
            [1, 3, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 3, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ]

        const CELL_SIZE = 20
        const ROWS = map.length
        const COLS = map[0].length

        // Entities
        let pacman = {
            x: 10, y: 16,
            dir: { x: 0, y: 0 },
            nextDir: { x: 0, y: 0 },
            progress: 0, // 0 to 1 between tiles
            speed: 0.15,
            poweredUp: false,
            powerTimer: 0
        }

        let ghosts = [
            { id: 1, x: 10, y: 8, color: 'red', path: [], progress: 0, speed: 0.1, state: 'chase' },
            { id: 2, x: 9, y: 10, color: 'pink', path: [], progress: 0, speed: 0.08, state: 'chase' },
            { id: 3, x: 11, y: 10, color: 'cyan', path: [], progress: 0, speed: 0.09, state: 'chase' }
        ]

        let gameOver = false

        // --- AI UTILS ---

        const getValidMoves = (x, y) => {
            const moves = []
            if (map[y][x + 1] !== 1) moves.push({ x: 1, y: 0 })
            if (map[y][x - 1] !== 1) moves.push({ x: -1, y: 0 })
            if (map[y + 1] && map[y + 1][x] !== 1) moves.push({ x: 0, y: 1 })
            if (map[y - 1] && map[y - 1][x] !== 1) moves.push({ x: 0, y: -1 })
            return moves
        }

        const bfs = (startX, startY, targetType) => {
            let queue = [{ x: startX, y: startY, path: [] }]
            let visited = new Set(`${startX},${startY}`)

            while (queue.length > 0) {
                let curr = queue.shift()

                // Check finding dot
                if (targetType === 'dot' && map[curr.y][curr.x] === 2) {
                    return curr.path[0] // Return first step
                }
                // Check finding pacman (for ghost)
                if (targetType === 'pacman' && curr.x === Math.round(pacman.x) && curr.y === Math.round(pacman.y)) {
                    return curr.path[0]
                }
                // Check finding home (dead ghost)
                if (targetType === 'home' && curr.x === 10 && curr.y === 10) {
                    return curr.path[0]
                }

                // Neighbors
                const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
                for (let d of dirs) {
                    let nx = curr.x + d.x, ny = curr.y + d.y
                    if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && map[ny][nx] !== 1 && !visited.has(`${nx},${ny}`)) {
                        visited.add(`${nx},${ny}`)
                        queue.push({ x: nx, y: ny, path: [...curr.path, d] })
                    }
                }
            }
            return null
        }

        const resetGame = () => {
            // Simple respawn of dots if all eaten
            let dotsLeft = false
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (map[r][c] === 2) dotsLeft = true
                }
            }
            if (!dotsLeft) {
                // Reset Level
                for (let r = 0; r < ROWS; r++) {
                    for (let c = 0; c < COLS; c++) {
                        if (r > 7 && r < 12 && c > 7 && c < 13) {
                            map[r][c] = 0 // House
                        } else {
                            // Crude restore logic
                            if (map[r][c] === 0) map[r][c] = 2
                        }
                    }
                }
                // Restore corners
                map[1][1] = 3; map[1][19] = 3; map[18][1] = 3; map[18][19] = 3;
            }

            pacman.x = 10; pacman.y = 16;
            ghosts[0].x = 10; ghosts[0].y = 8; ghosts[0].state = 'chase';
            ghosts[1].x = 9; ghosts[1].y = 10; ghosts[1].state = 'chase';
            ghosts[2].x = 11; ghosts[2].y = 10; ghosts[2].state = 'chase';

            pacman.poweredUp = false
            gameOver = false
        }

        const resize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }
        window.addEventListener('resize', resize)
        resize()

        const update = () => {
            if (gameOver) {
                if (Math.random() < 0.05) resetGame(); // Auto restart
                return
            }

            // --- POWER TIMER ---
            if (pacman.poweredUp) {
                pacman.powerTimer--
                if (pacman.powerTimer <= 0) {
                    pacman.poweredUp = false
                    ghosts.forEach(g => {
                        if (g.state === 'scared') g.state = 'chase'
                    })
                }
            }

            // --- PACMAN ---
            // Choose logic
            if (pacman.progress === 0) {
                // Find nearest dot or pellet
                // Simplified: BFS for nearest "2" or "3"
                // ...
                const nextMove = bfs(Math.round(pacman.x), Math.round(pacman.y), 'dot')

                if (nextMove && Math.random() > 0.1) {
                    pacman.nextDir = nextMove
                } else {
                    const moves = getValidMoves(Math.round(pacman.x), Math.round(pacman.y))
                    if (moves.length > 0) pacman.nextDir = moves[Math.floor(Math.random() * moves.length)]
                }
                pacman.dir = pacman.nextDir
            }

            // Move
            if (pacman.dir.x !== 0 || pacman.dir.y !== 0) {
                pacman.progress += pacman.speed
                if (pacman.progress >= 1) {
                    pacman.x += pacman.dir.x
                    pacman.y += pacman.dir.y
                    pacman.progress = 0

                    const tile = map[Math.round(pacman.y)][Math.round(pacman.x)]
                    // Eat dot
                    if (tile === 2) {
                        map[Math.round(pacman.y)][Math.round(pacman.x)] = 0
                        audioController.playTone(300 + Math.random() * 200, 0.05, 'triangle', 0.1)
                    }
                    // Eat Power Pellet
                    else if (tile === 3) {
                        map[Math.round(pacman.y)][Math.round(pacman.x)] = 0
                        pacman.poweredUp = true
                        pacman.powerTimer = 600 // 10 seconds (approx)
                        ghosts.forEach(g => {
                            if (g.state !== 'dead') g.state = 'scared'
                        })
                        audioController.playSweep(600, 800, 0.5, 'sine', 0.1)
                    }

                    // Wrap around
                    if (pacman.x < 0) pacman.x = COLS - 1
                    if (pacman.x >= COLS) pacman.x = 0
                }
            }

            // --- GHOSTS ---
            ghosts.forEach(g => {
                if (g.progress === 0) {
                    let move = null

                    if (g.state === 'dead') {
                        // Return to center
                        move = bfs(Math.round(g.x), Math.round(g.y), 'home')
                        if (!move) { // Arrived
                            g.state = 'chase'
                        }
                    } else if (g.state === 'scared') {
                        // Move randomly or away? Random is easier for MVP
                        const moves = getValidMoves(Math.round(g.x), Math.round(g.y))
                        move = moves[Math.floor(Math.random() * moves.length)]
                    } else {
                        // Chase
                        move = bfs(Math.round(g.x), Math.round(g.y), 'pacman')
                    }

                    if (move) {
                        g.nextDir = move
                    } else {
                        const moves = getValidMoves(Math.round(g.x), Math.round(g.y))
                        g.nextDir = moves[Math.floor(Math.random() * moves.length)]
                    }
                }

                if (g.nextDir) {
                    // Speed var
                    let currentSpeed = g.speed
                    if (g.state === 'scared') currentSpeed *= 0.6
                    if (g.state === 'dead') currentSpeed *= 2.0

                    g.progress += currentSpeed
                    if (g.progress >= 1) {
                        g.x += g.nextDir.x
                        g.y += g.nextDir.y
                        g.progress = 0
                    }
                }

                // Collision
                const dx = (g.x + (g.nextDir?.x || 0) * g.progress) - (pacman.x + pacman.dir.x * pacman.progress)
                const dy = (g.y + (g.nextDir?.y || 0) * g.progress) - (pacman.y + pacman.dir.y * pacman.progress)
                if (Math.sqrt(dx * dx + dy * dy) < 0.8) {
                    if (g.state === 'scared') {
                        // Eat Ghost
                        g.state = 'dead'
                        audioController.playTone(800, 0.1, 'square', 0.2)
                    } else if (g.state === 'chase') {
                        gameOver = true
                        audioController.playSweep(400, 100, 0.5, 'sawtooth', 0.2)
                    }
                }
            })
        }

        const draw = () => {
            // Clear
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // Scale to fit
            const mapWidth = COLS * CELL_SIZE
            const mapHeight = ROWS * CELL_SIZE
            const scale = Math.min(canvas.width / mapWidth, canvas.height / mapHeight) * 0.9

            ctx.save()
            ctx.translate((canvas.width - mapWidth * scale) / 2, (canvas.height - mapHeight * scale) / 2)
            ctx.scale(scale, scale)

            // Draw Map
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (map[r][c] === 1) {
                        ctx.fillStyle = 'black'
                        ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE)
                    } else if (map[r][c] === 2) {
                        ctx.fillStyle = 'black'
                        ctx.beginPath()
                        ctx.arc(c * CELL_SIZE + CELL_SIZE / 2, r * CELL_SIZE + CELL_SIZE / 2, 2, 0, Math.PI * 2)
                        ctx.fill()
                    } else if (map[r][c] === 3) {
                        // Power Pellet
                        ctx.fillStyle = 'black'
                        ctx.beginPath()

                        // Flash effect
                        const r = (Date.now() % 400 < 200) ? 6 : 4

                        ctx.arc(c * CELL_SIZE + CELL_SIZE / 2, r * CELL_SIZE + CELL_SIZE / 2, r, 0, Math.PI * 2)
                        ctx.fill()
                    }
                }
            }

            // Draw Pacman
            const px = (pacman.x + pacman.dir.x * pacman.progress) * CELL_SIZE + CELL_SIZE / 2
            const py = (pacman.y + pacman.dir.y * pacman.progress) * CELL_SIZE + CELL_SIZE / 2

            ctx.fillStyle = 'black'
            ctx.beginPath()
            const mouthOpen = 0.2 * Math.sin(Date.now() / 50) + 0.2
            let angle = 0
            if (pacman.dir.x === 1) angle = 0
            if (pacman.dir.x === -1) angle = Math.PI
            if (pacman.dir.y === 1) angle = Math.PI / 2
            if (pacman.dir.y === -1) angle = -Math.PI / 2

            ctx.arc(px, py, CELL_SIZE / 2 - 2, angle + mouthOpen, angle + 2 * Math.PI - mouthOpen)
            ctx.lineTo(px, py)
            ctx.fill()

            // Draw Ghosts
            ghosts.forEach(g => {
                const gx = (g.x + (g.nextDir?.x || 0) * g.progress) * CELL_SIZE
                const gy = (g.y + (g.nextDir?.y || 0) * g.progress) * CELL_SIZE

                if (g.state === 'scared') ctx.fillStyle = 'blue'
                else if (g.state === 'dead') ctx.fillStyle = '#e0e0e0' // gray eyes
                else ctx.fillStyle = g.color

                ctx.beginPath()
                ctx.arc(gx + CELL_SIZE / 2, gy + CELL_SIZE / 2 - 2, CELL_SIZE / 2 - 2, Math.PI, 0)
                ctx.lineTo(gx + CELL_SIZE - 2, gy + CELL_SIZE)
                ctx.lineTo(gx + 2, gy + CELL_SIZE)
                ctx.fill()

                // Eyes
                ctx.fillStyle = 'white'
                ctx.beginPath()
                ctx.arc(gx + CELL_SIZE / 3, gy + CELL_SIZE / 2 - 4, 2, 0, Math.PI * 2)
                ctx.arc(gx + 2 * CELL_SIZE / 3, gy + CELL_SIZE / 2 - 4, 2, 0, Math.PI * 2)
                ctx.fill()
            })

            ctx.restore()
        }

        const loop = () => {
            update()
            draw()
            animationFrameId = requestAnimationFrame(loop)
        }
        loop()

        return () => {
            window.removeEventListener('resize', resize)
            cancelAnimationFrame(animationFrameId)
        }
    }, [])

    return <canvas ref={canvasRef} className="block fixed inset-0 w-full h-full" />
}

export default PacmanGame
