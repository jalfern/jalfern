import { useEffect, useRef } from 'react'
import { audioController } from '../utils/AudioController'

const PitfallGame = () => {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        let animationFrameId

        // CONSTANTS
        const SCREEN_WIDTH = 800 // Virtual Width
        const SCREEN_HEIGHT = 600
        const GROUND_Y = 450
        const UNDERGROUND_Y = 550
        const PLAYER_SPEED = 4
        const JUMP_FORCE = -12
        const GRAVITY = 0.6

        // GAME STATE
        let currentScreen = 0
        let score = 2000
        let timeLeft = 20 * 60 // 20 minutes
        let gameOver = false

        // INPUT
        const keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false,
            Space: false
        }

        // PLAYER
        let player = {
            x: 50,
            y: GROUND_Y,
            w: 16,
            h: 32,
            vx: 0,
            vy: 0,
            state: 'idle', // idle, run, jump, climb, swing, dead
            onGround: true,
            onLadder: false,
            vine: null // Attach to vine object
        }

        // WORLD DEFINITION
        // Types: 'ground', 'water', 'pit', 'quicksand'
        // Objects: 'log', 'croc', 'ladder', 'vine', 'treasure', 'wall'
        const screens = [
            { id: 0, type: 'ground', objects: [{ type: 'log', x: 400 }] },
            { id: 1, type: 'water', objects: [{ type: 'vine', x: 400, length: 150 }] },
            { id: 2, type: 'pit', objects: [{ type: 'ladder', x: 400 }] },
            { id: 3, type: 'ground', objects: [{ type: 'croc', x: 300 }, { type: 'croc', x: 500 }, { type: 'croc', x: 700 }] },
            { id: 4, type: 'quicksand', objects: [{ type: 'vine', x: 400, length: 150 }] },
            { id: 5, type: 'ground', objects: [{ type: 'wall', x: 400 }, { type: 'treasure', x: 600, value: 2000 }] },
            // Repeat pattern or generate more...
        ]
        // Generate more screens
        for (let i = 6; i < 256; i++) {
            const types = ['ground', 'water', 'pit', 'quicksand']
            const type = types[Math.floor(Math.random() * types.length)]
            const objs = []
            if (type === 'water' || type === 'quicksand') {
                if (Math.random() > 0.5) objs.push({ type: 'vine', x: 400, length: 150 })
                else objs.push({ type: 'croc', x: 300 }, { type: 'croc', x: 500 }, { type: 'croc', x: 700 })
            }
            if (type === 'ground') {
                if (Math.random() > 0.5) objs.push({ type: 'log', x: 800 })
                if (Math.random() > 0.8) objs.push({ type: 'wall', x: 400 })
                if (Math.random() > 0.9) objs.push({ type: 'treasure', x: 600, value: 4000 })
            }
            if (Math.random() > 0.7) objs.push({ type: 'ladder', x: Math.random() * 600 + 100 })

            screens.push({ id: i, type, objects: objs })
        }

        // ENTITIES (Active per screen)
        let activeObjects = []

        const loadScreen = (index) => {
            currentScreen = index
            // Reset objects for this screen
            const screenData = screens[index]
            // Deep copy to allow state changes (like log position)
            activeObjects = JSON.parse(JSON.stringify(screenData.objects))

            // Initialize dynamic objects
            activeObjects.forEach(obj => {
                if (obj.type === 'log') {
                    obj.vx = -3
                }
                if (obj.type === 'vine') {
                    obj.angle = Math.PI / 4 // Start swing
                    obj.vAngle = 0
                    obj.pivotX = obj.x
                    obj.pivotY = 100 // Tree branch height
                }
            })
        }

        // INIT
        const init = () => {
            loadScreen(0)
            window.addEventListener('keydown', handleKeyDown)
            window.addEventListener('keyup', handleKeyUp)
            window.addEventListener('resize', resize)
            resize()
            canvas.focus()
            loop()
        }

        const resize = () => {
            // Keep aspect ratio 4:3 or similar
            const dpr = window.devicePixelRatio || 1
            canvas.width = window.innerWidth * dpr
            canvas.height = window.innerHeight * dpr
            canvas.style.width = `${window.innerWidth}px`
            canvas.style.height = `${window.innerHeight}px`
            ctx.scale(dpr, dpr)

            // Retro Crispness
            ctx.imageSmoothingEnabled = false
        }

        const handleKeyDown = (e) => {
            if (e.code === 'Space') keys.Space = true
            if (e.code === 'ArrowUp') keys.ArrowUp = true
            if (e.code === 'ArrowDown') keys.ArrowDown = true
            if (e.code === 'ArrowLeft') keys.ArrowLeft = true
            if (e.code === 'ArrowRight') keys.ArrowRight = true
        }

        const handleKeyUp = (e) => {
            if (e.code === 'Space') keys.Space = false
            if (e.code === 'ArrowUp') keys.ArrowUp = false
            if (e.code === 'ArrowDown') keys.ArrowDown = false
            if (e.code === 'ArrowLeft') keys.ArrowLeft = false
            if (e.code === 'ArrowRight') keys.ArrowRight = false
        }

        const update = () => {
            if (gameOver) return

            // Physics Scale for implementation simplification
            // Map 0-800 to canvas width
            const scaleX = window.innerWidth / SCREEN_WIDTH
            const scaleY = window.innerHeight / SCREEN_HEIGHT
            const scale = Math.min(scaleX, scaleY)

            // --- PLAYER MOVEMENT ---
            if (player.state !== 'swing') {
                if (keys.ArrowLeft) player.vx = -PLAYER_SPEED
                else if (keys.ArrowRight) player.vx = PLAYER_SPEED
                else player.vx = 0
            }

            // Jump
            if (keys.Space && player.onGround && player.state !== 'climb') {
                player.vy = JUMP_FORCE
                player.onGround = false
                player.state = 'jump'
                audioController.playTone(200, 0.1, 'square')
            }

            // Gravity
            if (!player.onGround && player.state !== 'climb' && player.state !== 'swing') {
                player.vy += GRAVITY
            }

            // Apply Velocity
            player.x += player.vx
            player.y += player.vy

            // --- COLLISIONS & INTERACTIONS ---

            // Ground/Floor
            // Simple: Ground is always at GROUND_Y unless in a pit
            const screen = screens[currentScreen]
            let groundLevel = GROUND_Y

            // Pit/Water logic
            const isHole = (screen.type === 'water' || screen.type === 'pit' || screen.type === 'quicksand')
            const inHoleZone = (player.x > 250 && player.x < 550) // Approximation of hole width

            if (isHole && inHoleZone) {
                // Determine if falling into pit
                // If on ground, fall.
                if (player.y >= GROUND_Y && !player.onLadder && player.state !== 'jump' && player.state !== 'swing') {
                    // Fall through
                    // groundLevel is undefined/lower
                } else {
                    // Jumping over?
                }
            } else {
                // Solid ground
                if (player.y > GROUND_Y && player.vy >= 0 && !player.onLadder) {
                    player.y = GROUND_Y
                    player.vy = 0
                    player.onGround = true
                    player.state = 'run'
                }
            }

            if (player.y > 700) {
                // Fell in pit -> Respawn/Start Over?
                // Pitfall lives system... for now, reset screen
                player.x = 50
                player.y = GROUND_Y
                score -= 100
                audioController.playTone(100, 0.3, 'sawtooth')
            }


            // Objects
            let onVine = false
            activeObjects.forEach(obj => {
                // LOGS
                if (obj.type === 'log') {
                    obj.x += obj.vx
                    if (obj.x < 0) obj.x = SCREEN_WIDTH // Wrap

                    // Collision
                    if (Math.abs(player.x - obj.x) < 20 && Math.abs(player.y - GROUND_Y) < 10) {
                        score -= 50
                        // Trip physics?
                    }
                }

                // LADDERS
                if (obj.type === 'ladder') {
                    if (Math.abs(player.x - obj.x) < 10) {
                        if (keys.ArrowUp || keys.ArrowDown) {
                            player.state = 'climb'
                            player.onLadder = true
                            player.vx = 0
                            player.x = obj.x // Snap
                            if (keys.ArrowUp) player.y -= 2
                            if (keys.ArrowDown) player.y += 2
                        }
                    }
                }

                // VINES
                if (obj.type === 'vine') {
                    // Pendulum physics
                    obj.angle += Math.sin(gameTime * 0.05) * 0.001 // Simplify swing for now: constant swing
                    // Actually, proper pendulum
                    // angularAcc = -g/L * sin(theta)
                    const g = 0.4
                    const L = obj.length
                    const acc = -g / 10 * Math.sin(obj.angle)
                    obj.vAngle += acc
                    obj.angle += obj.vAngle
                    obj.vAngle *= 0.99 // Damping

                    // Force Swing to keep it moving for gameplay
                    if (Math.abs(obj.angle) < 0.1 && Math.abs(obj.vAngle) < 0.001) obj.vAngle = 0.02

                    const tipX = obj.pivotX + Math.sin(obj.angle) * L
                    const tipY = obj.pivotY + Math.cos(obj.angle) * L

                    // Grab Vine
                    if (player.state !== 'swing') {
                        // Check collision with vine tip
                        if (Math.abs(player.x - tipX) < 20 && Math.abs(player.y - tipY) < 40 && !player.onGround) {
                            player.state = 'swing'
                            player.vine = obj
                            player.onGround = false
                            player.vy = 0
                            score += 100 // Bonus for catch
                        }
                    }
                }

                // TREASURE
                if (obj.type === 'treasure' && !obj.collected) {
                    if (Math.abs(player.x - obj.x) < 20 && Math.abs(player.y - GROUND_Y) < 10) {
                        obj.collected = true
                        score += obj.value
                        audioController.playTone(800, 0.1, 'sine')
                        audioController.playTone(1200, 0.1, 'sine')
                    }
                }
            })

            // Swinging State
            if (player.state === 'swing' && player.vine) {
                const v = player.vine
                const tipX = v.pivotX + Math.sin(v.angle) * v.length
                const tipY = v.pivotY + Math.cos(v.angle) * v.length
                player.x = tipX
                player.y = tipY

                if (keys.Space) {
                    // Jump off
                    player.state = 'jump'
                    player.vx = player.vine.vAngle * 100 // Launch velocity
                    if (player.vx > 8) player.vx = 8
                    if (player.vx < -8) player.vx = -8
                    player.vy = -5
                    player.vine = null
                }
            }

            // Screen Switching
            if (player.x > SCREEN_WIDTH) {
                loadScreen(currentScreen + 1)
                player.x = 10
            } else if (player.x < 0) {
                if (currentScreen > 0) {
                    loadScreen(currentScreen - 1)
                    player.x = SCREEN_WIDTH - 10
                } else {
                    player.x = 0
                }
            }

            gameTime++
            if (gameTime % 60 === 0) timeLeft--
            if (timeLeft <= 0) gameOver = true
        }

        const draw = () => {
            // Scaling
            const scaleX = window.innerWidth / SCREEN_WIDTH
            const scaleY = window.innerHeight / SCREEN_HEIGHT
            const scale = Math.min(scaleX, scaleY) * 0.9

            const transX = (window.innerWidth - SCREEN_WIDTH * scale) / 2
            const transY = (window.innerHeight - SCREEN_HEIGHT * scale) / 2

            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, window.innerWidth, window.innerHeight)

            ctx.save()
            ctx.translate(transX, transY)
            ctx.scale(scale, scale)

            // Mask Frame
            ctx.beginPath()
            ctx.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
            ctx.clip()

            // --- BACKGROUND ---
            // Sky/Trees background
            ctx.fillStyle = '#55AA55' // Atari Green
            ctx.fillRect(0, 0, SCREEN_WIDTH, 350)

            // Trunk line
            ctx.fillStyle = '#331100' // Dark Brown
            // Draw many trunks
            for (let x = 20; x < SCREEN_WIDTH; x += 80) {
                ctx.fillRect(x, 60, 20, 300)
            }

            // Canopy
            ctx.fillStyle = '#228822' // Darker Green
            ctx.fillRect(0, 0, SCREEN_WIDTH, 80)

            // Ground
            ctx.fillStyle = '#AAAA55' // Yellowish Brown Earth
            ctx.fillRect(0, 350, SCREEN_WIDTH, 120) // Top level ground

            // Underground
            ctx.fillStyle = '#996633' // Dirt
            ctx.fillRect(0, 470, SCREEN_WIDTH, 130)

            // --- CURRENT SCREEN FEATURES ---
            const screen = screens[currentScreen]

            // Pit/Water Hole
            if (screen.type !== 'ground') {
                // The hole cutout
                ctx.fillStyle = '#000000' // Background of hole? Or Water color?
                if (screen.type === 'water') ctx.fillStyle = '#2244CC' // Blue
                if (screen.type === 'pit') ctx.fillStyle = '#000000' // Black pit
                if (screen.type === 'quicksand') ctx.fillStyle = '#331100' // Tar/Mud

                ctx.fillRect(250, 350, 300, 120) // The hole in the upper ground

                // If water, draw crocodiles if present
            }

            // Objects
            activeObjects.forEach(obj => {
                if (obj.type === 'log') {
                    ctx.fillStyle = '#552200'
                    ctx.fillRect(obj.x - 15, GROUND_Y - 20, 30, 20)
                }
                if (obj.type === 'treasure' && !obj.collected) {
                    ctx.fillStyle = '#FFD700' // Gold
                    ctx.fillRect(obj.x - 10, GROUND_Y - 20, 20, 20)
                    ctx.fillStyle = '#FFFFFF'
                    ctx.fillText('$', obj.x - 3, GROUND_Y - 5)
                }
                if (obj.type === 'ladder') {
                    ctx.fillStyle = '#444444'
                    ctx.fillRect(obj.x - 10, 350, 20, 200) // Extends down
                    // Rungs
                    ctx.fillStyle = '#AAAAAA'
                    for (let y = 360; y < 550; y += 20) ctx.fillRect(obj.x - 8, y, 16, 2)
                }
                if (obj.type === 'vine') {
                    const tipX = obj.pivotX + Math.sin(obj.angle) * obj.length
                    const tipY = obj.pivotY + Math.cos(obj.angle) * obj.length
                    ctx.strokeStyle = '#EEEEEE' // White vine
                    ctx.lineWidth = 2
                    ctx.beginPath()
                    ctx.moveTo(obj.pivotX, obj.pivotY)
                    ctx.lineTo(tipX, tipY)
                    ctx.stroke()
                }
                if (obj.type === 'wall') {
                    ctx.fillStyle = '#883311' // Brick red
                    ctx.fillRect(obj.x, 350, 30, 120)
                }
            })

            // --- PLAYER ---
            // Harry Pitfall
            ctx.fillStyle = '#228822' // Green Shirt
            ctx.fillRect(player.x - 6, player.y - 32, 12, 16)
            ctx.fillStyle = '#DDDDDD' // White Pants can
            ctx.fillRect(player.x - 6, player.y - 16, 12, 16)
            // Head
            ctx.fillStyle = '#FFCCAA' // Skin
            ctx.fillRect(player.x - 5, player.y - 40, 10, 8)

            // --- UI ---
            ctx.fillStyle = '#FFFFFF'
            ctx.font = '24px monospace'
            ctx.textAlign = 'left'
            ctx.fillText(`SCORE: ${score}`, 20, 40)
            ctx.textAlign = 'center'
            ctx.fillText(`TIME: ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`, SCREEN_WIDTH / 2, 40)
            ctx.textAlign = 'right'
            ctx.fillText(`PITCH: ${currentScreen}`, SCREEN_WIDTH - 20, 40)

            ctx.restore()
        }

        const loop = () => {
            update()
            draw()
            animationFrameId = requestAnimationFrame(loop)
        }
        init()

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
            window.removeEventListener('resize', resize)
            cancelAnimationFrame(animationFrameId)
        }
    }, [])

    return <canvas ref={canvasRef} className="block fixed inset-0 w-full h-full bg-black" />
}

export default PitfallGame
