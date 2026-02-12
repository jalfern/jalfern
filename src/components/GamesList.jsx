import { Link } from 'react-router-dom'
import { GAMES } from '../config/games'

const GamesList = () => {
    return (
        <div className="min-h-screen bg-black text-white font-mono flex flex-col items-center justify-center p-8">
            <h1 className="text-4xl mb-12 tracking-widest text-[#00ff00] animate-pulse">
                ARCADE MENU
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                {GAMES.map((game) => (
                    <Link
                        key={game.path}
                        to={game.path}
                        className="group relative border-2 border-white p-6 hover:bg-white hover:text-black transition-colors duration-200"
                    >
                        <div className="flex justify-between items-center">
                            <span className="text-xl tracking-wider font-bold">
                                {game.label}
                            </span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                PLAY &gt;
                            </span>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="mt-16 text-xs text-gray-500">
                SELECT A GAME TO START
            </div>
        </div>
    )
}

export default GamesList
