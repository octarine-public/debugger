import { canvas } from "../render"

/** An order the scripts sent (`EOrderStage.Sent`), waiting for its message to go out. */
interface Sent {
	readonly at: number
	readonly given: number
	readonly owner: OrderOwner
	readonly type: dotaunitorder_t
	readonly target: number
	readonly x: number
	readonly y: number
	readonly cursors: Nullable<Cursors>
}

/** Where the player's cursor and the scripts' last written one were, on the ground, as an order was given. */
interface Cursors {
	readonly playerX: number
	readonly playerY: number
	readonly writtenX: number
	readonly writtenY: number
}

/** An order whose message went out, waiting for the next move message to be judged. */
interface Outgoing {
	readonly time: number
	readonly owner: OrderOwner
	readonly type: dotaunitorder_t
	readonly given: number
	readonly target: number
	readonly aim: Vector3
	readonly hull: number
	readonly cursors: Nullable<Cursors>
	readonly writtenX: number
	readonly writtenY: number
}

/** What the server got with an order: where its cursor was and how long the order took. */
interface Judged {
	readonly time: number
	readonly owner: OrderOwner
	readonly ok: boolean
	readonly distance: number
	readonly minimap: boolean
	readonly clickToWire: number
	/** Ms from the order to the first move message with the cursor on its target; -1 for none in 1 s. */
	reach: number
	readonly order: Outgoing
	readonly underX: number
	readonly underY: number
	readonly moveBefore: number
	readonly commands: number
}

/** A point the server's cursor was on, in the world, from the screen or the minimap. */
interface CursorPoint {
	readonly x: number
	readonly y: number
	readonly z: number
	readonly minimap: boolean
	readonly slack: number
}

interface Mark {
	readonly aim: Vector3
	readonly under: Nullable<Vector3>
	readonly ok: boolean
	readonly until: number
	readonly text: string
}

interface Summary {
	readonly total: number
	readonly ok: number
	readonly distance: number[]
	readonly reach: number[]
	readonly never: number
	readonly clickToWire: number[]
	readonly perMinute: number
	readonly peak: number
	readonly dropped: number
	readonly lost: number
}

interface Row {
	readonly label: string
	readonly value: (summary: Summary) => string
}

interface Group {
	readonly title: string
	readonly rows: Row[]
}

interface Cell {
	readonly text: string
	readonly box: Rectangle
	readonly style: MenuSDK.CanvasTextStyle
}

/** Milliseconds the panel looks back over. */
const SPAN = 60000
/** Milliseconds between two readings of the panel's text. */
const REFRESH = 250
/** Milliseconds an order sent by the scripts or a click waits for its message. */
const MATCH_SPAN = 2000
/** Milliseconds of move messages kept to judge an order by. */
const MOVES_SPAN = 3000
/** Milliseconds after an order a missed cursor may still come onto its target. */
const REACH_SPAN = 1000
/** World units around an order's point, past its unit's hull, the server's cursor counts as on it. */
const ON_TARGET = 50
/** The screen grid the server gets the cursor on. */
const MOUSE_WIDTH = 511,
	MOUSE_HEIGHT = 384
const MAX_SCRIPTS = 2,
	MAX_MISSES = 5,
	MAX_MARKS = 20
const MARK_OK_MS = 1500,
	MARK_MISS_MS = 5000

const CURSOR_ORDERS = new Set<dotaunitorder_t>([
	dotaunitorder_t.DOTA_UNIT_ORDER_MOVE_TO_POSITION,
	dotaunitorder_t.DOTA_UNIT_ORDER_MOVE_TO_TARGET,
	dotaunitorder_t.DOTA_UNIT_ORDER_ATTACK_MOVE,
	dotaunitorder_t.DOTA_UNIT_ORDER_ATTACK_TARGET,
	dotaunitorder_t.DOTA_UNIT_ORDER_CAST_POSITION,
	dotaunitorder_t.DOTA_UNIT_ORDER_CAST_TARGET,
	dotaunitorder_t.DOTA_UNIT_ORDER_CAST_TARGET_TREE,
	dotaunitorder_t.DOTA_UNIT_ORDER_PICKUP_ITEM,
	dotaunitorder_t.DOTA_UNIT_ORDER_PICKUP_RUNE,
	dotaunitorder_t.DOTA_UNIT_ORDER_PATROL,
	dotaunitorder_t.DOTA_UNIT_ORDER_RADAR,
	dotaunitorder_t.DOTA_UNIT_ORDER_MOVE_TO_DIRECTION,
	dotaunitorder_t.DOTA_UNIT_ORDER_GIVE_ITEM,
	dotaunitorder_t.DOTA_UNIT_ORDER_DROP_ITEM,
	dotaunitorder_t.DOTA_UNIT_ORDER_VECTOR_TARGET_POSITION
])

