/** Beta native: hands the game's cursor to PostWindowMove and PostWindowButton alone. */
declare function SetVirtualMouse(enabled: boolean): void
/** Beta native: moves the game's cursor to x, y surface pixels without touching the real one. */
declare function PostWindowMove(x: number, y: number): boolean
/** Beta native: presses or releases a button of the game's cursor where PostWindowMove put it. */
declare function PostWindowButton(right: boolean, down: boolean): boolean
