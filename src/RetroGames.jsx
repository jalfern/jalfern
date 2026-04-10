import { useState } from 'react';

function RetroGames() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-mono p-4">
      <h1 className="text-3xl tracking-widest opacity-80 mb-8">RetroGames Exploration</h1>
      <p className="text-center max-w-2xl mb-6 opacity-60">
        Welcome to the RetroGames section of my site. This is a placeholder for future content.
      </p>
      <div className="flex flex-col gap-4">
        <a 
          href="/retrogames/games" 
          className="opacity-60 hover:opacity-100 transition-opacity duration-300 tracking-wide text-center"
        >
          View Games List →
        </a>
        <a 
          href="/" 
          className="opacity-60 hover:opacity-100 transition-opacity duration-300 tracking-wide text-center"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}

export default RetroGames;