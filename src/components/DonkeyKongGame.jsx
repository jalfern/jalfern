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

        // Colors (Strict B&W)
        const COLOR_PLATFORM = '#ffffff'
        const COLOR_LADDER = '#cccccc'
        const COLOR_PLAYER = '#ffffff'
        const COLOR_BARREL = '#ffffff'
        const COLOR_DK = '#ffffff'

        let state = {
            width: 0,
            height: 0,
            player: {
                x: 50, y: 0, w: 20, h: 20,
                vx: 0, vy: 0,
                grounded: false,
                climbing: false,
                dead: false,
                dir: 1, // 1 right, -1 left
                frame: 0
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

            state.platforms = [
                { x: 0, y: h - 10, w: w, h: 10 },
                { x: 0, y: h - 100, w: w - 50, h: 10 },
                { x: 50, y: h - 190, w: w - 50, h: 10 },
                { x: 0, y: h - 280, w: w - 50, h: 10 },
                { x: 50, y: h - 370, w: w - 50, h: 10 },
                { x: 20, y: h - 460, w: 200, h: 10 } // Top
            ]

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
            // Anim frame
            state.player.frame++

            if (state.player.dead) {
                if (Math.random() < 0.01) {
                    state.player.dead = false
                    createLevel()
                }
                return
            }

            const targetY = 100
            let moveDir = 0
            let jump = false
            let tryClimb = false

            // Simple AI
            const nearbyLadder = state.ladders.find(l =>
                Math.abs(l.y + l.h - (state.player.y + state.player.h)) < 5 &&
                Math.abs(state.player.x - l.x) < 20
            )

            if (nearbyLadder && state.player.y > targetY + 100) {
                tryClimb = true
            } else {
                const levelHeight = 90
                const currentLevel = Math.floor((state.height - state.player.y) / levelHeight)

                if (currentLevel % 2 === 0) {
                    moveDir = 1
                } else {
                    moveDir = -1
                }
            }

            if (moveDir !== 0) state.player.dir = moveDir

            // Barrel Avoidance (Jump)
            const approachingBarrel = state.barrels.find(b =>
                Math.abs(b.y - state.player.y) < 20 &&
                Math.abs(b.x - state.player.x) < 60 &&
                Math.sign(b.vx) !== Math.sign(moveDir)
            )

            if (approachingBarrel && state.player.grounded) {
                jump = true
            }

            // Apply Input
            if (state.player.climbing) {
                state.player.y -= LADDER_SPEED
                state.player.vx = 0
                if (state.platforms.some(p => Math.abs((state.player.y + state.player.h) - p.y) < 5)) {
                    state.player.climbing = false
                    state.player.y -= 5
                }
            } else {
                if (tryClimb) {
                    state.player.climbing = true
                    state.player.x = nearbyLadder.x - state.player.w / 2
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
                if (state.player.vy >= 0 &&
                    state.player.y + state.player.h >= p.y &&
                    state.player.y + state.player.h <= p.y + 20 &&
                    state.player.x + state.player.w > p.x &&
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
                    vx: 2, vy: 0, rot: 0
                })
                state.barrelTimer = 180
            }

            state.barrels.forEach(b => {
                b.vy += GRAVITY
                b.x += b.vx
                b.y += b.vy
                b.rot += b.vx * 0.1

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

                const levelH = 90
                const bLevel = Math.floor((state.height - b.y) / levelH)

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

            state.barrels = state.barrels.filter(b => b.y < state.height)

            // Win
            if (state.player.y < 100) {
                createLevel()
                audioController.playSweep(400, 800, 0.5, 'square')
            }
        }

        const drawMario = (ctx, x, y, w, h, dir, frame, climbing) => {
            ctx.save()
            // Center
            ctx.translate(x + w / 2, y + h)
            ctx.scale(dir, 1) // Flip for facing direction

            ctx.fillStyle = '#ffffff'

            // Body (Stout)
            ctx.fillRect(-6, -12, 12, 10)

            // Head
            ctx.fillRect(-5, -18, 10, 6)
            // Hat visor
            ctx.fillRect(2, -18, 4, 2)

            // Legs (Simple animation)
            const legOffset = (frame % 10 < 5) ? 2 : -2
            if (climbing) {
                // Climbing anim
                ctx.fillRect(-6, -2, 4, 4 + legOffset)
                ctx.fillRect(2, -2, 4, 4 - legOffset)
            } else if (Math.abs(state.player.vx) > 0.1) {
                // Walking
                ctx.fillRect(-6 + legOffset, -2, 4, 4)
                ctx.fillRect(2 - legOffset, -2, 4, 4)
            } else {
                // Standing
                ctx.fillRect(-6, -2, 4, 4)
                ctx.fillRect(2, -2, 4, 4)
            }

            // Arm / Hammer
            // Hammer Smashing animation
            const hammerUp = frame % 20 < 10
            ctx.fillStyle = '#ffffff'

            if (hammerUp) {
                // Hammer Up
                ctx.fillRect(4, -20, 4, 10) // Handle
                ctx.fillRect(2, -24, 8, 5)  // Head
            } else {
                // Hammer Down
                ctx.fillRect(8, -14, 10, 4) // Handle
                ctx.fillRect(16, -18, 5, 12) // Head
            }

            ctx.restore()
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
                for (let y = l.y; y < l.y + l.h; y += 10) {
                    ctx.fillRect(l.x - 10, y, 20, 2)
                }
                ctx.fillRect(l.x - 10, l.y, 2, l.h)
                ctx.fillRect(l.x + 10, l.y, 2, l.h)
            })

            // Player (Mario-ish)
            if (!state.player.dead) {
                drawMario(ctx, state.player.x, state.player.y, state.player.w, state.player.h, state.player.dir, state.player.frame, state.player.climbing)
            } else {
                // Dead sprite (simple cross)
                ctx.strokeStyle = '#ffffff'
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.moveTo(state.player.x, state.player.y)
                ctx.lineTo(state.player.x + state.player.w, state.player.y + state.player.h)
                ctx.moveTo(state.player.x + state.player.w, state.player.y)
                ctx.lineTo(state.player.x, state.player.y + state.player.h)
                ctx.stroke()
            }

            // Barrels
            ctx.fillStyle = COLOR_BARREL
            ctx.strokeStyle = '#000000'
            state.barrels.forEach(b => {
                ctx.save()
                ctx.translate(b.x + b.w / 2, b.y + b.h / 2)
                ctx.rotate(b.rot)
                ctx.beginPath()
                ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2)
                ctx.fill()
                // Internal lines to show roll
                ctx.beginPath()
                ctx.moveTo(-b.w / 2, 0); ctx.lineTo(b.w / 2, 0);
                ctx.moveTo(0, -b.w / 2); ctx.lineTo(0, b.w / 2);
                ctx.stroke()
                ctx.restore()
            })

            // DK (Top Left) - Crude sprite
            ctx.fillStyle = COLOR_DK
            ctx.fillRect(20, state.height - 480 - 40, 40, 40)
            // Eyes
            ctx.fillStyle = 'black'
            ctx.fillRect(25, state.height - 480 - 35, 5, 5)
            ctx.fillRect(35, state.height - 480 - 35, 5, 5)
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
