import "./translations"

import { canvas } from "../render"
import { DebuggerIcons, withIcon } from "./icons"
import { CreateVisualDebug } from "./visualDebug"

const globalThisAny = globalThis as any
globalThisAny.DEBUGGER_INSTALLED = true

const run = (command: string) => () => GameState.ExecuteCommand(command)

function setConVar() {
	ConVarsSDK.Set(
		"sv_cheats",
		ConVarsSDK.GetBoolean("sv_cheats", false) || svCheats.value
	)
	const players = PlayerCustomData.Array.filter(x => x.SteamID !== 0n)
	if (players.length === 1) {
		GameState.ExecuteCommand(
			wtf.value ? "dota_ability_debug_enable" : "dota_ability_debug_disable"
		)
		GameState.ExecuteCommand(
			creepsNoSpawn.value
				? "dota_creeps_no_spawning_enable"
				: "dota_creeps_no_spawning_disable"
		)
	}
}

const debuggerMenu = Menu.AddEntry(
	"Debugger",
	DebuggerIcons.Debugger,
	"Tools for debugging and script development"
)

/**
 * The master switch: off, every passive output of the debugger is silent - the visual debuggers,
 * the GridNav and cursor draws, the GUIInfo outline and the console logs - and each switch keeps its
 * own value. What fires only on a press (the console commands, the unit keys) stays apart. Its
 * priority -1 keeps it above every other row.
 */
const masterState = withIcon(
	debuggerMenu.AddToggle(
		"Enabled",
		true,
		"Master switch: off, all of the debugger's output stops at once",
		-1
	),
	DebuggerIcons.Master
)
/** Whether `toggle` is on and the master switch too: what every output reads. */
const isOn = (toggle: Menu.Toggle) => masterState.value && toggle.value

const guiInfo = withIcon(
	debuggerMenu.AddToggle(
		"Debug GUIInfo",
		false,
		"Outlines the HUD areas scripts read from GUIInfo"
	),
	DebuggerIcons.GUIInfo
)
const syncGUIInfo = () => (GUIInfo.debugDraw = isOn(guiInfo))
guiInfo.OnValue(syncGUIInfo)
masterState.OnValue(syncGUIInfo)

const renderGNV = withIcon(
	debuggerMenu.AddToggle(
		"Debug GridNav",
		false,
		"Navigation grid cells around the cursor:\ngreen walkable, aqua blocked by units, orange trees,\nred movement and pink interaction blockers"
	),
	DebuggerIcons.GridNav
)

const renderV3cursor = withIcon(
	debuggerMenu.AddToggle(
		"Debug world cursor position",
		false,
		"Writes the cursor's world coordinates next to it"
	),
	DebuggerIcons.WorldCursor
)

const screenCursor = withIcon(
	debuggerMenu.AddToggle(
		"Debug screen cursor position",
		false,
		"Writes the cursor's screen coordinates next to it"
	),
	DebuggerIcons.ScreenCursor
)

const svCheatsMenu = debuggerMenu.AddNode(
	"Concommands",
	DebuggerIcons.Concommands,
	"Cheat console commands for a local lobby"
)
const svCheats = withIcon(
	svCheatsMenu.AddToggle(
		"sv_cheats",
		false,
		"Allows cheat commands on the server (sv_cheats)"
	),
	DebuggerIcons.Cheats
)
svCheats.OnValue(setConVar)

const wtf = withIcon(
	svCheatsMenu.AddToggle(
		"wtf",
		false,
		"Abilities and items have no cooldowns or mana costs (dota_ability_debug)"
	),
	DebuggerIcons.NoCooldowns
)
wtf.OnValue(setConVar)

const creepsNoSpawn = withIcon(
	svCheatsMenu.AddToggle(
		"Creeps no spawning",
		false,
		"Lane creeps stop spawning (dota_creeps_no_spawning)"
	),
	DebuggerIcons.CreepsNoSpawn
)
creepsNoSpawn.OnValue(setConVar)

withIcon(
	svCheatsMenu.AddKeybind(
		"All vision",
		"",
		"Toggles vision over the whole map (dota_all_vision)"
	),
	DebuggerIcons.AllVision
).OnRelease(() =>
	ConVarsSDK.Set("dota_all_vision", !ConVarsSDK.GetBoolean("dota_all_vision", false))
)

const timeScale = withIcon(
	svCheatsMenu.AddSlider(
		"Time Scale (n)",
		1,
		1,
		10,
		1,
		"Game speed the key below sets"
	),
	DebuggerIcons.TimeScale
)

