import React, { useEffect, useRef } from 'react'
import { audioController } from '../../utils/AudioController'
import PauseOverlay from '../../components/PauseOverlay'
import VirtualControls from '../../components/VirtualControls'
import { GAMES } from '../../config/games'

const AdventureGame = () => {
    const canvasRef = useRef(null)
    const containerRef = useRef(null)
    const [paused, setPaused] = React.useState(false)
    const pausedRef = useRef(false)

    const handleResume = () => {
        setPaused(false)
        pausedRef.current = false
        canvasRef.current?.focus()
    }

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        let animationFrameId

        // ===== CONSTANTS =====
        const W = 160 // Atari 2600 resolution width
        const H = 192 // Atari 2600 resolution height (playfield area)
        const SCALE = 4 // We'll scale up
        const PLAYER_SPEED = 2
        const DRAGON_SPEED = 1.2
        const RHINDLE_SPEED = 1.6
        const BAT_SPEED = 1.8
        const WALL_THICKNESS = 8

        // Atari 2600 color palette (NTSC)
        const COLORS = {
            BLACK: '#000000',
            YELLOW: '#E8D800',   // Yellow castle / Yorgle
            OLIVE: '#6C6C00',    // Yellow castle dark
            GREEN: '#00A800',    // Grundle
            DARK_GREEN: '#005800',
            RED: '#D80000',      // Rhindle
            DARK_RED: '#880000',
            ORANGE: '#E87800',   // Chalice / Gold key
            TAN: '#C89858',      // Bridge
            CYAN: '#00E8E8',     // Blue maze
            BLUE: '#0058A8',     // Blue maze walls
            PURPLE: '#7800A8',   // White castle area
            LIGHT_PURPLE: '#B858D8',
            WHITE: '#FFFFFF',    // White castle
            GRAY: '#A8A8A8',     // Black castle
            DARK_GRAY: '#585858',
            PINK: '#E878A8',     // Magnet
            FLASH_COLOR: '#FFFFFF',
            CHALICE_COLOR: '#FFD800',
            SWORD_COLOR: '#FFFF00',
            MAGNET_COLOR: '#404040',
            WALL_COLOR_BLUE: '#0058A8',
            WALL_COLOR_RED: '#880000',
            BG_BLUE: '#000058',
            BG_RED: '#280000',
            BG_GREEN: '#002800',
            BG_YELLOW: '#585800',
            BG_PURPLE: '#280058',
            BG_BLACK: '#000000',
            BG_WHITE: '#585858',
            BG_OLIVE: '#383800',
        }

        // ===== ROOM DEFINITIONS =====
        // Each room: name, bgColor, wallColor, walls (array of rects), exits {up, right, down, left}
        // Walls define the playfield layout. Exits connect rooms.
        // Wall format: [x, y, w, h] in 160x192 space

        // Room indices
        const ROOM = {
            NUMBER: 0,
            GOLD_CASTLE: 1,
            GOLD_FOYER: 2,
            BELOW_GOLD: 3,
            SOUTHEAST: 4,
            SOUTHWEST: 5,
            BLUE_MAZE_TOP: 6,
            BLUE_MAZE_1: 7,
            BLUE_MAZE_BOTTOM: 8,
            BLUE_MAZE_CENTER: 9,
            BLUE_MAZE_ENTRY: 10,
            WHITE_CASTLE: 11,
            WHITE_FOYER: 12,
            BELOW_WHITE: 13,
            SOUTH_HALL_R: 14,
            SOUTH_HALL_L: 15,
            BLACK_CASTLE: 16,
            BLACK_FOYER: 17,
            RED_MAZE_1: 18,
            RED_MAZE_TOP: 19,
            RED_MAZE_BOTTOM: 20,
            RED_MAZE_CENTER: 21,
            RED_MAZE_ENTRY: 22,
            BLACK_MAZE_1: 23,
            BLACK_MAZE_2: 24,
            BLACK_MAZE_3: 25,
            BLACK_MAZE_ENTRY: 26,
            MAIN_HALL_LEFT: 27,
            MAIN_HALL_CENTER: 28,
            MAIN_HALL_RIGHT: 29,
            EASTER_EGG: 30,
        }

        // Standard open room walls (border only)
        const OPEN_WALLS = [
            [0, 0, W, WALL_THICKNESS],          // top
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS], // bottom
            [0, 0, WALL_THICKNESS, H],            // left
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, H], // right
        ]

        // Open room with top passage
        const topPassageWalls = () => [
            [0, 0, 60, WALL_THICKNESS],
            [100, 0, 60, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, H],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, H],
        ]

        // Open room with bottom passage
        const bottomPassageWalls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, 60, WALL_THICKNESS],
            [100, H - WALL_THICKNESS, 60, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, H],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, H],
        ]

        // Open room with side passages
        const sidePassageWalls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, 80],
            [0, 120, WALL_THICKNESS, 72],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, 80],
            [W - WALL_THICKNESS, 120, WALL_THICKNESS, 72],
        ]

        // Castle room (gate at bottom)
        const castleWalls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, 60, WALL_THICKNESS],
            [100, H - WALL_THICKNESS, 60, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, H],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, H],
        ]

        // Castle interior (foyer)
        const foyerWalls = () => [
            [0, 0, 60, WALL_THICKNESS],
            [100, 0, 60, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, H],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, H],
        ]

        // Blue maze layouts
        const blueMazeTopWalls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, H],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, H],
            // Internal maze walls
            [WALL_THICKNESS, 40, 50, WALL_THICKNESS],
            [80, 40, 72, WALL_THICKNESS],
            [30, 70, WALL_THICKNESS, 50],
            [60, 70, 60, WALL_THICKNESS],
            [60, 70, WALL_THICKNESS, 50],
            [WALL_THICKNESS, 110, 60, WALL_THICKNESS],
            [100, 100, WALL_THICKNESS, 50],
            [100, 140, 52, WALL_THICKNESS],
            [30, 140, 40, WALL_THICKNESS],
        ]

        const blueMaze1Walls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, 80],
            [0, 120, WALL_THICKNESS, 72],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, H],
            // Internal walls
            [30, WALL_THICKNESS, WALL_THICKNESS, 50],
            [30, 50, 50, WALL_THICKNESS],
            [70, 50, WALL_THICKNESS, 40],
            [100, 50, 52, WALL_THICKNESS],
            [30, 90, 80, WALL_THICKNESS],
            [100, 90, WALL_THICKNESS, 50],
            [30, 130, WALL_THICKNESS, 54],
            [50, 130, 60, WALL_THICKNESS],
            [50, 160, 60, WALL_THICKNESS],
        ]

        const blueMazeBottomWalls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, 60, WALL_THICKNESS],
            [100, H - WALL_THICKNESS, 60, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, H],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, H],
            // Internal walls
            [WALL_THICKNESS, 40, 60, WALL_THICKNESS],
            [50, 40, WALL_THICKNESS, 50],
            [80, 40, 72, WALL_THICKNESS],
            [80, 40, WALL_THICKNESS, 60],
            [30, 90, 90, WALL_THICKNESS],
            [WALL_THICKNESS, 130, 40, WALL_THICKNESS],
            [70, 120, WALL_THICKNESS, 50],
            [100, 130, 52, WALL_THICKNESS],
        ]

        const blueMazeCenterWalls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, H],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, 80],
            [W - WALL_THICKNESS, 120, WALL_THICKNESS, 72],
            // Internal walls
            [30, 30, WALL_THICKNESS, 60],
            [50, 30, 60, WALL_THICKNESS],
            [50, 60, WALL_THICKNESS, 40],
            [80, 60, WALL_THICKNESS, 50],
            [30, 100, 60, WALL_THICKNESS],
            [120, 80, 32, WALL_THICKNESS],
            [WALL_THICKNESS, 140, 50, WALL_THICKNESS],
            [80, 140, 72, WALL_THICKNESS],
        ]

        const blueMazeEntryWalls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, 80],
            [0, 120, WALL_THICKNESS, 72],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, 80],
            [W - WALL_THICKNESS, 120, WALL_THICKNESS, 72],
            // Internal walls
            [30, 40, 100, WALL_THICKNESS],
            [30, 40, WALL_THICKNESS, 50],
            [120, 40, WALL_THICKNESS, 50],
            [50, 80, 60, WALL_THICKNESS],
            [30, 120, WALL_THICKNESS, 40],
            [120, 120, WALL_THICKNESS, 40],
            [30, 150, 100, WALL_THICKNESS],
        ]

        // Red maze layouts
        const redMaze1Walls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, H],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, 80],
            [W - WALL_THICKNESS, 120, WALL_THICKNESS, 72],
            // Internal maze
            [30, 30, 80, WALL_THICKNESS],
            [30, 30, WALL_THICKNESS, 50],
            [100, 30, WALL_THICKNESS, 50],
            [50, 70, 60, WALL_THICKNESS],
            [WALL_THICKNESS, 100, 50, WALL_THICKNESS],
            [80, 100, 72, WALL_THICKNESS],
            [50, 130, WALL_THICKNESS, 54],
            [30, 150, 90, WALL_THICKNESS],
        ]

        const redMazeTopWalls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, 80],
            [0, 120, WALL_THICKNESS, 72],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, H],
            // Internal maze
            [30, 40, WALL_THICKNESS, 60],
            [50, 40, 80, WALL_THICKNESS],
            [80, 70, WALL_THICKNESS, 40],
            [WALL_THICKNESS, 100, 80, WALL_THICKNESS],
            [110, 100, WALL_THICKNESS, 40],
            [40, 140, 80, WALL_THICKNESS],
            [110, 140, 42, WALL_THICKNESS],
        ]

        const redMazeBottomWalls = () => [
            [0, 0, 60, WALL_THICKNESS],
            [100, 0, 60, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, H],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, H],
            // Internal maze
            [30, 40, 100, WALL_THICKNESS],
            [60, 40, WALL_THICKNESS, 50],
            [WALL_THICKNESS, 80, 50, WALL_THICKNESS],
            [90, 80, 62, WALL_THICKNESS],
            [30, 120, WALL_THICKNESS, 40],
            [50, 120, 70, WALL_THICKNESS],
            [110, 120, WALL_THICKNESS, 64],
            [30, 155, 80, WALL_THICKNESS],
        ]

        const redMazeCenterWalls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, H],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, H],
            // Internal maze
            [WALL_THICKNESS, 40, 60, WALL_THICKNESS],
            [100, 40, 52, WALL_THICKNESS],
            [40, 40, WALL_THICKNESS, 50],
            [80, 40, WALL_THICKNESS, 50],
            [40, 80, 50, WALL_THICKNESS],
            [120, 80, WALL_THICKNESS, 40],
            [WALL_THICKNESS, 120, 40, WALL_THICKNESS],
            [60, 120, WALL_THICKNESS, 64],
            [80, 120, 72, WALL_THICKNESS],
            [30, 155, 40, WALL_THICKNESS],
            [100, 155, 52, WALL_THICKNESS],
        ]

        const redMazeEntryWalls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, H],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, 80],
            [W - WALL_THICKNESS, 120, WALL_THICKNESS, 72],
            // Internal walls
            [30, 30, 100, WALL_THICKNESS],
            [60, 30, WALL_THICKNESS, 60],
            [WALL_THICKNESS, 80, 60, WALL_THICKNESS],
            [100, 80, 52, WALL_THICKNESS],
            [30, 80, WALL_THICKNESS, 50],
            [100, 80, WALL_THICKNESS, 50],
            [30, 130, 90, WALL_THICKNESS],
            [WALL_THICKNESS, 160, 60, WALL_THICKNESS],
            [100, 160, 52, WALL_THICKNESS],
        ]

        // Black (invisible) maze - walls exist but same color as background
        const blackMaze1Walls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, H],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, 80],
            [W - WALL_THICKNESS, 120, WALL_THICKNESS, 72],
            [40, 30, WALL_THICKNESS, 80],
            [70, 50, WALL_THICKNESS, 80],
            [100, 30, WALL_THICKNESS, 80],
            [30, 130, 110, WALL_THICKNESS],
        ]

        const blackMaze2Walls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, 80],
            [0, 120, WALL_THICKNESS, 72],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, H],
            [30, 50, 80, WALL_THICKNESS],
            [60, 50, WALL_THICKNESS, 80],
            [30, 130, 80, WALL_THICKNESS],
        ]

        const blackMaze3Walls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, 60, WALL_THICKNESS],
            [100, H - WALL_THICKNESS, 60, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, H],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, 80],
            [W - WALL_THICKNESS, 120, WALL_THICKNESS, 72],
            [40, 40, WALL_THICKNESS, 100],
            [80, 40, WALL_THICKNESS, 100],
            [120, 60, WALL_THICKNESS, 80],
        ]

        const blackMazeEntryWalls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, 80],
            [0, 120, WALL_THICKNESS, 72],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, H],
            [40, 30, 80, WALL_THICKNESS],
            [40, 30, WALL_THICKNESS, 60],
            [110, 30, WALL_THICKNESS, 60],
            [40, 100, 80, WALL_THICKNESS],
            [60, 140, 50, WALL_THICKNESS],
        ]

        // Main hall walls (wide open corridors)
        const mainHallWalls = () => [
            [0, 0, W, WALL_THICKNESS],
            [0, H - WALL_THICKNESS, W, WALL_THICKNESS],
            [0, 0, WALL_THICKNESS, 80],
            [0, 120, WALL_THICKNESS, 72],
            [W - WALL_THICKNESS, 0, WALL_THICKNESS, 80],
            [W - WALL_THICKNESS, 120, WALL_THICKNESS, 72],
        ]

        const rooms = [
            // 0: Number Room (game select)
            { name: 'Number Room', bg: COLORS.BLACK, wallColor: COLORS.BLACK,
              walls: [...OPEN_WALLS], exits: { up: 0, right: 0, down: 0, left: 0 } },
            // 1: Gold Castle (exterior with gate)
            { name: 'Gold Castle', bg: COLORS.BG_YELLOW, wallColor: COLORS.YELLOW,
              walls: castleWalls(), exits: { up: 3, right: -1, down: -1, left: -1 },
              castle: 'gold' },
            // 2: Gold Castle Foyer (inside)
            { name: 'Gold Foyer', bg: COLORS.BG_YELLOW, wallColor: COLORS.YELLOW,
              walls: foyerWalls(), exits: { up: -1, right: -1, down: -1, left: -1 },
              inside: 'gold' },
            // 3: Below Gold Castle
            { name: 'Below Gold Castle', bg: COLORS.BG_OLIVE, wallColor: COLORS.YELLOW,
              walls: sidePassageWalls(), exits: { up: 5, right: 4, down: 1, left: 27 } },
            // 4: Southeast area
            { name: 'Southeast', bg: COLORS.BG_GREEN, wallColor: COLORS.GREEN,
              walls: sidePassageWalls(), exits: { up: 10, right: -1, down: 14, left: 3 } },
            // 5: Southwest area
            { name: 'Southwest', bg: COLORS.BG_GREEN, wallColor: COLORS.GREEN,
              walls: sidePassageWalls(), exits: { up: 27, right: -1, down: 3, left: 15 } },
            // 6: Blue Maze Top
            { name: 'Blue Maze Top', bg: COLORS.BG_BLUE, wallColor: COLORS.CYAN,
              walls: blueMazeTopWalls(), exits: { up: -1, right: -1, down: 7, left: -1 } },
            // 7: Blue Maze 1
            { name: 'Blue Maze 1', bg: COLORS.BG_BLUE, wallColor: COLORS.CYAN,
              walls: blueMaze1Walls(), exits: { up: 6, right: 9, down: 8, left: -1 } },
            // 8: Blue Maze Bottom
            { name: 'Blue Maze Bottom', bg: COLORS.BG_BLUE, wallColor: COLORS.CYAN,
              walls: blueMazeBottomWalls(), exits: { up: 7, right: -1, down: 10, left: -1 } },
            // 9: Blue Maze Center
            { name: 'Blue Maze Center', bg: COLORS.BG_BLUE, wallColor: COLORS.CYAN,
              walls: blueMazeCenterWalls(), exits: { up: -1, right: -1, down: -1, left: 7 } },
            // 10: Blue Maze Entry
            { name: 'Blue Maze Entry', bg: COLORS.BG_BLUE, wallColor: COLORS.CYAN,
              walls: blueMazeEntryWalls(), exits: { up: 8, right: -1, down: 4, left: -1 } },
            // 11: White Castle (exterior)
            { name: 'White Castle', bg: COLORS.BG_PURPLE, wallColor: COLORS.WHITE,
              walls: castleWalls(), exits: { up: 13, right: -1, down: -1, left: -1 },
              castle: 'white' },
            // 12: White Castle Foyer
            { name: 'White Foyer', bg: COLORS.BG_PURPLE, wallColor: COLORS.WHITE,
              walls: foyerWalls(), exits: { up: -1, right: -1, down: -1, left: -1 },
              inside: 'white' },
            // 13: Below White Castle
            { name: 'Below White Castle', bg: COLORS.BG_PURPLE, wallColor: COLORS.LIGHT_PURPLE,
              walls: sidePassageWalls(), exits: { up: 15, right: -1, down: 11, left: 22 } },
            // 14: South Hall Right
            { name: 'South Hall Right', bg: COLORS.BG_GREEN, wallColor: COLORS.GREEN,
              walls: sidePassageWalls(), exits: { up: 4, right: -1, down: 16, left: 15 } },
            // 15: South Hall Left
            { name: 'South Hall Left', bg: COLORS.BG_GREEN, wallColor: COLORS.GREEN,
              walls: sidePassageWalls(), exits: { up: 13, right: 14, down: 5, left: -1 } },
            // 16: Black Castle (exterior)
            { name: 'Black Castle', bg: COLORS.BG_BLACK, wallColor: COLORS.GRAY,
              walls: castleWalls(), exits: { up: 14, right: -1, down: -1, left: -1 },
              castle: 'black' },
            // 17: Black Castle Foyer
            { name: 'Black Foyer', bg: COLORS.BG_BLACK, wallColor: COLORS.DARK_GRAY,
              walls: foyerWalls(), exits: { up: -1, right: -1, down: -1, left: -1 },
              inside: 'black' },
            // 18: Red Maze 1
            { name: 'Red Maze 1', bg: COLORS.BG_RED, wallColor: COLORS.RED,
              walls: redMaze1Walls(), exits: { up: -1, right: 19, down: 20, left: -1 } },
            // 19: Red Maze Top
            { name: 'Red Maze Top', bg: COLORS.BG_RED, wallColor: COLORS.RED,
              walls: redMazeTopWalls(), exits: { up: -1, right: -1, down: 21, left: 18 } },
            // 20: Red Maze Bottom
            { name: 'Red Maze Bottom', bg: COLORS.BG_RED, wallColor: COLORS.RED,
              walls: redMazeBottomWalls(), exits: { up: 18, right: -1, down: -1, left: -1 } },
            // 21: Red Maze Center
            { name: 'Red Maze Center', bg: COLORS.BG_RED, wallColor: COLORS.RED,
              walls: redMazeCenterWalls(), exits: { up: 19, right: -1, down: -1, left: -1 } },
            // 22: Red Maze Entry
            { name: 'Red Maze Entry', bg: COLORS.BG_RED, wallColor: COLORS.RED,
              walls: redMazeEntryWalls(), exits: { up: -1, right: 13, down: -1, left: -1 } },
            // 23: Black Maze 1
            { name: 'Black Maze 1', bg: COLORS.BG_BLACK, wallColor: COLORS.BG_BLACK,
              walls: blackMaze1Walls(), exits: { up: -1, right: 24, down: 26, left: -1 },
              invisible: true },
            // 24: Black Maze 2
            { name: 'Black Maze 2', bg: COLORS.BG_BLACK, wallColor: COLORS.BG_BLACK,
              walls: blackMaze2Walls(), exits: { up: -1, right: -1, down: -1, left: 23 },
              invisible: true },
            // 25: Black Maze 3
            { name: 'Black Maze 3', bg: COLORS.BG_BLACK, wallColor: COLORS.BG_BLACK,
              walls: blackMaze3Walls(), exits: { up: -1, right: 26, down: 30, left: -1 },
              invisible: true },
            // 26: Black Maze Entry
            { name: 'Black Maze Entry', bg: COLORS.BG_BLACK, wallColor: COLORS.BG_BLACK,
              walls: blackMazeEntryWalls(), exits: { up: 23, right: -1, down: -1, left: 25 },
              inside: 'blackMaze', invisible: true },
            // 27: Main Hall Left
            { name: 'Main Hall Left', bg: COLORS.BG_OLIVE, wallColor: COLORS.YELLOW,
              walls: mainHallWalls(), exits: { up: 3, right: 28, down: 5, left: -1 } },
            // 28: Main Hall Center
            { name: 'Main Hall Center', bg: COLORS.BG_OLIVE, wallColor: COLORS.YELLOW,
              walls: mainHallWalls(), exits: { up: -1, right: 29, down: -1, left: 27 } },
            // 29: Main Hall Right
            { name: 'Main Hall Right', bg: COLORS.BG_OLIVE, wallColor: COLORS.YELLOW,
              walls: mainHallWalls(), exits: { up: -1, right: -1, down: -1, left: 28 } },
            // 30: Easter Egg Room
            { name: 'Created by Warren Robinett', bg: COLORS.BLACK, wallColor: COLORS.FLASH_COLOR,
              walls: [...OPEN_WALLS], exits: { up: 25, right: 25, down: 25, left: 25 } },
        ]

        // ===== OBJECT TYPES =====
        const OBJ = {
            SWORD: 0,
            KEY_GOLD: 1,
            KEY_BLACK: 2,
            KEY_WHITE: 3,
            CHALICE: 4,
            BRIDGE: 5,
            MAGNET: 6,
            BAT: 7,
            YORGLE: 8,   // Yellow dragon
            GRUNDLE: 9,  // Green dragon
            RHINDLE: 10, // Red dragon
            DOT: 11,     // Easter egg dot
        }

        // ===== GAME STATE =====
        const gameConfig = GAMES.find(g => g.label === 'ADVENTURE')
        let isAttractMode = true
        let gameLevel = 2 // 1, 2, or 3
        let gameState = 'select' // select, playing, win, eaten
        let winFlashTimer = 0
        let eatenTimer = 0
        let attractTimer = 0

        // Player (the square)
        let player = {
            x: 80, y: 96, w: 6, h: 6,
            room: ROOM.GOLD_FOYER,
            carrying: -1, // index into objects, or -1
        }

        // Castle gates
        let gates = {
            gold: { open: false, animFrame: 0 },
            black: { open: false, animFrame: 0 },
            white: { open: false, animFrame: 0 },
        }

        // Objects
        let objects = []

        const initObjects = () => {
            objects = [
                // 0: Sword (arrow shape)
                { type: OBJ.SWORD, room: ROOM.GOLD_FOYER, x: 80, y: 96,
                  color: COLORS.SWORD_COLOR, w: 6, h: 16 },
                // 1: Gold Key
                { type: OBJ.KEY_GOLD, room: ROOM.SOUTHEAST, x: 80, y: 96,
                  color: COLORS.ORANGE, w: 6, h: 10 },
                // 2: Black Key
                { type: OBJ.KEY_BLACK, room: ROOM.BLUE_MAZE_CENTER, x: 80, y: 96,
                  color: COLORS.DARK_GRAY, w: 6, h: 10 },
                // 3: White Key
                { type: OBJ.KEY_WHITE, room: ROOM.RED_MAZE_CENTER, x: 80, y: 130,
                  color: COLORS.WHITE, w: 6, h: 10 },
                // 4: Chalice
                { type: OBJ.CHALICE, room: ROOM.BLACK_FOYER, x: 80, y: 96,
                  color: COLORS.CHALICE_COLOR, w: 8, h: 14, flash: 0 },
                // 5: Bridge
                { type: OBJ.BRIDGE, room: ROOM.BELOW_WHITE, x: 80, y: 60,
                  color: COLORS.TAN, w: 24, h: 4 },
                // 6: Magnet
                { type: OBJ.MAGNET, room: ROOM.BLACK_MAZE_2, x: 80, y: 96,
                  color: COLORS.MAGNET_COLOR, w: 6, h: 12 },
                // 7: Bat
                { type: OBJ.BAT, room: ROOM.MAIN_HALL_RIGHT, x: 100, y: 60,
                  color: COLORS.BLACK, w: 10, h: 10, wingFrame: 0, wingTimer: 0,
                  carrying: -1, seekObj: -1, fedUp: 0 },
                // 8: Yorgle (Yellow Dragon)
                { type: OBJ.YORGLE, room: ROOM.MAIN_HALL_CENTER, x: 80, y: 96,
                  color: COLORS.YELLOW, w: 10, h: 16, state: 'roam',
                  mouthOpen: false, mouthTimer: 0, speed: DRAGON_SPEED,
                  guardObj: OBJ.CHALICE, afraid: [OBJ.KEY_GOLD], dead: false },
                // 9: Grundle (Green Dragon)
                { type: OBJ.GRUNDLE, room: ROOM.BLUE_MAZE_BOTTOM, x: 80, y: 96,
                  color: COLORS.GREEN, w: 10, h: 16, state: 'roam',
                  mouthOpen: false, mouthTimer: 0, speed: DRAGON_SPEED,
                  guardObj: OBJ.BRIDGE, afraid: [], dead: false },
                // 10: Rhindle (Red Dragon)
                { type: OBJ.RHINDLE, room: ROOM.RED_MAZE_1, x: 80, y: 96,
                  color: COLORS.RED, w: 10, h: 16, state: 'roam',
                  mouthOpen: false, mouthTimer: 0, speed: RHINDLE_SPEED,
                  guardObj: OBJ.CHALICE, afraid: [], dead: false },
                // 11: Easter Egg Dot
                { type: OBJ.DOT, room: ROOM.BLACK_MAZE_ENTRY, x: 78, y: 96,
                  color: COLORS.BLACK, w: 1, h: 1 },
            ]
        }

        // Level 1 object positions (simpler game)
        const initLevel1 = () => {
            initObjects()
            // Level 1: only gold/black castles, 2 dragons, no bat, no white castle
            objects[OBJ.SWORD].room = ROOM.GOLD_FOYER
            objects[OBJ.SWORD].x = 80; objects[OBJ.SWORD].y = 80
            objects[OBJ.KEY_GOLD].room = ROOM.SOUTHEAST
            objects[OBJ.KEY_BLACK].room = ROOM.BLUE_MAZE_1
            objects[OBJ.KEY_WHITE].room = -1 // Not in level 1
            objects[OBJ.CHALICE].room = ROOM.BLACK_FOYER
            objects[OBJ.BRIDGE].room = -1 // Not in level 1
            objects[OBJ.MAGNET].room = -1 // Not in level 1
            objects[OBJ.BAT].room = -1 // Not in level 1
            objects[OBJ.YORGLE].room = ROOM.MAIN_HALL_CENTER
            objects[OBJ.GRUNDLE].room = ROOM.BLUE_MAZE_BOTTOM
            objects[OBJ.RHINDLE].room = -1 // Not in level 1
            objects[OBJ.DOT].room = -1 // Not in level 1
            player.room = ROOM.GOLD_FOYER
            player.x = 80; player.y = 130
            player.carrying = -1
            gates.gold = { open: false, animFrame: 0 }
            gates.black = { open: false, animFrame: 0 }
            gates.white = { open: false, animFrame: 0 }
        }

        const initLevel2 = () => {
            initObjects()
            player.room = ROOM.GOLD_FOYER
            player.x = 80; player.y = 130
            player.carrying = -1
            gates.gold = { open: false, animFrame: 0 }
            gates.black = { open: false, animFrame: 0 }
            gates.white = { open: false, animFrame: 0 }
        }

        const initLevel3 = () => {
            initObjects()
            // Randomize positions
            const validRooms = [ROOM.BELOW_GOLD, ROOM.SOUTHEAST, ROOM.SOUTHWEST,
                ROOM.BLUE_MAZE_1, ROOM.BLUE_MAZE_CENTER, ROOM.BLUE_MAZE_BOTTOM,
                ROOM.BELOW_WHITE, ROOM.SOUTH_HALL_R, ROOM.SOUTH_HALL_L,
                ROOM.RED_MAZE_1, ROOM.RED_MAZE_CENTER,
                ROOM.MAIN_HALL_LEFT, ROOM.MAIN_HALL_CENTER, ROOM.MAIN_HALL_RIGHT]
            for (let i = 0; i < objects.length; i++) {
                if (i === OBJ.DOT) continue
                const rm = validRooms[Math.floor(Math.random() * validRooms.length)]
                objects[i].room = rm
                objects[i].x = 30 + Math.random() * 100
                objects[i].y = 30 + Math.random() * 130
            }
            player.room = ROOM.GOLD_FOYER
            player.x = 80; player.y = 130
            player.carrying = -1
            gates.gold = { open: false, animFrame: 0 }
            gates.black = { open: false, animFrame: 0 }
            gates.white = { open: false, animFrame: 0 }
        }

        // Initialize
        initLevel2()

        // ===== INPUT =====
        const keys = {}

        const handleKeyDown = (e) => {
            if (e.key === '?' || (e.shiftKey && e.key === '/')) {
                const newState = !pausedRef.current
                pausedRef.current = newState
                setPaused(newState)
                return
            }
            if (pausedRef.current) return

            if (isAttractMode) {
                isAttractMode = false
                gameState = 'select'
                return
            }

            if (gameState === 'select') {
                if (e.key === '1') { gameLevel = 1; initLevel1(); gameState = 'playing' }
                else if (e.key === '2') { gameLevel = 2; initLevel2(); gameState = 'playing' }
                else if (e.key === '3') { gameLevel = 3; initLevel3(); gameState = 'playing' }
                else if (e.key === ' ' || e.key === 'Enter') {
                    if (gameLevel === 1) initLevel1()
                    else if (gameLevel === 2) initLevel2()
                    else initLevel3()
                    gameState = 'playing'
                }
                else if (e.key === 'ArrowUp') { gameLevel = Math.max(1, gameLevel - 1) }
                else if (e.key === 'ArrowDown') { gameLevel = Math.min(3, gameLevel + 1) }
                e.preventDefault()
                return
            }

            if (gameState === 'win' || gameState === 'eaten') {
                if (e.key === ' ' || e.key === 'Enter') {
                    gameState = 'select'
                }
                e.preventDefault()
                return
            }

            keys[e.key] = true

            // Drop/pickup with space
            if (e.key === ' ') {
                if (player.carrying >= 0) {
                    // Drop
                    const obj = objects[player.carrying]
                    obj.x = player.x
                    obj.y = player.y
                    player.carrying = -1
                    audioController.playTone(200, 0.1, 'square')
                } else {
                    // Pick up nearest object in same room
                    let bestDist = 20
                    let bestIdx = -1
                    for (let i = 0; i < objects.length; i++) {
                        const obj = objects[i]
                        if (obj.room !== player.room) continue
                        if (obj.type === OBJ.YORGLE || obj.type === OBJ.GRUNDLE || obj.type === OBJ.RHINDLE) {
                            if (!obj.dead) continue // Can't pick up live dragons
                        }
                        const dx = obj.x - player.x
                        const dy = obj.y - player.y
                        const dist = Math.sqrt(dx * dx + dy * dy)
                        if (dist < bestDist) {
                            bestDist = dist
                            bestIdx = i
                        }
                    }
                    if (bestIdx >= 0) {
                        player.carrying = bestIdx
                        audioController.playTone(400, 0.1, 'square')
                    }
                }
                e.preventDefault()
            }

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault()
            }
        }

        const handleKeyUp = (e) => {
            keys[e.key] = false
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        // ===== COLLISION =====
        const rectsOverlap = (ax, ay, aw, ah, bx, by, bw, bh) => {
            return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
        }

        const isWallCollision = (x, y, w, h, room) => {
            const rm = rooms[room]
            if (!rm) return false
            for (const wall of rm.walls) {
                if (rectsOverlap(x, y, w, h, wall[0], wall[1], wall[2], wall[3])) {
                    return true
                }
            }
            return false
        }

        // Check if bridge is present and allows passage through a wall
        const bridgeAt = (x, y, w, h) => {
            const bridge = objects[OBJ.BRIDGE]
            if (bridge.room !== player.room) return false
            // Bridge creates a passage - check overlap with bridge
            return rectsOverlap(x, y, w, h, bridge.x - bridge.w/2, bridge.y - bridge.h/2, bridge.w, bridge.h * 3)
        }

        // ===== DRAWING HELPERS =====

        // Draw the player square
        const drawPlayer = (ctx, x, y, w, h) => {
            ctx.fillStyle = COLORS.YELLOW
            ctx.fillRect(x, y, w, h)
        }

        // Draw sword (arrow/cross shape)
        const drawSword = (ctx, x, y) => {
            ctx.fillStyle = COLORS.SWORD_COLOR
            // Vertical shaft
            ctx.fillRect(x + 2, y, 2, 16)
            // Cross guard
            ctx.fillRect(x, y + 4, 6, 2)
            // Arrow tip
            ctx.fillRect(x + 1, y - 2, 4, 2)
        }

        // Draw key
        const drawKey = (ctx, x, y, color) => {
            ctx.fillStyle = color
            // Handle (ring)
            ctx.fillRect(x, y, 6, 2)
            ctx.fillRect(x, y, 2, 4)
            ctx.fillRect(x + 4, y, 2, 4)
            ctx.fillRect(x, y + 4, 6, 2)
            // Shaft
            ctx.fillRect(x + 2, y + 6, 2, 6)
            // Teeth
            ctx.fillRect(x + 4, y + 8, 2, 2)
            ctx.fillRect(x + 4, y + 11, 2, 2)
        }

        // Draw chalice (trophy/goblet shape)
        const drawChalice = (ctx, x, y, flash) => {
            const c = flash > 0 ? (Math.floor(flash / 4) % 2 === 0 ? COLORS.CHALICE_COLOR : COLORS.WHITE) : COLORS.CHALICE_COLOR
            ctx.fillStyle = c
            // Cup top
            ctx.fillRect(x, y, 8, 2)
            ctx.fillRect(x + 1, y + 2, 6, 2)
            ctx.fillRect(x + 2, y + 4, 4, 2)
            // Stem
            ctx.fillRect(x + 3, y + 6, 2, 4)
            // Base
            ctx.fillRect(x + 1, y + 10, 6, 2)
            ctx.fillRect(x, y + 12, 8, 2)
        }

        // Draw bridge
        const drawBridge = (ctx, x, y) => {
            ctx.fillStyle = COLORS.TAN
            ctx.fillRect(x, y, 24, 2)
            ctx.fillRect(x, y + 6, 24, 2)
            ctx.fillRect(x, y, 2, 8)
            ctx.fillRect(x + 22, y, 2, 8)
        }

        // Draw magnet (horseshoe shape)
        const drawMagnet = (ctx, x, y) => {
            ctx.fillStyle = COLORS.RED
            ctx.fillRect(x, y, 2, 12)
            ctx.fillRect(x + 4, y, 2, 12)
            ctx.fillRect(x, y, 6, 2)
            // Tips
            ctx.fillStyle = COLORS.GRAY
            ctx.fillRect(x, y + 10, 2, 2)
            ctx.fillRect(x + 4, y + 10, 2, 2)
        }

        // Draw dragon
        const drawDragon = (ctx, x, y, color, mouthOpen, dead) => {
            ctx.fillStyle = color
            if (dead) {
                // Dead dragon - lying on side
                ctx.fillRect(x - 2, y + 8, 14, 4)
                ctx.fillRect(x + 8, y + 6, 4, 2)
                return
            }
            // Body
            ctx.fillRect(x + 2, y + 4, 6, 8)
            // Head
            if (mouthOpen) {
                // Open mouth - jaw drops
                ctx.fillRect(x + 1, y, 8, 4) // upper head
                ctx.fillRect(x + 1, y + 4, 8, 2) // jaw
                // Mouth gap
                ctx.fillStyle = rooms[player.room]?.bg || COLORS.BLACK
                ctx.fillRect(x + 3, y + 3, 4, 2)
                ctx.fillStyle = color
            } else {
                ctx.fillRect(x + 1, y, 8, 4)
            }
            // Eyes
            ctx.fillStyle = COLORS.WHITE
            ctx.fillRect(x + 6, y + 1, 2, 2)
            ctx.fillStyle = color
            // Legs
            ctx.fillRect(x, y + 10, 2, 4)
            ctx.fillRect(x + 4, y + 10, 2, 4)
            ctx.fillRect(x + 6, y + 10, 2, 4)
            // Tail
            ctx.fillRect(x + 2, y + 12, 6, 2)
            ctx.fillRect(x + 6, y + 14, 4, 2)
            ctx.fillRect(x + 8, y + 16, 2, 2)
            // Wings/horns
            ctx.fillRect(x - 1, y + 2, 2, 2)
            ctx.fillRect(x + 9, y + 2, 2, 2)
        }

        // Draw bat
        const drawBat = (ctx, x, y, wingFrame) => {
            ctx.fillStyle = COLORS.BLACK
            // Body
            ctx.fillRect(x + 3, y + 3, 4, 6)
            // Head
            ctx.fillRect(x + 3, y, 4, 3)
            // Ears
            ctx.fillRect(x + 2, y - 1, 2, 2)
            ctx.fillRect(x + 6, y - 1, 2, 2)
            // Eyes
            ctx.fillStyle = COLORS.RED
            ctx.fillRect(x + 3, y + 1, 1, 1)
            ctx.fillRect(x + 6, y + 1, 1, 1)
            ctx.fillStyle = COLORS.BLACK
            // Wings
            if (wingFrame % 2 === 0) {
                // Wings up
                ctx.fillRect(x - 3, y + 1, 6, 2)
                ctx.fillRect(x + 7, y + 1, 6, 2)
                ctx.fillRect(x - 4, y - 1, 3, 2)
                ctx.fillRect(x + 11, y - 1, 3, 2)
            } else {
                // Wings down
                ctx.fillRect(x - 3, y + 5, 6, 2)
                ctx.fillRect(x + 7, y + 5, 6, 2)
                ctx.fillRect(x - 4, y + 7, 3, 2)
                ctx.fillRect(x + 11, y + 7, 3, 2)
            }
            // Feet
            ctx.fillRect(x + 3, y + 9, 2, 2)
            ctx.fillRect(x + 5, y + 9, 2, 2)
        }

        // Draw castle gate (portcullis)
        const drawGate = (ctx, x, y, color, open, animFrame) => {
            ctx.fillStyle = color
            const gateH = open ? Math.max(0, 30 - animFrame * 2) : 30
            // Portcullis bars
            for (let i = 0; i < 5; i++) {
                ctx.fillRect(x + i * 8, y, 2, gateH)
            }
            for (let j = 0; j < Math.floor(gateH / 6); j++) {
                ctx.fillRect(x, y + j * 6, 38, 2)
            }
        }

        // ===== GAME LOGIC =====

        const movePlayer = () => {
            if (gameState !== 'playing') return

            let dx = 0, dy = 0
            if (keys['ArrowUp']) dy = -PLAYER_SPEED
            if (keys['ArrowDown']) dy = PLAYER_SPEED
            if (keys['ArrowLeft']) dx = -PLAYER_SPEED
            if (keys['ArrowRight']) dx = PLAYER_SPEED

            // Diagonal movement normalization
            if (dx !== 0 && dy !== 0) {
                dx *= 0.707
                dy *= 0.707
            }

            let newX = player.x + dx
            let newY = player.y + dy

            // Check wall collisions (unless bridge helps)
            if (dx !== 0) {
                if (isWallCollision(newX, player.y, player.w, player.h, player.room) && !bridgeAt(newX, player.y, player.w, player.h)) {
                    newX = player.x
                }
            }
            if (dy !== 0) {
                if (isWallCollision(player.x, newY, player.w, player.h, player.room) && !bridgeAt(player.x, newY, player.w, player.h)) {
                    newY = player.y
                }
            }

            // Room transitions
            const rm = rooms[player.room]
            if (newY < 0) {
                // Go up
                if (rm.exits.up >= 0) {
                    player.room = rm.exits.up
                    newY = H - player.h - WALL_THICKNESS - 1
                } else { newY = 0 }
            } else if (newY + player.h > H) {
                // Go down
                if (rm.exits.down >= 0) {
                    // Check for castle gate
                    const castleKey = rm.castle
                    if (castleKey) {
                        const gate = gates[castleKey]
                        if (!gate.open) {
                            newY = player.y // Blocked by gate
                        } else {
                            // Enter castle foyer
                            if (castleKey === 'gold') player.room = ROOM.GOLD_FOYER
                            else if (castleKey === 'black') player.room = ROOM.BLACK_FOYER
                            else if (castleKey === 'white') player.room = ROOM.WHITE_FOYER
                            newY = WALL_THICKNESS + 2
                        }
                    } else {
                        player.room = rm.exits.down
                        newY = WALL_THICKNESS + 1
                    }
                } else { newY = H - player.h }
            }
            if (newX < 0) {
                if (rm.exits.left >= 0) {
                    player.room = rm.exits.left
                    newX = W - player.w - WALL_THICKNESS - 1
                } else { newX = 0 }
            } else if (newX + player.w > W) {
                if (rm.exits.right >= 0) {
                    player.room = rm.exits.right
                    newX = WALL_THICKNESS + 1
                } else { newX = W - player.w }
            }

            // Handle entering castle from below (foyer exit up -> castle room)
            if (rm.inside) {
                if (newY < 0) {
                    const castleKey = rm.inside
                    // Going up from foyer - exit through gate
                    if (castleKey === 'gold') player.room = ROOM.GOLD_CASTLE
                    else if (castleKey === 'black') player.room = ROOM.BLACK_CASTLE
                    else if (castleKey === 'white') player.room = ROOM.WHITE_CASTLE
                    newY = H - player.h - WALL_THICKNESS - 2
                    // Position at gate center
                    newX = 76
                }
            }

            player.x = newX
            player.y = newY

            // Move carried object with player
            if (player.carrying >= 0) {
                const obj = objects[player.carrying]
                obj.room = player.room
                obj.x = player.x
                obj.y = player.y + player.h + 2
            }
        }

        // Dragon AI
        const updateDragon = (dragon) => {
            if (dragon.dead) return
            if (dragon.room < 0) return

            // Check if dragon is afraid of something player carries
            if (player.carrying >= 0 && dragon.afraid.includes(objects[player.carrying].type)) {
                // Run away from player
                if (dragon.room === player.room) {
                    const dx = dragon.x - player.x
                    const dy = dragon.y - player.y
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1
                    dragon.x += (dx / dist) * dragon.speed
                    dragon.y += (dy / dist) * dragon.speed
                }
                return
            }

            // Check for sword kill
            if (player.carrying === OBJ.SWORD && dragon.room === player.room) {
                const sword = objects[OBJ.SWORD]
                if (rectsOverlap(dragon.x, dragon.y, dragon.w, dragon.h, sword.x - 2, sword.y - 2, sword.w + 4, sword.h + 4)) {
                    dragon.dead = true
                    dragon.state = 'dead'
                    audioController.playSweep(600, 100, 0.3)
                    return
                }
            }

            // Chase player if in same room
            if (dragon.room === player.room && dragon.state !== 'eating') {
                dragon.state = 'chase'
                const dx = player.x - dragon.x
                const dy = player.y - dragon.y
                const dist = Math.sqrt(dx * dx + dy * dy) || 1
                dragon.x += (dx / dist) * dragon.speed
                dragon.y += (dy / dist) * dragon.speed

                // Try to eat player
                dragon.mouthTimer++
                if (dragon.mouthTimer > 30) {
                    dragon.mouthOpen = true
                }
                if (dragon.mouthTimer > 40) {
                    dragon.mouthOpen = false
                    dragon.mouthTimer = 0
                }

                if (dragon.mouthOpen && rectsOverlap(
                    player.x, player.y, player.w, player.h,
                    dragon.x - 2, dragon.y - 2, dragon.w + 4, dragon.h + 4
                )) {
                    // Eaten!
                    gameState = 'eaten'
                    eatenTimer = 0
                    dragon.state = 'eating'
                    audioController.playSweep(400, 80, 0.5)
                }
            } else if (dragon.room !== player.room) {
                // Roam or guard
                dragon.state = 'roam'
                dragon.mouthOpen = false
                dragon.mouthTimer = 0

                // Move toward guarded object or roam randomly
                const guardedObj = objects[dragon.guardObj]
                if (guardedObj && guardedObj.room === dragon.room) {
                    // Stay near guarded object
                    const dx = guardedObj.x - dragon.x
                    const dy = guardedObj.y - dragon.y
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1
                    if (dist > 20) {
                        dragon.x += (dx / dist) * dragon.speed * 0.3
                        dragon.y += (dy / dist) * dragon.speed * 0.3
                    }
                } else {
                    // Random wander
                    if (Math.random() < 0.02) {
                        dragon.x += (Math.random() - 0.5) * 10
                        dragon.y += (Math.random() - 0.5) * 10
                    }
                }
            }

            // Keep in bounds
            dragon.x = Math.max(WALL_THICKNESS + 1, Math.min(W - WALL_THICKNESS - dragon.w - 1, dragon.x))
            dragon.y = Math.max(WALL_THICKNESS + 1, Math.min(H - WALL_THICKNESS - dragon.h - 1, dragon.y))
        }

        // Bat AI
        const updateBat = () => {
            const bat = objects[OBJ.BAT]
            if (bat.room < 0) return

            bat.wingTimer++
            if (bat.wingTimer > 8) {
                bat.wingTimer = 0
                bat.wingFrame = (bat.wingFrame + 1) % 2
            }

            // Bat picks up and swaps objects
            bat.fedUp++
            if (bat.fedUp > 120) {
                bat.fedUp = 0
                // Find a random object to seek
                const pickable = objects.filter((o, i) =>
                    i !== OBJ.BAT && i !== OBJ.DOT && o.room >= 0 && !o.dead)
                if (pickable.length > 0) {
                    const target = pickable[Math.floor(Math.random() * pickable.length)]
                    bat.seekObj = objects.indexOf(target)
                }
            }

            // Move toward seek target
            if (bat.seekObj >= 0 && bat.seekObj < objects.length) {
                const target = objects[bat.seekObj]
                if (target.room === bat.room) {
                    const dx = target.x - bat.x
                    const dy = target.y - bat.y
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1
                    bat.x += (dx / dist) * BAT_SPEED
                    bat.y += (dy / dist) * BAT_SPEED

                    // Pick up if close
                    if (dist < 10) {
                        if (bat.carrying >= 0) {
                            // Drop what we're carrying
                            const dropped = objects[bat.carrying]
                            dropped.x = bat.x
                            dropped.y = bat.y
                            dropped.room = bat.room
                            if (player.carrying === bat.carrying) {
                                player.carrying = -1
                            }
                        }
                        // Swap - pick up target
                        if (player.carrying === bat.seekObj) {
                            player.carrying = -1
                        }
                        bat.carrying = bat.seekObj
                        bat.seekObj = -1
                        bat.fedUp = 0
                    }
                } else {
                    // Move to random adjacent room
                    if (Math.random() < 0.01) {
                        const rm = rooms[bat.room]
                        const exits = [rm.exits.up, rm.exits.right, rm.exits.down, rm.exits.left]
                            .filter(e => e >= 0)
                        if (exits.length > 0) {
                            bat.room = exits[Math.floor(Math.random() * exits.length)]
                            bat.x = 80
                            bat.y = 96
                        }
                    }
                }
            } else {
                // Wander
                if (Math.random() < 0.02) {
                    bat.x += (Math.random() - 0.5) * 15
                    bat.y += (Math.random() - 0.5) * 15
                }
                // Occasionally move to adjacent room
                if (Math.random() < 0.005) {
                    const rm = rooms[bat.room]
                    const exits = [rm.exits.up, rm.exits.right, rm.exits.down, rm.exits.left]
                        .filter(e => e >= 0)
                    if (exits.length > 0) {
                        bat.room = exits[Math.floor(Math.random() * exits.length)]
                        bat.x = 80
                        bat.y = 96
                    }
                }
            }

            // Move carried object
            if (bat.carrying >= 0) {
                const obj = objects[bat.carrying]
                obj.room = bat.room
                obj.x = bat.x
                obj.y = bat.y + 10
            }

            // Keep in bounds
            bat.x = Math.max(WALL_THICKNESS + 5, Math.min(W - WALL_THICKNESS - 15, bat.x))
            bat.y = Math.max(WALL_THICKNESS + 5, Math.min(H - WALL_THICKNESS - 15, bat.y))
        }

        // Check castle key interactions
        const updateCastles = () => {
            for (const castleKey of ['gold', 'black', 'white']) {
                const gate = gates[castleKey]
                let keyIdx
                if (castleKey === 'gold') keyIdx = OBJ.KEY_GOLD
                else if (castleKey === 'black') keyIdx = OBJ.KEY_BLACK
                else keyIdx = OBJ.KEY_WHITE

                const key = objects[keyIdx]
                let castleRoom
                if (castleKey === 'gold') castleRoom = ROOM.GOLD_CASTLE
                else if (castleKey === 'black') castleRoom = ROOM.BLACK_CASTLE
                else castleRoom = ROOM.WHITE_CASTLE

                // Check if key is near gate
                if (key.room === castleRoom && key.y > H - 40) {
                    if (!gate.open) {
                        gate.open = true
                        gate.animFrame = 0
                        audioController.playSweep(200, 600, 0.3)
                    }
                }

                // Animate gate
                if (gate.open && gate.animFrame < 15) {
                    gate.animFrame++
                }
            }
        }

        // Magnet pulls objects
        const updateMagnet = () => {
            const magnet = objects[OBJ.MAGNET]
            if (magnet.room < 0) return

            for (let i = 0; i < objects.length; i++) {
                if (i === OBJ.MAGNET || i === OBJ.BAT || i === OBJ.DOT) continue
                const obj = objects[i]
                if (obj.room !== magnet.room) continue
                if (player.carrying === i) continue // Don't pull carried items

                const dx = magnet.x - obj.x
                const dy = magnet.y - obj.y
                const dist = Math.sqrt(dx * dx + dy * dy) || 1
                if (dist < 60 && dist > 5) {
                    obj.x += (dx / dist) * 0.3
                    obj.y += (dy / dist) * 0.3
                }
            }
        }

        // Check win condition
        const checkWin = () => {
            if (gameState !== 'playing') return
            const chalice = objects[OBJ.CHALICE]
            if (player.carrying === OBJ.CHALICE && player.room === ROOM.GOLD_FOYER) {
                gameState = 'win'
                winFlashTimer = 0
                audioController.playSweep(200, 800, 1.0)
            }
        }

        // ===== ATTRACT MODE AI =====
        const updateAttract = () => {
            attractTimer++
            // Simple demo - player wanders around
            if (attractTimer % 60 < 20) keys['ArrowRight'] = true
            else keys['ArrowRight'] = false
            if (attractTimer % 120 < 30) keys['ArrowDown'] = true
            else keys['ArrowDown'] = false
            if (attractTimer % 180 < 20) keys['ArrowUp'] = true
            else keys['ArrowUp'] = false
        }

        // ===== RESIZE =====
        const resize = () => {
            const container = containerRef.current
            if (!container) return
            const rect = container.getBoundingClientRect()
            canvas.width = rect.width
            canvas.height = rect.height
        }
        window.addEventListener('resize', resize)
        resize()

        // ===== MAIN UPDATE =====
        const update = () => {
            if (isAttractMode) {
                updateAttract()
            }

            if (gameState === 'playing') {
                movePlayer()
                updateDragon(objects[OBJ.YORGLE])
                updateDragon(objects[OBJ.GRUNDLE])
                updateDragon(objects[OBJ.RHINDLE])
                updateBat()
                updateCastles()
                updateMagnet()
                checkWin()
            }

            if (gameState === 'win') {
                winFlashTimer++
                objects[OBJ.CHALICE].flash = winFlashTimer
            }

            if (gameState === 'eaten') {
                eatenTimer++
                if (eatenTimer > 180) {
                    // Reset after being eaten
                    gameState = 'select'
                }
            }
        }

        // ===== MAIN DRAW =====
        const draw = () => {
            const cw = canvas.width
            const ch = canvas.height
            ctx.clearRect(0, 0, cw, ch)

            // Calculate scale to fit canvas
            const scaleX = cw / W
            const scaleY = ch / H
            const scale = Math.min(scaleX, scaleY)
            const offsetX = (cw - W * scale) / 2
            const offsetY = (ch - H * scale) / 2

            ctx.save()
            ctx.translate(offsetX, offsetY)
            ctx.scale(scale, scale)

            // Disable image smoothing for pixel-perfect look
            ctx.imageSmoothingEnabled = false

            if (gameState === 'select' || isAttractMode) {
                drawSelectScreen(ctx)
            } else if (gameState === 'playing' || gameState === 'eaten') {
                drawRoom(ctx)
                drawObjects(ctx)
                drawPlayerSprite(ctx)

                if (gameState === 'eaten') {
                    drawEatenOverlay(ctx)
                }
            } else if (gameState === 'win') {
                drawRoom(ctx)
                drawObjects(ctx)
                drawPlayerSprite(ctx)
                drawWinOverlay(ctx)
            }

            ctx.restore()
        }

        const drawSelectScreen = (ctx) => {
            ctx.fillStyle = COLORS.BLACK
            ctx.fillRect(0, 0, W, H)

            // Title
            ctx.fillStyle = COLORS.YELLOW
            ctx.font = '12px monospace'
            ctx.textAlign = 'center'
            ctx.fillText('ADVENTURE', W / 2, 40)

            // Game level selection
            ctx.font = '8px monospace'
            ctx.fillStyle = COLORS.WHITE
            ctx.fillText('SELECT GAME', W / 2, 70)

            for (let i = 1; i <= 3; i++) {
                ctx.fillStyle = i === gameLevel ? COLORS.YELLOW : COLORS.GRAY
                const label = i === 1 ? '1 - BEGINNER' : i === 2 ? '2 - STANDARD' : '3 - RANDOM'
                ctx.fillText(label, W / 2, 85 + i * 14)
            }

            ctx.fillStyle = COLORS.ORANGE
            ctx.fillText('PRESS ENTER', W / 2, 155)

            // Draw small chalice
            drawChalice(ctx, W / 2 - 4, 165, 0)

            if (isAttractMode) {
                ctx.fillStyle = (Math.floor(attractTimer / 30) % 2 === 0) ? COLORS.WHITE : COLORS.BLACK
                ctx.fillText('PRESS ANY KEY', W / 2, 185)
            }
        }

        const drawRoom = (ctx) => {
            const rm = rooms[player.room]
            if (!rm) return

            // Background
            ctx.fillStyle = rm.bg
            ctx.fillRect(0, 0, W, H)

            // Walls
            ctx.fillStyle = rm.wallColor
            for (const wall of rm.walls) {
                if (rm.invisible) {
                    // Invisible maze - walls same as bg
                    ctx.fillStyle = rm.bg
                }
                ctx.fillRect(wall[0], wall[1], wall[2], wall[3])
            }

            // Castle gates
            if (rm.castle) {
                const gate = gates[rm.castle]
                let gateColor
                if (rm.castle === 'gold') gateColor = COLORS.YELLOW
                else if (rm.castle === 'black') gateColor = COLORS.GRAY
                else gateColor = COLORS.WHITE
                drawGate(ctx, 62, H - 30, gateColor, gate.open, gate.animFrame)
            }

            // Easter egg room
            if (player.room === ROOM.EASTER_EGG) {
                ctx.fillStyle = COLORS.FLASH_COLOR
                ctx.font = '6px monospace'
                ctx.textAlign = 'center'
                ctx.fillText('Created by', W / 2, 60)
                ctx.fillText('Warren Robinett', W / 2, 80)
            }
        }

        const drawObjects = (ctx) => {
            for (let i = 0; i < objects.length; i++) {
                const obj = objects[i]
                if (obj.room !== player.room) continue
                if (player.carrying === i) continue // Draw carried item with player

                switch (obj.type) {
                    case OBJ.SWORD:
                        drawSword(ctx, obj.x, obj.y)
                        break
                    case OBJ.KEY_GOLD:
                    case OBJ.KEY_BLACK:
                    case OBJ.KEY_WHITE:
                        drawKey(ctx, obj.x, obj.y, obj.color)
                        break
                    case OBJ.CHALICE:
                        drawChalice(ctx, obj.x, obj.y, obj.flash || 0)
                        break
                    case OBJ.BRIDGE:
                        drawBridge(ctx, obj.x, obj.y)
                        break
                    case OBJ.MAGNET:
                        drawMagnet(ctx, obj.x, obj.y)
                        break
                    case OBJ.BAT:
                        drawBat(ctx, obj.x, obj.y, obj.wingFrame)
                        break
                    case OBJ.YORGLE:
                    case OBJ.GRUNDLE:
                    case OBJ.RHINDLE:
                        drawDragon(ctx, obj.x, obj.y, obj.color, obj.mouthOpen, obj.dead)
                        break
                    case OBJ.DOT:
                        // Tiny 1px dot - nearly invisible
                        ctx.fillStyle = obj.color
                        ctx.fillRect(obj.x, obj.y, 1, 1)
                        break
                }
            }
        }

        const drawPlayerSprite = (ctx) => {
            if (gameState === 'eaten') return // Don't draw when eaten

            // Draw player square
            drawPlayer(ctx, player.x, player.y, player.w, player.h)

            // Draw carried object attached to player
            if (player.carrying >= 0) {
                const obj = objects[player.carrying]
                switch (obj.type) {
                    case OBJ.SWORD:
                        drawSword(ctx, player.x, player.y + player.h + 2)
                        break
                    case OBJ.KEY_GOLD:
                    case OBJ.KEY_BLACK:
                    case OBJ.KEY_WHITE:
                        drawKey(ctx, player.x, player.y + player.h + 2, obj.color)
                        break
                    case OBJ.CHALICE:
                        drawChalice(ctx, player.x - 1, player.y + player.h + 2, obj.flash || 0)
                        break
                    case OBJ.BRIDGE:
                        drawBridge(ctx, player.x - 9, player.y + player.h + 2)
                        break
                    case OBJ.MAGNET:
                        drawMagnet(ctx, player.x, player.y + player.h + 2)
                        break
                    default:
                        break
                }
            }
        }

        const drawEatenOverlay = (ctx) => {
            // Show player inside dragon's belly
            const flash = Math.floor(eatenTimer / 10) % 2
            ctx.fillStyle = flash ? COLORS.RED : COLORS.DARK_RED
            ctx.font = '8px monospace'
            ctx.textAlign = 'center'
            ctx.fillText('YOU HAVE BEEN', W / 2, H / 2 - 10)
            ctx.fillText('EATEN!', W / 2, H / 2 + 5)

            if (eatenTimer > 90) {
                ctx.fillStyle = COLORS.WHITE
                ctx.fillText('PRESS ENTER', W / 2, H / 2 + 30)
            }
        }

        const drawWinOverlay = (ctx) => {
            const flash = Math.floor(winFlashTimer / 8) % 4
            const winColors = [COLORS.YELLOW, COLORS.ORANGE, COLORS.RED, COLORS.WHITE]
            ctx.fillStyle = winColors[flash]
            ctx.font = '10px monospace'
            ctx.textAlign = 'center'
            ctx.fillText('YOU WIN!', W / 2, H / 2 - 10)

            ctx.fillStyle = COLORS.WHITE
            ctx.font = '6px monospace'
            ctx.fillText('THE CHALICE', W / 2, H / 2 + 10)
            ctx.fillText('HAS BEEN', W / 2, H / 2 + 22)
            ctx.fillText('RETURNED!', W / 2, H / 2 + 34)

            if (winFlashTimer > 60) {
                ctx.fillStyle = COLORS.YELLOW
                ctx.fillText('PRESS ENTER', W / 2, H / 2 + 55)
            }
        }

        // ===== GAME LOOP =====
        const loop = () => {
            if (!pausedRef.current) {
                update()
                draw()
            }
            animationFrameId = requestAnimationFrame(loop)
        }
        loop()

        // ===== CLEANUP =====
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
            window.removeEventListener('resize', resize)
            cancelAnimationFrame(animationFrameId)
        }
    }, [])

    return (
        <div className="fixed inset-0 bg-black flex items-center justify-center p-4">
            <div ref={containerRef} className="relative w-full max-w-[600px] aspect-[3/4] border-2 border-neutral-800 rounded-lg overflow-hidden shadow-2xl shadow-neutral-900 bg-black">
                <canvas ref={canvasRef} className="block w-full h-full" />
                {paused && <PauseOverlay game={GAMES.find(g => g.label === 'ADVENTURE')} onResume={handleResume} />}
            </div>
            <VirtualControls />
        </div>
    )
}

export default AdventureGame
