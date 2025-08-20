import {
	Color,
	ConVarsSDK,
	DOTAGameState,
	DOTAGameUIState,
	EventsSDK,
	ExecuteOrder,
	GameRules,
	GameSleeper,
	GameState,
	GetPositionHeight,
	GridNav,
	GridNavCellFlags,
	GUIInfo,
	Input,
	LocalPlayer,
	Menu,
	ParticlesSDK,
	PlayerCustomData,
	ProjectileManager,
	Rectangle,
	RendererSDK,
	Team,
	Utils,
	Vector2,
	Vector3,
	WorldPolygon
} from "github.com/octarine-public/wrapper/index"

// for scripts
const globalThisAny = globalThis as any
globalThisAny.DEBUGGER_INSTALLED = true

const exec = (self: Menu.Base) => GameState.ExecuteCommand(self.InternalTooltipName)

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
	"panorama/images/plus/achievements/mvp_icon_png.vtex_c"
)
// debuggerMenu.IsHidden = (globalThis as any).DEBUGER_ENABLE ?? true

debuggerMenu
	.AddToggle("Debug GUIInfo", false)
	.OnValue(toggle => (GUIInfo.debugDraw = toggle.value))

const renderGNV = debuggerMenu.AddToggle("Debug GridNav")

const renderV3cursor = debuggerMenu.AddToggle("Debug world cursor position")

const screenCursor = debuggerMenu.AddToggle("Debug screen cursor position")

const svCheatsMenu = debuggerMenu.AddNode(
	"Concommands",
	"panorama/images/plus/achievements/mvp_icon_png.vtex_c"
)
const svCheats = svCheatsMenu.AddToggle("sv_cheats", false, "sv_cheats")
svCheats.OnValue(setConVar)

const wtf = svCheatsMenu.AddToggle("wtf", false, "dota_ability_debug")
wtf.OnValue(setConVar)

const creepsNoSpawn = svCheatsMenu.AddToggle(
	"Creeps no spawning",
	false,
	"dota_creeps_no_spawning"
)
creepsNoSpawn.OnValue(setConVar)

svCheatsMenu
	.AddKeybind("All vision", "", "dota_all_vision")
	.OnRelease(() =>
		ConVarsSDK.Set(
			"dota_all_vision",
			!ConVarsSDK.GetBoolean("dota_all_vision", false)
		)
	)

const timeScale = svCheatsMenu.AddSlider("Time Scale (n)", 1, 1, 10, 1)

svCheatsMenu
	.AddKeybind("Time Scale (slider)", "", "host_timescale")
	.OnRelease(() => ConVarsSDK.Set("host_timescale", timeScale.value))

svCheatsMenu
	.AddKeybind("Time Scale (normal)", "", "host_timescale")
	.OnRelease(() => ConVarsSDK.Set("host_timescale", 1))

svCheatsMenu.AddKeybind("Refresh", "", "dota_hero_refresh").OnRelease(exec)

svCheatsMenu.AddButton("Local lvl max", "dota_hero_level 30").OnValue(exec)

svCheatsMenu.AddButton("Get Rapier God", "dota_rap_god").OnValue(exec)

const addUnitMenu = debuggerMenu.AddNode(
	"add unit",
	"panorama/images/spellicons/techies_focused_detonate_png.vtex_c"
)

addUnitMenu
	.AddKeybind("Add creep", "", "dota_create_unit npc_dota_creep_badguys_melee enemy")
	.OnRelease(exec)

EventsSDK.on("GameStarted", setConVar)

const debugEventsMenu = debuggerMenu.AddNode(
	"Debugging events",
	"panorama/images/status_icons/information_psd.vtex_c",
	"Debugging native events in console"
)

const debugEvents = debugEventsMenu.AddToggle("Debugging events")

const debugProjectiles = debugEventsMenu.AddToggle(
	"Debug projectiles",
	false,
	"Visual only"
)

const humanizerMenu = debuggerMenu.AddNode(
	"Humanizer",
	"panorama/images/plus/achievements/hero_challenges_icon_png.vtex_c"
)

humanizerMenu
	.AddToggle("debug_draw")
	.OnValue(toggle => (ExecuteOrder.DebugDraw = toggle.value))
