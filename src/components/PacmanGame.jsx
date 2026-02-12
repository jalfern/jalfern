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
        // Corners: (1,1), (1,19), (18,1), (18,19) -> mapped to index
        // Tunnel: Row 9, Col 0 and Col 20
        const map = [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 3, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 1],
            [1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1],
            [1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1],
            [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
            [1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1],
            [1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1],
            [1, 1, 1, 1, 1, 2, 1, 1, 1, 0, 1, 0, 1, 1, 1, 2, 1, 1, 1, 1, 1],
            [0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0], // Tunnel Row
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

        // B&W Ghosts: Differentiate by 'shade' (simulated by filling logic)
        // 1: Fill, 2: Outline, 3: Fill + Dot, 4: Crosshatch? 
        // Let's use simple shades of gray: 
        // Red -> Dark Gray (#666)
        // Pink -> Gray (#999)
        // Cyan -> Light Gray (#ccc)
        let ghosts = [
            { id: 1, x: 10, y: 8, color: '#666666', path: [], progress: 0, speed: 0.1, state: 'chase' },
            { id: 2, x: 9, y: 10, color: '#999999', path: [], progress: 0, speed: 0.08, state: 'chase' },
            { id: 3, x: 11, y: 10, color: '#cccccc', path: [], progress: 0, speed: 0.09, state: 'chase' }
        ]

        let gameOver = false

        // --- AI UTILS ---

        const getValidMoves = (x, y) => {
            const moves = []

            // Tunnel Check
            if (y === 8) {
                if (x === 0) { moves.push({ x: -1, y: 0 }); moves.push({ x: 1, y: 0 }); } // Can go left (wrap) or right
                if (x === COLS - 1) { moves.push({ x: 1, y: 0 }); moves.push({ x: -1, y: 0 }); } // Can go right (wrap) or left
            }

            // Normal moves
            if (x < COLS - 1 && map[y][x + 1] !== 1) moves.push({ x: 1, y: 0 })
            if (x > 0 && map[y][x - 1] !== 1) moves.push({ x: -1, y: 0 })
            if (y < ROWS - 1 && map[y + 1][x] !== 1) moves.push({ x: 0, y: 1 })
            if (y > 0 && map[y - 1][x] !== 1) moves.push({ x: 0, y: -1 })

            return moves
        }

        const bfs = (startX, startY, targetType) => {
            // Basic implementation, but robust for wrapping needs special care?
            // For now, let's assume ghosts don't use the tunnel for simplicity in pathfinding
            // Or they can, but let's prevent them to avoid complexity

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
            // Respawn dots/power pellets
            let dotsLeft = false
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (map[r][c] === 2 || map[r][c] === 3) dotsLeft = true
                }
            }
            if (!dotsLeft) {
                // Reset Level
                for (let r = 0; r < ROWS; r++) {
                    for (let c = 0; c < COLS; c++) {
                        if (r > 7 && r < 12 && c > 7 && c < 13) {
                            map[r][c] = 0 // House
                        } else {
                            if (map[r][c] === 0) map[r][c] = 2
                        }
                    }
                }
                // Restore corners (Power Pellets)
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
            if (pacman.progress === 0) {
                const nextMove = bfs(Math.round(pacman.x), Math.round(pacman.y), 'dot')

                // Tunnel Logic: if we are at edge, can we go into tunnel?
                // Logic handled by getValidMoves mostly, but pathfinding might fail.
                // Simple random move fallback works for tunnel entry usually.

                if (nextMove && Math.random() > 0.1) {
                    pacman.nextDir = nextMove
                } else {
                    const moves = getValidMoves(Math.round(pacman.x), Math.round(pacman.y))
                    if (moves.length > 0) pacman.nextDir = moves[Math.floor(Math.random() * moves.length)]
                }

                // Force tunnel usage if aligned? 
                // If at (0,8) and moving left (-1,0), next move is valid in getValidMoves
                pacman.dir = pacman.nextDir
            }

            // Move
            if (pacman.dir.x !== 0 || pacman.dir.y !== 0) {
                pacman.progress += pacman.speed
                if (pacman.progress >= 1) {
                    pacman.x += pacman.dir.x
                    pacman.y += pacman.dir.y
                    pacman.progress = 0

                    // WRAPPING
                    if (pacman.x <= -1) {
                        pacman.x = COLS - 1
                    }
                    else if (pacman.x >= COLS) {
                        pacman.x = 0
                    }

                    // Normalize for map access
                    const mapX = Math.round(pacman.x)
                    const mapY = Math.round(pacman.y)

                    if (mapX >= 0 && mapX < COLS && mapY >= 0 && mapY < ROWS) {
                        const tile = map[mapY][mapX]
                        // Eat dot
                        if (tile === 2) {
                            map[mapY][mapX] = 0
                            audioController.playTone(300 + Math.random() * 200, 0.05, 'triangle', 0.1)
                        }
                        // Eat Power Pellet
                        else if (tile === 3) {
                            map[mapY][mapX] = 0
                            pacman.poweredUp = true
                            pacman.powerTimer = 600
                            ghosts.forEach(g => {
                                if (g.state !== 'dead') g.state = 'scared'
                            })
                            audioController.playSweep(600, 800, 0.5, 'sine', 0.1)
                        }
                    }
                }
            }

            // --- GHOSTS ---
            ghosts.forEach(g => {
                if (g.progress === 0) {
                    let move = null

                    if (g.state === 'dead') {
                        move = bfs(Math.round(g.x), Math.round(g.y), 'home')
                        if (!move) { g.state = 'chase' }
                    } else if (g.state === 'scared') {
                        const moves = getValidMoves(Math.round(g.x), Math.round(g.y))
                        move = moves[Math.floor(Math.random() * moves.length)]
                    } else {
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
                    let currentSpeed = g.speed
                    if (g.state === 'scared') currentSpeed *= 0.6
                    if (g.state === 'dead') currentSpeed *= 2.0

                    g.progress += currentSpeed
                    if (g.progress >= 1) {
                        g.x += g.nextDir.x
                        g.y += g.nextDir.y
                        g.progress = 0

                        // Wrap Ghosts too?
                        if (g.x <= -1) g.x = COLS - 1
                        if (g.x >= COLS) g.x = 0
                    }
                }

                // Collision
                const dx = (g.x + (g.nextDir?.x || 0) * g.progress) - (pacman.x + pacman.dir.x * pacman.progress)
                const dy = (g.y + (g.nextDir?.y || 0) * g.progress) - (pacman.y + pacman.dir.y * pacman.progress)
                if (Math.sqrt(dx * dx + dy * dy) < 0.8) {
                    if (g.state === 'scared') {
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
            // Clear (White Background to keep B&W aesthetic consistent with Pong? or Black?)
            // User said "black and white". Pong is White bg with black items.
            // Donkey Kong is Black bg with white items.
            // Let's stick to WHITE BG for Pacman as it was before, but remove colors.

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
                        ctx.fillStyle = 'black'
                        ctx.beginPath()
                        // Slower flash
                        const rRadius = (Date.now() % 600 < 300) ? 6 : 4
                        ctx.arc(c * CELL_SIZE + CELL_SIZE / 2, r * CELL_SIZE + CELL_SIZE / 2, rRadius, 0, Math.PI * 2)
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

                // B&W Logic
                if (g.state === 'scared') {
                    // Flashing white/black outline
                    if (Date.now() % 400 < 200) {
                        ctx.fillStyle = 'white'
                        ctx.strokeStyle = 'black'
                    } else {
                        ctx.fillStyle = 'black'
                        ctx.strokeStyle = 'white'
                    }
                    ctx.lineWidth = 1
                } else if (g.state === 'dead') {
                    ctx.fillStyle = '#ffffff' // invisible body
                    ctx.strokeStyle = 'black'
                    ctx.lineWidth = 1
                } else {
                    ctx.fillStyle = g.color
                    ctx.strokeStyle = 'black'
                }

                ctx.beginPath()
                ctx.arc(gx + CELL_SIZE / 2, gy + CELL_SIZE / 2 - 2, CELL_SIZE / 2 - 2, Math.PI, 0)
                ctx.lineTo(gx + CELL_SIZE - 2, gy + CELL_SIZE)
                ctx.lineTo(gx + 2, gy + CELL_SIZE)
                ctx.fill()
                // if dead or scared, stroke
                if (g.state === 'scared' || g.state === 'dead') ctx.stroke()

                // Eyes
                ctx.fillStyle = (g.state === 'scared' && ctx.fillStyle === 'black') ? 'white' : 'white'
                // If dead, eyes act as body
                if (g.state === 'dead') ctx.fillStyle = 'black'

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