withIcon(
	svCheatsMenu.AddKeybind(
		"Time Scale (slider)",
		"",
		"Sets the game speed to the value above (host_timescale)"
	),
	DebuggerIcons.TimeScaleApply
).OnRelease(() => ConVarsSDK.Set("host_timescale", timeScale.value))

withIcon(
	svCheatsMenu.AddKeybind(
		"Time Scale (normal)",
		"",
		"Puts the game speed back to normal (host_timescale 1)"
	),
	DebuggerIcons.TimeScaleNormal
).OnRelease(() => ConVarsSDK.Set("host_timescale", 1))

withIcon(
	svCheatsMenu.AddKeybind(
		"Refresh",
		"",
		"Refreshes your hero's health, mana and cooldowns (dota_hero_refresh)"
	),
	DebuggerIcons.Refresh
).OnRelease(run("dota_hero_refresh"))

withIcon(
	svCheatsMenu.AddButton(
		"Local lvl max",
		"Raises your hero to level 30 (dota_hero_level 30)"
	),
	DebuggerIcons.MaxLevel
).OnValue(run("dota_hero_level 30"))

withIcon(
	svCheatsMenu.AddButton(
		"Get Rapier God",
		"Gives your hero a Divine Rapier (dota_rap_god)"
	),
	DebuggerIcons.Rapier
).OnValue(run("dota_rap_god"))

const addUnitMenu = debuggerMenu.AddNode(
	"add unit",
	DebuggerIcons.AddUnit,
	"Spawns units to test against"
)

withIcon(
	addUnitMenu.AddKeybind(
		"Add creep",
		"",
		"Spawns an enemy melee creep (dota_create_unit)"
	),
	DebuggerIcons.AddCreep
).OnRelease(run("dota_create_unit npc_dota_creep_badguys_melee enemy"))

EventsSDK.on("GameStarted", setConVar)

const debugEventsMenu = debuggerMenu.AddNode(
	"Debugging events",
	DebuggerIcons.Events,
	"Debugging native events in console"
)

const debugEvents = withIcon(
	debugEventsMenu.AddToggle(
		"Debugging events",
		false,
		"Logs game events, particles, sounds and modifiers to the console"
	),
	DebuggerIcons.State
)

const debugTeleports = withIcon(
	debugEventsMenu.AddToggle(
		"Debug teleports",
		false,
		"Logs each unit teleport's data (start, end, ability, duration) to the console"
	),
	DebuggerIcons.Teleports
)

const ignoreCreeps = withIcon(
	debugEventsMenu.AddToggle(
		"Ignore creeps",
		true,
		"Leaves creep-sourced events (damage, attacks, animations, sounds, ...) out of the console"
	),
	DebuggerIcons.IgnoreCreeps
)

const humanizerMenu = debuggerMenu.AddNode(
	"Humanizer",
	DebuggerIcons.Humanizer,
	"Debug switches of the order humanizer"
)

withIcon(
	humanizerMenu.AddToggle(
		"debug_draw",
		false,
		"Draws the humanizer's camera zones and cursor targets"
	),
	DebuggerIcons.DebugDraw
).OnValue(toggle => (ExecuteOrder.DebugDraw = toggle.value))
withIcon(
	humanizerMenu.AddToggle(
		"debug_orders",
		false,
		"Logs every order the humanizer sends to the console"
	),
	DebuggerIcons.DebugOrders
).OnValue(toggle => (ExecuteOrder.DebugOrders = toggle.value))
withIcon(
	humanizerMenu.AddToggle(
		"unsafe_mode",
		false,
		"Sends orders at once, without the humanizer"
	),
	DebuggerIcons.UnsafeMode
).OnValue(toggle => (ExecuteOrder.unsafeMode = toggle.value))

CreateVisualDebug(debuggerMenu, masterState)

const canBeDown = () => {
	return (
		Dota2SDK.GameRules !== undefined &&
		GameState.UIState === DOTAGameUIState.DOTA_GAME_UI_DOTA_INGAME &&
		Dota2SDK.GameRules.GameState >
			DOTAGameState.DOTA_GAMERULES_STATE_HERO_SELECTION &&
		Dota2SDK.GameRules.GameState < DOTAGameState.DOTA_GAMERULES_STATE_POST_GAME
	)
}

let pressSven = false,
	pressSniper = false
