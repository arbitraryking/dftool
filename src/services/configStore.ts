import { collectMapValidationIssues, normalizeUserSettings, parseLootTypesConfig, parseMapConfig, parseUserSettings } from '../domain/configValidation';
import { LootTypesConfig, MapConfig, UserSettings } from '../domain/schemas';
import { loadConfigBundle, saveMapConfig, saveUserSettings } from './tauriApi';

export type LoadedConfig = {
  lootTypes: LootTypesConfig;
  maps: MapConfig[];
  settings: UserSettings;
};

export async function loadInitialConfig(): Promise<LoadedConfig> {
  const raw = await loadConfigBundle();
  const lootTypes = parseLootTypesConfig(raw.loot_types);
  const maps = raw.maps.map((map) => parseMapConfig(map.data));
  const parsedSettings = raw.settings ? parseUserSettings(raw.settings) : undefined;
  const settings = normalizeUserSettings(parsedSettings, lootTypes, maps);

  return { lootTypes, maps, settings };
}

export async function persistUserSettings(settings: UserSettings): Promise<void> {
  parseUserSettings(settings);
  await saveUserSettings(settings);
}

export async function persistMapConfig(map: MapConfig, lootTypes?: LootTypesConfig): Promise<void> {
  const parsedMap = parseMapConfig(map);
  const issues = lootTypes ? collectMapValidationIssues(parsedMap, lootTypes) : [];
  const blockingIssue = issues.find((issue) => issue.level === 'error');

  if (blockingIssue) {
    throw new Error(blockingIssue.message);
  }

  await saveMapConfig(parsedMap.id, parsedMap);
}
