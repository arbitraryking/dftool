import {
  LootTypesConfig,
  MapConfig,
  UserSettings,
  ValidationIssue,
  lootTypesConfigSchema,
  mapConfigSchema,
  userSettingsSchema,
} from './schemas';
import { getImageResourcePathIssue } from './resourcePaths';

export function parseLootTypesConfig(input: unknown): LootTypesConfig {
  return lootTypesConfigSchema.parse(input);
}

export function parseMapConfig(input: unknown): MapConfig {
  return mapConfigSchema.parse(input);
}

export function parseUserSettings(input: unknown): UserSettings {
  return userSettingsSchema.parse(input);
}

export function collectMapValidationIssues(map: MapConfig, lootTypes: LootTypesConfig): ValidationIssue[] {
  const knownTypeIds = new Set(lootTypes.types.map((type) => type.id));
  const issues: ValidationIssue[] = [];

  for (const point of map.points) {
    if (!knownTypeIds.has(point.type)) {
      issues.push({
        level: 'warning',
        pointId: point.id,
        message: `点位 ${point.id} 使用未知物资类型 ${point.type}`,
      });
    }

    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      issues.push({
        level: 'error',
        pointId: point.id,
        message: `点位 ${point.id} 坐标越界`,
      });
    }

    for (const screenshot of point.screenshots) {
      const issue = getImageResourcePathIssue(screenshot, { requireScreenshotRoot: true });
      if (issue) {
        issues.push({
          level: 'warning',
          pointId: point.id,
          message: `点位 ${point.id} 截图路径 ${screenshot} 无效：${issue}`,
        });
      }
    }
  }

  return issues;
}

export function normalizeUserSettings(
  settings: UserSettings | undefined,
  lootTypes: LootTypesConfig,
  maps: MapConfig[],
): UserSettings {
  const firstMapId = maps[0]?.id ?? '';
  const configuredMapId = settings?.selectedMapId;
  const selectedMapId = configuredMapId && maps.some((map) => map.id === configuredMapId)
    ? configuredMapId
    : firstMapId;

  const visibleLootTypes: Record<string, boolean> = {};
  for (const lootType of lootTypes.types) {
    visibleLootTypes[lootType.id] = settings?.visibleLootTypes[lootType.id] ?? lootType.defaultVisible;
  }

  return {
    selectedMapId,
    visibleLootTypes,
  };
}

export function filterValidPoints(map: MapConfig): MapConfig {
  return {
    ...map,
    points: map.points.filter((point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1),
  };
}