const PLAYER_COLOR = new Color(110, 220, 130),
	SCRIPT_COLORS = [new Color(255, 170, 70), new Color(185, 145, 255)],
	TOTAL_COLOR = new Color(225, 225, 225),
	LABEL_COLOR = new Color(165, 170, 180),
	TITLE_COLOR = new Color(120, 190, 255),
	PANEL_COLOR = new Color(12, 14, 18, 210),
	PANEL_BORDER = new Color(255, 255, 255, 30),
	MISS_COLOR = new Color(255, 110, 90),
	HIT_COLOR = new Color(110, 230, 120)

const GROUPS: Group[] = [
	{
		title: "Server's cursor at the order",
		rows: [
			{
				label: "On target",
				value: s => (s.total === 0 ? "–" : `${s.ok}/${s.total}`)
			},
			{ label: "Off by, units: p50 / p95", value: s => Spread(s.distance) },
			{ label: "Missed, on target after, ms", value: s => Spread(s.reach) },
			{ label: "Missed, not on it in 1 s", value: s => `${s.never}` }
		]
	},
	{
		title: "Delays, ms: p50 / p95",
		rows: [{ label: "Click → sent to the server", value: s => Spread(s.clickToWire) }]
	},
	{
		title: "Orders",
		rows: [
			{ label: "Per minute", value: s => `${s.perMinute}` },
			{ label: "Peak per second", value: s => `${s.peak}` },
			{ label: "Dropped", value: s => `${s.dropped}` },
			{ label: "Lost casts", value: s => `${s.lost}` }
		]
	}
]

/** Byte offsets of the point under the cursor in `LatestUserCmd`. */
const UNDER_X = 69,
	UNDER_Y = 73
const userCmd = new DataView(LatestUserCmd.buffer)

const cursorsAtGiven = new WeakMap<ExecuteOrder, Cursors>(),
	given = new WeakMap<ExecuteOrder, number>(),
	clicks: Sent[] = [],
	sentByScripts: Sent[] = [],
	outgoing: Outgoing[] = [],
	moves: [number, WireUserCmd[]][] = [],
	judged: Judged[] = [],
	following: [Judged, Outgoing][] = [],
	misses: Judged[] = [],
	marks: Mark[] = [],
	drops: [number, OrderOwner][] = [],
	lost: [number, OrderOwner][] = [],
	panelPos = new Vector2(),
	panelSize = new Vector2(),
	dotSize = new Vector2()
let cells: Cell[] = [],
	since = 0,
	refreshedAt = 0,
	panelRadius = 0,
	showStats = false,
	showMarks = false

function Collecting(): boolean {
	return showStats || showMarks
}

function Reset(): void {
	since = 0
	refreshedAt = 0
	clicks.length = 0
	sentByScripts.length = 0
	outgoing.length = 0
	moves.length = 0
	judged.length = 0
	following.length = 0
	misses.length = 0
	marks.length = 0
	drops.length = 0
	lost.length = 0
	cells = []
}

function Rank(sorted: number[], share: number): number {
	return sorted[Math.max(Math.ceil(share * sorted.length), 1) - 1]
}

function Spread(values: number[]): string {
	if (values.length === 0) {
		return "–"
	}
	values.sort((a, b) => a - b)
	return `${Math.round(Rank(values, 0.5))} / ${Math.round(Rank(values, 0.95))}`
}

