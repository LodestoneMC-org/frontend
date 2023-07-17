// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { ConfigurableManifest } from "../../../../../../../deno_bindings/ConfigurableManifest.ts";
import type { Game } from "../../../../../../../deno_bindings/Game.ts";
import type { GenericPlayer } from "../../../../../../../deno_bindings/GenericPlayer.ts";
import type { InstanceState } from "../../../../../../../deno_bindings/InstanceState.ts";
import type { PerformanceReport } from "../../../../../../../deno_bindings/PerformanceReport.ts";
import { SetupManifest } from "../../../../../../../deno_bindings/SetupManifest.ts";

export type ProcedureCallResultInner =
  | { String: string }
  | { Monitor: PerformanceReport }
  | { State: InstanceState }
  | { Num: number }
  | { Game: Game }
  | { Bool: boolean }
  | { ConfigurableManifest: ConfigurableManifest }
  | { Player: Array<GenericPlayer> }
  | { SetupManifest: SetupManifest }
  | "Void";