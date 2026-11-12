/**
 * Draws the `.vhcg` height map over the visible ground: a grid whose every node stands at the
 * height `GetPositionHeight` gives it, the square under the cursor with its height, and where
 * the world's physics floor (what the game's clicks land on) leaves the height map.
 */
/** Font size of the cursor label. */
const LABEL_SIZE = 12
/** Screen pixels the cursor label sits above the cursor. */
const LABEL_OFFSET = 20
/** Radius in screen pixels of the dot that marks a node without ground. */
const HOLE_RADIUS = 3
/** The height a `.vhcg` stores where the map has no ground. */
const NO_GROUND = -16384
/**
 * Lower than any ground on the dota maps (their lowest is about -140). A height between it and
 * `NO_GROUND` is the native lookup blending a sample without ground into its neighbours.
 */
const LOWEST_GROUND = -1024
/** Height per unit of run by which a node may leave its line and still be merged into it. */
const SLOPE_EPSILON = 0.001
/**
 * Height of the camera that looks straight down to read the physics floor under the nodes: from
 * there a ray through a node 3000 units off its centre lands within a unit of it.
 */
const PROBE_HEIGHT = 1e6
const PROBE_ANGLES = new QAngle(90, 90, 0)
/** World units between the probe camera's reference points. */
const PROBE_SPAN = 1000
/**
 * Screens one `ScreenToWorldFar` call answers right. The native writes each result (3 floats from
 * offset 0) over the screens it has not read yet (2 floats from offset 11), so from the 13th
 * screen on it returns garbage (measured: 12 exact, the 13th wrong).
 */
const PROBE_BATCH = 12
/** What the physics cache holds where the probe met no floor. */
const NO_FLOOR = -Infinity
const GRID_COLOR = new Color(80, 220, 255, 140)
const HOLE_COLOR = new Color(255, 70, 70, 220)
const BLEND_COLOR = new Color(255, 160, 40, 220)
const FLOOR_COLOR = new Color(255, 80, 220, 200)
const CELL_COLOR = Color.Yellow

const world = new MenuSDK.WorldCanvas("debugger-height-map")
const corners = [
	new Vector2(0, 0),
	new Vector2(1, 0),
	new Vector2(1, 1),
	new Vector2(0, 1)
]
const square = Array.from({ length: 5 }, () => new Vector3())
const label: [number, number] = [0, 0]
const ground = new Vector3()
const pixel = new Vector2()
const probe = new Vector2()
const probeCamera = new Vector3()
const probeTarget = new Vector3()
const probeScreens = Array.from({ length: PROBE_BATCH }, () => new Vector2())
const probeBatch: Vector2[] = []
const probeIndices = new Int32Array(PROBE_BATCH)
const riser = [new Vector3(), new Vector3()]
const mapMin = new Vector2()
const mapMax = new Vector2()

const settings = { grid: false, cursor: false, floor: false, size: 32, difference: 8 }
let mapLoaded = false
/** Heights of the map's nodes at `cacheSize` apart, NaN until read. */
let cache = new Float32Array(0)
/** Heights of the physics floor under the same nodes, NaN until probed. */
let floors = new Float32Array(0)
let cacheColumns = 0
let cacheRows = 0
let cacheSize = 0
let lines: Vector3[][] = []
let floorLines: Vector3[][] = []
let floorDots: Vector3[] = []
let holes: Vector3[] = []
let blends: Vector3[] = []
let builtX = NaN
let builtY = NaN
let builtCountX = 0
let builtCountY = 0
let builtSize = 0
let builtFloor = false
let builtDifference = 0

export function ShowHeightMapGrid(show: boolean): void {
	settings.grid = show
	if (!show) {
		Reset()
	}
}

export function ShowHeightMapCursor(show: boolean): void {
	settings.cursor = show
}

export function ShowHeightMapFloor(show: boolean): void {
	settings.floor = show
}

export function SetHeightMapCellSize(size: number): void {
	settings.size = size
}

export function SetHeightMapFloorDifference(difference: number): void {
	settings.difference = difference
}

