import { useParams } from 'react-router-dom';
import { games } from './games.js';

function GameDetail() {
  const { id } = useParams();
  const game = games.find(g => g.id === parseInt(id));
  
  if (!game) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono">
        <div className="text-center">
          <h1 className="text-2xl tracking-widest opacity-60">Game not found</h1>
          <a 
            href="/retrogames/games" 
            className="opacity-60 hover:opacity-100 transition-opacity duration-300 tracking-wide block mt-4"
          >
            ← Back to Games List
          </a>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono">
      <div className="text-center space-y-8 max-w-2xl">
        <h1 className="text-3xl tracking-widest opacity-80">{game.name}</h1>
        <div className="space-y-4">
          <p className="opacity-60">Year: {game.year}</p>
          <p className="opacity-60">Genre: {game.genre}</p>
        </div>
        <a 
          href="/retrogames/games" 
          className="opacity-60 hover:opacity-100 transition-opacity duration-300 tracking-wide block mt-4"
        >
          ← Back to Games List
        </a>
      </div>
    </div>
  );
}

export default GameDetail;