import { useEffect, useRef } from 'react'

const SpaceInvadersGame = () => {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        let animationFrameId

        // Constants
        const PLAYER_WIDTH = 30
        const PLAYER_HEIGHT = 15
        const INVADER_WIDTH = 25
        const INVADER_HEIGHT = 20
        const BASE_SPEED = 2
        const BULLET_SPEED = 5
        const INVADER_SPEED = 1

        // Game State
        let state = {
            width: 0,
            height: 0,
            player: { x: 0, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, bullets: [], cooldown: 0 },
            invaders: [], // {x, y, active}
            invaderDir: 1, // 1 for right, -1 for left
            enemyBullets: [],
            score: 0
        }

        // Initialize logic
        const initGame = () => {
            state.player.x = state.width / 2 - PLAYER_WIDTH / 2

            // Create grid of invaders
            state.invaders = []
            const rows = 4
            const cols = 8
            const startX = state.width * 0.1
            const startY = 50

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    state.invaders.push({
                        x: startX + c * (INVADER_WIDTH + 15),
                        y: startY + r * (INVADER_HEIGHT + 15),
                        width: INVADER_WIDTH,
                        height: INVADER_HEIGHT,
                        active: true
                    })
                }
            }
            state.invaderDir = 1
            state.enemyBullets = []
            state.player.bullets = []
        }

        const resize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
            state.width = canvas.width
            state.height = canvas.height
            initGame()
        }

        window.addEventListener('resize', resize)
        resize()

        const update = () => {
            // --- PLAYER AI ---
            // 1. Dodge: Check for incoming bullets
            let moveDir = 0

            // Find closest dangerous bullet
            const dangerousBullet = state.enemyBullets
                .filter(b => b.y > state.height - 200 && Math.abs(b.x - (state.player.x + PLAYER_WIDTH / 2)) < 50)
                .sort((a, b) => b.y - a.y)[0] // closest to bottom

            if (dangerousBullet) {
                // Move away from bullet
                if (dangerousBullet.x > state.player.x + PLAYER_WIDTH / 2) {
                    moveDir = -1 // Left
                } else {
                    moveDir = 1 // Right
                }
            } else {
                // 2. Attack: Track nearest active invader column
                // Find bottom-most active invader logic could vary, but tracking 'x' average is simple
                const activeInvaders = state.invaders.filter(i => i.active)
                if (activeInvaders.length > 0) {
                    // Target a random active invader occasionally to create strafing
                    // Or just average X
                    const targetX = activeInvaders[Math.floor(Date.now() / 1000) % activeInvaders.length].x

                    if (targetX > state.player.x + PLAYER_WIDTH / 2 + 10) moveDir = 1
                    else if (targetX < state.player.x + PLAYER_WIDTH / 2 - 10) moveDir = -1
                }
            }

            // Apply Movement
            state.player.x += moveDir * BASE_SPEED
            // Clamp
            state.player.x = Math.max(10, Math.min(state.width - PLAYER_WIDTH - 10, state.player.x))

            // Shoot?
            if (state.player.cooldown > 0) state.player.cooldown--

            // Simple shooting logic: if aligned with an active invader
            const center = state.player.x + PLAYER_WIDTH / 2
            const aligned = state.invaders.some(i => i.active && Math.abs(i.x + INVADER_WIDTH / 2 - center) < 15)

            if (aligned && state.player.cooldown <= 0) {
                state.player.bullets.push({
                    x: state.player.x + PLAYER_WIDTH / 2 - 2,
                    y: state.height - PLAYER_HEIGHT - 10,
                    w: 4, h: 10
                })
                state.player.cooldown = 40 // frames
            }

            // --- UPDATE ENTITIES ---

            // Player Bullets
            state.player.bullets.forEach(b => b.y -= BULLET_SPEED)
            state.player.bullets = state.player.bullets.filter(b => b.y > 0)

            // Enemy Bullets
            state.enemyBullets.forEach(b => b.y += BULLET_SPEED)
            state.enemyBullets = state.enemyBullets.filter(b => b.y < state.height)

            // Invaders Movement
            let hitEdge = false
            // Find bounds
            const activeInvaders = state.invaders.filter(i => i.active)
            if (activeInvaders.length === 0) {
                // Reset if won
                initGame()
                return
            }

            const minX = Math.min(...activeInvaders.map(i => i.x))
            const maxX = Math.max(...activeInvaders.map(i => i.x + i.width))

            if ((maxX >= state.width - 20 && state.invaderDir === 1) ||
                (minX <= 20 && state.invaderDir === -1)) {
                state.invaderDir *= -1
                // Move down
                state.invaders.forEach(i => i.y += 20)

                // Reset if too low (Game Over scenario -> restart)
                if (Math.max(...activeInvaders.map(i => i.y)) > state.height - 100) {
                    initGame()
                    return
                }
            } else {
                state.invaders.forEach(i => i.x += state.invaderDir * INVADER_SPEED)
            }

            // Invader Shooting
            if (Math.random() < 0.02 && activeInvaders.length > 0) {
                const shooter = activeInvaders[Math.floor(Math.random() * activeInvaders.length)]
                state.enemyBullets.push({
                    x: shooter.x + INVADER_WIDTH / 2 - 2,
                    y: shooter.y + INVADER_HEIGHT,
                    w: 4, h: 10
                })
            }

            // --- COLLISIONS ---

            // Player Bullets hitting Invaders
            state.player.bullets.forEach((b, bIdx) => {
                state.invaders.forEach(inv => {
                    if (!inv.active) return
                    if (b.x < inv.x + inv.width &&
                        b.x + b.w > inv.x &&
                        b.y < inv.y + inv.height &&
                        b.y + b.h > inv.y) {
                        inv.active = false
                        // Remove bullet (hacky splice)
                        b.y = -100
                    }
                })
            })

            // Enemy Bullets hitting Player
            state.enemyBullets.forEach(b => {
                if (b.x < state.player.x + state.player.width &&
                    b.x + b.w > state.player.x &&
                    b.y < state.height - 20 && // Assuming player Y fixed near bottom
                    b.y + b.h > state.height - 20 - state.player.height) {
                    // Player hit -> restart
                    initGame()
                }
            })
        }

        const draw = () => {
            // Clear
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, state.width, state.height)

            ctx.fillStyle = '#000000'

            // Player
            ctx.fillRect(state.player.x, state.height - PLAYER_HEIGHT - 20, state.player.width, state.player.height)
            // Player "cannon"
            ctx.fillRect(state.player.x + state.player.width / 2 - 2, state.height - PLAYER_HEIGHT - 25, 4, 5)

            // Invaders
            state.invaders.forEach(i => {
                if (i.active) {
                    // Simple alien shape (rectangle with gaps?)
                    // Just rectangle for minimalism
                    ctx.fillRect(i.x, i.y, i.width, i.height)
                    // Eyes
                    ctx.clearRect(i.x + 5, i.y + 5, 4, 4)
                    ctx.clearRect(i.x + i.width - 9, i.y + 5, 4, 4)
                }
            })

            // Bullets
            state.player.bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h))

            // Enemy Bullets
            state.enemyBullets.forEach(b => {
                // Cross shape or zig zag? Just simple rect
                ctx.fillRect(b.x, b.y, b.w, b.h)
            })
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

    return <canvas ref={canvasRef} className="block fixed inset-0 w-full h-full cursor-none" />
}

export default SpaceInvadersGame
