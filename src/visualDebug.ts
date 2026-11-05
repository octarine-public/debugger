import { canvas } from "../render"
import { DebuggerIcons, withIcon } from "./icons"

/** What a visual debugger hands the info panel while it draws a frame. */
export interface VisualDebugContext {
	/** Puts one line into the info panel for this frame. */
	Line(line: string): void
}
type VisualDebugDraw = (ctx: VisualDebugContext) => void

/**
 * On-screen debuggers: each is a toggle of the "Visual debug" node and a draw run every frame in a
 * game while it and the master switch are on. A draw paints into the world on the debugger's canvas
 * and may hand the info panel lines; the panel draws them after every module, where its sliders put
 * it on the screen.
 * @example
 * visualDebug.Add("My feature", ctx => {
 * 	const w2s = RendererSDK.WorldToScreen(position)
 * 	if (w2s !== undefined) {
 * 		canvas.Circle(w2s, new Vector2(10, 10), { color: Color.Red })
 * 	}
 * 	ctx.Line("my feature: ...")
 * }, false, "What it draws", DebuggerIcons.State)
 */
export class VisualDebug implements VisualDebugContext {
	private static readonly PanelTitle = "— Visual debug —"
	private static readonly PanelText = { color: Color.White, size: 16 } as const
	private static readonly PanelPadding = 8
	private static readonly PanelLineHeight = 22
	private static readonly PanelColor = new Color(0, 0, 0, 180)

	/** The node the modules sit in, for a module's own controls next to its toggle. */
	public readonly Node: Menu.Node
	private readonly showPanel: Menu.Toggle
	private readonly panelX: Menu.Slider
	private readonly panelY: Menu.Slider
	private readonly modules: [Menu.Toggle, VisualDebugDraw][] = []
	private readonly lines: string[] = []

	constructor(
		parent: Menu.Node,
		private readonly master: Menu.Toggle
	) {
		this.Node = parent.AddNode(
			"Visual debug",
			DebuggerIcons.VisualDebug,
			"On-screen debuggers: each toggle draws into the world"
		)
		this.showPanel = withIcon(
			this.Node.AddToggle(
				"Show info panel",
				true,
				"A panel with what the enabled debuggers report"
			),
			DebuggerIcons.InfoPanel
		)
		this.panelX = withIcon(
			this.Node.AddSlider(
				"Panel X (%)",
				1,
				0,
				100,
				0,
				"The panel's left edge, in percent of the screen's width"
			),
			DebuggerIcons.PanelPosition
		)
		this.panelY = withIcon(
			this.Node.AddSlider(
				"Panel Y (%)",
				35,
				0,
				100,
				0,
				"The panel's top edge, in percent of the screen's height"
			),
			DebuggerIcons.PanelPosition
		)
		EventsSDK.on("Draw", () => this.Draw())
	}

	/** Whether `toggle` is on and the master switch too. */
	public IsOn(toggle: Menu.Toggle): boolean {
		return this.master.value && toggle.value
	}
	/** Adds a visual debugger: its toggle, which its own event handlers may read. */
	public Add(
		name: string,
		draw: VisualDebugDraw,
		defaultValue: boolean,
		tooltip: string,
		iconPath: string
	): Menu.Toggle {
		const toggle = withIcon(
			this.Node.AddToggle(name, defaultValue, tooltip),
			iconPath
		)
		this.modules.push([toggle, draw])
		return toggle
	}
	public Line(line: string): void {
		this.lines.push(line)
	}

	private Draw(): void {
		this.lines.clear()
		if (
			!this.master.value ||
			GameState.UIState !== DOTAGameUIState.DOTA_GAME_UI_DOTA_INGAME
		) {
			return
		}
		for (const [toggle, draw] of this.modules) {
			if (toggle.value) {
				draw(this)
			}
		}
		if (this.showPanel.value && this.lines.length !== 0) {
			this.DrawPanel()
		}
	}
	private DrawPanel(): void {
		const lines = this.lines,
			text = VisualDebug.PanelText,
			padding = VisualDebug.PanelPadding,
			lineHeight = VisualDebug.PanelLineHeight
		lines.unshift(VisualDebug.PanelTitle)
		let width = 0
		for (const line of lines) {
			width = Math.max(width, MenuSDK.TextSize(line, text).x)
		}
		const screen = RendererSDK.WindowSize,
			position = new Vector2(
				(screen.x * this.panelX.value) / 100,
				(screen.y * this.panelY.value) / 100
			)
		canvas.Rect(
			position,
			new Vector2(width + padding * 2, lines.length * lineHeight + padding * 2),
			{ color: VisualDebug.PanelColor }
		)
		for (let i = 0; i < lines.length; i++) {
			canvas.Text(
				lines[i],
				new Vector2(position.x + padding, position.y + padding + i * lineHeight),
				text
			)
		}
	}
}