function Prune<T>(list: T[], timeOf: (entry: T) => number, cutoff: number): void {
	let i = 0
	while (i < list.length && timeOf(list[i]) < cutoff) {
		i++
	}
	if (i !== 0) {
		list.splice(0, i)
	}
}

function TargetIndex(target: Nullable<Entity | number>): number {
	return target instanceof Entity ? target.Index : (target ?? -1)
}

/** Takes from `list` the order `order` went out as: the same type and target, or the same point. */
function Match(list: Sent[], order: WireOrder, now: number): Nullable<Sent> {
	Prune(list, entry => entry.at, now - MATCH_SPAN)
	for (let i = 0, end = list.length; i < end; i++) {
		const entry = list[i]
		if (entry.type !== order.type) {
			continue
		}
		if (
			order.target >= 0
				? entry.target === order.target
				: Math.hypot(entry.x - order.positionX, entry.y - order.positionY) < 2
		) {
			list.splice(i, 1)
			return entry
		}
	}
	return undefined
}

/** The world point the server's cursor was on in `cmd`: the minimap's if the cursor is on it. */
function CursorPointOf(cmd: WireUserCmd): CursorPoint {
	const window = RendererSDK.WindowSize,
		rect = GUIInfo.Minimap?.MinimapRenderBounds,
		screen = new Vector2(
			(cmd.mouseX / MOUSE_WIDTH) * window.x,
			(cmd.mouseY / MOUSE_HEIGHT) * window.y
		)
	if (rect !== undefined && rect.Contains(screen)) {
		const world = MinimapSDK.MinimapToWorld(screen)
		if (world !== undefined) {
			const perPixel = MinimapSDK.MinimapBounds.Size.x / rect.Width
			return {
				x: world.x,
				y: world.y,
				z: world.z,
				minimap: true,
				slack:
					Math.hypot(window.x / MOUSE_WIDTH, window.y / MOUSE_HEIGHT) * perPixel
			}
		}
	}
	return { x: cmd.underX, y: cmd.underY, z: cmd.underZ, minimap: false, slack: 0 }
}

function OnTarget(order: Outgoing, cmd: WireUserCmd, point: CursorPoint): boolean {
	if (
		order.target >= 0 &&
		(cmd.weaponSelect === order.target ||
			(cmd.weaponSelect & 0x3fff) === order.target)
	) {
		return true
	}
	return (
		Math.hypot(point.x - order.aim.x, point.y - order.aim.y) <=
		ON_TARGET + point.slack + order.hull
	)
}

/** Judges `order` by the last user command of the last move message that went before it. */
function Judge(order: Outgoing): void {
	let before: Nullable<WireUserCmd[]>, beforeTime: Nullable<number>
	for (let i = moves.length - 1; i > -1; i--) {
		if (moves[i][0] <= order.time) {
			before = moves[i][1]
			beforeTime = moves[i][0]
			break
		}
	}
	const cmd = before?.[before.length - 1],
		point = cmd === undefined ? undefined : CursorPointOf(cmd),
		ok = cmd !== undefined && point !== undefined && OnTarget(order, cmd, point),
		record: Judged = {
			time: order.time,
			owner: order.owner,
			ok,
			distance:
				point === undefined
					? NaN
					: Math.round(
							Math.hypot(point.x - order.aim.x, point.y - order.aim.y)
						),
			minimap: point?.minimap ?? false,
			clickToWire: Number.isNaN(order.given) ? NaN : order.time - order.given,
			reach: ok ? 0 : NaN,
			order,
			underX: point?.x ?? NaN,
			underY: point?.y ?? NaN,
			moveBefore: beforeTime === undefined ? NaN : order.time - beforeTime,
			commands: before?.length ?? 0
		}
	judged.push(record)
	Prune(judged, entry => entry.time, order.time - SPAN)
	if (!ok) {
		following.push([record, order])
		misses.unshift(record)
		if (misses.length > MAX_MISSES) {
			misses.length = MAX_MISSES
		}
	}
	if (!showMarks) {
		return
	}
	marks.push({
		aim: order.aim,
		under:
			cmd === undefined || point === undefined || point.minimap
				? undefined
				: new Vector3(cmd.underX, cmd.underY, cmd.underZ),
		ok,
		until: hrtime() + (ok ? MARK_OK_MS : MARK_MISS_MS),
		text: Describe(record)
	})
	if (marks.length > MAX_MARKS) {
		marks.shift()
	}
}

