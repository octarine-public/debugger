/** Beta native: hands the game's cursor to PostWindowMove and PostWindowButton alone. */
declare function SetVirtualMouse(enabled: boolean): void
/** Beta native: moves the game's cursor to x, y surface pixels without touching the real one. */
declare function PostWindowMove(x: number, y: number): boolean
/**
 * Beta native: presses or releases a button of the game's cursor where PostWindowMove put it: true
 * or 1 the right one, false or 0 the left, 2 the middle.
 */
declare function PostWindowButton(button: boolean | 0 | 1 | 2, down: boolean): boolean
/** Beta native: presses or releases the virtual-key `key` in the game's window. */
declare function PostWindowKey(key: number, down: boolean): boolean
