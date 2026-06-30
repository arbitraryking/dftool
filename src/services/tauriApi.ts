import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export type RawConfigBundle = {
  loot_types: unknown;
  maps: Array<{ name: string; data: unknown }>;
  settings?: unknown;
};

export const isTauriRuntime = '__TAURI_INTERNALS__' in window;
const inTauri = isTauriRuntime;

export async function loadConfigBundle(): Promise<RawConfigBundle> {
  if (inTauri) {
    return invoke<RawConfigBundle>('load_config_bundle');
  }

  const [lootTypesResponse, zeroDamResponse] = await Promise.all([
    fetch('/config/loot-types.json'),
    fetch('/config/maps/zero-dam.json'),
  ]);

  return {
    loot_types: await lootTypesResponse.json(),
    maps: [{ name: 'zero-dam', data: await zeroDamResponse.json() }],
  };
}

export async function saveUserSettings(settings: unknown): Promise<void> {
  if (inTauri) {
    await invoke('save_user_settings', { settings });
  }
}

export async function saveMapConfig(mapId: string, mapConfig: unknown): Promise<void> {
  if (inTauri) {
    await invoke('save_map_config', { mapId, mapConfig });
  }
}

export async function setOverlayInteractive(interactive: boolean): Promise<void> {
  if (inTauri) {
    await invoke('set_overlay_interactive', { interactive });
  }
}

export async function setOverlayVisible(visible: boolean): Promise<void> {
  if (inTauri) {
    await invoke('set_overlay_visible', { visible });
  }
}

export async function getWindowLabel(): Promise<string> {
  if (!inTauri) {
    return new URLSearchParams(window.location.search).get('window') ?? 'control';
  }

  return getCurrentWindow().label;
}
