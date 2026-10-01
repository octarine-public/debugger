import "./translations"

import { canvas } from "../render"
import { DebuggerIcons } from "./icons"

const globalThisAny = globalThis as any
globalThisAny.DEBUGGER_INSTALLED = true

const run = (command: string) => () => GameState.ExecuteCommand(command)

/** Puts a glyph on a row and hands the row back, so a declaration stays one chain. */
function withIcon<T extends Menu.Base>(entry: T, iconPath: string): T {
	entry.IconPath = iconPath
	return entry
}

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

withIcon(
	debuggerMenu.AddToggle(
		"Debug GUIInfo",
		false,
		"Outlines the HUD areas scripts read from GUIInfo"
	),
	DebuggerIcons.GUIInfo
).OnValue(toggle => (GUIInfo.debugDraw = toggle.value))

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

const debugProjectiles = withIcon(
	debugEventsMenu.AddToggle(
		"Debug projectiles",
		false,
		"Marks tracking (green) and linear (red) projectiles on screen\nWorks while event debugging is on"
	),
	DebuggerIcons.Projectiles
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

function GetRectPolygon(rect: Rectangle): WorldPolygon {
	const pos1 = rect.pos1,
		pos2 = new Vector2(rect.pos1.x, rect.pos2.y),
		pos3 = rect.pos2,
		pos4 = new Vector2(rect.pos2.x, rect.pos1.y)
	return new WorldPolygon(
		Vector3.FromVector2(pos1).SetZ(Dota2SDK.GetPositionHeight(pos1)),
		Vector3.FromVector2(pos2).SetZ(Dota2SDK.GetPositionHeight(pos2)),
		Vector3.FromVector2(pos3).SetZ(Dota2SDK.GetPositionHeight(pos3)),
		Vector3.FromVector2(pos4).SetZ(Dota2SDK.GetPositionHeight(pos4))
	)
}

const GNVParticleManager = new ParticlesSDK()
EventsSDK.on("Draw", () => {
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
		const gridPos = GridNav.GetGridPosForPos(Vector2.FromVector3(absPos))
		for (let i = -10; i < 10; i++) {
			for (let j = -10; j < 10; j++) {
				const x = gridPos.x + i
				const y = gridPos.y + j
				const baseKey = `gridnav_${i}_${j}_`
				let currentKey = 0
				const flags = GridNav.GetCellFlagsForGridPos(x, y)
				const rect = GridNav.GetRectForGridPos(x, y)
				rect.pos1.AddScalarForThis(1)
				rect.pos2.SubtractScalarForThis(1)

				if (flags.hasBit(GridNavCellFlags.Walkable)) {
					GetRectPolygon(rect).Draw(
						baseKey + currentKey++,
						Dota2SDK.LocalPlayer.Hero,
						GNVParticleManager,
						Color.Green
					)
				} else {
					GetRectPolygon(rect).Destroy(
						baseKey + currentKey++,
						GNVParticleManager
					)
				}

				rect.pos1.AddScalarForThis(5)
				rect.pos2.SubtractScalarForThis(5)

				if (flags.hasBit(GridNavCellFlags.UnitBlocking)) {
					GetRectPolygon(rect).Draw(
						baseKey + currentKey++,
						Dota2SDK.LocalPlayer.Hero,
						GNVParticleManager,
						Color.Aqua
					)
				} else {
					GetRectPolygon(rect).Destroy(
						baseKey + currentKey++,
						GNVParticleManager
					)
				}

				rect.pos1.AddScalarForThis(5)
				rect.pos2.SubtractScalarForThis(5)

				if (flags.hasBit(GridNavCellFlags.Tree)) {
					GetRectPolygon(rect).Draw(
						baseKey + currentKey++,
						Dota2SDK.LocalPlayer.Hero,
						GNVParticleManager,
						Color.Orange
					)
				} else {
					GetRectPolygon(rect).Destroy(
						baseKey + currentKey++,
						GNVParticleManager
					)
				}

				rect.pos1.AddScalarForThis(5)
				rect.pos2.SubtractScalarForThis(5)

				if (flags.hasBit(GridNavCellFlags.MovementBlocker)) {
					GetRectPolygon(rect).Draw(
						baseKey + currentKey++,
						Dota2SDK.LocalPlayer.Hero,
						GNVParticleManager,
						Color.Red
					)
				} else {
					GetRectPolygon(rect).Destroy(
						baseKey + currentKey++,
						GNVParticleManager
					)
				}

				rect.pos1.AddScalarForThis(5)
				rect.pos2.SubtractScalarForThis(5)

				if (flags.hasBit(GridNavCellFlags.InteractionBlocker)) {
					GetRectPolygon(rect).Draw(
						baseKey + currentKey++,
						Dota2SDK.LocalPlayer.Hero,
						GNVParticleManager,
						Color.Fuchsia
					)
				} else {
					GetRectPolygon(rect).Destroy(
						baseKey + currentKey++,
						GNVParticleManager
					)
				}
			}
		}
	} else {
		GNVParticleManager.DestroyAll()
	}

	if (
		!debugEvents.value ||
		!debugProjectiles.value ||
		GameState.UIState !== DOTAGameUIState.DOTA_GAME_UI_DOTA_INGAME
	) {
		return
	}

	ProjectileManager.AllTrackingProjectiles.forEach(proj => {
		const w2s = RendererSDK.WorldToScreen(proj.Position)
		if (w2s === undefined) {
			return
		}
		canvas.Rect(w2s.SubtractForThis(new Vector2(10, 10)), new Vector2(20, 20), {
			color: new Color(0, 255)
		})
	})
	ProjectileManager.AllLinearProjectiles.forEach(proj => {
		const w2s = RendererSDK.WorldToScreen(proj.Position)
		if (w2s === undefined) {
			return
		}
		canvas.Rect(w2s.SubtractForThis(new Vector2(10, 10)), new Vector2(20, 20), {
			color: new Color(255)
		})
	})
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

EventsSDK.on("GameEvent", (name, obj) => {
	if (!debugEvents.value) {
		return
	}
	SafeLog("GameEvent", name, obj)
})
EventsSDK.on("ServerInfo", obj => {
	if (!debugEvents.value) {
		return
	}
	SafeLog("ServerInfo", SharedSDK.MapToObject(obj))
})

EventsSDK.on("ParticleCreated", par => {
	if (!debugEvents.value) {
		return
	}
	console.log(GameState.RawGameTime, {
		ParticleCreated: par
	})
})

EventsSDK.on("ParticleUpdated", par => {
	if (!debugEvents.value) {
		return
	}
	console.log(GameState.RawGameTime, {
		ParticleUpdated: par
	})
})

EventsSDK.on("ParticleDestroyed", par => {
	if (!debugEvents.value) {
		return
	}
	console.log(GameState.RawGameTime, {
		ParticleDestroyed: par
	})
})

EventsSDK.on("StartSound", (name, sourceEnt, position, _seed, startTime) => {
	if (!debugEvents.value) {
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
	if (!debugEvents.value) {
		return
	}
	console.log(GameState.RawGameTime, {
		ModifierCreated: {
			mod
		}
	})
})

EventsSDK.on("ModifierRemoved", mod => {
	if (!debugEvents.value) {
		return
	}
	console.log(GameState.RawGameTime, {
		ModifierRemoved: {
			mod
		}
	})
})

EventsSDK.on("GameEnded", () => {
	pressSven = false
	pressCreeps = false
	sleeper.FullReset()
})

EventsSDK.on("PlayerCustomDataUpdated", player => {
	if (player.IsValid && !player.IsSpectator) {
		setConVar()
	}
})
