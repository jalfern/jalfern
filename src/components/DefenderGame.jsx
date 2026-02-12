import { useEffect, useRef } from 'react'
import { audioController } from '../utils/AudioController'

const DefenderGame = () => {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        let animationFrameId

        // GAME CONSTANTS
        const WORLD_WIDTH = 4000
        const MINIMAP_HEIGHT = 50
        const GROUND_HEIGHT = 50
        const PLAYER_SPEED = 0.5
        const PLAYER_MAX_SPEED = 8
        const LASER_SPEED = 20

        // GAME STATE
        let cameraX = 0
        let gameTime = 0

        // INPUT
        const keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false,
            Space: false
        }

        // ENTITIES
        let player = {
            x: 200,
            y: 300,
            vx: 0,
            vy: 0,
            facing: 1, // 1 or -1
            cooldown: 0
        }

        let lasers = []
        let particles = []
        let enemies = []

        // TERRAIN GENERATION
        // Simple heightmap
        const terrain = []
        const generateTerrain = (width, height) => {
            let y = height - 100
            for (let x = 0; x < width; x += 10) {
                terrain.push({ x, y })
                y += (Math.random() - 0.5) * 40
                if (y > height - 20) y = height - 20
                if (y < height - 200) y = height - 200
            }
            terrain.push({ x: width, y: height - 100 })
        }

        // SPAWN ENEMIES
        const spawnEnemies = () => {
            for (let i = 0; i < 15; i++) {
                enemies.push({
                    x: Math.random() * WORLD_WIDTH,
                    y: Math.random() * (window.innerHeight - 200) + 50,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    type: 'lander'
                })
            }
        }

        // INIT
        const init = () => {
            resize()
            generateTerrain(WORLD_WIDTH, canvas.height)
            spawnEnemies()

            window.addEventListener('keydown', handleKeyDown)
            window.addEventListener('keyup', handleKeyUp)
            window.addEventListener('resize', resize)
        }

        const resize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }

        const handleKeyDown = (e) => {
            if (e.code === 'Space') keys.Space = true
            if (e.code === 'ArrowUp' || e.key === 'w') keys.ArrowUp = true
            if (e.code === 'ArrowDown' || e.key === 's') keys.ArrowDown = true
            if (e.code === 'ArrowLeft' || e.key === 'a') keys.ArrowLeft = true
            if (e.code === 'ArrowRight' || e.key === 'd') keys.ArrowRight = true
        }

        const handleKeyUp = (e) => {
            if (e.code === 'Space') keys.Space = false
            if (e.code === 'ArrowUp' || e.key === 'w') keys.ArrowUp = false
            if (e.code === 'ArrowDown' || e.key === 's') keys.ArrowDown = false
            if (e.code === 'ArrowLeft' || e.key === 'a') keys.ArrowLeft = false
            if (e.code === 'ArrowRight' || e.key === 'd') keys.ArrowRight = false
        }

        const update = () => {
            // Player Physics
            if (keys.ArrowLeft) player.vx -= PLAYER_SPEED
            if (keys.ArrowRight) player.vx += PLAYER_SPEED
            if (keys.ArrowUp) player.vy -= PLAYER_SPEED
            if (keys.ArrowDown) player.vy += PLAYER_SPEED

            // Friction
            player.vx *= 0.98
            player.vy *= 0.95

            // Max Speed
            if (player.vx > PLAYER_MAX_SPEED) player.vx = PLAYER_MAX_SPEED
            if (player.vx < -PLAYER_MAX_SPEED) player.vx = -PLAYER_MAX_SPEED
            if (player.vy > PLAYER_MAX_SPEED) player.vy = PLAYER_MAX_SPEED
            if (player.vy < -PLAYER_MAX_SPEED) player.vy = -PLAYER_MAX_SPEED

            // Movement
            player.x += player.vx
            player.y += player.vy

            // Boundaries
            if (player.x < 0) player.x = 0
            if (player.x > WORLD_WIDTH) player.x = WORLD_WIDTH
            if (player.y < MINIMAP_HEIGHT + 20) player.y = MINIMAP_HEIGHT + 20
            if (player.y > canvas.height - 20) player.y = canvas.height - 20

            // Facing
            if (keys.ArrowLeft) player.facing = -1
            if (keys.ArrowRight) player.facing = 1

            // Camera Follow
            cameraX = player.x - canvas.width / 2
            if (cameraX < 0) cameraX = 0
            if (cameraX > WORLD_WIDTH - canvas.width) cameraX = WORLD_WIDTH - canvas.width

            // Shooting
            if (keys.Space && player.cooldown <= 0) {
                lasers.push({
                    x: player.x + (player.facing === 1 ? 20 : -20),
                    y: player.y,
                    vx: player.facing * LASER_SPEED,
                    life: 60
                })
                player.cooldown = 10
                audioController.playTone(400, 0.05, 'square', 0.1) // Pew
            }
            if (player.cooldown > 0) player.cooldown--

            // Entities
            lasers.forEach(l => {
                l.x += l.vx
                l.life--
            })
            lasers = lasers.filter(l => l.life > 0)

            enemies.forEach(e => {
                e.x += e.vx
                e.y += e.vy

                // Bounce
                if (e.y < MINIMAP_HEIGHT || e.y > canvas.height - 50) e.vy *= -1
                if (e.x < 0 || e.x > WORLD_WIDTH) e.vx *= -1

                // Random jitter
                if (Math.random() < 0.02) e.vy = (Math.random() - 0.5) * 2
            })

            // Collision
            lasers.forEach(l => {
                enemies.forEach(e => {
                    if (Math.abs(l.x - e.x) < 20 && Math.abs(l.y - e.y) < 20) {
                        e.dead = true
                        l.life = 0
                        // Explosion particles
                        for (let i = 0; i < 10; i++) {
                            particles.push({
                                x: e.x, y: e.y,
                                vx: (Math.random() - 0.5) * 10,
                                vy: (Math.random() - 0.5) * 10,
                                life: 30
                            })
                        }
                        audioController.playTone(150, 0.1, 'sawtooth', 0.2) // Boom
                    }
                })
            })
            enemies = enemies.filter(e => !e.dead)

            // Particles
            particles.forEach(p => {
                p.x += p.vx
                p.y += p.vy
                p.life--
            })
            particles = particles.filter(p => p.life > 0)
        }

        const draw = () => {
            // Background
            ctx.fillStyle = 'black'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // --- MAIN VIEW ---
            ctx.save()
            ctx.translate(-cameraX, 0)

            // Stars (Static parallax?)
            // Just random white dots for now, scrolling slower
            // Actually, static world stars:
            ctx.fillStyle = 'white'
            for (let i = 0; i < 100; i++) {
                // deterministic stars based on i
                const sx = (i * 137) % WORLD_WIDTH
                const sy = (i * 53) % canvas.height
                if (sx > cameraX && sx < cameraX + canvas.width)
                    ctx.fillRect(sx, sy, 1, 1)
            }

            // Terrain
            ctx.strokeStyle = 'white'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(0, canvas.height)
            terrain.forEach(p => ctx.lineTo(p.x, p.y))
            ctx.lineTo(WORLD_WIDTH, canvas.height)
            ctx.stroke()

            // Player
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 2
            ctx.save()
            ctx.translate(player.x, player.y)
            ctx.scale(player.facing, 1)
            ctx.beginPath()
            // Simple ship shape
            ctx.moveTo(10, 0); ctx.lineTo(-10, -5); ctx.lineTo(-10, 5); ctx.lineTo(10, 0)
            ctx.moveTo(-10, -5); ctx.lineTo(-15, 0); ctx.lineTo(-10, 5) // Thruster
            ctx.moveTo(0, -3); ctx.lineTo(0, -8) // Top fin
            ctx.stroke()

            // Thrust flame
            if ((player.facing === 1 && keys.ArrowRight) || (player.facing === -1 && keys.ArrowLeft)) {
                ctx.beginPath()
                ctx.moveTo(-15, 0)
                ctx.lineTo(-25 - Math.random() * 10, 0)
                ctx.strokeStyle = Math.random() > 0.5 ? 'white' : 'gray'
                ctx.stroke()
            }
            ctx.restore()

            // Lasers
            ctx.strokeStyle = 'white' // Colorful lasers? Grayscale requested.
            // Actually defender has colorful lasers. But user asked for greyscale.
            ctx.lineWidth = 2
            ctx.beginPath()
            lasers.forEach(l => {
                ctx.moveTo(l.x, l.y)
                ctx.lineTo(l.x + 40 * (l.vx > 0 ? 1 : -1), l.y)
            })
            ctx.stroke()

            // Enemies
            ctx.strokeStyle = '#cccccc'
            enemies.forEach(e => {
                ctx.save()
                ctx.translate(e.x, e.y)
                ctx.beginPath()
                // Lander shape
                ctx.rect(-10, -10, 20, 20)
                ctx.moveTo(-10, 10); ctx.lineTo(-10, 5); ctx.lineTo(10, 5); ctx.lineTo(10, 10)
                ctx.moveTo(-5, 0); ctx.lineTo(5, 0)
                ctx.stroke()
                ctx.restore()
            })

            // Particles
            ctx.fillStyle = 'white'
            particles.forEach(p => ctx.fillRect(p.x, p.y, 2, 2))

            ctx.restore()

            // --- SCANNER (MINIMAP) ---
            // Top of screen
            const scannerScale = canvas.width / WORLD_WIDTH
            const scannerH = MINIMAP_HEIGHT

            // Frame
            ctx.fillStyle = 'black'
            ctx.fillRect(0, 0, canvas.width, scannerH)
            ctx.strokeStyle = 'white'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(0, scannerH); ctx.lineTo(canvas.width, scannerH)
            ctx.stroke()

            // Terrain on Scanner
            ctx.strokeStyle = '#666666'
            ctx.lineWidth = 1
            ctx.beginPath()
            terrain.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x * scannerScale, p.y * (scannerH / canvas.height * 0.5) + scannerH / 2) // Scale height down?
                else ctx.lineTo(p.x * scannerScale, p.y * 0.15 + 10)
            })
            ctx.stroke()

            // Entities on Scanner
            // Player
            ctx.fillStyle = 'white'
            ctx.fillRect(player.x * scannerScale, player.y * 0.15 + 10, 4, 4)

            // Enemies
            ctx.fillStyle = '#aaaaaa'
            enemies.forEach(e => {
                ctx.fillRect(e.x * scannerScale, e.y * 0.15 + 10, 2, 2)
            })

            // Camera Box
            ctx.strokeStyle = 'white'
            ctx.strokeRect(cameraX * scannerScale, 2, canvas.width * scannerScale, scannerH - 4)

        }

        const loop = () => {
            update()
            draw()
            animationFrameId = requestAnimationFrame(loop)
        }
        loop()

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
            window.removeEventListener('resize', resize)
            cancelAnimationFrame(animationFrameId)
        }
    }, [])

    return <canvas ref={canvasRef} className="block fixed inset-0 w-full h-full" />
}

export default DefenderGame
