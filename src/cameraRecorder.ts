/**
 * Records how the player moves the camera and what the server gets for it, for the humanizer's
 * camera grip and arrows: every frame the real camera, the cursor and the keys held, and every
 * user command and order that went out (Beta wire events). Driven over the debugger protocol:
 * `DEBUGGER_CAMERA_RECORDER.start(120)`, then `take("frames", 0, 5000)` page by page.
 */
const FRAME_LIMIT = 600000
const COMMAND_LIMIT = 100000
const ORDER_LIMIT = 10000

/** The mouse buttons of a frame's mask, its lowest bits: left, right, middle. */
const BUTTONS = [VMouseKeys.MK_LBUTTON, VMouseKeys.MK_RBUTTON, VMouseKeys.MK_MBUTTON]
/** The keys of a frame's mask, in bit order after `BUTTONS`: the arrows, Alt, Ctrl and Shift. */
const KEYS = [
	VKeys.UP,
	VKeys.DOWN,
	VKeys.LEFT,
	VKeys.RIGHT,
	VKeys.MENU,
	VKeys.CONTROL,
	VKeys.SHIFT
]

/**
 * A frame: `hrtime`, camera x, y, z and distance, cursor on the screen x, y (pixels), cursor on the
 * ground x, y, keys mask (`BUTTONS`, then `KEYS`).
 */
const frames: number[][] = []
/**
 * A command: `hrtime` of its move message, whether the scripts wrote it (0: the game), tick, mouse x,
 * y (0..511, 0..384), camera x, y, ground under the cursor x, y, buttons 1, 2, 3, forward, left, pitch,
 * yaw, impulse, flags, subticks, subtick buttons, click behaviour.
 */
const commands: number[][] = []
/** An order: `hrtime`, whether the game sent it (0: the scripts), type, x, y, target, ability. */
const orders: number[][] = []

const state = { running: false, startedAt: 0, until: 0 }
let stopTimer: Nullable<ReturnType<typeof setTimeout>>

function Round(value: number): number {
	return Math.round(value * 10) / 10
}

function Stop(): void {
	if (stopTimer !== undefined) {
		clearTimeout(stopTimer)
		stopTimer = undefined
	}
	state.running = false
}

function Start(seconds = 120): typeof state {
	Stop()
	frames.length = 0
	commands.length = 0
	orders.length = 0
	state.running = true
	state.startedAt = hrtime()
	state.until = state.startedAt + seconds * 1000
	stopTimer = setTimeout(Stop, seconds * 1000)
	return state
}

EventsSDK.on("Draw", () => {
	if (!state.running || frames.length >= FRAME_LIMIT) {
		return
	}
	const camera = CameraSDK.Position,
		screen = InputManager.CursorOnScreen,
		ground = InputManager.CursorOnWorld
	let keys = 0
	for (let i = 0, end = BUTTONS.length; i < end; i++) {
		if (InputManager.IsMouseKeyDown(BUTTONS[i])) {
			keys |= 1 << i
		}
	}
	for (let i = 0, end = KEYS.length; i < end; i++) {
		if (InputManager.IsKeyDown(KEYS[i])) {
			keys |= 1 << (BUTTONS.length + i)
		}
	}
	frames.push([
		Round(hrtime()),
		Round(camera.x),
		Round(camera.y),
		Round(camera.z),
		Round(CameraSDK.Distance),
		Round(screen.x),
		Round(screen.y),
		Round(ground.x),
		Round(ground.y),
		keys
	])
})

Source2SDK.NativeEvents.on("UserCmdSent", (time, own, sent) => {
	if (!state.running) {
		return
	}
	for (let i = 0, end = sent.length; i < end && commands.length < COMMAND_LIMIT; i++) {
		const cmd = sent[i]
		commands.push([
			Round(time),
			own ? 1 : 0,
			cmd.tick,
			cmd.mouseX,
			cmd.mouseY,
			cmd.cameraX,
			cmd.cameraY,
			Round(cmd.underX),
			Round(cmd.underY),
			cmd.buttons1,
			cmd.buttons2,
			cmd.buttons3,
			cmd.forwardMove,
			cmd.leftMove,
			Round(cmd.pitch),
			Round(cmd.yaw),
			cmd.impulse,
			cmd.cmdFlags,
			cmd.subticks,
			cmd.subtickButtons,
			cmd.click
		])
	}
})

Source2SDK.NativeEvents.on("OrdersSent", (time, sent, fromGame) => {
	if (!state.running) {
		return
	}
	for (let i = 0, end = sent.length; i < end && orders.length < ORDER_LIMIT; i++) {
		const order = sent[i]
		orders.push([
			Round(time),
			fromGame ? 1 : 0,
			order.type,
			Round(order.positionX),
			Round(order.positionY),
			order.target,
			order.ability
		])
	}
})

const globalThisAny = globalThis as any
globalThisAny.DEBUGGER_CAMERA_RECORDER = {
	start: Start,
	stop: Stop,
	state: () => ({
		...state,
		frames: frames.length,
		commands: commands.length,
		orders: orders.length
	}),
	/** A page of `what` ("frames", "commands" or "orders"): `count` rows from `from`. */
	take: (what: "frames" | "commands" | "orders", from = 0, count = 5000) =>
		(what === "frames" ? frames : what === "commands" ? commands : orders).slice(
			from,
			from + count
		)
}

export {}
