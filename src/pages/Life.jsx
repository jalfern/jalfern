import { useEffect, useRef, useState } from 'react'

export default function Life() {
  const canvasRef = useRef(null)
  const [running, setRunning] = useState(false)
  const gridRef = useRef(null)
  const animationRef = useRef(null)
  const lastTimeRef = useRef(0)

  // Initialize grid
  const createGrid = (rows, cols) => {
    const grid = []
    for (let i = 0; i < rows; i++) {
      grid[i] = []
      for (let j = 0; j < cols; j++) {
        grid[i][j] = Math.random() > 0.8 ? 1 : 0
      }
    }
    return grid
  }

  // Count neighbors
  const countNeighbors = (grid, i, j, rows, cols) => {
    let count = 0
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (di === 0 && dj === 0) continue
        const ni = (i + di + rows) % rows
        const nj = (j + dj + cols) % cols
        count += grid[ni][nj]
      }
    }
    return count
  }

  // Update grid
  const updateGrid = (grid) => {
    const rows = grid.length
    const cols = grid[0].length
    const newGrid = grid.map(row => [...row])

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const neighbors = countNeighbors(grid, i, j, rows, cols)
        if (grid[i][j] === 1) {
          newGrid[i][j] = neighbors === 2 || neighbors === 3 ? 1 : 0
        } else {
          newGrid[i][j] = neighbors === 3 ? 1 : 0
        }
      }
    }
    return newGrid
  }

  // Draw grid
  const draw = (ctx, grid, cellSize) => {
    const rows = grid.length
    const cols = grid[0].length

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    ctx.fillStyle = 'black'
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        if (grid[i][j] === 1) {
          ctx.fillRect(j * cellSize, i * cellSize, cellSize - 1, cellSize - 1)
        }
      }
    }
  }

  // Animation loop
  const animate = (time) => {
    if (!running) return

    const fps = 10
    const interval = 1000 / fps

    if (time - lastTimeRef.current >= interval) {
      lastTimeRef.current = time
      gridRef.current = updateGrid(gridRef.current)
      draw(canvasRef.current.getContext('2d'), gridRef.current, canvasRef.current.cellSize)
    }

    animationRef.current = requestAnimationFrame(animate)
  }

  // Setup canvas and grid
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const resize = () => {
      const size = Math.min(window.innerWidth, window.innerHeight) * 0.9
      const cellSize = 10
      const cols = Math.floor(size / cellSize)
      const rows = Math.floor(size / cellSize)

      canvas.width = cols * cellSize
      canvas.height = rows * cellSize
      canvas.cellSize = cellSize

      gridRef.current = createGrid(rows, cols)
      draw(ctx, gridRef.current, cellSize)
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Start/stop animation
  useEffect(() => {
    if (running) {
      lastTimeRef.current = performance.now()
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [running])

  // Randomize
  const randomize = () => {
    const canvas = canvasRef.current
    const cellSize = canvas.cellSize
    const rows = Math.floor(canvas.height / cellSize)
    const cols = Math.floor(canvas.width / cellSize)
    gridRef.current = createGrid(rows, cols)
    draw(canvas.getContext('2d'), gridRef.current, cellSize)
  }

  // Clear
  const clear = () => {
    const canvas = canvasRef.current
    const cellSize = canvas.cellSize
    const rows = Math.floor(canvas.height / cellSize)
    const cols = Math.floor(canvas.width / cellSize)
    gridRef.current = Array(rows).fill(null).map(() => Array(cols).fill(0))
    draw(canvas.getContext('2d'), gridRef.current, cellSize)
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-white">
      <canvas
        ref={canvasRef}
        className="border border-black/20"
      />
      <div className="mt-6 flex gap-4">
        <button
          onClick={() => setRunning(!running)}
          className="px-4 py-2 border-2 border-black font-mono text-sm hover:bg-black hover:text-white transition-colors"
        >
          {running ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={randomize}
          className="px-4 py-2 border-2 border-black font-mono text-sm hover:bg-black hover:text-white transition-colors"
        >
          Random
        </button>
        <button
          onClick={clear}
          className="px-4 py-2 border-2 border-black font-mono text-sm hover:bg-black hover:text-white transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
