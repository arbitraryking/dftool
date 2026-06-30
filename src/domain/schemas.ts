import { z } from 'zod';

export const calibrationSchema = z.object({
  offsetX: z.number().default(0),
  offsetY: z.number().default(0),
  scale: z.number().positive().default(1),
});

export const lootTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().min(1),
  defaultSize: z.number().positive(),
  valueLevel: z.number().int().min(0).max(5).default(0),
  defaultVisible: z.boolean().default(true),
});

export const lootTypesConfigSchema = z.object({
  version: z.literal(1),
  types: z.array(lootTypeSchema),
});

export const mapPointSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  x: z.number(),
  y: z.number(),
  title: z.string().min(1),
  description: z.string().default(''),
  screenshots: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export const mapConfigSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  defaultCalibration: calibrationSchema,
  points: z.array(mapPointSchema),
});

export const userSettingsSchema = z.object({
  selectedMapId: z.string().min(1),
  visibleLootTypes: z.record(z.boolean()),
});

export type Calibration = z.infer<typeof calibrationSchema>;
export type LootType = z.infer<typeof lootTypeSchema>;
export type LootTypesConfig = z.infer<typeof lootTypesConfigSchema>;
export type MapPoint = z.infer<typeof mapPointSchema>;
export type MapConfig = z.infer<typeof mapConfigSchema>;
export type UserSettings = z.infer<typeof userSettingsSchema>;

export type ValidationIssue = {
  level: 'warning' | 'error';
  message: string;
  pointId?: string;
};
