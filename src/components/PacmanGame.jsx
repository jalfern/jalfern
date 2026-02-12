import { useEffect, useRef } from 'react'
import { audioController } from '../utils/AudioController'

const PacmanGame = () => {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        let animationFrameId

        // Authentic Level 1 Map (28x31)
        // 0: Empty, 1: Wall, 2: Dot, 3: Power Pellet, 4: Door/House
        const map = [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
            [1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1],
            [1, 3, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 3, 1],
            [1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1],
            [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
            [1, 2, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 1],
            [1, 2, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 1],
            [1, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 1],
            [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1],
            [0, 0, 0, 0, 0, 1, 2, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 2, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 2, 1, 1, 0, 1, 1, 1, 4, 4, 1, 1, 1, 0, 1, 1, 2, 1, 0, 0, 0, 0, 0],
            [1, 1, 1, 1, 1, 1, 2, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 2, 1, 1, 1, 1, 1, 1],
            [0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0], // Tunnel Row (Index 14)
            [1, 1, 1, 1, 1, 1, 2, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 2, 1, 1, 1, 1, 1, 1],
            [0, 0, 0, 0, 0, 1, 2, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 2, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 2, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 2, 1, 0, 0, 0, 0, 0],
            [1, 1, 1, 1, 1, 1, 2, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 2, 1, 1, 1, 1, 1, 1],
            [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
            [1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1],
            [1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1],
            [1, 3, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 3, 1],
            [1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1],
            [1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1],
            [1, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 1],
            [1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1],
            [1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1],
            [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ]

        const CELL_SIZE = 16
        const ROWS = map.length
        const COLS = map[0].length

        // Entities
        let pacman = {
            x: 13.5, y: 23,
            dir: { x: -1, y: 0 },
            nextDir: { x: -1, y: 0 },
            progress: 0,
            speed: 0.15, // Standard speed
            poweredUp: false,
            powerTimer: 0
        }

        // Tuned Ghost Speeds (Slower)
        let ghosts = [
            { id: 1, x: 13.5, y: 11, color: '#666666', path: [], progress: 0, speed: 0.08, state: 'chase', type: 'blinky' },
            { id: 2, x: 13.5, y: 14, color: '#999999', path: [], progress: 0, speed: 0.075, state: 'chase', type: 'pinky' },
            { id: 3, x: 12, y: 14, color: '#cccccc', path: [], progress: 0, speed: 0.07, state: 'chase', type: 'inky' },
            { id: 4, x: 15, y: 14, color: '#dddddd', path: [], progress: 0, speed: 0.06, state: 'chase', type: 'clyde' }
        ]

        let gameOver = false

        // --- AI UTILS ---

        const getValidMoves = (x, y) => {
            const moves = []

            // Tunnel Check (Row 14)
            if (y === 14) {
                if (x <= 1) { moves.push({ x: -1, y: 0 }); moves.push({ x: 1, y: 0 }); }
                else if (x >= COLS - 2) { moves.push({ x: 1, y: 0 }); moves.push({ x: -1, y: 0 }); }
            }

            if (x < COLS - 1 && map[y][x + 1] !== 1) moves.push({ x: 1, y: 0 })
            if (x > 0 && map[y][x - 1] !== 1) moves.push({ x: -1, y: 0 })
            if (y < ROWS - 1 && map[y + 1][x] !== 1 && map[y + 1][x] !== 4) moves.push({ x: 0, y: 1 })
            if (y > 0 && map[y - 1][x] !== 1) moves.push({ x: 0, y: -1 })

            return moves
        }

        const bfs = (startX, startY, targetType, targetPos = null) => {
            let queue = [{ x: startX, y: startY, path: [] }]
            let visited = new Set(`${startX},${startY}`)

            let iterations = 0;
            const MAX_ITER = 600; // Performance limit

            while (queue.length > 0 && iterations++ < MAX_ITER) {
                let curr = queue.shift()

                // Target Checks
                if (targetType === 'dot' && map[curr.y][curr.x] === 2) return curr.path[0]
                if (targetType === 'power' && map[curr.y][curr.x] === 3) return curr.path[0]
                if (targetType === 'pacman' && curr.x === Math.round(pacman.x) && curr.y === Math.round(pacman.y)) return curr.path[0]
                if (targetType === 'home' && curr.x === 13 && curr.y === 14) return curr.path[0]
                if (targetType === 'pos' && curr.x === targetPos.x && curr.y === targetPos.y) return curr.path[0]

                // Neighbors
                const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]

                // Randomize dirs in BFS to make movement less rigid?
                // Actually standard BFS is fine for shortest path.

                for (let d of dirs) {
                    let nx = curr.x + d.x, ny = curr.y + d.y

                    if (ny === 14 && (nx < 0 || nx >= COLS)) continue;

                    if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && map[ny][nx] !== 1 && !visited.has(`${nx},${ny}`)) {
                        visited.add(`${nx},${ny}`)
                        queue.push({ x: nx, y: ny, path: [...curr.path, d] })
                    }
                }
            }
            return null
        }

        // Find nearest ghost distance
        const getNearestGhostDist = (x, y) => {
            let minDist = Infinity
            ghosts.forEach(g => {
                const dist = Math.sqrt(Math.pow(g.x - x, 2) + Math.pow(g.y - y, 2))
                if (dist < minDist) minDist = dist
            })
            return minDist
        }

        // Custom Pac-Man Logic: Evasion
        const getSafeMove = (x, y) => {
            const moves = getValidMoves(x, y)
            if (moves.length === 0) return { x: 0, y: 0 }

            // Score moves by distance to nearest ghost
            // We want to MAXIMIZE distance to ghosts
            let bestMove = null
            let maxScore = -Infinity

            moves.forEach(m => {
                const nx = x + m.x
                const ny = y + m.y
                const ghostDist = getNearestGhostDist(nx, ny)

                // Avoid reversing if possible to prevent oscillation
                const isReverse = (m.x === -pacman.dir.x && m.y === -pacman.dir.y)
                const score = ghostDist - (isReverse ? 2 : 0) // Penalty for reverse

                if (score > maxScore) {
                    maxScore = score
                    bestMove = m
                }
            })

            return bestMove
        }


        const resetGame = () => {
            // Crude reload check
            let dotsLeft = false
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (map[r][c] === 2 || map[r][c] === 3) dotsLeft = true
                }
            }
            if (!dotsLeft) {
                window.location.reload()
            }

            pacman.x = 13.5; pacman.y = 23;
            ghosts[0].x = 13.5; ghosts[0].y = 11; ghosts[0].state = 'chase';
            ghosts[1].x = 13.5; ghosts[1].y = 14; ghosts[1].state = 'chase';
            ghosts[2].x = 12; ghosts[2].y = 14; ghosts[2].state = 'chase';
            ghosts[3].x = 15; ghosts[3].y = 14; ghosts[3].state = 'chase';

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
                if (Math.random() < 0.05) resetGame();
                return
            }

            if (pacman.poweredUp) {
                pacman.powerTimer--
                if (pacman.powerTimer <= 0) {
                    pacman.poweredUp = false
                    ghosts.forEach(g => { if (g.state === 'scared') g.state = 'chase' })
                }
            }

            // --- PACMAN AI IMPROVED ---
            if (pacman.progress === 0) {
                const mapX = Math.round(pacman.x)
                const mapY = Math.round(pacman.y)

                // 1. DANGER CHECK
                // Is a ghost (that is NOT scared) nearby?
                let dangerGhost = ghosts.find(g =>
                    g.state === 'chase' &&
                    Math.sqrt(Math.pow(g.x - mapX, 2) + Math.pow(g.y - mapY, 2)) < 8
                )

                if (dangerGhost) {
                    // EVADE
                    // Pick move that maximizes distance to ghosts
                    pacman.nextDir = getSafeMove(mapX, mapY)
                }
                else {
                    // 2. HUNT / GATHER
                    // If powered up, hunt ghosts? 
                    // Nah, stick to gathering for now, maybe hunt if very close.

                    // Look for nearest Power Pellet if ghosts act up?
                    const nearbyPower = bfs(mapX, mapY, 'power')
                    if (nearbyPower && !pacman.poweredUp) {
                        pacman.nextDir = nearbyPower
                    } else {
                        // Gather nearest dot
                        const nextDot = bfs(mapX, mapY, 'dot')
                        if (nextDot) pacman.nextDir = nextDot
                        else {
                            // Random wander if no dots found (or bfs limit hit)
                            const moves = getValidMoves(mapX, mapY)
                            if (moves.length > 0) pacman.nextDir = moves[Math.floor(Math.random() * moves.length)]
                        }
                    }
                }

                pacman.dir = pacman.nextDir || pacman.dir
            }

            // Move Pacman
            if (pacman.dir.x !== 0 || pacman.dir.y !== 0) {
                pacman.progress += pacman.speed
                if (pacman.progress >= 1) {
                    pacman.x += pacman.dir.x
                    pacman.y += pacman.dir.y
                    pacman.progress = 0

                    if (pacman.x <= -1) pacman.x = COLS - 1
                    else if (pacman.x >= COLS) pacman.x = 0

                    const mapX = Math.round(pacman.x)
                    const mapY = Math.round(pacman.y)

                    if (mapX >= 0 && mapX < COLS && mapY >= 0 && mapY < ROWS) {
                        const tile = map[mapY][mapX]
                        if (tile === 2) {
                            map[mapY][mapX] = 0
                            audioController.playTone(300 + Math.random() * 200, 0.05, 'triangle', 0.1)
                        } else if (tile === 3) {
                            map[mapY][mapX] = 0
                            pacman.poweredUp = true
                            pacman.powerTimer = 600
                            ghosts.forEach(g => { if (g.state !== 'dead') g.state = 'scared' })
                            audioController.playSweep(600, 800, 0.5, 'sine', 0.1)
                        }
                    }
                }
            }

            // --- GHOST AI TUNED ---
            ghosts.forEach(g => {
                if (g.progress === 0) {
                    let move = null

                    if (g.state === 'dead') {
                        move = bfs(Math.round(g.x), Math.round(g.y), 'home')
                        if (!move) g.state = 'chase'
                    } else if (g.state === 'scared') {
                        const moves = getValidMoves(Math.round(g.x), Math.round(g.y))
                        move = moves[Math.floor(Math.random() * moves.length)]
                    } else {
                        // CHASE LOGIC VARIATIONS
                        if (g.type === 'blinky') {
                            // Direct Chase
                            move = bfs(Math.round(g.x), Math.round(g.y), 'pacman')
                        } else if (g.type === 'pinky') {
                            // Ambush (Target 4 tiles ahead)
                            const targetX = Math.round(pacman.x + pacman.dir.x * 4)
                            const targetY = Math.round(pacman.y + pacman.dir.y * 4)
                            // Clamp to map
                            const tx = Math.max(0, Math.min(COLS - 1, targetX))
                            const ty = Math.max(0, Math.min(ROWS - 1, targetY))
                            move = bfs(Math.round(g.x), Math.round(g.y), 'pos', { x: tx, y: ty })
                            // Fallback to chase if bfs fails
                            if (!move) move = bfs(Math.round(g.x), Math.round(g.y), 'pacman')
                        } else {
                            // Inky/Clyde: Random / Lazy Chase
                            if (Math.random() > 0.5) {
                                move = bfs(Math.round(g.x), Math.round(g.y), 'pacman')
                            } else {
                                const moves = getValidMoves(Math.round(g.x), Math.round(g.y))
                                if (moves.length > 0) move = moves[Math.floor(Math.random() * moves.length)]
                            }
                        }
                    }

                    if (move) g.nextDir = move
                    else {
                        const moves = getValidMoves(Math.round(g.x), Math.round(g.y))
                        if (moves.length > 0) g.nextDir = moves[Math.floor(Math.random() * moves.length)]
                    }
                }

                if (g.nextDir) {
                    let currentSpeed = g.speed
                    if (g.state === 'scared') currentSpeed *= 0.6
                    if (g.state === 'dead') currentSpeed *= 3.0

                    g.progress += currentSpeed
                    if (g.progress >= 1) {
                        g.x += g.nextDir.x
                        g.y += g.nextDir.y
                        g.progress = 0
                        if (g.x <= -1) g.x = COLS - 1
                        if (g.x >= COLS) g.x = 0
                    }
                }

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

        const drawWalls = (ctx, scale, mapWidth, mapHeight) => {
            // Use Path2D to draw all walls as a single complex shape? 
            // Or construct valid paths.
            // Simpler: Draw each cell's connections.
            // To create "Double Line":
            // 1. Draw distinct wide stroke (Black)
            // 2. Draw narrower stroke (White) on top

            // We need to iterate over map and draw lines to neighbors

            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'

            // Helper to get center of cell
            const getCenter = (c, r) => ({ x: c * CELL_SIZE + CELL_SIZE / 2, y: r * CELL_SIZE + CELL_SIZE / 2 })

            // PASS 1: Thick Black (Outer)
            ctx.strokeStyle = 'black'
            ctx.lineWidth = CELL_SIZE * 0.8
            ctx.beginPath()
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (map[r][c] === 1) {
                        const { x, y } = getCenter(c, r)
                        ctx.moveTo(x, y)
                        // Connect to neighbors if they are also wall 1
                        // Right
                        if (c < COLS - 1 && map[r][c + 1] === 1) ctx.lineTo(x + CELL_SIZE, y)
                        ctx.moveTo(x, y)
                        // Down
                        if (r < ROWS - 1 && map[r + 1][c] === 1) ctx.lineTo(x, y + CELL_SIZE)
                    }
                }
            }
            ctx.stroke()

            // PASS 2: Thin White (Inner "Hollow")
            ctx.strokeStyle = 'white'
            ctx.lineWidth = CELL_SIZE * 0.4
            ctx.stroke() // Re-stroke same path
        }

        const draw = () => {
            // Clear
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            const mapWidth = COLS * CELL_SIZE
            const mapHeight = ROWS * CELL_SIZE
            const scale = Math.min(canvas.width / mapWidth, canvas.height / mapHeight) * 0.95

            ctx.save()
            ctx.translate((canvas.width - mapWidth * scale) / 2, (canvas.height - mapHeight * scale) / 2)
            ctx.scale(scale, scale)

            // DRAW WALLS (New System)
            drawWalls(ctx, scale, mapWidth, mapHeight)

            // Draw Dots (Optimization: Draw them simply)
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const x = c * CELL_SIZE
                    const y = r * CELL_SIZE
                    if (map[r][c] === 2) {
                        ctx.fillStyle = 'black'
                        ctx.beginPath()
                        ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, 2, 0, Math.PI * 2)
                        ctx.fill()
                    } else if (map[r][c] === 3) {
                        ctx.fillStyle = 'black'
                        const rRadius = (Date.now() % 600 < 300) ? 5 : 3
                        ctx.beginPath()
                        ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, rRadius, 0, Math.PI * 2)
                        ctx.fill()
                    }
                }
            }

            // Door
            ctx.fillStyle = '#ccc'
            // Hardcode door pos?
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (map[r][c] === 4) ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE + CELL_SIZE / 2 - 2, CELL_SIZE, 4)
                }
            }

            // Entities
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

            ghosts.forEach(g => {
                const gx = (g.x + (g.nextDir?.x || 0) * g.progress) * CELL_SIZE
                const gy = (g.y + (g.nextDir?.y || 0) * g.progress) * CELL_SIZE

                if (g.state === 'scared') {
                    if (Date.now() % 400 < 200) { ctx.fillStyle = 'white'; ctx.strokeStyle = 'black'; }
                    else { ctx.fillStyle = 'black'; ctx.strokeStyle = 'white'; }
                    ctx.lineWidth = 1
                } else if (g.state === 'dead') {
                    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'black'; ctx.lineWidth = 1
                } else {
                    ctx.fillStyle = g.color; ctx.strokeStyle = 'black'
                }

                ctx.beginPath()
                ctx.arc(gx + CELL_SIZE / 2, gy + CELL_SIZE / 2 - 2, CELL_SIZE / 2 - 2, Math.PI, 0)
                ctx.lineTo(gx + CELL_SIZE - 2, gy + CELL_SIZE)
                ctx.lineTo(gx + 2, gy + CELL_SIZE)
                ctx.fill()
                if (g.state === 'scared' || g.state === 'dead') ctx.stroke()
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
