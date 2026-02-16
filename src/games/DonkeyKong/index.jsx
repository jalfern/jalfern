import React, { useEffect, useRef } from 'react'
import { audioController } from '../../utils/AudioController'
import PauseOverlay from '../../components/PauseOverlay'
import VirtualControls from '../../components/VirtualControls'
import { GAMES } from '../../config/games'

const DonkeyKongGame = () => {
    const canvasRef = useRef(null)
    const containerRef = useRef(null)
    const [paused, setPaused] = React.useState(false)
    const pausedRef = useRef(false)

    // Resume callback
    const handleResume = () => {
        setPaused(false)
        pausedRef.current = false
        canvasRef.current?.focus()
    }

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        let animationFrameId

        // Game Constants
        const GRAVITY = 0.4
        const JUMP_FORCE = -8
        const SPEED = 3
        const LADDER_SPEED = 2

        // Colors (Strict B&W)
        const COLOR_LADDER = '#cccccc'
        const COLOR_BARREL = '#ffffff'
        const COLOR_PLATFORM = '#ffffff'

        let state = {
            width: 0,
            height: 0,
            player: {
                x: 50, y: 0, w: 20, h: 20,
                vx: 0, vy: 0,
                grounded: false,
                climbing: false,
                dead: false,
                dir: 1,
                frame: 0
            },
            platforms: [],
            ladders: [],
            barrels: [],
            score: 0,
            level: 1,
            barrelTimer: 0,
            dkFrame: 0,
            isAttractMode: true
        }

        // Input
        const keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false,
            Space: false
        }

        const createLevel = () => {
            const w = state.width
            const h = state.height
            const gap = 90 // Vertical gap

            state.platforms = [
                { x: 0, y: h - 20, w: w, h: 20 },
                { x: 0, y: h - 20 - gap, w: w - 60, h: 20 },
                { x: 60, y: h - 20 - gap * 2, w: w - 60, h: 20 },
                { x: 0, y: h - 20 - gap * 3, w: w - 60, h: 20 },
                { x: 60, y: h - 20 - gap * 4, w: w - 60, h: 20 },
                { x: 0, y: h - 20 - gap * 5, w: w - 60, h: 20 },
                { x: w / 2 - 60, y: h - 20 - gap * 6, w: 120, h: 20 }
            ]

            state.ladders = [
                { x: w - 100, y: h - 20 - gap, h: gap },
                { x: 100, y: h - 20 - gap * 2, h: gap },
                { x: w - 100, y: h - 20 - gap * 3, h: gap },
                { x: 100, y: h - 20 - gap * 4, h: gap },
                { x: w - 100, y: h - 20 - gap * 5, h: gap },
                { x: w / 2, y: h - 20 - gap * 5, h: gap },
                { x: w / 2 - 40, y: h - 20 - gap * 6, h: gap },
                { x: w / 2 + 40, y: h - 20 - gap * 6, h: gap }
            ]

            state.player.x = 20
            state.player.y = h - 50
            state.player.vx = 0
            state.player.vy = 0
            state.barrels = []
        }

        const resize = () => {
            if (containerRef.current && canvas) {
                const { width, height } = containerRef.current.getBoundingClientRect()
                canvas.width = width
                canvas.height = height
                state.width = width
                state.height = height
                createLevel()
            }
        }
        window.addEventListener('resize', resize)
        resize()

        const handleKeyDown = (e) => {
            if (e.key === '?' || (e.shiftKey && e.key === '/')) {
                const newState = !pausedRef.current
                pausedRef.current = newState
                setPaused(newState)
                return
            }
            if (pausedRef.current) return

            if (state.isAttractMode) {
                state.isAttractMode = false
            }
            if (keys.hasOwnProperty(e.code)) {
                keys[e.code] = true
            }
            if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'Space') {
                e.preventDefault()
            }
        }
        const handleKeyUp = (e) => {
            if (keys.hasOwnProperty(e.code)) {
                keys[e.code] = false
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        const AABB = (r1, r2) => {
            return r1.x < r2.x + r2.w &&
                r1.x + r1.w > r2.x &&
                r1.y < r2.y + r2.h &&
                r1.y + r1.h > r2.y
        }

        const update = () => {
            state.player.frame++
            state.dkFrame++

            if (state.player.dead) {
                if (state.player.frame % 180 === 0) {
                    state.player.dead = false
                    createLevel()
                }
                return
            }

            let move = 0
            let jump = false
            let climbUp = false
            let climbDown = false

            // --- AI & CONTROL LOGIC ---
            if (state.isAttractMode) {
                // AI LOGIC (Original)
                // 1. Find nearest ladder going UP
                const nearbyLadder = state.ladders.find(l =>
                    Math.abs(l.y + l.h - (state.player.y + state.player.h)) < 20 &&
                    Math.abs((state.player.x + state.player.w / 2) - l.x) < 30
                )

                if (state.player.climbing) {
                    climbUp = true
                } else if (nearbyLadder) {
                    if (state.player.y > state.platforms[state.platforms.length - 1].y + 20) {
                        climbUp = true
                    } else {
                        if (state.player.x < state.width / 2) move = 1
                        else move = -1
                    }
                } else {
                    if (state.player.x < 50) state.player.dir = 1
                    if (state.player.x > state.width - 50) state.player.dir = -1
                    move = state.player.dir
                }

                // Barrel Avoidance
                const approachingBarrel = state.barrels.find(b =>
                    Math.abs(b.y - state.player.y) < 30 &&
                    Math.abs(b.x - state.player.x) < 70 &&
                    Math.sign(b.vx) !== Math.sign(move)
                )
                if (approachingBarrel && state.player.grounded) {
                    jump = true
                }
            } else {
                // MANUAL CONTROL
                if (keys.ArrowLeft) move = -1
                if (keys.ArrowRight) move = 1
                if (keys.ArrowUp) climbUp = true
                if (keys.ArrowDown) climbDown = true
                if (keys.Space && state.player.grounded) jump = true
            }

            // MOVEMENT APPLICATION
            // Check ladder interaction for manual/AI
            // Find ladder intersection
            const ladder = state.ladders.find(l =>
                state.player.x + state.player.w > l.x - 10 &&
                state.player.x < l.x + 10 &&
                state.player.y + state.player.h > l.y &&
                state.player.y < l.y + l.h + state.player.h
            )

            if (state.player.climbing) {
                if (climbUp || climbDown) {
                    state.player.y += (climbUp ? -1 : 1) * LADDER_SPEED
                    state.player.frame++ // Animate climb
                }
                // Check top/bottom of ladder
                // If at bottom and pressing down, dismount?
                // If at top

                // Fall off ladder if not overlaps
                if (!ladder) {
                    state.player.climbing = false
                }
            } else {
                // Try to mount ladder
                if (ladder && (climbUp || climbDown)) {
                    // Snap to ladder x
                    if (Math.abs((state.player.x + state.player.w / 2) - ladder.x) < 20) {
                        state.player.x = ladder.x - state.player.w / 2
                        state.player.climbing = true
                        state.player.vx = 0
                    }
                }

                if (!state.player.climbing) {
                    state.player.vx = move * SPEED
                    if (move !== 0) state.player.dir = move

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
            } else {
                state.player.vy = 0
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
                    if (!state.player.climbing || (state.player.climbing && climbDown && state.player.y + state.player.h >= p.y)) {
                        // Land logic
                        // If climbing down and hit ground, dismount
                        if (state.player.climbing && state.player.y + state.player.h >= p.y) state.player.climbing = false

                        if (!state.player.climbing) {
                            state.player.grounded = true
                            state.player.vy = 0
                            state.player.y = p.y - state.player.h
                        }
                    }
                }
            })

            // Wall Constraints
            if (state.player.x < 0) state.player.x = 0
            if (state.player.x > state.width - state.player.w) state.player.x = state.width - state.player.w

            // --- BARRELS ---
            if (state.barrelTimer-- <= 0) {
                state.barrels.push({
                    x: 60, y: 150,
                    w: 16, h: 16,
                    vx: 2, vy: 0, rot: 0
                })
                state.barrelTimer = 220
            }

            state.barrels.forEach(b => {
                b.vy += GRAVITY
                b.x += b.vx
                b.y += b.vy
                b.rot += b.vx * 0.15

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

                if (b.x <= 10 && b.vx < 0) b.vx = -b.vx
                if (b.x >= state.width - 26 && b.vx > 0) b.vx = -b.vx

                if (AABB(state.player, b)) {
                    state.player.dead = true
                    audioController.playNoise(0.5, 0.4)
                }
            })
            state.barrels = state.barrels.filter(b => b.y < state.height)

            // Win
            if (state.player.y < state.platforms[state.platforms.length - 1].y - 20) {
                createLevel()
                audioController.playSweep(400, 800, 0.5, 'square')
            }
        }

        // DRAWING
        const drawGirder = (x, y, w, h) => {
            ctx.fillStyle = 'black'
            ctx.fillRect(x, y, w, h)
            ctx.strokeStyle = '#ffffff' // Force white stroke for B&W
            ctx.lineWidth = 1
            ctx.strokeRect(x, y, w, h)

            ctx.beginPath()
            ctx.moveTo(x, y + 3); ctx.lineTo(x + w, y + 3)
            ctx.moveTo(x, y + h - 3); ctx.lineTo(x + w, y + h - 3)
            for (let i = x; i < x + w; i += 10) {
                ctx.moveTo(i, y + 3); ctx.lineTo(i + 5, y + h - 3)
                ctx.moveTo(i + 5, y + h - 3); ctx.lineTo(i + 10, y + 3)
            }
            ctx.stroke()
        }

        const drawOilDrum = (x, y) => {
            ctx.fillStyle = 'black'
            ctx.strokeStyle = 'white'
            ctx.lineWidth = 2
            ctx.strokeRect(x, y - 30, 25, 30)
            ctx.beginPath()
            ctx.moveTo(x, y - 20); ctx.lineTo(x + 25, y - 20)
            ctx.moveTo(x, y - 10); ctx.lineTo(x + 25, y - 10)
            ctx.stroke()
            ctx.fillStyle = 'white'
            ctx.font = '10px monospace'
            ctx.fillText("OIL", x + 4, y - 12)
            if (Math.random() > 0.5) {
                ctx.beginPath()
                ctx.moveTo(x + 5, y - 30)
                ctx.lineTo(x + 12, y - 40 - Math.random() * 5)
                ctx.lineTo(x + 20, y - 30)
                ctx.stroke()
            }
        }

        const drawDK = (x, y) => {
            const scale = 2
            ctx.save()
            ctx.translate(x, y)
            ctx.scale(scale, scale)
            ctx.fillStyle = 'white'
            const beat = Math.floor(Date.now() / 200) % 2 === 0
            if (beat) {
                ctx.fillRect(5, 5, 30, 20)
                ctx.fillRect(0, 5, 5, 15)
                ctx.fillRect(35, 5, 5, 15)
            } else {
                ctx.fillRect(5, 5, 30, 20)
                ctx.fillRect(10, 10, 5, 15)
                ctx.fillRect(25, 10, 5, 15)
            }
            ctx.fillRect(12, 0, 16, 12)
            ctx.fillRect(12, 4, 20, 4)
            ctx.fillStyle = 'black'
            ctx.fillRect(14, 8, 12, 2)
            ctx.fillStyle = 'white'
            ctx.fillRect(5, 25, 10, 10)
            ctx.fillRect(25, 25, 10, 10)
            ctx.restore()
        }

        const drawPauline = (x, y) => {
            ctx.fillStyle = 'white'
            ctx.beginPath()
            ctx.moveTo(x, y); ctx.lineTo(x + 10, y - 20); ctx.lineTo(x + 20, y);
            ctx.fill()
            ctx.fillRect(x + 7, y - 26, 6, 6)
            if (Math.floor(Date.now() / 300) % 2 === 0) {
                ctx.strokeStyle = 'white'
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.moveTo(x + 5, y - 15); ctx.lineTo(x, y - 25)
                ctx.moveTo(x + 15, y - 15); ctx.lineTo(x + 20, y - 25)
                ctx.stroke()
                ctx.font = '10px monospace'
                ctx.fillText("HELP!", x + 25, y - 25)
            }
        }

        const drawMario = (ctx, x, y, w, h, dir, frame, climbing) => {
            ctx.save()
            ctx.translate(x + w / 2, y + h)
            ctx.scale(dir, 1)
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(-6, -12, 12, 10)
            ctx.fillRect(-5, -18, 10, 6)
            ctx.fillRect(2, -18, 4, 2)

            const legOffset = (frame % 10 < 5) ? 2 : -2
            if (climbing) {
                ctx.fillRect(-6, -2, 4, 4 + legOffset)
                ctx.fillRect(2, -2, 4, 4 - legOffset)
            } else if (Math.abs(state.player.vx) > 0.1) {
                ctx.fillRect(-6 + legOffset, -2, 4, 4)
                ctx.fillRect(2 - legOffset, -2, 4, 4)
            } else {
                ctx.fillRect(-6, -2, 4, 4)
                ctx.fillRect(2, -2, 4, 4)
            }

            const hammerUp = frame % 20 < 10
            ctx.fillStyle = '#ffffff'
            if (hammerUp) {
                ctx.fillRect(4, -20, 4, 10)
                ctx.fillRect(2, -24, 8, 5)
            } else {
                ctx.fillRect(8, -14, 10, 4)
                ctx.fillRect(16, -18, 5, 12)
            }
            ctx.restore()
        }

        const draw = () => {
            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, state.width, state.height)

            state.platforms.forEach(p => {
                drawGirder(p.x, p.y, p.w, p.h)
            })

            ctx.fillStyle = COLOR_LADDER
            state.ladders.forEach(l => {
                for (let y = l.y; y < l.y + l.h; y += 8) {
                    ctx.fillRect(l.x - 8, y, 16, 2)
                }
                ctx.fillRect(l.x - 8, l.y, 2, l.h)
                ctx.fillRect(l.x + 8, l.y, 2, l.h)
            })

            drawOilDrum(40, state.height - 20)
            const dkPlat = state.platforms[state.platforms.length - 2]
            drawDK(dkPlat.x + 10, dkPlat.y - 70)
            const topPlat = state.platforms[state.platforms.length - 1]
            drawPauline(topPlat.x + topPlat.w / 2 - 10, topPlat.y)

            if (!state.player.dead) {
                drawMario(ctx, state.player.x, state.player.y, state.player.w, state.player.h, state.player.dir, state.player.frame, state.player.climbing)
            } else {
                ctx.strokeStyle = 'white'
                ctx.strokeRect(state.player.x, state.player.y, state.player.w, state.player.h)
            }

            ctx.strokeStyle = COLOR_BARREL
            ctx.lineWidth = 2
            state.barrels.forEach(b => {
                ctx.save()
                ctx.translate(b.x + b.w / 2, b.y + b.h / 2)
                ctx.rotate(b.rot)
                ctx.beginPath()
                ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2)
                ctx.stroke()
                ctx.beginPath()
                ctx.moveTo(-b.w / 2, 0); ctx.lineTo(b.w / 2, 0)
                ctx.moveTo(0, -b.w / 2); ctx.lineTo(0, b.w / 2)
                ctx.stroke()
                ctx.restore()
            })

            if (state.isAttractMode) {
                ctx.fillStyle = '#ffffff'
                ctx.font = '20px monospace'
                ctx.textAlign = 'center'
                ctx.fillText("PRESS ANY KEY TO START", state.width / 2, state.height - 50)
                ctx.fillText("ATTRACT MODE", state.width / 2, 50)
            }
        }

        const loop = () => {
            if (!pausedRef.current) {
                update()
                draw()
            }
            animationFrameId = requestAnimationFrame(loop)
        }
        loop()

        return () => {
            window.removeEventListener('resize', resize)
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
            cancelAnimationFrame(animationFrameId)
        }
    }, [])

    return (
        <div className="fixed inset-0 bg-black flex items-center justify-center p-4">
            <div ref={containerRef} className="relative w-full max-w-[600px] aspect-[3/4] border-2 border-neutral-800 rounded-lg overflow-hidden shadow-2xl shadow-neutral-900 bg-black">
                <canvas ref={canvasRef} className="block w-full h-full" />
                {paused && <PauseOverlay game={GAMES.find(g => g.label === 'DONKEY KONG')} onResume={handleResume} />}
            </div>
            <VirtualControls />
        </div>
    )
}

export default DonkeyKongGame