/** A disc and a label at a world point's place on the screen. */
function DrawMarker(screen: Vector2, color: Color, label: string): void {
	canvas.Circle(new Vector2(screen.x - 7, screen.y - 7), new Vector2(14, 14), { color })
	canvas.Text(label, new Vector2(screen.x + 10, screen.y - 8), { color, size: 16 })
}

/** A square of `color` at `world`'s place on the screen, when it is on it. */
function DrawSquare(world: Vector3, color: Color): void {
	const w2s = RendererSDK.WorldToScreen(world)
	if (w2s !== undefined) {
		canvas.Rect(new Vector2(w2s.x - 10, w2s.y - 10), new Vector2(20, 20), { color })
	}
}

/** Tracking projectiles green, linear ones red. */
function AddProjectiles(visual: VisualDebug): void {
	const tracking = new Color(0, 255),
		linear = new Color(255)
	visual.Add(
		"Projectiles",
		ctx => {
			const trackingAll = ProjectileManager.AllTrackingProjectiles,
				linearAll = ProjectileManager.AllLinearProjectiles
			for (const projectile of trackingAll) {
				DrawSquare(projectile.Position, tracking)
			}
			for (const projectile of linearAll) {
				DrawSquare(projectile.Position, linear)
			}
			ctx.Line(
				`projectiles: ${trackingAll.length} tracking, ${linearAll.length} linear`
			)
		},
		false,
		"Marks tracking (green) and linear (red) projectiles on screen",
		DebuggerIcons.Projectiles
	)
}

/**
 * Unit teleports from the SDK's `UnitPortalData` (`UnitPortalChanged` / `UnitPortalDestroyed`): the
 * way from the start to the end, and a panel line of the caster, the ability and the time left.
 * "Debug teleports" of the events dumps the whole model to the console.
 */
function AddTeleports(visual: VisualDebug): void {
	const active: UnitPortalData[] = [],
		path = new Color(255, 220, 0),
		start = new Color(0, 230, 0),
		end = new Color(255, 60, 60)
	const module = visual.Add(
		"Teleports",
		ctx => {
			for (let i = active.length - 1; i > -1; i--) {
				const data = active[i],
					from = RendererSDK.WorldToScreen(data.StartPosition),
					to = RendererSDK.WorldToScreen(data.EndPosition)
				if (from !== undefined && to !== undefined) {
					canvas.Line(from, to, path, 2)
				}
				if (from !== undefined) {
					DrawMarker(from, start, "START")
				}
				if (to !== undefined) {
					DrawMarker(to, end, "END")
				}
				ctx.Line(
					`tp: ${data.Caster?.Name ?? "unknown"} | ${data.AbilityName} | ${Math.max(0, data.RemainingTime).toFixed(1)}s`
				)
			}
		},
		false,
		"The start, the end, the way, the ability and the time left of unit teleports",
		DebuggerIcons.Teleports
	)
	EventsSDK.on("UnitPortalChanged", data => {
		if (visual.IsOn(module) && !active.includes(data)) {
			active.push(data)
		}
	})
	EventsSDK.on("UnitPortalDestroyed", data => {
		active.remove(data)
	})
	EventsSDK.on("GameEnded", () => active.clear())
}

/** The names of a particle's attach types, by `NetworkedParticle.Attach` + 1 (-1 is INVALID). */
const ParticleAttachNames: readonly string[] = [
	"INVALID",
	"ABSORIGIN",
	"ABSORIGIN_FOLLOW",
	"CUSTOMORIGIN",
	"CUSTOMORIGIN_FOLLOW",
	"POINT",
	"POINT_FOLLOW",
	"EYES_FOLLOW",
	"OVERHEAD_FOLLOW",
	"WORLDORIGIN",
	"ROOTBONE_FOLLOW",
	"RENDERORIGIN_FOLLOW",
	"MAIN_VIEW",
	"WATERWAKE",
	"CENTER_FOLLOW",
	"CUSTOM_GAME_STATE_1",
	"HEALTHBAR"
]