function Reset(): void {
	cache = new Float32Array(0)
	floors = new Float32Array(0)
	cacheSize = 0
	lines = []
	floorLines = []
	floorDots = []
	holes = []
	blends = []
	builtSize = 0
}

function LoadMap(): boolean {
	const map = HeightMap
	if (map === undefined) {
		return false
	}
	mapMin.CopyFrom(map.MinMapCoords)
	mapMax.CopyFrom(map.MaxMapCoords)
	return true
}

function IsGround(z: number): boolean {
	return z >= LOWEST_GROUND
}

function InCache(column: number, row: number): boolean {
	return column >= 0 && row >= 0 && column < cacheColumns && row < cacheRows
}

function HeightAt(column: number, row: number): number {
	if (!InCache(column, row)) {
		return NO_GROUND
	}
	const index = row * cacheColumns + column
	let z = cache[index]
	if (z !== z) {
		probe.x = mapMin.x + column * cacheSize
		probe.y = mapMin.y + row * cacheSize
		z = cache[index] = Dota2SDK.GetPositionHeight(probe)
	}
	return z
}

/** The physics floor under a node where it leaves the height map, `NO_FLOOR` elsewhere. */
function FloorAt(column: number, row: number): number {
	if (!InCache(column, row)) {
		return NO_FLOOR
	}
	const floor = floors[row * cacheColumns + column],
		height = HeightAt(column, row)
	if (floor === NO_FLOOR || floor !== floor) {
		return NO_FLOOR
	}
	return !IsGround(height) || Math.abs(floor - height) > settings.difference
		? floor
		: NO_FLOOR
}

function PrepareCache(size: number): void {
	if (cacheSize === size) {
		return
	}
	cacheSize = size
	cacheColumns = Math.ceil((mapMax.x - mapMin.x) / size) + 1
	cacheRows = Math.ceil((mapMax.y - mapMin.y) / size) + 1
	cache = new Float32Array(cacheColumns * cacheRows).fill(NaN)
	floors = new Float32Array(cacheColumns * cacheRows).fill(NaN)
}

function OnPlane(
	corner: Vector2,
	window: Vector2,
	camera: Vector3,
	z: number,
	out: Vector3
): boolean {
	const near = RendererSDK.ScreenToWorld(
			pixel.SetX(corner.x * window.x).SetY(corner.y * window.y)
		),
		dz = near.z - camera.z
	if (dz >= 0) {
		return false
	}
	const t = (z - camera.z) / dz
	out.SetX(camera.x + (near.x - camera.x) * t)
		.SetY(camera.y + (near.y - camera.y) * t)
		.SetZ(z)
	return true
}

function ProbeScreen(x: number, y: number, window: Vector2): Nullable<Vector2> {
	return RendererSDK.WorldToScreenCustom(
		probeTarget.SetX(x).SetY(y).SetZ(0),
		probeCamera,
		RendererSDK.CameraDistance,
		PROBE_ANGLES,
		window
	)
}

function FlushProbes(count: number, window: Vector2): void {
	if (count === 0) {
		return
	}
	probeBatch.length = count
	for (let i = 0; i < count; i++) {
		probeBatch[i] = probeScreens[i]
	}
	const hits = RendererSDK.ScreenToWorldFar(
		probeBatch,
		probeCamera,
		RendererSDK.CameraDistance,
		PROBE_ANGLES,
		window,
		-1
	)
	for (let i = 0; i < count; i++) {
		const z = hits[i].z
		floors[probeIndices[i]] = z === z ? z : NO_FLOOR
	}
}

/**
 * Reads the physics floor under every node of the window not read yet, through a camera far
 * above its centre looking straight down: a node at height 0 lands on the screen at an affine
 * function of its x and y, measured once from three reference points.
 */