const sleeper = new GameSleeper()
withIcon(
	addUnitMenu.AddKeybind(
		"Full sven",
		"",
		"Spawns an enemy Sven at level 30 with Hearts of Tarrasque"
	),
	DebuggerIcons.FullSven
).OnRelease(() => {
	if (canBeDown()) {
		GameState.ExecuteCommand("dota_create_unit npc_dota_hero_sven enemy")
		pressSven = true
		sleeper.Sleep(1000 + GameState.Ping / 2, "addSven")
		return
	}
	pressSven = false
	sleeper.FullReset()
})

withIcon(
	addUnitMenu.AddKeybind(
		"Full sniper",
		"",
		"Spawns an enemy Sniper at level 5 with Aghanim's Scepter"
	),
	DebuggerIcons.FullSniper
).OnRelease(() => {
	if (canBeDown()) {
		GameState.ExecuteCommand("dota_create_unit npc_dota_hero_sniper enemy")
		pressSniper = true
		sleeper.Sleep(1000 + GameState.Ping / 2, "addSniper")
		return
	}
	pressSniper = false
	sleeper.FullReset()
})

let pressCreeps = false
const treeCreeps = addUnitMenu.AddNode(
	"Creeps",
	DebuggerIcons.Creeps,
	"Spawns a pack of lane creeps"
)
const creepsType = withIcon(
	treeCreeps.AddDropdown("Type", ["range", "melee"]),
	DebuggerIcons.CreepType
)
const creepsTeam = withIcon(
	treeCreeps.AddDropdown("team", ["enemy", "allies", "neutral"]),
	DebuggerIcons.Team
)
const countCreeps = withIcon(
	treeCreeps.AddSlider("Count", 30, 1, 30, 0, "How many creeps to spawn"),
	DebuggerIcons.Count
)
withIcon(
	treeCreeps.AddKeybind("Key", "", "Spawns the creeps"),
	DebuggerIcons.Key
).OnRelease(() => {
	if (canBeDown()) {
		pressCreeps = true
		sleeper.Sleep(1000 + GameState.Ping / 2, "addCreeps")
		return
	}
	pressCreeps = false
	sleeper.FullReset()
})

EventsSDK.on("PostDataUpdate", () => {
	if (Dota2SDK.GameRules === undefined || !GameState.IsConnected) {
		return
	}

	if (!canBeDown()) {
		return
	}

	if (pressSven) {
		for (let i = 6; i--; ) {
			GameState.ExecuteCommand("dota_bot_give_item item_heart")
		}
		GameState.ExecuteCommand("dota_bot_give_level 30")
		if (!sleeper.Sleeping("addSven")) {
			pressSven = false
		}
	}

	if (pressSniper) {
		GameState.ExecuteCommand("dota_bot_give_level 5")
		GameState.ExecuteCommand("dota_bot_give_item item_ultimate_scepter")
		if (!sleeper.Sleeping("addSniper")) {
			pressSniper = false
		}
	}

	if (pressCreeps) {
		let creepTypeName = ""
		switch (creepsTeam.SelectedID) {
			case 0:
				creepTypeName = "enemy"
				break
			case 2:
				creepTypeName = "neutral"
				break
		}
		for (let i = countCreeps.value; i--; ) {
			GameState.ExecuteCommand(
				`dota_create_unit npc_dota_creep_${
					(Dota2SDK.LocalPlayer?.Team ?? Team.Dire === Team.Dire)
						? "badguys"
						: "goodguys"
				}_${creepsType.SelectedID === 0 ? "melee" : "ranged"} ${creepTypeName}`
			)
		}
		if (!sleeper.Sleeping("addCreeps")) {
			pressCreeps = false
		}
	}
})

function GetRectPolygon(rect: Rectangle, z: number): WorldPolygon {
	const pos1 = rect.pos1,
		pos2 = new Vector2(rect.pos1.x, rect.pos2.y),
		pos3 = rect.pos2,
		pos4 = new Vector2(rect.pos2.x, rect.pos1.y)
	return new WorldPolygon(
		Vector3.FromVector2(pos1).SetZ(z),
		Vector3.FromVector2(pos2).SetZ(z),
		Vector3.FromVector2(pos3).SetZ(z),
		Vector3.FromVector2(pos4).SetZ(z)
	)
}

const GNVParticleManager = new ParticlesSDK()
/**
 * The layers of a GridNav cell, each 5 units inside the last: green walkable, aqua blocked by units,
 * orange trees, red movement and pink interaction blockers.
 */
