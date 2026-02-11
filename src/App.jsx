import { useState } from 'react'

function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
            jalfern.com
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 font-light">
            Something amazing is being built here.
          </p>
        </div>

        <div className="flex justify-center gap-4">
          <div className="h-1 w-20 bg-blue-500 rounded-full animate-pulse"></div>
          <div className="h-1 w-20 bg-emerald-500 rounded-full animate-pulse delay-75"></div>
          <div className="h-1 w-20 bg-purple-500 rounded-full animate-pulse delay-150"></div>
        </div>

        <div className="pt-8 text-sm text-slate-500">
          &copy; {new Date().getFullYear()} Jalfern. All rights reserved.
        </div>
      </div>
    </div>
  )
}

export default App