function Describe(record: Judged): string {
	const localize = (text: string) => MenuSDK.Localization.Localize(text),
		distance = Number.isNaN(record.distance) ? "?" : `${record.distance}`,
		ms = Number.isNaN(record.clickToWire) ? "?" : `${Math.round(record.clickToWire)}`,
		minimap = record.minimap ? ` · ${localize("minimap")}` : ""
	return `${record.ok ? "✓" : "✗"} ${distance} ${localize("u")} · ${ms} ${localize("ms")}${minimap}`
}

function Follow(time: number, commands: WireUserCmd[]): void {
	for (let i = following.length - 1; i > -1; i--) {
		const [record, order] = following[i]
		if (order.time >= time) {
			continue
		}
		const late = time - order.time > REACH_SPAN
		let hit = false
		for (let j = 0, end = late ? 0 : commands.length; j < end && !hit; j++) {
			hit = OnTarget(order, commands[j], CursorPointOf(commands[j]))
		}
		if (hit || late) {
			record.reach = hit ? time - order.time : -1
			following.splice(i, 1)
		}
	}
}

Source2SDK.NativeEvents.on("UserCmdSent", (time, _own, commands) => {
	if (!Collecting()) {
		return
	}
	if (since === 0) {
		since = time
	}
	moves.push([time, commands])
	Prune(moves, move => move[0], time - MOVES_SPAN)
	Follow(time, commands)
	for (let i = 0; i < outgoing.length; ) {
		if (outgoing[i].time < time) {
			Judge(outgoing[i])
			outgoing.splice(i, 1)
		} else {
			i++
		}
	}
})

Source2SDK.NativeEvents.on("OrdersSent", (time, orders, fromGame) => {
	if (!Collecting() || (fromGame && !ExecuteOrder.DisableHumanizer)) {
		return
	}
	for (let i = 0, end = orders.length; i < end; i++) {
		const order = orders[i]
		if (
			!order.firstSend ||
			!CURSOR_ORDERS.has(order.type) ||
			(order.target >= 0 && order.issuers.includes(order.target)) ||
			(order.target < 0 && order.positionX === 0 && order.positionY === 0)
		) {
			continue
		}
		const sent = Match(fromGame ? clicks : sentByScripts, order, time),
			unit =
				order.target >= 0 ? EntityManager.EntityByIndex(order.target) : undefined,
			valid = unit instanceof Unit && unit.IsValid
		outgoing.push({
			time,
			owner: fromGame ? OrderOwner.Player : (sent?.owner ?? OrderOwner.Script),
			type: order.type,
			given: sent?.given ?? NaN,
			target: order.target,
			aim: valid
				? unit.Position.Clone()
				: new Vector3(order.positionX, order.positionY, order.positionZ),
			hull: valid ? unit.HullRadius : 0,
			cursors: sent?.cursors,
			writtenX: userCmd.getFloat32(UNDER_X, true),
			writtenY: userCmd.getFloat32(UNDER_Y, true)
		})
	}
})

function Entry(order: ExecuteOrder, at: number): Sent {
	const position = order.Position
	return {
		at,
		given: given.get(order) ?? NaN,
		owner: order.Owner,
		type: order.OrderType,
		target: TargetIndex(order.Target),
		x: position.x,
		y: position.y,
		cursors: cursorsAtGiven.get(order)
	}
}

EventsSDK.on("PrepareUnitOrders", order => {
	if (!Collecting() || given.has(order)) {
		return
	}
	const now = hrtime(),
		player = InputManager.CursorOnWorld
	given.set(order, now)
	cursorsAtGiven.set(order, {
		playerX: player.x,
		playerY: player.y,
		writtenX: userCmd.getFloat32(UNDER_X, true),
		writtenY: userCmd.getFloat32(UNDER_Y, true)
	})
	if (order.IsPlayerInput) {
		clicks.push(Entry(order, now))
	}
})