const GNVLayers: readonly [GridNavCellFlags, Color][] = [
	[GridNavCellFlags.Walkable, Color.Green],
	[GridNavCellFlags.UnitBlocking, Color.Aqua],
	[GridNavCellFlags.Tree, Color.Orange],
	[GridNavCellFlags.MovementBlocker, Color.Red],
	[GridNavCellFlags.InteractionBlocker, Color.Fuchsia]
]
/** The grid cell under the cursor the GridNav overlay was last laid out around; none while it is off. */
let lastGNVKey: Nullable<number>
/** Game time the overlay was last laid out: the cells' units and trees change under it too. */
let lastGNVAt = -Infinity
/** Seconds the overlay stands before it is laid out again with the cursor in the same cell. */
const GNVRefresh = 1
/**
 * The ground of each grid cell, read once: the map's ground does not change, and within a cell it
 * is flat enough for one height to stand for all its corners and layers. Cleared as the game ends.
 */
const gnvHeightCache = new Map<number, number>()
function getCellHeight(gridX: number, gridY: number, sample: Vector2): number {
	const key = gridX * 100000 + gridY
	let height = gnvHeightCache.get(key)
	if (height === undefined) {
		height = Dota2SDK.GetPositionHeight(sample)
		gnvHeightCache.set(key, height)
	}
	return height
}
/** Takes the GridNav overlay off the screen. */
function clearGNV() {
	if (lastGNVKey !== undefined) {
		GNVParticleManager.DestroyAll()
		lastGNVKey = undefined
	}
}
/**
 * Lays the GridNav overlay out around `gridPos` when the cursor came to another cell, or a second
 * on - the particles stay where they were drawn, and redrawing 400 cells a frame only cost frames.
 */
function drawGNV(gridPos: Vector2, hero: Unit) {
	const key = gridPos.x * 100000 + gridPos.y,
		now = GameState.RawGameTime
	if (key === lastGNVKey && now >= lastGNVAt && now - lastGNVAt < GNVRefresh) {
		return
	}
	lastGNVKey = key
	lastGNVAt = now
	for (let i = -10; i < 10; i++) {
		for (let j = -10; j < 10; j++) {
			const x = gridPos.x + i
			const y = gridPos.y + j
			const baseKey = `gridnav_${i}_${j}_`
			let currentKey = 0
			const flags = GridNav!.GetCellFlagsForGridPos(x, y)
			const rect = GridNav!.GetRectForGridPos(x, y)
			const z = getCellHeight(x, y, rect.pos1)
			rect.pos1.AddScalarForThis(1)
			rect.pos2.SubtractScalarForThis(1)
			for (let l = 0; l < GNVLayers.length; l++) {
				const [flag, color] = GNVLayers[l]
				if (l !== 0) {
					rect.pos1.AddScalarForThis(5)
					rect.pos2.SubtractScalarForThis(5)
				}
				if (flags.hasBit(flag)) {
					GetRectPolygon(rect, z).Draw(
						baseKey + currentKey++,
						hero,
						GNVParticleManager,
						color
					)
				} else {
					GetRectPolygon(rect, z).Destroy(
						baseKey + currentKey++,
						GNVParticleManager
					)
				}
			}
		}
	}
}

EventsSDK.on("Draw", () => {
	if (!masterState.value) {
		clearGNV()
		return
	}
	if (renderV3cursor.value) {
		const curPos = InputManager.CursorOnWorld
		const position = RendererSDK.WorldToScreen(curPos)
		if (position !== undefined) {
			canvas.CursorText(`${curPos.toArray().map(x => Math.floor(x))}`, {
				color: Color.Yellow,
				size: 30 + 4
			})
		}
	}

	if (screenCursor.value) {
		const curPos = InputManager.CursorOnScreen
		canvas.CursorText(`${curPos.toArray().map(x => Math.floor(x))}`, {
			color: Color.White,
			size: 30 + 4
		})
	}

	const absPos = InputManager.CursorOnWorld
	if (
		renderGNV.value &&
		GridNav !== undefined &&
		GridNav.IsInWorld(absPos) &&
		Dota2SDK.LocalPlayer?.Hero !== undefined
	) {
		drawGNV(
			GridNav.GetGridPosForPos(Vector2.FromVector3(absPos)),
			Dota2SDK.LocalPlayer.Hero
		)
	} else {
		clearGNV()
	}
})

function SafeLog(...args: any[]) {
	console.log(
		...args.map(arg =>
			JSON.parse(
				JSON.stringify(arg, (_, value) =>
					typeof value === "bigint" ? value.toString() + "n" : value
				)
			)
		)
	)
}

