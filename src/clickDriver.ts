/**
 * A player at the mouse for the humanizer's tests, through the Beta native's virtual mouse: the right
 * button held while the cursor glides around - the game repeats the walk - and single clicks between
 * the holds, inside the humanizer's green zone. Seeded, so the same seed walks the same path. Driven
 * over the debugger protocol: `DEBUGGER_CLICK_DRIVER.start({ seconds: 45, seed: 1 })`.
 */
interface DriverOptions {
	readonly seconds?: number
	readonly seed?: number
	/** The screen area, in shares of it, the cursor stays in: left, top, right, bottom. */
	readonly rect?: readonly number[]
	/** The share of presses held down rather than clicked. */
	readonly holdShare?: number
	readonly holdMs?: readonly number[]
	readonly gapMs?: readonly number[]
	readonly tapMs?: readonly number[]
	/** Peak speed of a glide, pixels a second. */
	readonly speed?: readonly number[]
}

/** Where the player's cursor was on the ground, frame by frame: the `hrtime`, x and y. */
const groundPath: number[][] = []
/** Frames of `groundPath` kept: about a minute at the frame rates the tests run at. */
const PATH_FRAMES = 60000

const state = { running: false, startedAt: 0, holds: 0, clicks: 0, failed: 0, left: 0 }
let held = false,
	stopTimer: Nullable<ReturnType<typeof setTimeout>>,
	step: Nullable<() => void>

function Seeded(seed: number): () => number {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

function Press(down: boolean): void {
	if (held === down) {
		return
	}
	held = down
	if (!PostWindowButton(true, down)) {
		state.failed++
	}
}

function Stop(): void {
	if (step !== undefined) {
		EventsSDK.removeListener("Draw", step)
		step = undefined
	}
	if (stopTimer !== undefined) {
		clearTimeout(stopTimer)
		stopTimer = undefined
	}
	Press(false)
	state.running = false
	SetVirtualMouse(false)
}

function Start({
	seconds = 45,
	seed = 1,
	rect = [0.32, 0.3, 0.78, 0.57],
	holdShare = 0.7,
	holdMs = [600, 2500],
	gapMs = [80, 350],
	tapMs = [40, 90],
	speed = [700, 2200]
}: DriverOptions = {}): string {
	Stop()
	groundPath.length = 0
	const random = Seeded(seed),
		range = (bounds: readonly number[]) =>
			bounds[0] + random() * (bounds[1] - bounds[0]),
		size = RendererSDK.WindowSize,
		pick = () => [
			(rect[0] + random() * (rect[2] - rect[0])) * size.x,
			(rect[1] + random() * (rect[3] - rect[1])) * size.y
		],
		cursor = InputManager.CursorOnScreen,
		begin = hrtime()
	let from = [cursor.x, cursor.y],
		to = from,
		segmentAt = begin,
		segmentMs = 1,
		phaseEnd = begin + 400 + range(gapMs),
		phase = "gap"
	const plan = (now: number) => {
		from = to
		to = pick()
		segmentMs =
			80 + (Math.hypot(to[0] - from[0], to[1] - from[1]) / range(speed)) * 1875
		segmentAt = now
	}
	plan(begin)
	state.running = true
	state.startedAt = begin
	state.holds = state.clicks = state.failed = 0
	SetVirtualMouse(true)
	step = () => {
		const now = hrtime()
		let t = (now - segmentAt) / segmentMs
		if (t >= 1) {
			plan(now)
			t = 0
		}
		const eased = t * t * t * (10 - 15 * t + 6 * t * t),
			ground = InputManager.CursorOnWorld
		PostWindowMove(
			from[0] + (to[0] - from[0]) * eased,
			from[1] + (to[1] - from[1]) * eased
		)
		groundPath.push([now, ground.x, ground.y])
		if (groundPath.length > PATH_FRAMES) {
			groundPath.shift()
		}
		if (now >= phaseEnd) {
			if (phase === "gap") {
				const hold = random() < holdShare
				phase = hold ? "hold" : "tap"
				phaseEnd = now + range(hold ? holdMs : tapMs)
				if (hold) {
					state.holds++
				} else {
					state.clicks++
				}
				Press(true)
			} else {
				Press(false)
				phase = "gap"
				phaseEnd = now + range(gapMs)
			}
		}
		state.left = Math.max(0, Math.round((begin + seconds * 1000 - now) / 1000))
	}
	EventsSDK.on("Draw", step)
	stopTimer = setTimeout(Stop, seconds * 1000)
	return "started"
}

/** Where the player's cursor was on the ground at `time` (`hrtime`), by the last frame before it. */
function GroundAt(time: number): Nullable<number[]> {
	let low = 0,
		high = groundPath.length - 1
	if (high < 0 || groundPath[0][0] > time) {
		return undefined
	}
	while (low < high) {
		const middle = (low + high + 1) >> 1
		if (groundPath[middle][0] <= time) {
			low = middle
		} else {
			high = middle - 1
		}
	}
	return groundPath[low]
}

const globalThisAny = globalThis as any
globalThisAny.DEBUGGER_CLICK_DRIVER = {
	start: Start,
	stop: Stop,
	state,
	groundAt: GroundAt
}