function ProbeFloors(
	startX: number,
	startY: number,
	countX: number,
	countY: number
): void {
	const size = cacheSize,
		window = RendererSDK.WindowSize,
		centerX = mapMin.x + (startX + countX / 2) * size,
		centerY = mapMin.y + (startY + countY / 2) * size
	probeCamera.SetX(centerX).SetY(centerY).SetZ(PROBE_HEIGHT)
	const origin = ProbeScreen(centerX, centerY, window)?.Clone(),
		alongX = ProbeScreen(centerX + PROBE_SPAN, centerY, window)?.Clone(),
		alongY = ProbeScreen(centerX, centerY + PROBE_SPAN, window)?.Clone()
	if (origin === undefined || alongX === undefined || alongY === undefined) {
		return
	}
	const xx = (alongX.x - origin.x) / PROBE_SPAN,
		xy = (alongX.y - origin.y) / PROBE_SPAN,
		yx = (alongY.x - origin.x) / PROBE_SPAN,
		yy = (alongY.y - origin.y) / PROBE_SPAN
	let count = 0
	for (let row = startY, endY = startY + countY; row <= endY; row++) {
		for (let column = startX, endX = startX + countX; column <= endX; column++) {
			if (!InCache(column, row)) {
				continue
			}
			const index = row * cacheColumns + column
			if (floors[index] === floors[index]) {
				continue
			}
			const dx = mapMin.x + column * size - centerX,
				dy = mapMin.y + row * size - centerY
			probeScreens[count]
				.SetX(origin.x + xx * dx + yx * dy)
				.SetY(origin.y + xy * dx + yy * dy)
			probeIndices[count++] = index
			if (count === PROBE_BATCH) {
				FlushProbes(count, window)
				count = 0
			}
		}
	}
	FlushProbes(count, window)
}

/** Adds a node to a run, merging it into the last segment when it carries on its slope. */
function Extend(run: Vector3[], x: number, y: number, z: number): void {
	const count = run.length
	if (count > 1) {
		const a = run[count - 2],
			b = run[count - 1],
			ab = Math.abs(b.x - a.x) + Math.abs(b.y - a.y),
			bc = Math.abs(x - b.x) + Math.abs(y - b.y)
		if (Math.abs((b.z - a.z) * bc - (z - b.z) * ab) <= SLOPE_EPSILON * ab * bc) {
			b.SetX(x).SetY(y).SetZ(z)
			return
		}
	}
	run.push(new Vector3(x, y, z))
}

function CollectRuns(
	column: number,
	row: number,
	stepColumn: number,
	stepRow: number,
	count: number,
	floor: boolean,
	out: Vector3[][]
): void {
	const size = cacheSize
	let run: Vector3[] = []
	for (let i = 0; i < count; i++) {
		const nodeColumn = column + i * stepColumn,
			nodeRow = row + i * stepRow,
			z = floor ? FloorAt(nodeColumn, nodeRow) : HeightAt(nodeColumn, nodeRow)
		if (floor ? z !== NO_FLOOR : IsGround(z)) {
			Extend(run, mapMin.x + nodeColumn * size, mapMin.y + nodeRow * size, z)
			continue
		}
		if (run.length > 1) {
			out.push(run)
		}
		run = []
	}
	if (run.length > 1) {
		out.push(run)
	}
}

function GroundAround(column: number, row: number): number {
	let sum = 0,
		count = 0
	for (let y = row - 1; y <= row + 1; y++) {
		for (let x = column - 1; x <= column + 1; x++) {
			const z = HeightAt(x, y)
			if (IsGround(z)) {
				sum += z
				count++
			}
		}
	}
	return count !== 0 ? sum / count : 0
}

function TouchesGround(column: number, row: number): boolean {
	return (
		IsGround(HeightAt(column - 1, row)) ||
		IsGround(HeightAt(column + 1, row)) ||
		IsGround(HeightAt(column, row - 1)) ||
		IsGround(HeightAt(column, row + 1))
	)
}

function FloorAlone(column: number, row: number): boolean {
	return (
		FloorAt(column - 1, row) === NO_FLOOR &&
		FloorAt(column + 1, row) === NO_FLOOR &&
		FloorAt(column, row - 1) === NO_FLOOR &&
		FloorAt(column, row + 1) === NO_FLOOR
	)
}