/**
 * Whether `ent` is a creep while "Ignore creeps" is on: creep combat kept out of the console so hero
 * and teleport events read. A unit in the fog has no creep flag: its name tells.
 */
function isCreepNoise(ent: Nullable<Unit | FakeUnit>): boolean {
	if (!ignoreCreeps.value || ent === undefined) {
		return false
	}
	return ent instanceof Unit ? ent.IsCreep : /creep|neutral/i.test(ent.Name)
}

/** Whether a game event (entity_hurt, entity_killed, ...) names a creep while "Ignore creeps" is on. */
function gameEventIsCreepNoise(obj: any): boolean {
	if (!ignoreCreeps.value) {
		return false
	}
	for (const key of ["entindex_killed", "entindex_attacker", "entindex_inflictor"]) {
		const index = obj?.[key]
		if (
			typeof index === "number" &&
			index > 0 &&
			EntityManager.EntityByIndex<Unit>(index)?.IsCreep === true
		) {
			return true
		}
	}
	return false
}

/** A particle's unit for the creep filter: the one it is attached to, else its modifiers'. */
function particleUnit(par: NetworkedParticle): Nullable<Unit | FakeUnit> {
	const target = par.AttachedTo ?? par.ModifiersAttachedTo
	return target instanceof Unit || target instanceof FakeUnit ? target : undefined
}

function logTeleport(event: string, data: UnitPortalData) {
	const caster = data.Caster
	SafeLog(GameState.RawGameTime, event, {
		caster: caster?.Name,
		casterIndex: caster?.Index,
		isEnemy: caster?.IsEnemy(),
		abilityName: data.AbilityName,
		isValid: data.IsValid,
		isCanceled: data.IsCanceled,
		maxDuration: data.MaxDuration,
		remainingTime: data.RemainingTime,
		target: data.Target?.Name,
		startPosition: data.StartPosition.toArray().map(x => Math.floor(x)),
		endPosition: data.EndPosition.toArray().map(x => Math.floor(x)),
		raw: data
	})
}
EventsSDK.on("UnitPortalChanged", data => {
	if (isOn(debugTeleports)) {
		logTeleport("UnitPortalChanged", data)
	}
})
EventsSDK.on("UnitPortalDestroyed", data => {
	if (isOn(debugTeleports)) {
		logTeleport("UnitPortalDestroyed", data)
	}
})

EventsSDK.on("GameEvent", (name, obj) => {
	if (!isOn(debugEvents) || gameEventIsCreepNoise(obj)) {
		return
	}
	SafeLog("GameEvent", name, obj)
})
EventsSDK.on("ServerInfo", obj => {
	if (!isOn(debugEvents)) {
		return
	}
	SafeLog("ServerInfo", SharedSDK.MapToObject(obj))
})

EventsSDK.on("ParticleCreated", par => {
	if (!isOn(debugEvents) || isCreepNoise(particleUnit(par))) {
		return
	}
	console.log(GameState.RawGameTime, {
		ParticleCreated: par
	})
})

EventsSDK.on("ParticleUpdated", par => {
	if (!isOn(debugEvents) || isCreepNoise(particleUnit(par))) {
		return
	}
	console.log(GameState.RawGameTime, {
		ParticleUpdated: par
	})
})

EventsSDK.on("ParticleDestroyed", par => {
	if (!isOn(debugEvents) || isCreepNoise(particleUnit(par))) {
		return
	}
	console.log(GameState.RawGameTime, {
		ParticleDestroyed: par
	})
})

EventsSDK.on("StartSound", (name, sourceEnt, position, _seed, startTime) => {
	if (!isOn(debugEvents) || isCreepNoise(sourceEnt)) {
		return
	}
	console.log(GameState.RawGameTime, {
		StartSound: {
			name,
			sourceEnt,
			position,
			startTime
		}
	})
})

EventsSDK.on("ModifierCreated", mod => {
	if (!isOn(debugEvents) || isCreepNoise(mod.Parent)) {
		return
	}
	console.log(GameState.RawGameTime, {
		ModifierCreated: {
			mod
		}
	})
})

EventsSDK.on("ModifierRemoved", mod => {
	if (!isOn(debugEvents) || isCreepNoise(mod.Parent)) {
		return
	}
	console.log(GameState.RawGameTime, {
		ModifierRemoved: {
			mod
		}
	})
})

/**
 * The events that tell something happened to a unit - a cast, an attack, an animation, a voice
 * line: the ones maphack listens to. Each switch logs its event's raw payload to the console, to
 * find how to detect an action.
 */
