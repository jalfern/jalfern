import { useEffect, useRef } from 'react'

const PongGame = () => {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        let animationFrameId

        // Game constants
        const PADDLE_WIDTH = 10
        const PADDLE_HEIGHT = 80
        const BALL_SIZE = 8
        const PADDLE_OFFSET = 20
        const BASE_SPEED = 4
        const AI_SPEED = 3.5

        // Game state
        let state = {
            ball: { x: 0, y: 0, dx: BASE_SPEED, dy: BASE_SPEED },
            leftPaddle: { y: 0, score: 0 },
            rightPaddle: { y: 0, score: 0 },
            width: 0,
            height: 0
        }

        const resetBall = () => {
            state.ball = {
                x: state.width / 2,
                y: state.height / 2,
                dx: (Math.random() > 0.5 ? 1 : -1) * BASE_SPEED,
                dy: (Math.random() * 2 - 1) * BASE_SPEED
            }
        }

        const resize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
            state.width = canvas.width
            state.height = canvas.height
            state.leftPaddle.y = canvas.height / 2 - PADDLE_HEIGHT / 2
            state.rightPaddle.y = canvas.height / 2 - PADDLE_HEIGHT / 2

            // Only reset ball if it's off screen or initialized at 0,0
            if (state.ball.x === 0 && state.ball.y === 0) {
                resetBall()
            }
        }

        window.addEventListener('resize', resize)
        resize() // Initial sizing

        const update = () => {
            // Move ball
            state.ball.x += state.ball.dx
            state.ball.y += state.ball.dy

            // Wall collisions (Top/Bottom)
            if (state.ball.y <= 0 || state.ball.y + BALL_SIZE >= state.height) {
                state.ball.dy *= -1
            }

            // AI Logic (Simple tracking)
            // Left Paddle
            const leftCenter = state.leftPaddle.y + PADDLE_HEIGHT / 2
            if (leftCenter < state.ball.y - 10) {
                state.leftPaddle.y += AI_SPEED
            } else if (leftCenter > state.ball.y + 10) {
                state.leftPaddle.y -= AI_SPEED
            }

            // Right Paddle
            const rightCenter = state.rightPaddle.y + PADDLE_HEIGHT / 2
            if (rightCenter < state.ball.y - 10) {
                state.rightPaddle.y += AI_SPEED
            } else if (rightCenter > state.ball.y + 10) {
                state.rightPaddle.y -= AI_SPEED
            }

            // Clamp paddles
            state.leftPaddle.y = Math.max(0, Math.min(state.height - PADDLE_HEIGHT, state.leftPaddle.y))
            state.rightPaddle.y = Math.max(0, Math.min(state.height - PADDLE_HEIGHT, state.rightPaddle.y))

            // Paddle Collisions
            // Left
            if (
                state.ball.x <= PADDLE_OFFSET + PADDLE_WIDTH &&
                state.ball.x >= PADDLE_OFFSET &&
                state.ball.y + BALL_SIZE >= state.leftPaddle.y &&
                state.ball.y <= state.leftPaddle.y + PADDLE_HEIGHT
            ) {
                state.ball.dx *= -1.05 // Slight speed up
                state.ball.x = PADDLE_OFFSET + PADDLE_WIDTH + 1 // Push out to avoid sticking
            }

            // Right
            if (
                state.ball.x + BALL_SIZE >= state.width - PADDLE_OFFSET - PADDLE_WIDTH &&
                state.ball.x + BALL_SIZE <= state.width - PADDLE_OFFSET &&
                state.ball.y + BALL_SIZE >= state.rightPaddle.y &&
                state.ball.y <= state.rightPaddle.y + PADDLE_HEIGHT
            ) {
                state.ball.dx *= -1.05
                state.ball.x = state.width - PADDLE_OFFSET - PADDLE_WIDTH - BALL_SIZE - 1
            }

            // Scoring (Ball goes off screen)
            if (state.ball.x < 0) {
                state.rightPaddle.score++
                resetBall()
            } else if (state.ball.x > state.width) {
                state.leftPaddle.score++
                resetBall()
            }
        }

        const draw = () => {
            // Clear background (White)
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, state.width, state.height)

            ctx.fillStyle = '#000000'

            // Draw Paddles
            ctx.fillRect(PADDLE_OFFSET, state.leftPaddle.y, PADDLE_WIDTH, PADDLE_HEIGHT)
            ctx.fillRect(state.width - PADDLE_OFFSET - PADDLE_WIDTH, state.rightPaddle.y, PADDLE_WIDTH, PADDLE_HEIGHT)

            // Draw Ball
            ctx.fillRect(state.ball.x, state.ball.y, BALL_SIZE, BALL_SIZE)

            // Draw Net (Optional dashed line)
            ctx.beginPath()
            ctx.setLineDash([10, 15])
            ctx.moveTo(state.width / 2, 0)
            ctx.lineTo(state.width / 2, state.height)
            ctx.strokeStyle = '#e5e5e5' // Very subtle net
            ctx.stroke()

            // Draw minimal score (optional, keep it clean)
            // ctx.font = '40px monospace'
            // ctx.fillText(state.leftPaddle.score, state.width / 4, 50)
            // ctx.fillText(state.rightPaddle.score, 3 * state.width / 4, 50)
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

    return (
        <canvas
            ref={canvasRef}
            className="block fixed inset-0 w-full h-full cursor-none"
        />
    )
}

export default PongGame
