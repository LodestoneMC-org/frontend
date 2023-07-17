// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { InstanceState } from "./InstanceState.ts";
import type { Player } from "./Player.ts";

export type InstanceEventInner = { type: "StateTransition", to: InstanceState, } | { type: "InstanceWarning" } | { type: "InstanceError" } | { type: "InstanceInput", message: string, } | { type: "InstanceOutput", message: string, } | { type: "SystemMessage", message: string, } | { type: "PlayerChange", player_list: Array<Player>, players_joined: Array<Player>, players_left: Array<Player>, } | { type: "PlayerMessage", player: string, player_message: string, };