const actionEventsMenu = debugEventsMenu.AddNode(
	"Action events",
	DebuggerIcons.ActionEvents,
	"Logs the events that signal in-game actions to the console"
)
/** A switch of the action events. */
const actionToggle = (name: string, tooltip: string, iconPath: string) =>
	withIcon(actionEventsMenu.AddToggle(name, false, tooltip), iconPath)
const logAbilityPhase = actionToggle(
	"AbilityPhaseChanged",
	"A cast point started or ended: a cast began or was cut off",
	DebuggerIcons.AbilityPhase
)
const logAbilityChannel = actionToggle(
	"AbilityChannelingChanged",
	"A channel started or stopped",
	DebuggerIcons.AbilityChannel
)
const logAttackStart = actionToggle(
	"AttackStarted",
	"A unit started an attack, with its attack point and animation names",
	DebuggerIcons.AttackStarted
)
const logAttackEnd = actionToggle(
	"AttackEnded",
	"A unit's attack ended or was cancelled",
	DebuggerIcons.AttackEnded
)
const logAddGesture = actionToggle(
	"UnitAddGesture",
	"An animation gesture was put on a unit",
	DebuggerIcons.Gesture
)
const logUnitAnimation = actionToggle(
	"UnitAnimation",
	"A unit's animation sequence changed",
	DebuggerIcons.Animation
)
const logUnitSpeech = actionToggle(
	"UnitSpeech",
	"Hero voice lines and responses",
	DebuggerIcons.Speech
)
const logFakeUnit = actionToggle(
	"FakeUnit created / destroyed",
	"Units in the fog of war, which the SDK tracks as FakeUnit",
	DebuggerIcons.FakeUnits
)

EventsSDK.on("AbilityPhaseChanged", ability => {
	if (isOn(logAbilityPhase) && !isCreepNoise(ability.Owner)) {
		console.log(GameState.RawGameTime, { AbilityPhaseChanged: ability })
	}
})
EventsSDK.on("AbilityChannelingChanged", ability => {
	if (isOn(logAbilityChannel) && !isCreepNoise(ability.Owner)) {
		console.log(GameState.RawGameTime, { AbilityChannelingChanged: ability })
	}
})
EventsSDK.on("AttackStarted", (unit, castPoint, animationNames) => {
	if (isOn(logAttackStart) && !isCreepNoise(unit)) {
		console.log(GameState.RawGameTime, {
			AttackStarted: { unit, castPoint, animationNames }
		})
	}
})
EventsSDK.on("AttackEnded", (unit, isCancelled) => {
	if (isOn(logAttackEnd) && !isCreepNoise(unit)) {
		console.log(GameState.RawGameTime, {
			AttackEnded: { unit, isCancelled }
		})
	}
})
EventsSDK.on("UnitAddGesture", (npc, activity, slot) => {
	if (isOn(logAddGesture) && !isCreepNoise(npc)) {
		console.log(GameState.RawGameTime, {
			UnitAddGesture: { npc, activity: GameActivity[activity], slot }
		})
	}
})
EventsSDK.on("UnitAnimation", (npc, _sequence, _rate, _castPoint, type, activity) => {
	if (isOn(logUnitAnimation) && !isCreepNoise(npc)) {
		console.log(GameState.RawGameTime, {
			UnitAnimation: { npc, type, activity: GameActivity[activity] }
		})
	}
})
EventsSDK.on("UnitSpeech", (npc, concept, response) => {
	if (isOn(logUnitSpeech) && !isCreepNoise(npc)) {
		console.log(GameState.RawGameTime, {
			UnitSpeech: { npc, concept, response }
		})
	}
})
EventsSDK.on("FakeUnitCreated", unit => {
	if (isOn(logFakeUnit)) {
		console.log(GameState.RawGameTime, { FakeUnitCreated: unit })
	}
})
EventsSDK.on("FakeUnitDestroyed", unit => {
	if (isOn(logFakeUnit)) {
		console.log(GameState.RawGameTime, { FakeUnitDestroyed: unit })
	}
})

EventsSDK.on("GameEnded", () => {
	pressSven = false
	pressCreeps = false
	lastGNVKey = undefined
	lastGNVAt = -Infinity
	gnvHeightCache.clear()
	sleeper.FullReset()
})

EventsSDK.on("PlayerCustomDataUpdated", player => {
	if (player.IsValid && !player.IsSpectator) {
		setConVar()
	}
})
