import { useEffect, useRef } from 'react'
import { audioController } from '../utils/AudioController'

const MissileCommandGame = () => {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        let animationFrameId

        // CONSTANTS
        const SCREEN_WIDTH = 800
        const SCREEN_HEIGHT = 600
        const GROUND_Y = 550
        const MISSILE_SPEED_PLAYER = 15
        const MISSILE_SPEED_ENEMY_BASE = 1
        const EXPLOSION_RADIUS_MAX = 40
        const EXPLOSION_SPEED = 1

        // GAME STATE
        let score = 0
        let wave = 1
        let missilesLeftInWave = 10
        let spawning = true
        let spawnTimer = 0
        let gameOver = false
        let gameState = 'playing' // playing, waveEnd, gameOver

        // ENTITIES
        // Cities: 6 total
        const cities = [
            { x: 120, y: GROUND_Y, alive: true },
            { x: 200, y: GROUND_Y, alive: true },
            { x: 280, y: GROUND_Y, alive: true },
            { x: 520, y: GROUND_Y, alive: true },
            { x: 600, y: GROUND_Y, alive: true },
            { x: 680, y: GROUND_Y, alive: true }
        ]

        // Silos: 3 total
        const silos = [
            { x: 40, y: GROUND_Y - 20, ammo: 10, alive: true },
            { x: 400, y: GROUND_Y - 20, ammo: 10, alive: true },
            { x: 760, y: GROUND_Y - 20, ammo: 10, alive: true }
        ]

        let playerMissiles = []
        let enemyMissiles = []
        let explosions = []
        let crosshair = { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 }

        // MOUSE INPUT
        const handleMouseMove = (e) => {
            const rect = canvas.getBoundingClientRect()
            const scaleX = SCREEN_WIDTH / rect.width
            const scaleY = SCREEN_HEIGHT / rect.height
            crosshair.x = (e.clientX - rect.left) * scaleX
            crosshair.y = (e.clientY - rect.top) * scaleY
        }

        const handleClick = () => {
            if (gameOver || gameState !== 'playing') return

            // Find nearest silo with ammo
            let bestSilo = null
            let minDist = Infinity

            silos.forEach(silo => {
                if (silo.alive && silo.ammo > 0) {
                    const dist = Math.abs(silo.x - crosshair.x)
                    if (dist < minDist) {
                        minDist = dist
                        bestSilo = silo
                    }
                }
            })

            if (bestSilo) {
                bestSilo.ammo--
                fireMissile(bestSilo.x, bestSilo.y, crosshair.x, crosshair.y)
            } else {
                // Out of ammo sound?
            }
        }

        const fireMissile = (sx, sy, tx, ty) => {
            playerMissiles.push({
                x: sx, y: sy,
                startX: sx, startY: sy,
                targetX: tx, targetY: ty,
                speed: MISSILE_SPEED_PLAYER,
                color: '#00ffff'
            })
            audioController.playTone(600, 0.05, 'triangle') // Pew
        }

        const spawnExplosion = (x, y) => {
            explosions.push({
                x, y,
                radius: 1,
                growing: true,
                color: Math.random() > 0.5 ? '#ffffff' : '#ff0000'
            })
            audioController.playTone(100, 0.2, 'noise', 0.5) // Boom
        }

        const startWave = () => {
            missilesLeftInWave = 10 + (wave * 2)
            spawning = true
            gameState = 'playing'
            // Restock ammo? Original creates bonus points then restocks.
            // For simplicity: Reload all alive silos logic happens at end of wave
        }

        const nextWave = () => {
            wave++
            gameState = 'waveEnd'
            // Calculate Bonus
            let bonus = 0
            cities.forEach(c => { if (c.alive) bonus += 100 })
            silos.forEach(s => { if (s.alive) bonus += s.ammo * 50; s.ammo = 10; }) // Reload
            score += bonus

            // Check revive city logic (every N points usually) - skipped for now

            setTimeout(() => {
                if (!gameOver) startWave()
            }, 3000)
        }

        const checkGameOver = () => {
            if (cities.every(c => !c.alive)) {
                gameOver = true
                gameState = 'gameOver'
            }
        }

        const init = () => {
            console.log("Missile Command Init")
            resize()
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mousedown', handleClick)
            window.addEventListener('resize', resize)
            loop()
        }

        const resize = () => {
            if (!canvas || !ctx) return
            const dpr = window.devicePixelRatio || 1
            canvas.width = window.innerWidth * dpr
            canvas.height = window.innerHeight * dpr
            canvas.style.width = `${window.innerWidth}px`
            canvas.style.height = `${window.innerHeight}px`
            ctx.scale(dpr, dpr)
            ctx.imageSmoothingEnabled = false
        }

        const update = () => {
            if (gameState === 'gameOver') return

            // Scaling for mouse logic (re-calculated in draw mostly, but mouse event used rect)

            // --- SPAWNING ---
            if (spawning && gameState === 'playing') {
                spawnTimer--
                if (spawnTimer <= 0) {
                    if (missilesLeftInWave > 0) {
                        // Pick Target
                        const targets = [...cities, ...silos].filter(t => t.alive)
                        if (targets.length > 0) {
                            const target = targets[Math.floor(Math.random() * targets.length)]
                            enemyMissiles.push({
                                x: Math.random() * SCREEN_WIDTH,
                                y: 0,
                                startX: Math.random() * SCREEN_WIDTH, startY: 0,
                                targetX: target.x,
                                targetY: target.y,
                                speed: MISSILE_SPEED_ENEMY_BASE + (wave * 0.1),
                                color: '#ff0000',
                                active: true
                            })
                            missilesLeftInWave--
                            spawnTimer = Math.max(10, 100 - (wave * 5)) // Spawn rate increases
                        }
                    } else {
                        spawning = false
                    }
                }
            }

            // End Wave Check
            if (!spawning && enemyMissiles.length === 0 && explosions.length === 0 && gameState === 'playing') {
                nextWave()
            }

            // --- UPDATE PLAYER MISSILES ---
            playerMissiles.forEach(m => {
                const dx = m.targetX - m.x
                const dy = m.targetY - m.y
                const dist = Math.sqrt(dx * dx + dy * dy)

                if (dist < m.speed) {
                    // Reached Target
                    spawnExplosion(m.targetX, m.targetY)
                    m.dead = true
                } else {
                    const angle = Math.atan2(dy, dx)
                    m.x += Math.cos(angle) * m.speed
                    m.y += Math.sin(angle) * m.speed
                }
            })
            playerMissiles = playerMissiles.filter(m => !m.dead)

            // --- UPDATE ENEMY MISSILES ---
            enemyMissiles.forEach(m => {
                const dx = m.targetX - m.x
                const dy = m.targetY - m.y
                const dist = Math.sqrt(dx * dx + dy * dy)

                if (dist < m.speed) {
                    // Hit Target
                    spawnExplosion(m.targetX, m.targetY); // Semicolon added
                    m.dead = true; // Semicolon added

                    // Destroy Logic
                    // Check specific collision with structures
                    // Simple check: distance to any live target
                    [...cities, ...silos].forEach(t => {
                        if (t.alive && Math.abs(t.x - m.targetX) < 20) {
                            // Actually, let explosion logic kill them? 
                            // Or direct hit logic.
                            // Original: Direct hit destroys, explosion destroys.
                        }
                    })
                    // Let the explosion created by the enemy missile do the destruction
                } else {
                    const angle = Math.atan2(dy, dx)
                    m.x += Math.cos(angle) * m.speed
                    m.y += Math.sin(angle) * m.speed
                }
            })
            // Filter dead later

            // --- EXPLOSIONS ---
            explosions.forEach(e => {
                if (e.growing) {
                    e.radius += EXPLOSION_SPEED
                    if (e.radius >= EXPLOSION_RADIUS_MAX) e.growing = false
                } else {
                    e.radius -= EXPLOSION_SPEED
                    if (e.radius <= 0) e.dead = true
                }

                // Collision with Enemies
                enemyMissiles.forEach(m => {
                    const dx = m.x - e.x
                    const dy = m.y - e.y
                    const dist = Math.sqrt(dx * dx + dy * dy)
                    if (dist < e.radius) {
                        m.dead = true
                        score += 25
                        // Chain reaction? Maybe just one explosion per enemy
                        // spawnExplosion(m.x, m.y) // Makes it too easy?
                    }
                })

                // Collision with Structures
                // If explosion center is close to structure (Enemy warhead hit)
                // Actually, standard Missile Command: Enemy warhead creates explosion. 
                // Any structure touching that explosion dies.
                const targets = [...cities, ...silos]
                targets.forEach(t => {
                    if (t.alive) {
                        const dx = t.x - e.x
                        const dy = t.y - e.y // Structure y is center of base
                        if (Math.sqrt(dx * dx + dy * dy) < e.radius) {
                            t.alive = false
                            checkGameOver()
                        }
                    }
                })
            })
            explosions = explosions.filter(e => !e.dead)
            enemyMissiles = enemyMissiles.filter(m => !m.dead)

        }

        const draw = () => {
            // Scale
            const scaleX = window.innerWidth / SCREEN_WIDTH
            const scaleY = window.innerHeight / SCREEN_HEIGHT
            const scale = Math.min(scaleX, scaleY) * 0.95

            const transX = (window.innerWidth - SCREEN_WIDTH * scale) / 2
            const transY = (window.innerHeight - SCREEN_HEIGHT * scale) / 2

            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, window.innerWidth, window.innerHeight)

            ctx.save()
            ctx.translate(transX, transY)
            ctx.scale(scale, scale)

            // Clip
            ctx.beginPath()
            ctx.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
            ctx.clip()

            // Ground
            ctx.fillStyle = '#ffff00' // Yellow ground line
            ctx.fillRect(0, GROUND_Y, SCREEN_WIDTH, 5)

            // Cities
            ctx.fillStyle = '#0000ff' // Blue cities
            cities.forEach(c => {
                if (c.alive) {
                    // Simple City Shape
                    ctx.beginPath()
                    ctx.moveTo(c.x - 15, GROUND_Y)
                    ctx.lineTo(c.x - 15, GROUND_Y - 10)
                    ctx.lineTo(c.x - 5, GROUND_Y - 10)
                    ctx.lineTo(c.x, GROUND_Y - 20)
                    ctx.lineTo(c.x + 5, GROUND_Y - 10)
                    ctx.lineTo(c.x + 15, GROUND_Y - 10)
                    ctx.lineTo(c.x + 15, GROUND_Y)
                    ctx.fill()
                }
            })

            // Silos
            ctx.fillStyle = '#aaaaaa'
            silos.forEach(s => {
                if (s.alive) {
                    // Pyramid
                    ctx.beginPath()
                    ctx.moveTo(s.x - 20, GROUND_Y)
                    ctx.lineTo(s.x, GROUND_Y - 30) // Top
                    ctx.lineTo(s.x + 20, GROUND_Y)
                    ctx.fill()

                    // Ammo
                    ctx.fillStyle = '#ffffff'
                    // Draw missiles inside
                    for (let i = 0; i < s.ammo; i++) {
                        let row = 0
                        let col = i
                        if (i > 3) { row = 1; col = i - 4 }
                        if (i > 7) { row = 2; col = i - 8 }
                        // Just visualize roughly
                        ctx.fillRect(s.x - 12 + (col * 6), GROUND_Y - 10 + (row * 4), 4, 4)
                    }
                    ctx.fillStyle = '#aaaaaa' // Restore color
                }
            })

            // Player Missiles
            playerMissiles.forEach(m => {
                ctx.strokeStyle = '#0000ff' // Blue trail
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.moveTo(m.startX, m.startY)
                ctx.lineTo(m.x, m.y)
                ctx.stroke()

                // Warhead
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(m.x - 1, m.y - 1, 2, 2)

                // Target Marker (X)
                ctx.strokeStyle = '#ffffff'
                ctx.lineWidth = 1
                const tx = m.targetX, ty = m.targetY
                ctx.beginPath()
                ctx.moveTo(tx - 3, ty - 3); ctx.lineTo(tx + 3, ty + 3)
                ctx.moveTo(tx + 3, ty - 3); ctx.lineTo(tx - 3, ty + 3)
                ctx.stroke()
            })

            // Enemy Missiles
            enemyMissiles.forEach(m => {
                ctx.strokeStyle = '#ff0000' // Red trail
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.moveTo(m.startX, m.startY)
                ctx.lineTo(m.x, m.y)
                ctx.stroke()

                // Warhead
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(m.x - 1, m.y - 1, 2, 2)
            })

            // Explosions
            explosions.forEach(e => {
                ctx.fillStyle = e.color
                ctx.beginPath()
                ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2)
                ctx.fill()
            })

            // Crosshair
            ctx.strokeStyle = '#ff00ff'
            ctx.lineWidth = 2
            const cx = crosshair.x, cy = crosshair.y
            ctx.beginPath()
            ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy)
            ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10)
            ctx.stroke()

            // UI
            ctx.fillStyle = '#ff0000'
            ctx.font = '24px monospace'
            ctx.textAlign = 'center'
            ctx.fillText(`SCORE: ${score}`, SCREEN_WIDTH / 2, 30)
            ctx.fillStyle = '#0000ff'
            ctx.fillText(`WAVE: ${wave}`, SCREEN_WIDTH / 2, 60)

            if (gameState === 'waveEnd') {
                ctx.fillStyle = '#00ff00'
                ctx.font = '40px monospace'
                ctx.fillText(`WAVE COMPLETE`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2)
                ctx.font = '20px monospace'
                ctx.fillText(`BONUS POINTS`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 40)
            }

            if (gameState === 'gameOver') {
                ctx.fillStyle = '#ff0000'
                ctx.font = '60px monospace'
                ctx.fillText(`THE END`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2)
            }

            ctx.restore()
        }

        const loop = () => {
            update()
            draw()
            animationFrameId = requestAnimationFrame(loop)
        }
        init()

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mousedown', handleClick)
            window.removeEventListener('resize', resize)
            cancelAnimationFrame(animationFrameId)
        }
    }, [])

    return <canvas ref={canvasRef} className="block fixed inset-0 w-full h-full bg-black cursor-none" />
}

export default MissileCommandGame