function BuildFloor(
	startX: number,
	startY: number,
	countX: number,
	countY: number
): void {
	const size = cacheSize
	floorLines = []
	floorDots = []
	if (!settings.floor) {
		return
	}
	ProbeFloors(startX, startY, countX, countY)
	for (let row = startY, endY = startY + countY; row <= endY; row++) {
		CollectRuns(startX, row, 1, 0, countX + 1, true, floorLines)
	}
	for (let column = startX, endX = startX + countX; column <= endX; column++) {
		CollectRuns(column, startY, 0, 1, countY + 1, true, floorLines)
	}
	for (let row = startY, endY = startY + countY; row <= endY; row++) {
		for (let column = startX, endX = startX + countX; column <= endX; column++) {
			const z = FloorAt(column, row)
			if (z !== NO_FLOOR && FloorAlone(column, row)) {
				floorDots.push(
					new Vector3(mapMin.x + column * size, mapMin.y + row * size, z)
				)
			}
		}
	}
}

function Build(startX: number, startY: number, countX: number, countY: number): void {
	const size = cacheSize
	lines = []
	holes = []
	blends = []
	for (let row = startY, endY = startY + countY; row <= endY; row++) {
		CollectRuns(startX, row, 1, 0, countX + 1, false, lines)
	}
	for (let column = startX, endX = startX + countX; column <= endX; column++) {
		CollectRuns(column, startY, 0, 1, countY + 1, false, lines)
	}
	for (let row = startY, endY = startY + countY; row <= endY; row++) {
		for (let column = startX, endX = startX + countX; column <= endX; column++) {
			const z = HeightAt(column, row)
			if (IsGround(z)) {
				continue
			}
			const hole = z === NO_GROUND
			if (hole && !TouchesGround(column, row)) {
				continue
			}
			const dot = new Vector3(
				mapMin.x + column * size,
				mapMin.y + row * size,
				GroundAround(column, row)
			)
			if (hole) {
				holes.push(dot)
			} else {
				blends.push(dot)
			}
		}
	}
	BuildFloor(startX, startY, countX, countY)
}

function DrawDots(nodes: Vector3[], window: Vector2, color: Color): void {
	for (let i = 0, end = nodes.length; i < end; i++) {
		if (
			world.Project(nodes[i], label) &&
			label[0] >= 0 &&
			label[1] >= 0 &&
			label[0] <= window.x &&
			label[1] <= window.y
		) {
			world.Dot(label[0], label[1], HOLE_RADIUS, color)
		}
	}
}

function DrawGrid(size: number): void {
	const camera = CameraSDK.Position,
		window = RendererSDK.WindowSize,
		visible = RendererSDK.ScreenToWorldFar(
			corners,
			camera,
			RendererSDK.CameraDistance,
			CameraSDK.Angles,
			window,
			CameraSDK.FoV
		)
	let planeZ = Infinity
	for (let i = 0, end = visible.length; i < end; i++) {
		const point = visible[i]
		if (point.IsValid) {
			planeZ = Math.min(planeZ, point.z)
		}
	}
	if (planeZ === Infinity) {
		planeZ = Dota2SDK.GetPositionHeight(camera)
	}
	let fromX = Infinity,
		fromY = Infinity,
		toX = -Infinity,
		toY = -Infinity
	for (let i = 0, end = visible.length; i < end; i++) {
		const point = visible[i]
		if (!point.IsValid && !OnPlane(corners[i], window, camera, planeZ, point)) {
			continue
		}
		fromX = Math.min(fromX, point.x)
		fromY = Math.min(fromY, point.y)
		toX = Math.max(toX, point.x)
		toY = Math.max(toY, point.y)
	}
	fromX = Math.max(fromX, mapMin.x)
	fromY = Math.max(fromY, mapMin.y)
	toX = Math.min(toX, mapMax.x)
	toY = Math.min(toY, mapMax.y)
	if (!(fromX < toX && fromY < toY)) {
		return
	}
	PrepareCache(size)
	const startX = Math.floor((fromX - mapMin.x) / size),
		startY = Math.floor((fromY - mapMin.y) / size),
		countX = Math.ceil((toX - mapMin.x) / size) - startX,
		countY = Math.ceil((toY - mapMin.y) / size) - startY
	if (
		startX !== builtX ||
		startY !== builtY ||
		countX !== builtCountX ||
		countY !== builtCountY ||
		size !== builtSize
	) {
		Build(startX, startY, countX, countY)
	} else if (settings.floor !== builtFloor || settings.difference !== builtDifference) {
		BuildFloor(startX, startY, countX, countY)
	}
	builtX = startX
	builtY = startY
	builtCountX = countX
	builtCountY = countY
	builtSize = size
	builtFloor = settings.floor
	builtDifference = settings.difference
	for (let i = 0, end = lines.length; i < end; i++) {
		world.Polyline(lines[i], 1, GRID_COLOR)
	}
	for (let i = 0, end = floorLines.length; i < end; i++) {
		world.Polyline(floorLines[i], 1, FLOOR_COLOR)
	}
	DrawDots(holes, window, HOLE_COLOR)
	DrawDots(blends, window, BLEND_COLOR)
	DrawDots(floorDots, window, FLOOR_COLOR)
}

