import { useState, useRef, useEffect } from 'react'

export default function Playground() {
  const [prompt, setPrompt] = useState('')
  const [turns, setTurns] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [context, setContext] = useState(null)
  const [latestStats, setLatestStats] = useState(null)

  const textareaRef = useRef(null)
  const outputRef = useRef(null)

  useEffect(() => {
    scrollToBottom()
  }, [turns])

  const scrollToBottom = () => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }

  const run = async () => {
    if (!prompt.trim() || loading) return

    const userTurn = { id: Date.now(), user: prompt, model: null, stats: null }
    setTurns((prev) => [...prev, userTurn])
    setPrompt('')
    setLoading(true)
    setError(null)

    const startTime = Date.now()

    try {
      const requestBody = {
        model: 'gemma4:latest',
        prompt: prompt,
        stream: false,
      }

      if (context) {
        requestBody.context = context
      }

      const response = await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || errData.message || `HTTP ${response.status}`)
      }

      const data = await response.json()

      const elapsed = Date.now() - startTime
      const tokenCount = data.prompt_eval_count + (data.eval_count || 0)
      const tokensPerSec = tokenCount > 0 ? (tokenCount / (elapsed / 1000)).toFixed(1) : 0

      const stats = {
        elapsedMs: elapsed,
        tokensPerSec: parseFloat(tokensPerSec),
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
      }

      setLatestStats(stats)
      setContext(data.context || null)

      setTurns((prev) =>
        prev.map((t) =>
          t.id === userTurn.id ? { ...t, model: data.response, stats } : t
        )
      )
    } catch (err) {
      setError(err.message)
      setTurns((prev) => prev.filter((t) => t.id !== userTurn.id))
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    setTurns([])
    setContext(null)
    setLatestStats(null)
    setError(null)
    textareaRef.current?.focus()
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl tracking-widest opacity-60">MODEL PLAYGROUND</h1>
          <button
            onClick={clear}
            disabled={loading || turns.length === 0}
            className={`px-4 py-2 rounded text-xs tracking-widest transition-all ${
              loading || turns.length === 0
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            CLEAR
          </button>
        </div>

        <div
          ref={outputRef}
          className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#444 #222' }}
        >
          {turns.length === 0 && !loading && (
            <div className="text-center text-gray-500 text-sm mt-20">
              Start a conversation...
            </div>
          )}

          {turns.map((turn) => (
            <div key={turn.id} className="space-y-2">
              <div className="flex justify-end">
                <div className="bg-gray-800 px-4 py-2 rounded max-w-[85%]">
                  <div className="text-xs text-gray-500 mb-1 text-right">YOU</div>
                  <div className="text-sm">{turn.user}</div>
                </div>
              </div>

              {turn.model && (
                <div className="flex justify-start">
                  <div className="bg-gray-900 border border-gray-700 px-4 py-2 rounded max-w-[85%]">
                    <div className="text-xs text-gray-500 mb-1">MODEL</div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      {turn.model}
                    </div>
                    {turn.stats && (
                      <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-800 flex gap-3">
                        <span>{turn.stats.elapsedMs}ms</span>
                        <span>{turn.stats.tokensPerSec} t/s</span>
                        <span>{turn.stats.completionTokens} tokens</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-900 border border-gray-700 px-4 py-2 rounded max-w-[85%]">
                <div className="text-xs text-gray-500 mb-1">MODEL</div>
                <div className="text-sm text-gray-400">Thinking...</div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded text-xs text-red-300">
            {error}
          </div>
        )}

        {latestStats && turns.length > 0 && !loading && (
          <div className="mb-4 p-2 bg-gray-900 border border-gray-700 rounded text-xs text-gray-500 flex gap-4">
            <span>Latest: {latestStats.elapsedMs}ms</span>
            <span>{latestStats.tokensPerSec} t/s</span>
            <span>Prompt: {latestStats.promptTokens}</span>
            <span>Context: {context ? context.length : 0} tokens</span>
          </div>
        )}

        <div className="flex gap-3">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your prompt... (Cmd+Enter to run)"
            disabled={loading}
            className="flex-1 bg-gray-900 border border-gray-700 rounded p-3 text-sm resize-none focus:outline-none focus:border-gray-500 disabled:opacity-50"
            rows={3}
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
            {loading ? '...' : 'RUN'}
          </button>
        </div>
      </div>
    </div>
  )
}