humanizerMenu
	.AddToggle("debug_orders")
	.OnValue(toggle => (ExecuteOrder.DebugOrders = toggle.value))
humanizerMenu
	.AddToggle("unsafe_mode")
	.OnValue(toggle => (ExecuteOrder.unsafeMode = toggle.value))

const canBeDown = () => {
	return (
		GameRules !== undefined &&
		GameState.UIState === DOTAGameUIState.DOTA_GAME_UI_DOTA_INGAME &&
		GameRules.GameState > DOTAGameState.DOTA_GAMERULES_STATE_HERO_SELECTION &&
		GameRules.GameState < DOTAGameState.DOTA_GAMERULES_STATE_POST_GAME
	)
}

let pressSven = false,
	pressSniper = false
const sleeper = new GameSleeper()
addUnitMenu.AddKeybind("Full sven").OnRelease(() => {
	if (canBeDown()) {
		GameState.ExecuteCommand("dota_create_unit npc_dota_hero_sven enemy")
		pressSven = true
		sleeper.Sleep(1000 + GameState.Ping / 2, "addSven")
		return
	}
	pressSven = false
	sleeper.FullReset()
})

addUnitMenu.AddKeybind("Full sniper").OnRelease(() => {
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
const treeCreeps = addUnitMenu.AddNode("Creeps")
const creepsType = treeCreeps.AddDropdown("Type", ["range", "melee"])
const creepsTeam = treeCreeps.AddDropdown("team", ["enemy", "allies", "neutral"])
const countCreeps = treeCreeps.AddSlider("Count", 30, 1, 30)
treeCreeps.AddKeybind("Key").OnRelease(() => {
	if (canBeDown()) {
		pressCreeps = true
		sleeper.Sleep(1000 + GameState.Ping / 2, "addCreeps")
		return
	}
	pressCreeps = false
	sleeper.FullReset()
})

EventsSDK.on("PostDataUpdate", () => {
	if (GameRules === undefined || !GameState.IsConnected) {
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
					(LocalPlayer?.Team ?? Team.Dire === Team.Dire)
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
		Vector3.FromVector2(pos1).SetZ(GetPositionHeight(pos1)),
		Vector3.FromVector2(pos2).SetZ(GetPositionHeight(pos2)),
		Vector3.FromVector2(pos3).SetZ(GetPositionHeight(pos3)),
		Vector3.FromVector2(pos4).SetZ(GetPositionHeight(pos4))
	)
}

const GNVParticleManager = new ParticlesSDK()
EventsSDK.on("Draw", () => {
	if (renderV3cursor.value) {
		const curPos = Input.CursorOnWorld
		const position = RendererSDK.WorldToScreen(curPos)
		if (position !== undefined) {
			RendererSDK.TextAroundMouse(`${curPos.toArray().map(x => Math.floor(x))}`)
		}
	}

	if (screenCursor.value) {
		const curPos = Input.CursorOnScreen
		RendererSDK.TextAroundMouse(
			`${curPos.toArray().map(x => Math.floor(x))}`,
			undefined,
			Color.White
		)
	}

	const absPos = Input.CursorOnWorld
	if (
		renderGNV.value &&
		GridNav !== undefined &&
		GridNav.IsInWorld(absPos) &&
		LocalPlayer?.Hero !== undefined
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
						LocalPlayer.Hero,
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
						LocalPlayer.Hero,
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
						LocalPlayer.Hero,
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
						LocalPlayer.Hero,
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
						LocalPlayer.Hero,
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
		RendererSDK.FilledRect(
			w2s.SubtractForThis(new Vector2(10, 10)),
			new Vector2(20, 20),
			new Color(0, 255)
		)
	})
	ProjectileManager.AllLinearProjectiles.forEach(proj => {
		const w2s = RendererSDK.WorldToScreen(proj.Position)
		if (w2s === undefined) {
			return
		}
		RendererSDK.FilledRect(
			w2s.SubtractForThis(new Vector2(10, 10)),
			new Vector2(20, 20),
			new Color(255)
		)
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
	SafeLog("ServerInfo", Utils.MapToObject(obj))
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
