import { BitsExtensions, Color, ConVarsSDK, DOTAGameUIState_t, EventsSDK, ExecuteOrder, GameState, GetPositionHeight, GridNav, GridNavCellFlags, GUIInfo, Input, LocalPlayer, Menu, ParticlesSDK, ProjectileManager, Rectangle, RendererSDK, TickSleeper, Utils, Vector2, Vector3, WorldPolygon } from "./wrapper/Imports"

const setConVar = (self: Menu.Toggle) => ConVarsSDK.Set(self.InternalTooltipName, self.value)
const exec = (self: Menu.Base) => GameState.ExecuteCommand(self.InternalTooltipName)

const debuggerMenu = Menu.AddEntry("Debugger", "panorama/images/plus/achievements/mvp_icon_png.vtex_c")

debuggerMenu.AddToggle("Debug GUIInfo", false).OnValue(toggle => GUIInfo.debug_draw = toggle.value)
const renderGNV = debuggerMenu.AddToggle("Debug GridNav")

const renderV3cursor = debuggerMenu.AddToggle("Debug cursor position")

const sv_cheatsMenu = debuggerMenu.AddNode("Concommands", "panorama/images/plus/achievements/mvp_icon_png.vtex_c")
const sv_cheats = sv_cheatsMenu.AddToggle("sv_cheats", false, "sv_cheats")
sv_cheats.OnValue(setConVar)

const wtf = sv_cheatsMenu.AddToggle("wtf", false, "dota_ability_debug")
wtf.OnValue(setConVar)

const creepsNoSpawn = sv_cheatsMenu.AddToggle("Creeps no spawning", false, "dota_creeps_no_spawning")
creepsNoSpawn.OnValue(setConVar)

sv_cheatsMenu.AddKeybind("All vision", "", "dota_all_vision")
	.OnRelease(() =>  ConVarsSDK.Set("dota_all_vision", !ConVarsSDK.GetBoolean("dota_all_vision", false)))

sv_cheatsMenu.AddKeybind("Refresh", "", "dota_hero_refresh")
	.OnRelease(exec)

sv_cheatsMenu.AddButton("Local lvl max", "dota_hero_level 25")
	.OnValue(exec)

sv_cheatsMenu.AddButton("Get Rapier God", "dota_rap_god")
	.OnValue(exec)

const addUnitMenu = debuggerMenu.AddNode("add unit", "panorama/images/spellicons/techies_focused_detonate_png.vtex_c")

addUnitMenu.AddKeybind("Add creep", "", "dota_create_unit npc_dota_creep_badguys_melee enemy")
	.OnRelease(exec)

EventsSDK.on("GameStarted", () => {
	ConVarsSDK.Set("sv_cheats", ConVarsSDK.GetBoolean("sv_cheats", false) || sv_cheats.value)
	ConVarsSDK.Set("dota_ability_debug", wtf.value)
	ConVarsSDK.Set("dota_creeps_no_spawning", creepsNoSpawn.value)
})

const debugEventsMenu = debuggerMenu.AddNode("Debugging events", "panorama/images/status_icons/information_psd.vtex_c", "Debugging native events in console")

const debugEvents = debugEventsMenu.AddToggle("Debugging events")

const debugProjectiles = debugEventsMenu.AddToggle("Debug projectiles", false, "Visual only")

const humanizerMenu = debuggerMenu.AddNode("Humanizer", "panorama/images/plus/achievements/hero_challenges_icon_png.vtex_c")

humanizerMenu.AddToggle("debug_draw").OnValue(toggle => ExecuteOrder.debug_draw = toggle.value)
humanizerMenu.AddToggle("debug_orders").OnValue(toggle => ExecuteOrder.debug_orders = toggle.value)

let press = false
const sleeper = new TickSleeper()
addUnitMenu.AddKeybind("Full sven").OnRelease(() => {
	GameState.ExecuteCommand("dota_create_unit npc_dota_hero_sven enemy")
	press = true
	sleeper.Sleep(1000 + GameState.Ping / 2)
})

