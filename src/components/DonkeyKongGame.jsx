import { useEffect, useRef } from 'react'
import { audioController } from '../utils/AudioController'

const DonkeyKongGame = () => {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        let animationFrameId

        // Game Constants
        const GRAVITY = 0.4
        const JUMP_FORCE = -8
        const SPEED = 3
        const LADDER_SPEED = 2
        const BARREL_SPEED = 2

        // Colors
        const COLOR_PLATFORM = '#ff00ff' // Neon Pink
        const COLOR_LADDER = '#00ffff'   // Cyan
        const COLOR_PLAYER = '#ffffff'
        const COLOR_BARREL = '#ff9900'   // Orange
        const COLOR_DK = '#8b4513'       // Brown

        let state = {
            width: 0,
            height: 0,
            player: {
                x: 50, y: 0, w: 20, h: 20,
                vx: 0, vy: 0,
                grounded: false,
                climbing: false,
                dead: false
            },
            platforms: [],
            ladders: [],
            barrels: [],
            score: 0,
            level: 1,
            barrelTimer: 0
        }

        const createLevel = () => {
            const w = state.width
            const h = state.height
            const ground = h - 20

            // Generate zig-zag platforms
            state.platforms = [
                // Ground
                { x: 0, y: ground, w: w, h: 20 },
                // 1st Floor (Angle Right)
                { x: 0, y: ground - 80, w: w - 80, h: 20, angle: 0.02 },
                // 2nd Floor (Angle Left)
                { x: 80, y: ground - 160, w: w - 80, h: 20, angle: -0.02 },
                // 3rd Floor (Angle Right)
                { x: 0, y: ground - 240, w: w - 80, h: 20, angle: 0.02 },
                // 4th Floor (Angle Left)
                { x: 80, y: ground - 320, w: w - 80, h: 20, angle: -0.02 },
                // Top Floor (DK)
                { x: 0, y: ground - 400, w: w / 2, h: 20, angle: 0 },
                // Pauline / Goal platform
                { x: w / 2 + 40, y: ground - 440, w: 100, h: 20, angle: 0 }
            ]

            // Calculate actual Y positions for slanted platforms (simplified: just flat for now for MVP, collision is hard with slopes in 5 min)
            // Wait, slopes are iconic. Let's do FLAT first to ensure playable, then maybe slope visual only.
            // Actually, for barrels to roll, we need logic. Let's start with flat platforms but "pretend" roll logic or just AI movement.
            // Simplified: Barrels move towards edge, fall, switch direction.

            // Adjust platforms to be flat for MVP constraints
            state.platforms = [
                { x: 0, y: h - 10, w: w, h: 10 },
                { x: 0, y: h - 100, w: w - 50, h: 10 },
                { x: 50, y: h - 190, w: w - 50, h: 10 },
                { x: 0, y: h - 280, w: w - 50, h: 10 },
                { x: 50, y: h - 370, w: w - 50, h: 10 },
                { x: 20, y: h - 460, w: 200, h: 10 } // Top
            ]

            // Ladders
            state.ladders = [
                { x: w - 100, y: h - 100, h: 90 },
                { x: 100, y: h - 190, h: 90 },
                { x: w - 100, y: h - 280, h: 90 },
                { x: 100, y: h - 370, h: 90 },
                { x: w / 2, y: h - 460, h: 90 }
            ]

            state.player.x = 20
            state.player.y = h - 40
            state.player.vx = 0
            state.player.vy = 0
            state.barrels = []
        }

        const resize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
            state.width = canvas.width
            state.height = canvas.height
            createLevel()
        }
        window.addEventListener('resize', resize)
        resize()

        const AABB = (r1, r2) => {
            return r1.x < r2.x + r2.w &&
                r1.x + r1.w > r2.x &&
                r1.y < r2.y + r2.h &&
                r1.y + r1.h > r2.y
        }

        const update = () => {
            if (state.player.dead) {
                if (Math.random() < 0.01) {
                    state.player.dead = false
                    createLevel()
                }
                return
            }

            // --- PLAYER CONTROL (Simulated AI for self-playing) ---
            // Simple logic: Climb nearest ladder if above, otherwise move towards it

            // Find target ladder (one that leads up)
            // Or just target "top"
            const targetY = 100
            let moveDir = 0
            let jump = false
            let tryClimb = false

            // Identify current floor
            // Find valid ladder to go UP
            // Simple AI: Move towards center X, check for ladders

            // Actually, simpler: Just move right on even floors, left on odd?
            // Let's just seek the ladder that is closest in Y but above us
            const nearbyLadder = state.ladders.find(l =>
                Math.abs(l.y + l.h - (state.player.y + state.player.h)) < 5 && // Bottom of ladder is near feet
                Math.abs(state.player.x - l.x) < 20 // Close to it
            )

            if (nearbyLadder && state.player.y > targetY + 100) {
                tryClimb = true
            } else {
                // Move towards the next necessary ladder
                // If on bottom floor (y ~ h-10), target ladder at w-100
                // Hardcoded flow for MVP AI

                // Logic: if not climbing, move towards the "Up" ladder for this level
                // Determine level by Y
                // Level 0 (Bottom): Go Right
                // Level 1: Go Left
                // Level 2: Go Right
                // etc

                const levelHeight = 90
                const currentLevel = Math.floor((state.height - state.player.y) / levelHeight)

                if (currentLevel % 2 === 0) {
                    moveDir = 1 // Right
                } else {
                    moveDir = -1 // Left
                }
            }

            // Barrel Avoidance (Jump)
            const approachingBarrel = state.barrels.find(b =>
                Math.abs(b.y - state.player.y) < 20 && // Same level
                Math.abs(b.x - state.player.x) < 60 && // Close
                Math.sign(b.vx) !== Math.sign(moveDir) // Coming at us (roughly)
            )

            if (approachingBarrel && state.player.grounded) {
                jump = true
            }

            // Apply Input
            if (state.player.climbing) {
                state.player.y -= LADDER_SPEED
                state.player.vx = 0
                // Stop climbing if top reached
                if (state.platforms.some(p => Math.abs((state.player.y + state.player.h) - p.y) < 5)) {
                    state.player.climbing = false
                    state.player.y -= 5 // Pop up
                }
            } else {
                if (tryClimb) {
                    state.player.climbing = true
                    state.player.x = nearbyLadder.x - state.player.w / 2 // Snap
                } else {
                    state.player.vx = moveDir * SPEED
                    if (jump) {
                        state.player.vy = JUMP_FORCE
                        state.player.grounded = false
                        audioController.playTone(300, 0.1, 'square')
                    }
                }
            }

            // Gravity
            if (!state.player.climbing) {
                state.player.vy += GRAVITY
                state.player.y += state.player.vy
                state.player.x += state.player.vx
            }

            // Ground Collision
            state.player.grounded = false
            state.platforms.forEach(p => {
                // Check if feet falling through top of platform
                if (state.player.vy >= 0 && // Falling
                    state.player.y + state.player.h >= p.y && // Feet below top
                    state.player.y + state.player.h <= p.y + 20 && // Not too far down
                    state.player.x + state.player.w > p.x && // Within X bounds
                    state.player.x < p.x + p.w
                ) {
                    state.player.grounded = true
                    state.player.vy = 0
                    state.player.y = p.y - state.player.h
                    state.player.climbing = false
                }
            })

            // Wall Constraints
            if (state.player.x < 0) state.player.x = 0
            if (state.player.x > state.width - state.player.w) state.player.x = state.width - state.player.w

            // --- BARRELS ---
            if (state.barrelTimer-- <= 0) {
                state.barrels.push({
                    x: 20, y: state.height - 480, w: 15, h: 15,
                    vx: 2, vy: 0
                })
                state.barrelTimer = 180 // 3 seconds
            }

            state.barrels.forEach(b => {
                b.vy += GRAVITY
                b.x += b.vx
                b.y += b.vy

                // Platform collisions
                state.platforms.forEach(p => {
                    if (b.vy >= 0 &&
                        b.y + b.h >= p.y &&
                        b.y + b.h <= p.y + 20 &&
                        b.x + b.w > p.x &&
                        b.x < p.x + p.w
                    ) {
                        b.vy = 0
                        b.y = p.y - b.h
                    }
                })

                // Reverse at edges if grounded?
                // Or just fall off. 
                // Simple AI logic: flip vx based on level index?
                // Hacky check: if moving Right and no platform under right edge -> Keep moving to fall
                // But if grounded, maybe flip? No, barrels just roll off.
                // But we need them to zigzag.
                // Map levels to directions?
                const levelH = 90
                const bLevel = Math.floor((state.height - b.y) / levelH)
                // If on ground (level 0), roll Left (-vx)
                // Level 1: Right
                // Level 2: Left

                // Only correct vx if grounded
                if (b.vy === 0) {
                    if (bLevel % 2 === 0) b.vx = -BARREL_SPEED
                    else b.vx = BARREL_SPEED
                }

                // Player Collision
                if (AABB(state.player, b)) {
                    state.player.dead = true
                    audioController.playNoise(0.5, 0.4)
                }
            })

            // Cleanup Barrels
            state.barrels = state.barrels.filter(b => b.y < state.height)

            // Win
            if (state.player.y < 100) {
                createLevel() // Restart
                audioController.playSweep(400, 800, 0.5, 'square')
            }
        }

        const draw = () => {
            // Clear (Black)
            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, state.width, state.height)

            // Platforms
            ctx.fillStyle = COLOR_PLATFORM
            state.platforms.forEach(p => {
                ctx.fillRect(p.x, p.y, p.w, p.h)
            })

            // Ladders
            ctx.fillStyle = COLOR_LADDER
            state.ladders.forEach(l => {
                // Draw rungs
                for (let y = l.y; y < l.y + l.h; y += 10) {
                    ctx.fillRect(l.x - 10, y, 20, 2)
                }
                // Sides
                ctx.fillRect(l.x - 10, l.y, 2, l.h)
                ctx.fillRect(l.x + 10, l.y, 2, l.h)
            })

            // Player (Mario-ish)
            ctx.fillStyle = state.player.dead ? 'red' : COLOR_PLAYER
            ctx.fillRect(state.player.x, state.player.y, state.player.w, state.player.h)

            // Barrels
            ctx.fillStyle = COLOR_BARREL
            state.barrels.forEach(b => {
                ctx.beginPath()
                ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, Math.PI * 2)
                ctx.fill()
            })

            // DK (Top Left)
            ctx.fillStyle = COLOR_DK
            ctx.fillRect(20, state.height - 480 - 40, 40, 40)
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

export default DonkeyKongGame
