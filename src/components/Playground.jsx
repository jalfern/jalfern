import { useState, useEffect, useRef } from 'react'

export default function Playground() {
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)

  const textareaRef = useRef(null)

  useEffect(() => {
    setGameInfo('Model Playground', 'dark')
  }, [])

  const run = async () => {
    if (!prompt.trim()) return

    setLoading(true)
    setError(null)
    setOutput('')
    setStats(null)

    const startTime = Date.now()

    try {
      const response = await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemma4:latest',
          prompt: prompt,
          stream: false,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || errData.message || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setOutput(data.response || 'No response')

      const elapsed = Date.now() - startTime
      const tokenCount = data.prompt_eval_count + (data.eval_count || 0)
      const tokensPerSec = tokenCount > 0 ? (tokenCount / (elapsed / 1000)).toFixed(1) : 0

      setStats({
        elapsedMs: elapsed,
        tokensPerSec: parseFloat(tokensPerSec),
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault()
      run()
    }
  }

  return (
    <div className="absolute inset-0 bg-black text-white flex flex-col font-mono">
      <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full">
        <h1 className="text-xl tracking-widest opacity-60 mb-6 text-center">MODEL PLAYGROUND</h1>

        <div className="flex-1 flex flex-col gap-4">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your prompt... (Cmd+Enter to run)"
            className="flex-1 bg-gray-900 border border-gray-700 rounded p-4 text-sm resize-none focus:outline-none focus:border-gray-500"
          />

          <button
            onClick={run}
            disabled={loading || !prompt.trim()}
            className={`px-6 py-3 rounded text-sm tracking-widest transition-all ${
              loading || !prompt.trim()
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-white text-black hover:bg-gray-200'
            }`}
          >
            {loading ? 'Running...' : 'Run'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded text-sm text-red-300">
            {error}
          </div>
        )}

        {output && (
          <div className="mt-4 p-4 bg-gray-900 border border-gray-700 rounded">
            <div className="text-xs text-gray-500 mb-2">RESPONSE</div>
            <div className="text-sm leading-relaxed">{output}</div>
          </div>
        )}

        {stats && (
          <div className="mt-4 p-3 bg-gray-900 border border-gray-700 rounded text-xs text-gray-400 flex flex-wrap gap-4 justify-between">
            <span>Elapsed: {stats.elapsedMs} ms</span>
            <span>Speed: {stats.tokensPerSec} tokens/s</span>
            <span>Prompt: {stats.promptTokens} tokens</span>
            <span>Completion: {stats.completionTokens} tokens</span>
          </div>
        )}
      </div>
    </div>
  )
}