EventsSDK.on("OrderStageChanged", order => {
	if (!Collecting()) {
		return
	}
	const now = hrtime()
	switch (order.Stage) {
		case EOrderStage.Sent:
			sentByScripts.push(Entry(order, now))
			break
		case EOrderStage.Lost:
			lost.push([now, order.Owner])
			break
		case EOrderStage.Dropped:
			drops.push([now, order.Owner])
			break
		default:
			break
	}
})

function CountOf(list: [number, OrderOwner][], owner: Nullable<OrderOwner>): number {
	if (owner === undefined) {
		return list.length
	}
	let count = 0
	for (let i = 0, end = list.length; i < end; i++) {
		if (list[i][1] === owner) {
			count++
		}
	}
	return count
}

function Peak(records: readonly Judged[]): number {
	let best = 0
	for (let i = 0, j = 0, end = records.length; i < end; i++) {
		while (records[i].time - records[j].time >= 1000) {
			j++
		}
		best = Math.max(best, i - j + 1)
	}
	return best
}

function Summarize(owner: Nullable<OrderOwner>, now: number): Summary {
	const records = owner === undefined ? judged : judged.filter(r => r.owner === owner),
		distance: number[] = [],
		reach: number[] = [],
		clickToWire: number[] = []
	let ok = 0,
		never = 0
	for (let i = 0, end = records.length; i < end; i++) {
		const record = records[i]
		if (record.ok) {
			ok++
		} else if (record.reach > 0) {
			reach.push(record.reach)
		} else if (record.reach === -1) {
			never++
		}
		if (!Number.isNaN(record.distance)) {
			distance.push(record.distance)
		}
		if (!Number.isNaN(record.clickToWire)) {
			clickToWire.push(record.clickToWire)
		}
	}
	return {
		total: records.length,
		ok,
		distance,
		reach,
		never,
		clickToWire,
		perMinute: Math.round(
			(records.length * 60000) / Math.min(Math.max(now - since, 1000), SPAN)
		),
		peak: Peak(records),
		dropped: CountOf(drops, owner),
		lost: CountOf(lost, owner)
	}
}

function Scripts(): OrderOwner[] {
	const counts = new Map<OrderOwner, number>()
	for (let i = 0, end = judged.length; i < end; i++) {
		const owner = judged[i].owner
		if (owner !== OrderOwner.Player) {
			counts.set(owner, (counts.get(owner) ?? 0) + 1)
		}
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, MAX_SCRIPTS)
		.map(entry => entry[0])
}

function Text(
	text: string,
	x: number,
	y: number,
	width: number,
	height: number,
	style: MenuSDK.CanvasTextStyle
): Cell {
	return {
		text,
		box: new Rectangle(new Vector2(x, y), new Vector2(x + width, y + height)),
		style
	}
}

function Status(localize: (text: string) => string): [string, Color] {
	if (moves.length === 0) {
		return [
			localize("No wire events: the loaded native does not send them"),
			MISS_COLOR
		]
	}
	if (ExecuteOrder.unsafeMode) {
		return [
			localize("unsafe_mode: orders go at once, without the cursor"),
			MISS_COLOR
		]
	}
	return ExecuteOrder.DisableHumanizer
		? [localize("Humanizer off: the game sends the player's orders"), LABEL_COLOR]
		: [localize("Humanizer on"), LABEL_COLOR]
}

function MovesPerSecond(now: number): number {
	let count = 0
	for (let i = moves.length - 1; i > -1 && moves[i][0] > now - 1000; i--) {
		count++
	}
	return count
}

