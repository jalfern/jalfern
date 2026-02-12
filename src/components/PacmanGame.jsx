import { useEffect, useRef } from 'react'
import { audioController } from '../utils/AudioController'

const PacmanGame = () => {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        let animationFrameId

        // Grid Constants
        // 0: Empty, 1: Wall, 2: Dot
        const map = [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
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
            [1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1],
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
            speed: 0.15
        }

        let ghosts = [
            { x: 10, y: 8, color: 'black', path: [], progress: 0, speed: 0.1 },
            { x: 9, y: 10, color: 'black', path: [], progress: 0, speed: 0.08 },
            { x: 11, y: 10, color: 'black', path: [], progress: 0, speed: 0.09 }
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
                for (let r = 0; r < ROWS; r++) {
                    for (let c = 0; c < COLS; c++) {
                        if (map[r][c] === 0) map[r][c] = 2 // Respawn dots in empty spaces (simplified)
                        // Don't spawn in ghost house (approx)
                        if (r > 7 && r < 12 && c > 7 && c < 13) map[r][c] = 0
                    }
                }
            }

            pacman.x = 10; pacman.y = 16;
            ghosts[0].x = 10; ghosts[0].y = 8;
            ghosts[1].x = 9; ghosts[1].y = 10;
            ghosts[2].x = 11; ghosts[2].y = 10;
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

            // --- PACMAN ---
            // Choose logic
            if (pacman.progress === 0) {
                // simple "stuck" detector: if in same 3x3 area too long?
                // Easier: just add 10% chance to pick random valid move even if dot found

                // Find nearest dot
                const nextMove = bfs(Math.round(pacman.x), Math.round(pacman.y), 'dot')

                // 10% chance to ignore optimal path to break loops
                if (nextMove && Math.random() > 0.1) {
                    pacman.nextDir = nextMove
                } else {
                    // No dots found OR random wander
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

                    // Eat dot
                    if (map[Math.round(pacman.y)][Math.round(pacman.x)] === 2) {
                        map[Math.round(pacman.y)][Math.round(pacman.x)] = 0
                        audioController.playTone(300 + Math.random() * 200, 0.05, 'triangle', 0.1)
                    }

                    // Wrap around (tunnel)
                    if (pacman.x < 0) pacman.x = COLS - 1
                    if (pacman.x >= COLS) pacman.x = 0
                }
            }

            // --- GHOSTS ---
            ghosts.forEach(g => {
                if (g.progress === 0) {
                    // Chase pacman roughly
                    const move = bfs(Math.round(g.x), Math.round(g.y), 'pacman')
                    // If BFS fails (path blocked?), random legal move
                    if (move) {
                        g.nextDir = move
                    } else {
                        const moves = getValidMoves(Math.round(g.x), Math.round(g.y))
                        g.nextDir = moves[Math.floor(Math.random() * moves.length)]
                    }
                }

                if (g.nextDir) {
                    g.progress += g.speed
                    if (g.progress >= 1) {
                        g.x += g.nextDir.x
                        g.y += g.nextDir.y
                        g.progress = 0
                    }
                }

                // Collision
                // Simple dist check
                const dx = (g.x + (g.nextDir?.x || 0) * g.progress) - (pacman.x + pacman.dir.x * pacman.progress)
                const dy = (g.y + (g.nextDir?.y || 0) * g.progress) - (pacman.y + pacman.dir.y * pacman.progress)
                if (Math.sqrt(dx * dx + dy * dy) < 0.8) {
                    gameOver = true
                    audioController.playSweep(400, 100, 0.5, 'sawtooth', 0.2)
                }
            })

            // Check win condition (no dots)
            // (Handled in resetGame check logic above if needed)
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
                    }
                }
            }

            // Draw Pacman
            const px = (pacman.x + pacman.dir.x * pacman.progress) * CELL_SIZE + CELL_SIZE / 2
            const py = (pacman.y + pacman.dir.y * pacman.progress) * CELL_SIZE + CELL_SIZE / 2

            ctx.fillStyle = 'black'
            ctx.beginPath()
            // Simple mouth animation based on time? or progress
            const mouthOpen = 0.2 * Math.sin(Date.now() / 50) + 0.2

            // Calculate angle
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

                ctx.fillStyle = 'black'
                // Ghost shape (circle top, rect bottom)
                ctx.beginPath()
                ctx.arc(gx + CELL_SIZE / 2, gy + CELL_SIZE / 2 - 2, CELL_SIZE / 2 - 2, Math.PI, 0)
                ctx.lineTo(gx + CELL_SIZE - 2, gy + CELL_SIZE)
                ctx.lineTo(gx + 2, gy + CELL_SIZE)
                ctx.fill()

                // Eyes (white)
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