function SetNode(node: Vector3, x: number, y: number, z: number): void {
	node.SetX(x).SetY(y).SetZ(z)
}

/** The cell at `x`, `y`: flat at `z`, or on the height map where `z` is NaN and on `fallback` off it. */
function DrawSquare(
	x: number,
	y: number,
	size: number,
	z: number,
	fallback: number,
	color: Color
): void {
	for (let i = 0; i < 4; i++) {
		const nodeX = i === 1 || i === 2 ? x + size : x,
			nodeY = i > 1 ? y + size : y,
			node = square[i]
		node.SetX(nodeX).SetY(nodeY).SetZ(0)
		const height = Dota2SDK.GetPositionHeight(node)
		node.SetZ(z === z ? z : IsGround(height) ? height : fallback)
	}
	square[0].CopyTo(square[4])
	world.Polyline(square, 2, color)
}

function DrawCursor(size: number): void {
	const cursor = InputManager.CursorOnWorld
	if (!cursor.IsValid) {
		return
	}
	const x = mapMin.x + Math.floor((cursor.x - mapMin.x) / size) * size,
		y = mapMin.y + Math.floor((cursor.y - mapMin.y) / size) * size,
		height = Dota2SDK.GetPositionHeight(cursor),
		isGround = IsGround(height),
		difference = cursor.z - height,
		apart = !isGround || Math.abs(difference) > settings.difference
	DrawSquare(x, y, size, NaN, cursor.z, CELL_COLOR)
	if (settings.floor && apart) {
		DrawSquare(x, y, size, cursor.z, cursor.z, FLOOR_COLOR)
		if (isGround) {
			SetNode(riser[0], cursor.x, cursor.y, height)
			SetNode(riser[1], cursor.x, cursor.y, cursor.z)
			world.Polyline(riser, 1, FLOOR_COLOR)
		}
	}
	if (!world.Project(ground.CopyFrom(cursor), label)) {
		return
	}
	const map =
		height === NO_GROUND
			? "map: no ground"
			: `map ${height.toFixed(1)}${isGround ? "" : " (blended with no ground)"}`
	world.Text(
		label[0],
		label[1] - LABEL_OFFSET,
		`${map} · world ${cursor.z.toFixed(1)}${isGround ? ` · Δ ${difference >= 0 ? "+" : ""}${difference.toFixed(1)}` : ""}`,
		LABEL_SIZE,
		apart ? FLOOR_COLOR : Color.White
	)
}

EventsSDK.on("Draw", () => {
	if (!settings.grid && !settings.cursor) {
		return
	}
	if (!mapLoaded) {
		mapLoaded = LoadMap()
		if (!mapLoaded) {
			return
		}
	}
	if (settings.grid) {
		DrawGrid(settings.size)
	}
	if (settings.cursor) {
		DrawCursor(settings.size)
	}
})

EventsSDK.on("GameEnded", () => {
	mapLoaded = false
	Reset()
})
