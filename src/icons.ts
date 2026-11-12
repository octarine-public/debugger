/** Root the loader mounts this package at: a spelled-out repository path does not resolve. */
const icon = (name: string) =>
	`${__OCT_PACKAGE_ROOT__}/scripts_files/debugger/icons/${name}.svg`

/** Outline glyphs of the menu: the SDK set where it has one, our own next to it otherwise. */
export const DebuggerIcons = {
	Debugger: Menu.Icons.IconDebugger,
	GUIInfo: icon("layout-dashboard"),
	GridNav: icon("grid"),
	WorldCursor: icon("map-pin"),
	ScreenCursor: icon("mouse-pointer"),
	Concommands: icon("terminal"),
	Cheats: icon("lock-open"),
	/** dota_ability_debug: abilities and items without cooldowns or mana costs. */
	NoCooldowns: icon("infinity"),
	CreepsNoSpawn: Menu.Icons.Ban,
	AllVision: Menu.Icons.IconEye,
	TimeScale: icon("gauge"),
	TimeScaleApply: icon("fast-forward"),
	TimeScaleNormal: Menu.Icons.Play,
	Refresh: Menu.Icons.RefreshCw,
	MaxLevel: icon("chevrons-up"),
	Rapier: icon("sword"),
	AddUnit: icon("user-plus"),
	AddCreep: icon("circle-plus"),
	/** Sven under six Hearts: the tank to hit. */
	FullSven: icon("shield"),
	/** Sniper with a Scepter: the ranged one to be hit by. */
	FullSniper: icon("crosshair"),
	Creeps: Menu.Icons.IconCreeps,
	CreepType: icon("swords"),
	Team: icon("flag"),
	Count: icon("hash"),
	Key: Menu.Icons.Keyboard,
	Events: Menu.Icons.Activity,
	State: Menu.Icons.Power,
	Projectiles: icon("rocket"),
	Humanizer: icon("mouse-pointer-click"),
	DebugDraw: Menu.Icons.Pencil,
	OrderStats: Menu.Icons.LevelBars,
	OrderMarks: Menu.Icons.CircleCheck,
	DebugOrders: icon("list-ordered"),
	UnsafeMode: icon("triangle-alert"),
	/** The switch that silences every output of the debugger at once. */
	Master: Menu.Icons.Power,
	Teleports: Menu.Icons.Zap,
	/** Creep-sourced events left out of the console. */
	IgnoreCreeps: Menu.Icons.IconCreeps,
	VisualDebug: Menu.Icons.Monitor,
	InfoPanel: Menu.Icons.PanelLeft,
	PanelPosition: Menu.Icons.Move,
	Filter: Menu.Icons.ListFilter,
	Particles: Menu.Icons.Sparkles,
	Modifiers: Menu.Icons.SquareStack,
	TwinGates: Menu.Icons.ArrowUpDown,
	ActionEvents: Menu.Icons.Activity,
	AbilityPhase: Menu.Icons.Timer,
	AbilityChannel: Menu.Icons.Hourglass,
	AttackStarted: icon("swords"),
	AttackEnded: icon("sword"),
	Gesture: Menu.Icons.Animation,
	Animation: Menu.Icons.MonitorPlay,
	Speech: Menu.Icons.Volume,
	FakeUnits: Menu.Icons.EyeOff,
	DebugLog: icon("terminal"),
	HeightMap: Menu.Icons.Checkerboard,
	HeightMapGrid: icon("grid"),
	CellSize: Menu.Icons.Radius,
	CursorCell: Menu.Icons.Scan,
	WorldFloor: Menu.Icons.BackdropLayers,
	FloorDifference: Menu.Icons.ArrowUpDown
} as const

/** Puts a glyph on a row and hands the row back, so a declaration stays one chain. */
export function withIcon<T extends Menu.Base>(entry: T, iconPath: string): T {
	entry.IconPath = iconPath
	return entry
}