EventsSDK.on("Tick", () => {
	if (press) {
		for (var i = 6; i--;)
			GameState.ExecuteCommand("dota_bot_give_item item_heart")
		GameState.ExecuteCommand("dota_bot_give_level 30")
		if (!sleeper.Sleeping)
			press = false
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
		Vector3.FromVector2(pos4).SetZ(GetPositionHeight(pos4)),
	)
}

const GNVParticleManager = new ParticlesSDK()
EventsSDK.on("Draw", () => {

	if (renderV3cursor.value) {
		const curPos = Input.CursorOnWorld
		const position = RendererSDK.WorldToScreen(curPos)
		if (position !== undefined)
			RendererSDK.TextAroundMouse(`${curPos.toArray().map(x => Math.floor(x))}`)
	}

	if (renderGNV.value && GridNav !== undefined && LocalPlayer?.Hero !== undefined) {
		const gridPos = GridNav.GetGridPosForPos(Vector2.FromVector3(Input.CursorOnWorld))

		for (let i = -10; i < 10; i++)
			for (let j = -10; j < 10; j++) {
				const x = gridPos.x + i
				const y = gridPos.y + j
				const base_key = `gridnav_${i}_${j}_`
				let current_key = 0
				const flags = GridNav.GetCellFlagsForGridPos(x, y)
				const rect = GridNav.GetRectForGridPos(x, y)
				rect.pos1.AddScalarForThis(1)
				rect.pos2.SubtractScalarForThis(1)

				if (BitsExtensions.HasBit(flags, GridNavCellFlags.Walkable))
					GetRectPolygon(rect).Draw(base_key + current_key++, LocalPlayer.Hero, GNVParticleManager, Color.Green)
				else
					GetRectPolygon(rect).Destroy(base_key + current_key++, GNVParticleManager)

				rect.pos1.AddScalarForThis(5)
				rect.pos2.SubtractScalarForThis(5)

				if (BitsExtensions.HasBit(flags, GridNavCellFlags.Tree))
					GetRectPolygon(rect).Draw(base_key + current_key++, LocalPlayer.Hero, GNVParticleManager, Color.Orange)
				else
					GetRectPolygon(rect).Destroy(base_key + current_key++, GNVParticleManager)

				rect.pos1.AddScalarForThis(5)
				rect.pos2.SubtractScalarForThis(5)

				if (BitsExtensions.HasBit(flags, GridNavCellFlags.MovementBlocker))
					GetRectPolygon(rect).Draw(base_key + current_key++, LocalPlayer.Hero, GNVParticleManager, Color.Red)
				else
					GetRectPolygon(rect).Destroy(base_key + current_key++, GNVParticleManager)

				rect.pos1.AddScalarForThis(5)
				rect.pos2.SubtractScalarForThis(5)

				if (BitsExtensions.HasBit(flags, GridNavCellFlags.InteractionBlocker))
					GetRectPolygon(rect).Draw(base_key + current_key++, LocalPlayer.Hero, GNVParticleManager, Color.Fuchsia)
				else
					GetRectPolygon(rect).Destroy(base_key + current_key++, GNVParticleManager)
			}
	} else
		GNVParticleManager.DestroyAll()
	if (!debugEvents.value || !debugProjectiles.value || GameState.UIState !== DOTAGameUIState_t.DOTA_GAME_UI_DOTA_INGAME)
		return
	ProjectileManager.AllTrackingProjectiles.forEach(proj => {
		const w2s = RendererSDK.WorldToScreen(proj.Position)
		if (w2s === undefined)
			return
		RendererSDK.FilledRect(w2s.SubtractForThis(new Vector2(10, 10)), new Vector2(20, 20), new Color(0, 255))
	})
	ProjectileManager.AllLinearProjectiles.forEach(proj => {
		const w2s = RendererSDK.WorldToScreen(proj.Position)
		if (w2s === undefined)
			return
		RendererSDK.FilledRect(w2s.SubtractForThis(new Vector2(10, 10)), new Vector2(20, 20), new Color(255))
	})
})

function SafeLog(...args: any[]) {
	console.log(...args.map(arg => JSON.parse(JSON.stringify(arg, (_, value) => typeof value === "bigint" ? value.toString() + "n" : value))))
}

EventsSDK.on("GameEvent", (name, obj) => {
	if (!debugEvents.value)
		return
	SafeLog("GameEvent", name, obj)
})
EventsSDK.on("ServerInfo", obj => {
	if (!debugEvents.value)
		return
	SafeLog("ServerInfo", Utils.MapToObject(obj))
})

EventsSDK.on("ParticleCreated", par => {
	if (!debugEvents.value)
		return
	console.log(GameState.RawGameTime, {
		ParticleCreated: par,
	})
})

EventsSDK.on("ParticleUpdated", par => {
	if (!debugEvents.value)
		return
	console.log(GameState.RawGameTime, {
		ParticleUpdated: par,
	})
})

EventsSDK.on("ParticleDestroyed", par => {
	if (!debugEvents.value)
		return
	console.log(GameState.RawGameTime, {
		ParticleDestroyed: par,
	})
})

EventsSDK.on("StartSound", (name, source_ent, position, seed, start_time) => {
	if (!debugEvents.value)
		return
	console.log(GameState.RawGameTime, {
		StartSound: {
			name, source_ent, position, start_time,
		},
	})
})

EventsSDK.on("ModifierCreated", mod => {
	if (!debugEvents.value)
		return
	console.log(GameState.RawGameTime, {
		ModifierCreated: {
			mod,
		},
	})
})

EventsSDK.on("ModifierRemoved", mod => {
	if (!debugEvents.value)
		return
	console.log(GameState.RawGameTime, {
		ModifierRemoved: {
			mod,
		},
	})
})