/** Every entity a particle references, once each: the caster may be in any of them. */
function ParticleTargets(
	particle: NetworkedParticle,
	out: INativePredictionTarget[]
): void {
	out.clear()
	const add = (target: Nullable<INativePredictionTarget>) => {
		if (target !== undefined && !out.includes(target)) {
			out.push(target)
		}
	}
	add(particle.AttachedTo)
	add(particle.ModifiersAttachedTo)
	for (const entry of particle.ControlPointsEnt.values()) {
		add(entry[0])
	}
}

/** A unit's name - "(fog)" after one the SDK only predicts - or another entity's index. */
function TargetLabel(target: INativePredictionTarget): string {
	if (target instanceof FakeUnit) {
		return `${target.Name}(fog)`
	}
	return target instanceof Unit ? target.Name : `#${target.Index}`
}

/** Where a particle is: its control point 0 when set, else its first entity's place. */
function ParticlePosition(
	particle: NetworkedParticle,
	targets: readonly INativePredictionTarget[]
): Nullable<Vector3> {
	const cp0 = particle.ControlPoints.get(0)
	if (cp0 !== undefined && (cp0.x !== 0 || cp0.y !== 0)) {
		return cp0
	}
	const anchor = targets[0]
	if (anchor instanceof Unit) {
		return anchor.Position
	}
	return anchor?.PredictedPosition ?? cp0
}

/**
 * Every unit a particle references - attached to, its modifiers' unit, the entities of its control
 * points - fog units in red: a building such as a twin gate is always seen, so the game still makes
 * its portal particles when an enemy in the fog uses it, and the panel names who even where the
 * particle has no place on the screen.
 */
function AddParticles(visual: VisualDebug): void {
	const filter = withIcon(
			visual.Node.AddDropdown(
				"Particle filter",
				["teleport / portal only", "all particles"],
				0,
				"Which particles the Particles debugger lists"
			),
			DebuggerIcons.Filter
		),
		portal = /portal|teleport|twin_gate/i,
		targets: INativePredictionTarget[] = [],
		marker = new Color(255, 150, 0),
		label = new Color(255, 200, 0),
		fog = new Color(255, 80, 80)
	visual.Add(
		"Particles",
		ctx => {
			const portalsOnly = filter.SelectedID === 0,
				cap = portalsOnly ? 100 : 20
			let shown = 0
			for (const particle of NetworkedParticle.Instances.values()) {
				const path = particle.PathNoEcon
				if (portalsOnly && !portal.test(path)) {
					continue
				}
				shown++
				const name = path.split("/").pop() ?? path,
					attach =
						ParticleAttachNames[particle.Attach + 1] ?? `${particle.Attach}`
				ParticleTargets(particle, targets)
				if (shown <= cap) {
					ctx.Line(
						`${name} [${attach}] → ${targets.length !== 0 ? targets.map(TargetLabel).join(", ") : "-"}`
					)
				}
				const position = ParticlePosition(particle, targets),
					w2s =
						position !== undefined
							? RendererSDK.WorldToScreen(position)
							: undefined
				if (w2s === undefined) {
					continue
				}
				canvas.Circle(new Vector2(w2s.x - 4, w2s.y - 4), new Vector2(8, 8), {
					color: marker
				})
				canvas.Text(`${name} [${attach}]`, new Vector2(w2s.x + 8, w2s.y - 16), {
					color: label,
					size: 14
				})
				const hero = targets.find(
					target =>
						target instanceof FakeUnit ||
						(target instanceof Unit && target.IsHero)
				)
				if (hero !== undefined) {
					canvas.Text(`→ ${TargetLabel(hero)}`, new Vector2(w2s.x + 8, w2s.y), {
						color: hero instanceof FakeUnit ? fog : Color.White,
						size: 14
					})
				}
			}
			if (shown > cap) {
				ctx.Line(`… +${shown - cap} more particle(s) hidden`)
			}
			ctx.Line(
				`particles: ${shown} shown / ${NetworkedParticle.Instances.size} total`
			)
		},
		false,
		"Lists every unit a particle references (red: a unit in the fog)",
		DebuggerIcons.Particles
	)
}

