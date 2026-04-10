import { useState } from 'react';

function GamesList() {
  const [games] = useState([
    { id: 1, name: 'Pac-Man', year: 1980, genre: 'Arcade' },
    { id: 2, name: 'Space Invaders', year: 1978, genre: 'Arcade' },
    { id: 3, name: 'Tetris', year: 1984, genre: 'Puzzle' },
    { id: 4, name: 'Donkey Kong', year: 1981, genre: 'Platform' },
    { id: 5, name: 'The Legend of Zelda', year: 1986, genre: 'Adventure' },
  ]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-mono p-4">
      <h1 className="text-3xl tracking-widest opacity-80 mb-8">Games List</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        {games.map((game) => (
          <div key={game.id} className="bg-gray-900 p-4 rounded border border-gray-700">
            <h2 className="text-xl font-bold opacity-90">{game.name}</h2>
            <p className="opacity-60">Year: {game.year}</p>
            <p className="opacity-60">Genre: {game.genre}</p>
          </div>
        ))}
      </div>
      <a 
        href="/retrogames" 
        className="opacity-60 hover:opacity-100 transition-opacity duration-300 tracking-wide mt-8"
      >
        Back to RetroGames
      </a>
    </div>
  );
}

export default GamesList;