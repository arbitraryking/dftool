import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export type RawConfigBundle = {
  loot_types: unknown;
  maps: Array<{ name: string; data: unknown }>;
  settings?: unknown;
};

export type ConfigPaths = {
  bundled_config_dir: string;
  bundled_maps_dir: string;
  bundled_loot_types_path: string;
  bundled_assets_dir: string;
  bundled_icons_dir: string;
  bundled_screenshots_dir: string;
};

export const isTauriRuntime = '__TAURI_INTERNALS__' in window;
const inTauri = isTauriRuntime;

export async function getConfigPaths(): Promise<ConfigPaths | undefined> {
  if (inTauri) {
    return invoke<ConfigPaths>('get_config_paths');
  }

  return undefined;
}

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

export async function importPointScreenshot(mapId: string, pointId: string | undefined, file: File): Promise<string | undefined> {
  if (!inTauri) {
    return undefined;
  }

  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return invoke<string>('import_point_screenshot', {
    mapId,
    pointId: pointId || null,
    fileName: file.name,
    bytes,
  });
}

export async function discardImportedScreenshots(paths: string[]): Promise<void> {
  if (inTauri && paths.length > 0) {
    await invoke('discard_imported_screenshots', { paths });
  }
}

export async function commitImportedScreenshots(paths: string[]): Promise<void> {
  if (inTauri && paths.length > 0) {
    await invoke('commit_imported_screenshots', { paths });
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

export async function resolveResourceUrl(path: string): Promise<string> {
  if (inTauri) {
    return invoke<string>('resolve_resource_url', { path });
  }

  return `/${path}`;
}

export async function getStartupWarnings(): Promise<string[]> {
  if (inTauri) {
    return invoke<string[]>('get_startup_warnings');
  }

  return [];
}

export async function getWindowLabel(): Promise<string> {
  if (!inTauri) {
    return new URLSearchParams(window.location.search).get('window') ?? 'control';
  }

  return getCurrentWindow().label;
}