function Refresh(now: number): void {
	Prune(judged, record => record.time, now - SPAN)
	Prune(drops, entry => entry[0], now - SPAN)
	Prune(lost, entry => entry[0], now - SPAN)
	const localize = (text: string) => MenuSDK.Localization.Localize(text),
		scale = RendererSDK.WindowSize.y / 1080,
		pad = Math.round(10 * scale),
		rowHeight = Math.round(16 * scale),
		labelWidth = Math.round(185 * scale),
		columnWidth = Math.round(72 * scale),
		family = MenuSDK.Theme.FontFamily,
		size = Math.max(Math.round(12 * scale), 9),
		left = TextFlags.Left | TextFlags.Center,
		right = TextFlags.Right | TextFlags.Center,
		scripts = Scripts(),
		columns: [Nullable<OrderOwner>, string, Color][] = [
			[OrderOwner.Player, localize("Player"), PLAYER_COLOR]
		]
	for (let i = 0; i < scripts.length; i++) {
		columns.push([scripts[i], scripts[i].Name, SCRIPT_COLORS[i]])
	}
	columns.push([undefined, localize("Total"), TOTAL_COLOR])
	const summaries = columns.map(([owner]) => Summarize(owner, now)),
		width = pad * 2 + labelWidth + columnWidth * columns.length,
		inner = width - pad * 2,
		x = Math.round(12 * scale),
		top = Math.round(112 * scale),
		labelStyle = { color: LABEL_COLOR, family, size, flags: left },
		titleStyle = { color: TITLE_COLOR, family, size, weight: 600, flags: left },
		[status, statusColor] = Status(localize),
		next: Cell[] = []
	let y = top + pad
	next.push(
		Text(localize("Humanizer orders, last 60 s"), x + pad, y, inner, rowHeight, {
			color: TOTAL_COLOR,
			family,
			size,
			weight: 600,
			flags: left
		}),
		Text(
			`${localize("Ping, ms")}: ${Math.round(GameState.Ping)} · ${localize("Moves/s")}: ${MovesPerSecond(now)}`,
			x + pad,
			y,
			inner,
			rowHeight,
			{ ...labelStyle, flags: right }
		)
	)
	y += rowHeight
	next.push(
		Text(status, x + pad, y, inner, rowHeight, { ...labelStyle, color: statusColor })
	)
	y += rowHeight + Math.round(4 * scale)
	for (let c = 0; c < columns.length; c++) {
		next.push(
			Text(
				columns[c][1],
				x + pad + labelWidth + columnWidth * c,
				y,
				columnWidth,
				rowHeight,
				{ color: columns[c][2], family, size, weight: 600, flags: right }
			)
		)
	}
	y += rowHeight
	for (const group of GROUPS) {
		y += Math.round(4 * scale)
		next.push(
			Text(localize(group.title), x + pad, y, labelWidth, rowHeight, titleStyle)
		)
		y += rowHeight
		for (const row of group.rows) {
			next.push(
				Text(localize(row.label), x + pad, y, labelWidth, rowHeight, labelStyle)
			)
			for (let c = 0; c < columns.length; c++) {
				next.push(
					Text(
						row.value(summaries[c]),
						x + pad + labelWidth + columnWidth * c,
						y,
						columnWidth,
						rowHeight,
						{ color: columns[c][2], family, size, flags: right }
					)
				)
			}
			y += rowHeight
		}
	}
	if (misses.length !== 0) {
		y += Math.round(4 * scale)
		next.push(Text(localize("Last misses"), x + pad, y, inner, rowHeight, titleStyle))
		y += rowHeight
		for (let i = 0, end = misses.length; i < end; i++) {
			const miss = misses[i],
				owner =
					miss.owner === OrderOwner.Player
						? localize("Player")
						: miss.owner.Name,
				ago = Math.round((now - miss.time) / 1000)
			next.push(
				Text(Describe(miss), x + pad, y, inner, rowHeight, {
					...labelStyle,
					color: MISS_COLOR
				}),
				Text(
					`${owner} · ${ago} ${localize("s ago")}`,
					x + pad,
					y,
					inner,
					rowHeight,
					{ ...labelStyle, flags: right }
				)
			)
			y += rowHeight
		}
	}
	panelPos.x = x
	panelPos.y = top
	panelSize.x = width
	panelSize.y = y - top + pad
	panelRadius = Math.round(6 * scale)
	cells = next
}