/**
 * Active modifiers with their parent and caster, the raw handles of the modifier's data where the
 * unit is in the fog: a hero channeling a twin gate gets `modifier_twin_gate_warp_channel`, which the
 * game sends for an enemy in the fog too - its handle names the teleporter the particle does not.
 */
function AddModifiers(visual: VisualDebug): void {
	const active = new Set<Modifier>(),
		filter = withIcon(
			visual.Node.AddDropdown(
				"Modifier filter",
				["teleport / portal / warp", "all"],
				0,
				"Which modifiers the Modifiers debugger lists"
			),
			DebuggerIcons.Filter
		),
		warp = /twin_gate|portal|teleport|warp/i,
		label = new Color(120, 200, 255),
		cap = 30
	EventsSDK.on("ModifierCreated", mod => active.add(mod))
	EventsSDK.on("ModifierRemoved", mod => active.delete(mod))
	EventsSDK.on("GameEnded", () => active.clear())
	visual.Add(
		"Modifiers",
		ctx => {
			const filtered = filter.SelectedID === 0
			let shown = 0
			for (const mod of active) {
				if (filtered && !warp.test(mod.Name)) {
					continue
				}
				shown++
				if (shown <= cap) {
					const parent = mod.kv.Parent,
						caster = mod.kv.Caster
					ctx.Line(
						`${mod.Name} → P: ${mod.Parent?.Name ?? (parent !== undefined ? `handle#${parent} (fog?)` : "-")} | C: ${mod.Caster?.Name ?? (caster !== undefined ? `handle#${caster}` : "-")}`
					)
				}
				const position = mod.Parent?.Position,
					w2s =
						position !== undefined
							? RendererSDK.WorldToScreen(position)
							: undefined
				if (w2s !== undefined) {
					canvas.Text(mod.Name, new Vector2(w2s.x + 8, w2s.y + 14), {
						color: label,
						size: 14
					})
				}
			}
			if (shown > cap) {
				ctx.Line(`… +${shown - cap} more modifier(s) hidden`)
			}
			ctx.Line(`modifiers: ${shown} shown / ${active.size} total`)
		},
		false,
		"Active modifiers with their parent and caster (raw handles for units in the fog)",
		DebuggerIcons.Modifiers
	)
}

/**
 * The two active twin gates labelled START (entry) and END (exit): both fire `team_portal_active`,
 * the entry's first - the particles are listed in the order they came.
 */
function AddTwinGates(visual: VisualDebug): void {
	const active = /team_portal(_dire)?_active/,
		gates: Vector3[] = [],
		start = new Color(0, 230, 0),
		end = new Color(255, 80, 80)
	visual.Add(
		"Twin gate START / END",
		ctx => {
			gates.clear()
			for (const particle of NetworkedParticle.Instances.values()) {
				if (!active.test(particle.PathNoEcon)) {
					continue
				}
				const attached = particle.AttachedTo,
					position =
						attached instanceof Unit
							? attached.Position
							: particle.ControlPoints.get(0)
				if (
					position === undefined ||
					gates.some(gate => gate.Distance2D(position) < 50)
				) {
					continue
				}
				gates.push(position)
			}
			for (let i = 0; i < gates.length; i++) {
				const label = i === 0 ? "START (entry)" : "END (exit)",
					w2s = RendererSDK.WorldToScreen(gates[i])
				if (w2s !== undefined) {
					canvas.Text(label, new Vector2(w2s.x + 8, w2s.y + 28), {
						color: i === 0 ? start : end,
						size: 14
					})
				}
				ctx.Line(label)
			}
		},
		false,
		"Labels the two active twin gates START (entry) and END (exit)",
		DebuggerIcons.TwinGates
	)
}

/** The "Visual debug" node of `parent` with its built-in debuggers, under `master`. */
export function CreateVisualDebug(parent: Menu.Node, master: Menu.Toggle): VisualDebug {
	const visual = new VisualDebug(parent, master)
	AddProjectiles(visual)
	AddTeleports(visual)
	AddParticles(visual)
	AddModifiers(visual)
	AddTwinGates(visual)
	return visual
}