function DrawPanel(): void {
	const now = hrtime()
	if (now - refreshedAt >= REFRESH) {
		refreshedAt = now
		Refresh(now)
	}
	canvas.Rect(panelPos, panelSize, {
		color: PANEL_COLOR,
		borderColor: PANEL_BORDER,
		borderWidth: 1,
		radius: panelRadius
	})
	for (let i = 0, end = cells.length; i < end; i++) {
		const cell = cells[i]
		canvas.TextIn(cell.text, cell.box, cell.style)
	}
}

function DrawMarks(): void {
	const now = hrtime(),
		scale = RendererSDK.WindowSize.y / 1080,
		dot = Math.round(8 * scale),
		size = Math.round(14 * scale),
		offset = new Vector2(dot, -Math.round(10 * scale))
	dotSize.x = dot
	dotSize.y = dot
	for (let i = marks.length - 1; i > -1; i--) {
		const mark = marks[i]
		if (mark.until < now) {
			marks.splice(i, 1)
			continue
		}
		const at = RendererSDK.WorldToScreen(mark.aim)
		if (at === undefined) {
			continue
		}
		const color = mark.ok ? HIT_COLOR : MISS_COLOR
		canvas.Circle(at.SubtractScalar(dot / 2), dotSize, { color })
		if (!mark.ok && mark.under !== undefined) {
			const under = RendererSDK.WorldToScreen(mark.under)
			if (under !== undefined) {
				canvas.Line(at, under, color, Math.max(Math.round(2 * scale), 1))
			}
		}
		canvas.Text(mark.text, at.Add(offset), {
			color,
			size,
			weight: 600,
			outline: true
		})
	}
}

/** Milliseconds between the last frames drawn, for reading with the orders. */
const frameGaps: number[] = []
/** Frames whose gaps `frameGaps` keeps. */
const FRAME_GAPS = 600
let lastFrameAt = 0

EventsSDK.on("Draw", () => {
	if (!Collecting() || GameState.UIState !== DOTAGameUIState.DOTA_GAME_UI_DOTA_INGAME) {
		return
	}
	const now = hrtime()
	if (lastFrameAt !== 0) {
		frameGaps.push(now - lastFrameAt)
		if (frameGaps.length > FRAME_GAPS) {
			frameGaps.shift()
		}
	}
	lastFrameAt = now
	if (showMarks) {
		DrawMarks()
	}
	if (showStats) {
		DrawPanel()
	}
})

const globalThisAny = globalThis as any
/** The orders the panel judged over the last minute, for reading over the debugger protocol. */
globalThisAny.DEBUGGER_ORDER_STATS = () => ({
	frameMs: [...frameGaps],
	orders: judged.map(record => ({
		time: Math.round(record.time),
		owner: record.owner.Name,
		ok: record.ok,
		distance: record.distance,
		minimap: record.minimap,
		clickToWire: Math.round(record.clickToWire * 10) / 10,
		reach: Math.round(record.reach),
		type: record.order.type,
		moveBefore: Math.round(record.moveBefore * 10) / 10,
		commands: record.commands,
		aim: [Math.round(record.order.aim.x), Math.round(record.order.aim.y)],
		under: [Math.round(record.underX), Math.round(record.underY)],
		written: [Math.round(record.order.writtenX), Math.round(record.order.writtenY)],
		player: record.order.cursors && [
			Math.round(record.order.cursors.playerX),
			Math.round(record.order.cursors.playerY)
		],
		writtenAtGiven: record.order.cursors && [
			Math.round(record.order.cursors.writtenX),
			Math.round(record.order.cursors.writtenY)
		]
	}))
})

/** Shows or hides the panel of what the server got with each order. */
export function ShowOrderStats(show: boolean): void {
	showStats = show
	if (!Collecting()) {
		Reset()
	}
}

/** Shows or hides the marks each order leaves in the world. */
export function ShowOrderMarks(show: boolean): void {
	showMarks = show
	if (!show) {
		marks.length = 0
	}
	if (!Collecting()) {
		Reset()
	}
}
