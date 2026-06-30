# Delta Force Map Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows Tauri + TypeScript desktop overlay for configurable Delta Force PC map loot markers with browse, inspect, and edit modes.

**Architecture:** A Tauri app owns two windows: a transparent fullscreen overlay and a normal control window. TypeScript handles typed config parsing, app state, marker rendering, filtering, detail popovers, and edit forms; Rust/Tauri handles filesystem persistence, backups, window controls, and global shortcuts. Config files stay separate from user settings so map data can be updated without overwriting user preferences.

**Tech Stack:** Tauri v2, Vite, React, TypeScript, Vitest, React Testing Library, Zod, Rust serde/tauri commands, JSON config files.

---

## Scope Check

The approved spec covers one coherent first release: the map marker tool. It includes config parsing, overlay display, settings, three modes, editing, and persistence. These pieces are coupled enough to remain in one plan, but tasks are split so each produces testable software.

## Planned File Structure

```text
D:/projects/DFtool/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    main.tsx                         # React entry, routes window label to OverlayApp or ControlApp
    styles.css                       # Shared minimal UI styles
    domain/
      schemas.ts                     # Zod schemas and exported TS types
      configValidation.ts            # Config normalization and validation helpers
      markerPosition.ts              # Relative/screen coordinate conversion
      markerEditing.ts               # Add/update/delete/move marker helpers
      mapSelection.ts                # Previous/next map selection helpers
    services/
      tauriApi.ts                    # Frontend wrapper around Tauri invoke/window APIs
      configStore.ts                 # Load/save config and user settings into app state
    state/
      appStore.ts                    # React reducer/store for map, filters, modes, dirty state
    components/
      OverlayApp.tsx                 # Fullscreen overlay window root
      ControlApp.tsx                 # Settings/control window root
      MarkerLayer.tsx                # Renders filtered marker icons
      MarkerDetails.tsx              # Shows marker text and screenshots
      MarkerEditDialog.tsx           # Add/edit marker form
      LootTypeFilters.tsx            # Loot type checkboxes
      MapSelector.tsx                # Map dropdown and shortcut-visible current map
      ModeControls.tsx               # Browse/inspect/edit/hide controls
    test/
      fixtures.ts                    # Shared valid config fixtures
      setup.ts                       # Testing Library setup
  config/
    loot-types.json                  # Sample editable loot type config
    maps/
      zero-dam.json                  # Sample map config
  assets/
    icons/
      diamond.svg
      keycard.svg
      safe.svg
    screenshots/
      zero-dam/.gitkeep
  src-tauri/
    Cargo.toml
    build.rs                         # Tauri build script
    tauri.conf.json
    capabilities/default.json
    src/
      main.rs                        # Tauri app setup, commands, windows, shortcuts
      config_io.rs                   # Read/write config files and .bak creation
```

Note: the workspace is not currently a git repository. Do not run `git init` or commit unless the user explicitly requests it. Each task ends with a verification checkpoint instead of an automatic commit.

---

### Task 1: Scaffold the Tauri React TypeScript App

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/main.rs`

- [ ] **Step 1: Create frontend package metadata**

Create `package.json`:

```json
{
  "name": "dftool",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "tauri": "tauri",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "build": "tsc --noEmit && vite build"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-global-shortcut": "^2.0.0",
    "@tauri-apps/plugin-opener": "^2.0.0",
    "zod": "^3.24.1",
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.7",
    "typescript": "^5.7.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@tauri-apps/cli": "^2.0.0",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create TypeScript and Vite config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    strictPort: true,
    port: 1420,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DFtool</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create minimal React entry and styles**

Create `src/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function PlaceholderApp() {
  return <main className="app-shell">DFtool 地图标点工具</main>;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlaceholderApp />
  </React.StrictMode>,
);
```

Create `src/styles.css`:

```css
:root {
  color: #f4f7fb;
  background: transparent;
  font-family: Inter, "Microsoft YaHei", system-ui, sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-shell {
  min-height: 100%;
  padding: 16px;
  background: #111827;
}
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Create minimal Tauri config**

Create `src-tauri/Cargo.toml`:

```toml
[package]
name = "dftool"
version = "0.1.0"
description = "Delta Force map marker overlay"
authors = ["DFtool"]
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-global-shortcut = "2"
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

Create `src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build();
}
```

Create `src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "DFtool",
  "version": "0.1.0",
  "identifier": "com.dftool.mapmarker",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://127.0.0.1:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "control",
        "title": "DFtool 控制台",
        "width": 420,
        "height": 680,
        "resizable": true,
        "fullscreen": false,
        "decorations": true,
        "transparent": false
      },
      {
        "label": "overlay",
        "title": "DFtool Overlay",
        "fullscreen": true,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "skipTaskbar": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all"
  }
}
```

Create `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "DFtool default permissions",
  "windows": ["control", "overlay"],
  "permissions": [
    "core:default",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "global-shortcut:allow-is-registered"
  ]
}
```

Create `src-tauri/src/main.rs`:

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("failed to run DFtool");
}
```

- [ ] **Step 5: Install dependencies and verify scaffold**

Run:

```bash
npm install
npm run typecheck
npm run test
```

Expected:

```text
npm run typecheck exits 0
npm run test exits 0 with no test files or passing setup
```

---

### Task 2: Define Schemas and Config Validation

**Files:**
- Create: `src/domain/schemas.ts`
- Create: `src/domain/configValidation.ts`
- Create: `src/test/fixtures.ts`
- Create: `src/domain/configValidation.test.ts`

- [ ] **Step 1: Write failing schema validation tests**

Create `src/test/fixtures.ts`:

```ts
import type { LootTypesConfig, MapConfig, UserSettings } from '../domain/schemas';

export const validLootTypes: LootTypesConfig = {
  version: 1,
  types: [
    {
      id: 'diamond',
      name: '钻石',
      icon: 'assets/icons/diamond.svg',
      color: '#40D9FF',
      defaultSize: 28,
      valueLevel: 5,
      defaultVisible: true,
    },
    {
      id: 'keycard',
      name: '房卡',
      icon: 'assets/icons/keycard.svg',
      color: '#FFCC33',
      defaultSize: 28,
      valueLevel: 5,
      defaultVisible: true,
    },
  ],
};

export const validMap: MapConfig = {
  version: 1,
  id: 'zero-dam',
  name: '零号大坝',
  defaultCalibration: { offsetX: 0, offsetY: 0, scale: 1 },
  points: [
    {
      id: 'diamond-001',
      type: 'diamond',
      x: 0.532,
      y: 0.418,
      title: '二楼保险旁',
      description: '靠近保险箱刷新点',
      screenshots: ['assets/screenshots/zero-dam/diamond-001-1.jpg'],
      tags: ['高价值', '室内'],
    },
  ],
};

export const validSettings: UserSettings = {
  selectedMapId: 'zero-dam',
  visibleLootTypes: {
    diamond: true,
    keycard: true,
  },
};
```

Create `src/domain/configValidation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validLootTypes, validMap, validSettings } from '../test/fixtures';
import {
  collectMapValidationIssues,
  normalizeUserSettings,
  parseLootTypesConfig,
  parseMapConfig,
  parseUserSettings,
} from './configValidation';

it('parses valid loot type config', () => {
  expect(parseLootTypesConfig(validLootTypes).types).toHaveLength(2);
});

it('parses valid map config', () => {
  expect(parseMapConfig(validMap).points[0].id).toBe('diamond-001');
});

it('parses valid user settings', () => {
  expect(parseUserSettings(validSettings).selectedMapId).toBe('zero-dam');
});

it('reports unknown point type without throwing', () => {
  const map = {
    ...validMap,
    points: [{ ...validMap.points[0], type: 'unknown-type' }],
  };

  const issues = collectMapValidationIssues(map, validLootTypes);

  expect(issues).toEqual([
    {
      pointId: 'diamond-001',
      severity: 'warning',
      message: '未知物资类型: unknown-type',
    },
  ]);
});

it('reports out-of-range coordinates', () => {
  const map = {
    ...validMap,
    points: [{ ...validMap.points[0], x: 1.5, y: -0.2 }],
  };

  const issues = collectMapValidationIssues(map, validLootTypes);

  expect(issues).toContainEqual({
    pointId: 'diamond-001',
    severity: 'error',
    message: '点位坐标必须在 0 到 1 之间',
  });
});

it('normalizes settings with default visibility for new loot types', () => {
  const settings = normalizeUserSettings(
    { selectedMapId: 'zero-dam', visibleLootTypes: { diamond: false } },
    validLootTypes,
    [validMap],
  );

  expect(settings.visibleLootTypes).toEqual({
    diamond: false,
    keycard: true,
  });
});
```

Run:

```bash
npm run test -- src/domain/configValidation.test.ts
```

Expected: FAIL because `schemas.ts` and `configValidation.ts` do not exist.

- [ ] **Step 2: Implement schemas**

Create `src/domain/schemas.ts`:

```ts
import { z } from 'zod';

export const lootTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().min(1),
  defaultSize: z.number().positive(),
  valueLevel: z.number().int().min(1).max(5),
  defaultVisible: z.boolean(),
});

export const lootTypesConfigSchema = z.object({
  version: z.literal(1),
  types: z.array(lootTypeSchema),
});

export const calibrationSchema = z.object({
  offsetX: z.number(),
  offsetY: z.number(),
  scale: z.number().positive(),
});

export const mapPointSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  x: z.number(),
  y: z.number(),
  title: z.string(),
  description: z.string(),
  screenshots: z.array(z.string()),
  tags: z.array(z.string()),
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

export type LootType = z.infer<typeof lootTypeSchema>;
export type LootTypesConfig = z.infer<typeof lootTypesConfigSchema>;
export type Calibration = z.infer<typeof calibrationSchema>;
export type MapPoint = z.infer<typeof mapPointSchema>;
export type MapConfig = z.infer<typeof mapConfigSchema>;
export type UserSettings = z.infer<typeof userSettingsSchema>;

export type ValidationIssue = {
  pointId?: string;
  severity: 'warning' | 'error';
  message: string;
};
```

- [ ] **Step 3: Implement config validation helpers**

Create `src/domain/configValidation.ts`:

```ts
import {
  type LootTypesConfig,
  type MapConfig,
  type UserSettings,
  type ValidationIssue,
  lootTypesConfigSchema,
  mapConfigSchema,
  userSettingsSchema,
} from './schemas';

export function parseLootTypesConfig(input: unknown): LootTypesConfig {
  return lootTypesConfigSchema.parse(input);
}

export function parseMapConfig(input: unknown): MapConfig {
  return mapConfigSchema.parse(input);
}

export function parseUserSettings(input: unknown): UserSettings {
  return userSettingsSchema.parse(input);
}

export function collectMapValidationIssues(
  map: MapConfig,
  lootTypes: LootTypesConfig,
): ValidationIssue[] {
  const knownTypes = new Set(lootTypes.types.map((type) => type.id));
  const issues: ValidationIssue[] = [];

  for (const point of map.points) {
    if (!knownTypes.has(point.type)) {
      issues.push({
        pointId: point.id,
        severity: 'warning',
        message: `未知物资类型: ${point.type}`,
      });
    }

    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      issues.push({
        pointId: point.id,
        severity: 'error',
        message: '点位坐标必须在 0 到 1 之间',
      });
    }
  }

  return issues;
}

export function normalizeUserSettings(
  settings: UserSettings,
  lootTypes: LootTypesConfig,
  maps: MapConfig[],
): UserSettings {
  const selectedMapId = maps.some((map) => map.id === settings.selectedMapId)
    ? settings.selectedMapId
    : maps[0]?.id ?? settings.selectedMapId;

  const visibleLootTypes = Object.fromEntries(
    lootTypes.types.map((type) => [
      type.id,
      settings.visibleLootTypes[type.id] ?? type.defaultVisible,
    ]),
  );

  return { selectedMapId, visibleLootTypes };
}
```

- [ ] **Step 4: Verify validation tests pass**

Run:

```bash
npm run test -- src/domain/configValidation.test.ts
npm run typecheck
```

Expected:

```text
PASS src/domain/configValidation.test.ts
npm run typecheck exits 0
```

---

### Task 3: Implement Marker Geometry and Editing Domain Logic

**Files:**
- Create: `src/domain/markerPosition.ts`
- Create: `src/domain/markerPosition.test.ts`
- Create: `src/domain/markerEditing.ts`
- Create: `src/domain/markerEditing.test.ts`
- Create: `src/domain/mapSelection.ts`
- Create: `src/domain/mapSelection.test.ts`

- [ ] **Step 1: Write failing tests for geometry**

Create `src/domain/markerPosition.test.ts`:

```ts
import { expect, it } from 'vitest';
import { relativeToScreen, screenToRelative } from './markerPosition';

it('converts relative coordinates to screen coordinates', () => {
  expect(relativeToScreen({ x: 0.5, y: 0.25 }, { width: 1920, height: 1080 })).toEqual({
    left: 960,
    top: 270,
  });
});

it('converts screen coordinates to clamped relative coordinates', () => {
  expect(screenToRelative({ left: 2200, top: -10 }, { width: 1920, height: 1080 })).toEqual({
    x: 1,
    y: 0,
  });
});
```

Create `src/domain/mapSelection.test.ts`:

```ts
import { expect, it } from 'vitest';
import { selectNextMapId, selectPreviousMapId } from './mapSelection';

const ids = ['zero-dam', 'longbow-valley', 'space-city'];

it('selects the next map and wraps', () => {
  expect(selectNextMapId(ids, 'zero-dam')).toBe('longbow-valley');
  expect(selectNextMapId(ids, 'space-city')).toBe('zero-dam');
});

it('selects the previous map and wraps', () => {
  expect(selectPreviousMapId(ids, 'zero-dam')).toBe('space-city');
  expect(selectPreviousMapId(ids, 'longbow-valley')).toBe('zero-dam');
});
```

Run:

```bash
npm run test -- src/domain/markerPosition.test.ts src/domain/mapSelection.test.ts
```

Expected: FAIL because implementation files do not exist.

- [ ] **Step 2: Implement geometry and map selection**

Create `src/domain/markerPosition.ts`:

```ts
export type RelativePoint = { x: number; y: number };
export type ScreenPoint = { left: number; top: number };
export type ScreenSize = { width: number; height: number };

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function relativeToScreen(point: RelativePoint, size: ScreenSize): ScreenPoint {
  return {
    left: Math.round(point.x * size.width),
    top: Math.round(point.y * size.height),
  };
}

export function screenToRelative(point: ScreenPoint, size: ScreenSize): RelativePoint {
  return {
    x: clamp01(point.left / size.width),
    y: clamp01(point.top / size.height),
  };
}
```

Create `src/domain/mapSelection.ts`:

```ts
function selectByOffset(mapIds: string[], currentMapId: string, offset: number): string {
  if (mapIds.length === 0) {
    return currentMapId;
  }

  const currentIndex = mapIds.indexOf(currentMapId);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (safeIndex + offset + mapIds.length) % mapIds.length;
  return mapIds[nextIndex];
}

export function selectNextMapId(mapIds: string[], currentMapId: string): string {
  return selectByOffset(mapIds, currentMapId, 1);
}

export function selectPreviousMapId(mapIds: string[], currentMapId: string): string {
  return selectByOffset(mapIds, currentMapId, -1);
}
```

- [ ] **Step 3: Write failing tests for editing operations**

Create `src/domain/markerEditing.test.ts`:

```ts
import { expect, it } from 'vitest';
import { validMap } from '../test/fixtures';
import { addPoint, deletePoint, movePoint, updatePoint } from './markerEditing';

it('adds a new point with empty screenshots by default', () => {
  const next = addPoint(validMap, {
    id: 'diamond-002',
    type: 'diamond',
    x: 0.1,
    y: 0.2,
    title: '新点位',
    description: '',
    tags: [],
  });

  expect(next.points).toHaveLength(2);
  expect(next.points[1].screenshots).toEqual([]);
});

it('updates an existing point', () => {
  const next = updatePoint(validMap, 'diamond-001', { title: '改名点位' });
  expect(next.points[0].title).toBe('改名点位');
});

it('moves an existing point', () => {
  const next = movePoint(validMap, 'diamond-001', { x: 0.9, y: 0.8 });
  expect(next.points[0]).toMatchObject({ x: 0.9, y: 0.8 });
});

it('deletes an existing point', () => {
  const next = deletePoint(validMap, 'diamond-001');
  expect(next.points).toEqual([]);
});
```

Run:

```bash
npm run test -- src/domain/markerEditing.test.ts
```

Expected: FAIL because `markerEditing.ts` does not exist.

- [ ] **Step 4: Implement editing operations**

Create `src/domain/markerEditing.ts`:

```ts
import type { MapConfig, MapPoint } from './schemas';

export type NewMapPoint = Omit<MapPoint, 'screenshots'> & { screenshots?: string[] };

function withClampedCoordinates<T extends { x: number; y: number }>(point: T): T {
  return {
    ...point,
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y)),
  };
}

export function addPoint(map: MapConfig, point: NewMapPoint): MapConfig {
  return {
    ...map,
    points: [
      ...map.points,
      withClampedCoordinates({
        ...point,
        screenshots: point.screenshots ?? [],
      }),
    ],
  };
}

export function updatePoint(
  map: MapConfig,
  pointId: string,
  patch: Partial<Omit<MapPoint, 'id'>>,
): MapConfig {
  return {
    ...map,
    points: map.points.map((point) =>
      point.id === pointId ? withClampedCoordinates({ ...point, ...patch }) : point,
    ),
  };
}

export function movePoint(map: MapConfig, pointId: string, position: { x: number; y: number }): MapConfig {
  return updatePoint(map, pointId, position);
}

export function deletePoint(map: MapConfig, pointId: string): MapConfig {
  return {
    ...map,
    points: map.points.filter((point) => point.id !== pointId),
  };
}
```

- [ ] **Step 5: Verify domain tests pass**

Run:

```bash
npm run test -- src/domain
npm run typecheck
```

Expected:

```text
All domain tests pass
npm run typecheck exits 0
```

---

### Task 4: Add Sample Config and Assets

**Files:**
- Create: `config/loot-types.json`
- Create: `config/maps/zero-dam.json`
- Create: `assets/icons/diamond.svg`
- Create: `assets/icons/keycard.svg`
- Create: `assets/icons/safe.svg`
- Create: `assets/screenshots/zero-dam/.gitkeep`

- [ ] **Step 1: Create sample loot type config**

Create `config/loot-types.json`:

```json
{
  "version": 1,
  "types": [
    {
      "id": "diamond",
      "name": "钻石",
      "icon": "assets/icons/diamond.svg",
      "color": "#40D9FF",
      "defaultSize": 28,
      "valueLevel": 5,
      "defaultVisible": true
    },
    {
      "id": "keycard",
      "name": "房卡",
      "icon": "assets/icons/keycard.svg",
      "color": "#FFCC33",
      "defaultSize": 28,
      "valueLevel": 5,
      "defaultVisible": true
    },
    {
      "id": "safe",
      "name": "保险箱",
      "icon": "assets/icons/safe.svg",
      "color": "#FF6B6B",
      "defaultSize": 28,
      "valueLevel": 4,
      "defaultVisible": true
    }
  ]
}
```

- [ ] **Step 2: Create sample map config**

Create `config/maps/zero-dam.json`:

```json
{
  "version": 1,
  "id": "zero-dam",
  "name": "零号大坝",
  "defaultCalibration": {
    "offsetX": 0,
    "offsetY": 0,
    "scale": 1
  },
  "points": [
    {
      "id": "diamond-001",
      "type": "diamond",
      "x": 0.532,
      "y": 0.418,
      "title": "二楼保险旁",
      "description": "靠近保险箱刷新点，注意窗口方向。",
      "screenshots": [],
      "tags": ["高价值", "室内"]
    },
    {
      "id": "keycard-001",
      "type": "keycard",
      "x": 0.274,
      "y": 0.661,
      "title": "宿舍桌面",
      "description": "房卡可能出现在桌面附近。",
      "screenshots": [],
      "tags": ["房卡"]
    }
  ]
}
```

- [ ] **Step 3: Create simple SVG icons**

Create `assets/icons/diamond.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <path fill="#40D9FF" d="M16 8h32l12 18-28 30L4 26 16 8z"/>
  <path fill="#B9F6FF" d="M16 8l16 48L48 8H16z" opacity="0.65"/>
  <path fill="none" stroke="#063B4A" stroke-width="3" d="M16 8h32l12 18-28 30L4 26 16 8z"/>
</svg>
```

Create `assets/icons/keycard.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="8" y="14" width="48" height="36" rx="6" fill="#FFCC33" stroke="#4A3600" stroke-width="3"/>
  <rect x="14" y="22" width="18" height="8" rx="2" fill="#FFF3B0"/>
  <path d="M16 40h32" stroke="#4A3600" stroke-width="4" stroke-linecap="round"/>
</svg>
```

Create `assets/icons/safe.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="10" y="10" width="44" height="44" rx="5" fill="#FF6B6B" stroke="#4A1111" stroke-width="3"/>
  <circle cx="32" cy="32" r="11" fill="#2D1111"/>
  <circle cx="32" cy="32" r="5" fill="#FFD1D1"/>
  <path d="M32 21v22M21 32h22" stroke="#FFD1D1" stroke-width="3"/>
</svg>
```

Create `assets/screenshots/zero-dam/.gitkeep` as an empty file.

- [ ] **Step 4: Verify sample config parses**

Run:

```bash
npm run test -- src/domain/configValidation.test.ts
npm run typecheck
```

Expected: PASS and typecheck exits 0.

---

### Task 5: Implement Rust Config IO Commands

**Files:**
- Create: `src-tauri/src/config_io.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Add Rust config IO module**

Create `src-tauri/src/config_io.rs`:

```rust
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfigBundle {
    pub loot_types: serde_json::Value,
    pub maps: Vec<serde_json::Value>,
    pub settings: serde_json::Value,
}

fn app_root() -> Result<PathBuf, String> {
    std::env::current_dir().map_err(|err| format!("无法获取当前目录: {err}"))
}

fn read_json(path: &Path) -> Result<serde_json::Value, String> {
    let content = fs::read_to_string(path).map_err(|err| format!("读取失败 {}: {err}", path.display()))?;
    serde_json::from_str(&content).map_err(|err| format!("JSON 解析失败 {}: {err}", path.display()))
}

fn default_settings() -> serde_json::Value {
    serde_json::json!({
        "selectedMapId": "zero-dam",
        "visibleLootTypes": {}
    })
}

#[tauri::command]
pub fn load_config_bundle() -> Result<ConfigBundle, String> {
    let root = app_root()?;
    let loot_types = read_json(&root.join("config/loot-types.json"))?;

    let maps_dir = root.join("config/maps");
    let mut maps = Vec::new();
    for entry in fs::read_dir(&maps_dir).map_err(|err| format!("读取地图目录失败 {}: {err}", maps_dir.display()))? {
        let entry = entry.map_err(|err| format!("读取地图目录项失败: {err}"))?;
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) == Some("json") {
            maps.push(read_json(&path)?);
        }
    }

    let settings_path = root.join("user-data/settings.json");
    let settings = if settings_path.exists() {
        read_json(&settings_path)?
    } else {
        default_settings()
    };

    Ok(ConfigBundle { loot_types, maps, settings })
}

#[tauri::command]
pub fn save_user_settings(settings: serde_json::Value) -> Result<(), String> {
    let root = app_root()?;
    let user_data = root.join("user-data");
    fs::create_dir_all(&user_data).map_err(|err| format!("创建用户设置目录失败: {err}"))?;
    let content = serde_json::to_string_pretty(&settings).map_err(|err| format!("序列化用户设置失败: {err}"))?;
    fs::write(user_data.join("settings.json"), content).map_err(|err| format!("保存用户设置失败: {err}"))
}

#[tauri::command]
pub fn save_map_config(map_id: String, map_config: serde_json::Value) -> Result<(), String> {
    let root = app_root()?;
    let path = root.join(format!("config/maps/{map_id}.json"));
    let backup = root.join(format!("config/maps/{map_id}.json.bak"));

    if path.exists() {
        fs::copy(&path, &backup).map_err(|err| format!("创建备份失败 {}: {err}", backup.display()))?;
    }

    let content = serde_json::to_string_pretty(&map_config).map_err(|err| format!("序列化地图配置失败: {err}"))?;
    fs::write(&path, content).map_err(|err| format!("保存地图配置失败 {}: {err}", path.display()))
}
```

- [ ] **Step 2: Register commands in Tauri main**

Modify `src-tauri/src/main.rs`:

```rust
mod config_io;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            config_io::load_config_bundle,
            config_io::save_user_settings,
            config_io::save_map_config
        ])
        .run(tauri::generate_context!())
        .expect("failed to run DFtool");
}
```

- [ ] **Step 3: Verify Rust compiles through Tauri dev check**

Run:

```bash
npm run tauri -- info
```

Expected: Tauri CLI prints app/environment info without Rust compile errors.

---

### Task 6: Implement Frontend Tauri API and App Store

**Files:**
- Create: `src/services/tauriApi.ts`
- Create: `src/services/configStore.ts`
- Create: `src/state/appStore.ts`
- Create: `src/state/appStore.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `src/state/appStore.test.ts`:

```ts
import { expect, it } from 'vitest';
import { validLootTypes, validMap, validSettings } from '../test/fixtures';
import { createInitialState, reduceAppState } from './appStore';

it('creates initial state from loaded config', () => {
  const state = createInitialState({
    lootTypes: validLootTypes,
    maps: [validMap],
    settings: validSettings,
  });

  expect(state.selectedMapId).toBe('zero-dam');
  expect(state.mode).toBe('browse');
  expect(state.overlayVisible).toBe(true);
});

it('toggles loot type visibility and marks settings dirty', () => {
  const state = createInitialState({ lootTypes: validLootTypes, maps: [validMap], settings: validSettings });
  const next = reduceAppState(state, { type: 'toggleLootType', lootTypeId: 'diamond' });

  expect(next.settings.visibleLootTypes.diamond).toBe(false);
  expect(next.settingsDirty).toBe(true);
});

it('marks map dirty after point edit', () => {
  const state = createInitialState({ lootTypes: validLootTypes, maps: [validMap], settings: validSettings });
  const next = reduceAppState(state, {
    type: 'updateMap',
    map: { ...validMap, points: [] },
  });

  expect(next.maps[0].points).toEqual([]);
  expect(next.dirtyMapIds).toEqual(new Set(['zero-dam']));
});
```

Run:

```bash
npm run test -- src/state/appStore.test.ts
```

Expected: FAIL because store files do not exist.

- [ ] **Step 2: Implement Tauri API wrappers**

Create `src/services/tauriApi.ts`:

```ts
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, getAllWindows } from '@tauri-apps/api/window';
import type { LootTypesConfig, MapConfig, UserSettings } from '../domain/schemas';

export type RawConfigBundle = {
  loot_types: unknown;
  maps: unknown[];
  settings: unknown;
};

export async function loadConfigBundleRaw(): Promise<RawConfigBundle> {
  return invoke<RawConfigBundle>('load_config_bundle');
}

export async function saveUserSettingsRaw(settings: UserSettings): Promise<void> {
  await invoke('save_user_settings', { settings });
}

export async function saveMapConfigRaw(mapId: string, mapConfig: MapConfig): Promise<void> {
  await invoke('save_map_config', { mapId, mapConfig });
}

export async function setCurrentWindowClickThrough(ignore: boolean): Promise<void> {
  await getCurrentWindow().setIgnoreCursorEvents(ignore);
}

export async function setOverlayVisible(visible: boolean): Promise<void> {
  const overlay = (await getAllWindows()).find((window) => window.label === 'overlay');
  if (!overlay) return;
  if (visible) {
    await overlay.show();
    await overlay.setFocus();
  } else {
    await overlay.hide();
  }
}

export type ParsedConfigBundle = {
  lootTypes: LootTypesConfig;
  maps: MapConfig[];
  settings: UserSettings;
};
```

- [ ] **Step 3: Implement config store parser/loader**

Create `src/services/configStore.ts`:

```ts
import {
  normalizeUserSettings,
  parseLootTypesConfig,
  parseMapConfig,
  parseUserSettings,
} from '../domain/configValidation';
import type { ParsedConfigBundle } from './tauriApi';
import { loadConfigBundleRaw, saveMapConfigRaw, saveUserSettingsRaw } from './tauriApi';
import type { MapConfig, UserSettings } from '../domain/schemas';

export async function loadConfigBundle(): Promise<ParsedConfigBundle> {
  const raw = await loadConfigBundleRaw();
  const lootTypes = parseLootTypesConfig(raw.loot_types);
  const maps = raw.maps.map(parseMapConfig).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  const settings = normalizeUserSettings(parseUserSettings(raw.settings), lootTypes, maps);
  return { lootTypes, maps, settings };
}

export async function persistUserSettings(settings: UserSettings): Promise<void> {
  await saveUserSettingsRaw(settings);
}

export async function persistMapConfig(map: MapConfig): Promise<void> {
  await saveMapConfigRaw(map.id, map);
}
```

- [ ] **Step 4: Implement app state reducer**

Create `src/state/appStore.ts`:

```ts
import type { LootTypesConfig, MapConfig, UserSettings } from '../domain/schemas';

export type AppMode = 'browse' | 'inspect' | 'edit';

export type AppState = {
  lootTypes: LootTypesConfig;
  maps: MapConfig[];
  settings: UserSettings;
  selectedMapId: string;
  mode: AppMode;
  overlayVisible: boolean;
  settingsDirty: boolean;
  dirtyMapIds: Set<string>;
};

export type LoadedConfig = {
  lootTypes: LootTypesConfig;
  maps: MapConfig[];
  settings: UserSettings;
};

export type AppAction =
  | { type: 'setMode'; mode: AppMode }
  | { type: 'setSelectedMap'; mapId: string }
  | { type: 'toggleLootType'; lootTypeId: string }
  | { type: 'setOverlayVisible'; visible: boolean }
  | { type: 'updateMap'; map: MapConfig }
  | { type: 'markMapSaved'; mapId: string }
  | { type: 'markSettingsSaved' };

export function createInitialState(config: LoadedConfig): AppState {
  return {
    lootTypes: config.lootTypes,
    maps: config.maps,
    settings: config.settings,
    selectedMapId: config.settings.selectedMapId,
    mode: 'browse',
    overlayVisible: true,
    settingsDirty: false,
    dirtyMapIds: new Set(),
  };
}

export function reduceAppState(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'setMode':
      return { ...state, mode: action.mode };
    case 'setSelectedMap':
      return {
        ...state,
        selectedMapId: action.mapId,
        settings: { ...state.settings, selectedMapId: action.mapId },
        settingsDirty: true,
      };
    case 'toggleLootType':
      return {
        ...state,
        settings: {
          ...state.settings,
          visibleLootTypes: {
            ...state.settings.visibleLootTypes,
            [action.lootTypeId]: !state.settings.visibleLootTypes[action.lootTypeId],
          },
        },
        settingsDirty: true,
      };
    case 'setOverlayVisible':
      return { ...state, overlayVisible: action.visible };
    case 'updateMap':
      return {
        ...state,
        maps: state.maps.map((map) => (map.id === action.map.id ? action.map : map)),
        dirtyMapIds: new Set([...state.dirtyMapIds, action.map.id]),
      };
    case 'markMapSaved': {
      const dirtyMapIds = new Set(state.dirtyMapIds);
      dirtyMapIds.delete(action.mapId);
      return { ...state, dirtyMapIds };
    }
    case 'markSettingsSaved':
      return { ...state, settingsDirty: false };
  }
}

export function getSelectedMap(state: AppState): MapConfig | undefined {
  return state.maps.find((map) => map.id === state.selectedMapId);
}
```

- [ ] **Step 5: Verify store tests pass**

Run:

```bash
npm run test -- src/state/appStore.test.ts
npm run typecheck
```

Expected: PASS and typecheck exits 0.

---

### Task 7: Build Overlay Rendering and Details UI

**Files:**
- Create: `src/components/MarkerLayer.tsx`
- Create: `src/components/MarkerLayer.test.tsx`
- Create: `src/components/MarkerDetails.tsx`
- Create: `src/components/MarkerDetails.test.tsx`
- Create: `src/components/OverlayApp.tsx`
- Modify: `src/main.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing component tests**

Create `src/components/MarkerLayer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { validLootTypes, validMap } from '../test/fixtures';
import { MarkerLayer } from './MarkerLayer';

it('renders visible markers with loot icons', () => {
  render(
    <MarkerLayer
      map={validMap}
      lootTypes={validLootTypes}
      visibleLootTypes={{ diamond: true }}
      mode="browse"
      screenSize={{ width: 1000, height: 1000 }}
      onSelectPoint={() => undefined}
      onMovePoint={() => undefined}
      onCreatePoint={() => undefined}
    />,
  );

  expect(screen.getByRole('button', { name: '二楼保险旁' })).toBeInTheDocument();
});

it('hides filtered marker types', () => {
  render(
    <MarkerLayer
      map={validMap}
      lootTypes={validLootTypes}
      visibleLootTypes={{ diamond: false }}
      mode="browse"
      screenSize={{ width: 1000, height: 1000 }}
      onSelectPoint={() => undefined}
      onMovePoint={() => undefined}
      onCreatePoint={() => undefined}
    />,
  );

  expect(screen.queryByRole('button', { name: '二楼保险旁' })).not.toBeInTheDocument();
});
```

Create `src/components/MarkerDetails.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { validLootTypes, validMap } from '../test/fixtures';
import { MarkerDetails } from './MarkerDetails';

it('shows empty screenshot message', () => {
  render(<MarkerDetails point={validMap.points[0]} lootTypes={validLootTypes} onClose={() => undefined} />);
  expect(screen.getByText('暂无实景截图')).toBeInTheDocument();
});

it('shows screenshot image when present', () => {
  const point = { ...validMap.points[0], screenshots: ['assets/screenshots/zero-dam/a.jpg'] };
  render(<MarkerDetails point={point} lootTypes={validLootTypes} onClose={() => undefined} />);
  expect(screen.getByRole('img', { name: '二楼保险旁 截图 1' })).toHaveAttribute('src', '/assets/screenshots/zero-dam/a.jpg');
});
```

Run:

```bash
npm run test -- src/components/MarkerLayer.test.tsx src/components/MarkerDetails.test.tsx
```

Expected: FAIL because components do not exist.

- [ ] **Step 2: Implement marker layer**

Create `src/components/MarkerLayer.tsx`:

```tsx
import type { AppMode } from '../state/appStore';
import type { LootTypesConfig, MapConfig, MapPoint } from '../domain/schemas';
import { relativeToScreen, screenToRelative, type ScreenSize } from '../domain/markerPosition';

export type MarkerLayerProps = {
  map: MapConfig;
  lootTypes: LootTypesConfig;
  visibleLootTypes: Record<string, boolean>;
  mode: AppMode;
  screenSize: ScreenSize;
  onSelectPoint: (point: MapPoint) => void;
  onMovePoint: (pointId: string, position: { x: number; y: number }) => void;
  onCreatePoint: (position: { x: number; y: number }) => void;
};

export function MarkerLayer({
  map,
  lootTypes,
  visibleLootTypes,
  mode,
  screenSize,
  onSelectPoint,
  onMovePoint,
  onCreatePoint,
}: MarkerLayerProps) {
  const typeById = new Map(lootTypes.types.map((type) => [type.id, type]));
  const visiblePoints = map.points.filter((point) => visibleLootTypes[point.type] ?? true);

  return (
    <div
      className={`marker-layer marker-layer--${mode}`}
      onClick={(event) => {
        if (mode !== 'edit' || event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        onCreatePoint(screenToRelative({ left: event.clientX - rect.left, top: event.clientY - rect.top }, screenSize));
      }}
    >
      {visiblePoints.map((point) => {
        const lootType = typeById.get(point.type);
        const position = relativeToScreen(point, screenSize);
        const size = lootType?.defaultSize ?? 28;
        return (
          <button
            key={point.id}
            type="button"
            className="marker-button"
            aria-label={point.title || point.id}
            style={{
              left: position.left,
              top: position.top,
              width: size,
              height: size,
              borderColor: lootType?.color ?? '#ffffff',
            }}
            draggable={mode === 'edit'}
            onClick={(event) => {
              event.stopPropagation();
              if (mode !== 'browse') onSelectPoint(point);
            }}
            onDragEnd={(event) => {
              if (mode !== 'edit') return;
              const layer = event.currentTarget.parentElement;
              if (!layer) return;
              const rect = layer.getBoundingClientRect();
              onMovePoint(
                point.id,
                screenToRelative({ left: event.clientX - rect.left, top: event.clientY - rect.top }, screenSize),
              );
            }}
          >
            {lootType ? <img src={`/${lootType.icon}`} alt="" draggable={false} /> : <span>?</span>}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Implement marker details**

Create `src/components/MarkerDetails.tsx`:

```tsx
import { useState } from 'react';
import type { LootTypesConfig, MapPoint } from '../domain/schemas';

export type MarkerDetailsProps = {
  point: MapPoint;
  lootTypes: LootTypesConfig;
  onClose: () => void;
};

export function MarkerDetails({ point, lootTypes, onClose }: MarkerDetailsProps) {
  const [index, setIndex] = useState(0);
  const lootType = lootTypes.types.find((type) => type.id === point.type);
  const screenshot = point.screenshots[index];

  return (
    <section className="marker-details" aria-label="点位详情">
      <header>
        <div>
          <h2>{point.title || point.id}</h2>
          <p>{lootType?.name ?? `未知类型: ${point.type}`}</p>
        </div>
        <button type="button" onClick={onClose}>关闭</button>
      </header>

      {point.description && <p>{point.description}</p>}
      {point.tags.length > 0 && <p>标签：{point.tags.join('、')}</p>}

      <div className="screenshot-box">
        {screenshot ? (
          <img src={`/${screenshot}`} alt={`${point.title || point.id} 截图 ${index + 1}`} />
        ) : (
          <p>暂无实景截图</p>
        )}
      </div>

      {point.screenshots.length > 1 && (
        <footer>
          <button type="button" onClick={() => setIndex((index - 1 + point.screenshots.length) % point.screenshots.length)}>
            上一张
          </button>
          <span>{index + 1} / {point.screenshots.length}</span>
          <button type="button" onClick={() => setIndex((index + 1) % point.screenshots.length)}>
            下一张
          </button>
        </footer>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Add overlay app root and route by window label**

Create `src/components/OverlayApp.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { validLootTypes, validMap, validSettings } from '../test/fixtures';
import type { MapPoint } from '../domain/schemas';
import { setCurrentWindowClickThrough } from '../services/tauriApi';
import { MarkerDetails } from './MarkerDetails';
import { MarkerLayer } from './MarkerLayer';

export function OverlayApp() {
  const [mode, setMode] = useState<'browse' | 'inspect' | 'edit'>('browse');
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const screenSize = useMemo(() => ({ width: window.innerWidth, height: window.innerHeight }), []);

  useEffect(() => {
    setCurrentWindowClickThrough(mode === 'browse').catch(console.error);
  }, [mode]);

  return (
    <div className="overlay-root">
      <MarkerLayer
        map={validMap}
        lootTypes={validLootTypes}
        visibleLootTypes={validSettings.visibleLootTypes}
        mode={mode}
        screenSize={screenSize}
        onSelectPoint={setSelectedPoint}
        onMovePoint={() => undefined}
        onCreatePoint={() => undefined}
      />
      {selectedPoint && <MarkerDetails point={selectedPoint} lootTypes={validLootTypes} onClose={() => setSelectedPoint(null)} />}
      <div className="overlay-debug-controls">
        <button type="button" onClick={() => setMode('browse')}>浏览</button>
        <button type="button" onClick={() => setMode('inspect')}>交互</button>
        <button type="button" onClick={() => setMode('edit')}>编辑</button>
      </div>
    </div>
  );
}

export async function isOverlayWindow(): Promise<boolean> {
  return getCurrentWindow().label === 'overlay';
}
```

Modify `src/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { OverlayApp } from './components/OverlayApp';
import './styles.css';

function ControlPlaceholder() {
  return <main className="app-shell">DFtool 控制台</main>;
}

const App = getCurrentWindow().label === 'overlay' ? OverlayApp : ControlPlaceholder;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 5: Add overlay styles**

Append to `src/styles.css`:

```css
.overlay-root,
.marker-layer {
  position: fixed;
  inset: 0;
  background: transparent;
  overflow: hidden;
}

.marker-button {
  position: absolute;
  transform: translate(-50%, -50%);
  padding: 0;
  border: 2px solid #fff;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  cursor: pointer;
}

.marker-button img {
  display: block;
  width: 100%;
  height: 100%;
}

.marker-details {
  position: fixed;
  right: 24px;
  top: 24px;
  width: 360px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(17, 24, 39, 0.94);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
}

.marker-details header,
.marker-details footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.marker-details h2 {
  margin: 0;
  font-size: 18px;
}

.screenshot-box {
  min-height: 160px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.screenshot-box img {
  max-width: 100%;
  max-height: 260px;
}

.overlay-debug-controls {
  position: fixed;
  left: 16px;
  bottom: 16px;
  display: flex;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.84);
}
```

- [ ] **Step 6: Verify overlay component tests pass**

Run:

```bash
npm run test -- src/components/MarkerLayer.test.tsx src/components/MarkerDetails.test.tsx
npm run typecheck
```

Expected: PASS and typecheck exits 0.

---

### Task 8: Build Control Window Components

**Files:**
- Create: `src/components/MapSelector.tsx`
- Create: `src/components/LootTypeFilters.tsx`
- Create: `src/components/ModeControls.tsx`
- Create: `src/components/ControlApp.tsx`
- Modify: `src/main.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Implement selector/filter/control components**

Create `src/components/MapSelector.tsx`:

```tsx
import type { MapConfig } from '../domain/schemas';

export function MapSelector({ maps, selectedMapId, onChange }: {
  maps: MapConfig[];
  selectedMapId: string;
  onChange: (mapId: string) => void;
}) {
  return (
    <label className="field">
      <span>当前地图</span>
      <select value={selectedMapId} onChange={(event) => onChange(event.target.value)}>
        {maps.map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}
      </select>
    </label>
  );
}
```

Create `src/components/LootTypeFilters.tsx`:

```tsx
import type { LootTypesConfig } from '../domain/schemas';

export function LootTypeFilters({ lootTypes, visibleLootTypes, onToggle }: {
  lootTypes: LootTypesConfig;
  visibleLootTypes: Record<string, boolean>;
  onToggle: (lootTypeId: string) => void;
}) {
  return (
    <section className="panel">
      <h2>物资筛选</h2>
      {lootTypes.types.map((type) => (
        <label key={type.id} className="checkbox-row">
          <input
            type="checkbox"
            checked={visibleLootTypes[type.id] ?? type.defaultVisible}
            onChange={() => onToggle(type.id)}
          />
          <img src={`/${type.icon}`} alt="" />
          <span>{type.name}</span>
        </label>
      ))}
    </section>
  );
}
```

Create `src/components/ModeControls.tsx`:

```tsx
import type { AppMode } from '../state/appStore';

export function ModeControls({ mode, overlayVisible, onModeChange, onOverlayVisibleChange }: {
  mode: AppMode;
  overlayVisible: boolean;
  onModeChange: (mode: AppMode) => void;
  onOverlayVisibleChange: (visible: boolean) => void;
}) {
  return (
    <section className="panel">
      <h2>模式</h2>
      <div className="button-row">
        <button type="button" aria-pressed={mode === 'browse'} onClick={() => onModeChange('browse')}>浏览</button>
        <button type="button" aria-pressed={mode === 'inspect'} onClick={() => onModeChange('inspect')}>交互</button>
        <button type="button" aria-pressed={mode === 'edit'} onClick={() => onModeChange('edit')}>编辑</button>
      </div>
      <button type="button" onClick={() => onOverlayVisibleChange(!overlayVisible)}>
        {overlayVisible ? '隐藏覆盖层' : '显示覆盖层'}
      </button>
      <p className="hint">Ctrl+PageUp/PageDown 切换地图，Ctrl+Alt+Space 切换浏览/交互，Ctrl+Alt+E 切换编辑。</p>
    </section>
  );
}
```

- [ ] **Step 2: Implement control app with sample state**

Create `src/components/ControlApp.tsx`:

```tsx
import { useReducer } from 'react';
import { validLootTypes, validMap, validSettings } from '../test/fixtures';
import { createInitialState, reduceAppState } from '../state/appStore';
import { LootTypeFilters } from './LootTypeFilters';
import { MapSelector } from './MapSelector';
import { ModeControls } from './ModeControls';

const initialState = createInitialState({
  lootTypes: validLootTypes,
  maps: [validMap],
  settings: validSettings,
});

export function ControlApp() {
  const [state, dispatch] = useReducer(reduceAppState, initialState);

  return (
    <main className="app-shell control-shell">
      <h1>DFtool 控制台</h1>
      <MapSelector
        maps={state.maps}
        selectedMapId={state.selectedMapId}
        onChange={(mapId) => dispatch({ type: 'setSelectedMap', mapId })}
      />
      <ModeControls
        mode={state.mode}
        overlayVisible={state.overlayVisible}
        onModeChange={(mode) => dispatch({ type: 'setMode', mode })}
        onOverlayVisibleChange={(visible) => dispatch({ type: 'setOverlayVisible', visible })}
      />
      <LootTypeFilters
        lootTypes={state.lootTypes}
        visibleLootTypes={state.settings.visibleLootTypes}
        onToggle={(lootTypeId) => dispatch({ type: 'toggleLootType', lootTypeId })}
      />
      {(state.settingsDirty || state.dirtyMapIds.size > 0) && <p className="dirty-warning">有未保存更改</p>}
    </main>
  );
}
```

Modify `src/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ControlApp } from './components/ControlApp';
import { OverlayApp } from './components/OverlayApp';
import './styles.css';

const App = getCurrentWindow().label === 'overlay' ? OverlayApp : ControlApp;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 3: Add control styles**

Append to `src/styles.css`:

```css
.control-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.control-shell h1 {
  margin: 0;
  font-size: 22px;
}

.panel,
.field {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
}

.panel h2 {
  margin: 0;
  font-size: 16px;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-row img {
  width: 22px;
  height: 22px;
}

.button-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.hint {
  color: #aab4c4;
  font-size: 13px;
}

.dirty-warning {
  color: #ffcc33;
}
```

- [ ] **Step 4: Verify build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit 0.

---

### Task 9: Wire Real Config Loading and Persistence

**Files:**
- Modify: `src/components/ControlApp.tsx`
- Modify: `src/components/OverlayApp.tsx`
- Modify: `src/state/appStore.ts`

- [ ] **Step 1: Extend reducer for loaded config**

Modify `src/state/appStore.ts` to add action and loading helper:

```ts
// Add to AppAction union:
| { type: 'replaceState'; config: LoadedConfig }

// Add to switch before default end:
case 'replaceState':
  return createInitialState(action.config);
```

Expected final `AppAction` union includes `replaceState` and reducer compiles.

- [ ] **Step 2: Load config in ControlApp and save settings**

Replace `src/components/ControlApp.tsx` with:

```tsx
import { useEffect, useReducer, useState } from 'react';
import { validLootTypes, validMap, validSettings } from '../test/fixtures';
import { createInitialState, getSelectedMap, reduceAppState } from '../state/appStore';
import { loadConfigBundle, persistMapConfig, persistUserSettings } from '../services/configStore';
import { LootTypeFilters } from './LootTypeFilters';
import { MapSelector } from './MapSelector';
import { ModeControls } from './ModeControls';

const fallbackState = createInitialState({ lootTypes: validLootTypes, maps: [validMap], settings: validSettings });

export function ControlApp() {
  const [state, dispatch] = useReducer(reduceAppState, fallbackState);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfigBundle()
      .then((config) => dispatch({ type: 'replaceState', config }))
      .catch((error) => setError(error instanceof Error ? error.message : String(error)));
  }, []);

  const selectedMap = getSelectedMap(state);

  return (
    <main className="app-shell control-shell">
      <h1>DFtool 控制台</h1>
      {error && <p className="error-message">配置加载失败：{error}</p>}
      <MapSelector maps={state.maps} selectedMapId={state.selectedMapId} onChange={(mapId) => dispatch({ type: 'setSelectedMap', mapId })} />
      <ModeControls mode={state.mode} overlayVisible={state.overlayVisible} onModeChange={(mode) => dispatch({ type: 'setMode', mode })} onOverlayVisibleChange={(visible) => dispatch({ type: 'setOverlayVisible', visible })} />
      <LootTypeFilters lootTypes={state.lootTypes} visibleLootTypes={state.settings.visibleLootTypes} onToggle={(lootTypeId) => dispatch({ type: 'toggleLootType', lootTypeId })} />
      <div className="button-row">
        <button type="button" onClick={() => persistUserSettings(state.settings).then(() => dispatch({ type: 'markSettingsSaved' })).catch((error) => setError(String(error)))}>
          保存用户设置
        </button>
        <button type="button" disabled={!selectedMap} onClick={() => selectedMap && persistMapConfig(selectedMap).then(() => dispatch({ type: 'markMapSaved', mapId: selectedMap.id })).catch((error) => setError(String(error)))}>
          保存当前地图配置
        </button>
      </div>
      {(state.settingsDirty || state.dirtyMapIds.size > 0) && <p className="dirty-warning">有未保存更改</p>}
    </main>
  );
}
```

- [ ] **Step 3: Add error style**

Append to `src/styles.css`:

```css
.error-message {
  color: #ff8a8a;
  white-space: pre-wrap;
}
```

- [ ] **Step 4: Verify typecheck and Tauri command names**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit 0.

---

### Task 10: Implement Edit Dialog and Editing Flow

**Files:**
- Create: `src/components/MarkerEditDialog.tsx`
- Create: `src/components/MarkerEditDialog.test.tsx`
- Modify: `src/components/OverlayApp.tsx`

- [ ] **Step 1: Write failing edit dialog test**

Create `src/components/MarkerEditDialog.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { validLootTypes, validMap } from '../test/fixtures';
import { MarkerEditDialog } from './MarkerEditDialog';

it('submits a new marker with empty screenshots', () => {
  const onSave = vi.fn();
  render(
    <MarkerEditDialog
      lootTypes={validLootTypes}
      initialPoint={null}
      initialPosition={{ x: 0.12, y: 0.34 }}
      onSave={onSave}
      onDelete={() => undefined}
      onCancel={() => undefined}
    />,
  );

  fireEvent.change(screen.getByLabelText('标题'), { target: { value: '新钻石点' } });
  fireEvent.click(screen.getByRole('button', { name: '保存点位' }));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    type: 'diamond',
    x: 0.12,
    y: 0.34,
    title: '新钻石点',
    screenshots: [],
  }));
});

it('deletes existing marker', () => {
  const onDelete = vi.fn();
  render(
    <MarkerEditDialog
      lootTypes={validLootTypes}
      initialPoint={validMap.points[0]}
      initialPosition={null}
      onSave={() => undefined}
      onDelete={onDelete}
      onCancel={() => undefined}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '删除点位' }));
  expect(onDelete).toHaveBeenCalledWith('diamond-001');
});
```

Run:

```bash
npm run test -- src/components/MarkerEditDialog.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 2: Implement edit dialog**

Create `src/components/MarkerEditDialog.tsx`:

```tsx
import { useState } from 'react';
import type { LootTypesConfig, MapPoint } from '../domain/schemas';

export function MarkerEditDialog({ lootTypes, initialPoint, initialPosition, onSave, onDelete, onCancel }: {
  lootTypes: LootTypesConfig;
  initialPoint: MapPoint | null;
  initialPosition: { x: number; y: number } | null;
  onSave: (point: MapPoint) => void;
  onDelete: (pointId: string) => void;
  onCancel: () => void;
}) {
  const firstType = lootTypes.types[0]?.id ?? 'unknown';
  const [id, setId] = useState(initialPoint?.id ?? `${firstType}-${Date.now()}`);
  const [type, setType] = useState(initialPoint?.type ?? firstType);
  const [title, setTitle] = useState(initialPoint?.title ?? '');
  const [description, setDescription] = useState(initialPoint?.description ?? '');
  const [tags, setTags] = useState(initialPoint?.tags.join(',') ?? '');
  const [screenshots, setScreenshots] = useState(initialPoint?.screenshots.join('\n') ?? '');
  const x = initialPoint?.x ?? initialPosition?.x ?? 0;
  const y = initialPoint?.y ?? initialPosition?.y ?? 0;

  return (
    <section className="marker-edit-dialog" aria-label="编辑点位">
      <h2>{initialPoint ? '编辑点位' : '新增点位'}</h2>
      <label>ID<input value={id} onChange={(event) => setId(event.target.value)} /></label>
      <label>物资类型<select value={type} onChange={(event) => setType(event.target.value)}>{lootTypes.types.map((lootType) => <option key={lootType.id} value={lootType.id}>{lootType.name}</option>)}</select></label>
      <label>标题<input aria-label="标题" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>描述<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <label>标签<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="高价值,室内" /></label>
      <label>截图路径<textarea value={screenshots} onChange={(event) => setScreenshots(event.target.value)} placeholder="每行一个相对路径，可置空" /></label>
      <p>坐标：{x.toFixed(4)}, {y.toFixed(4)}</p>
      <div className="button-row">
        <button type="button" onClick={() => onSave({ id, type, title, description, x, y, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean), screenshots: screenshots.split('\n').map((path) => path.trim()).filter(Boolean) })}>保存点位</button>
        {initialPoint && <button type="button" onClick={() => onDelete(initialPoint.id)}>删除点位</button>}
        <button type="button" onClick={onCancel}>取消</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Add edit dialog styles**

Append to `src/styles.css`:

```css
.marker-edit-dialog {
  position: fixed;
  left: 24px;
  top: 24px;
  width: 380px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: 12px;
  background: rgba(17, 24, 39, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.marker-edit-dialog label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
```

- [ ] **Step 4: Verify edit dialog tests pass**

Run:

```bash
npm run test -- src/components/MarkerEditDialog.test.tsx
npm run typecheck
```

Expected: PASS and typecheck exits 0.

---

### Task 11: Wire Global Shortcuts and Window Mode Behavior

**Files:**
- Modify: `src/components/ControlApp.tsx`
- Modify: `src/components/OverlayApp.tsx`
- Modify: `src/services/tauriApi.ts`

- [ ] **Step 1: Add shortcut registration helper**

Append to `src/services/tauriApi.ts`:

```ts
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';

export async function registerGlobalShortcuts(handlers: {
  previousMap: () => void;
  nextMap: () => void;
  toggleInspect: () => void;
  toggleEdit: () => void;
  toggleOverlay: () => void;
}): Promise<() => Promise<void>> {
  await register('Ctrl+PageUp', handlers.previousMap);
  await register('Ctrl+PageDown', handlers.nextMap);
  await register('Ctrl+Alt+Space', handlers.toggleInspect);
  await register('Ctrl+Alt+E', handlers.toggleEdit);
  await register('Ctrl+Alt+H', handlers.toggleOverlay);
  return unregisterAll;
}
```

- [ ] **Step 2: Wire shortcut registration in ControlApp**

In `src/components/ControlApp.tsx`, import helpers:

```ts
import { selectNextMapId, selectPreviousMapId } from '../domain/mapSelection';
import { registerGlobalShortcuts, setOverlayVisible } from '../services/tauriApi';
```

Add this effect inside `ControlApp` after state declarations:

```tsx
useEffect(() => {
  const mapIds = state.maps.map((map) => map.id);
  let cleanup: (() => Promise<void>) | undefined;

  registerGlobalShortcuts({
    previousMap: () => dispatch({ type: 'setSelectedMap', mapId: selectPreviousMapId(mapIds, state.selectedMapId) }),
    nextMap: () => dispatch({ type: 'setSelectedMap', mapId: selectNextMapId(mapIds, state.selectedMapId) }),
    toggleInspect: () => dispatch({ type: 'setMode', mode: state.mode === 'inspect' ? 'browse' : 'inspect' }),
    toggleEdit: () => dispatch({ type: 'setMode', mode: state.mode === 'edit' ? 'browse' : 'edit' }),
    toggleOverlay: () => {
      const visible = !state.overlayVisible;
      dispatch({ type: 'setOverlayVisible', visible });
      setOverlayVisible(visible).catch((error) => setError(String(error)));
    },
  }).then((value) => { cleanup = value; }).catch((error) => setError(String(error)));

  return () => { cleanup?.(); };
}, [state.maps, state.mode, state.overlayVisible, state.selectedMapId]);
```

- [ ] **Step 3: Verify shortcut code typechecks**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit 0.

---

### Task 12: Final Verification and Packaging Check

**Files:**
- Modify only files needed to fix failures found by commands below.

- [ ] **Step 1: Run full frontend tests**

Run:

```bash
npm run test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Run typecheck and build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 3: Run Tauri info/build smoke check**

Run:

```bash
npm run tauri -- info
```

Expected: Tauri CLI reports project info without errors.

If the machine has Rust, WebView2, and Tauri prerequisites installed, also run:

```bash
npm run tauri -- build
```

Expected: Windows bundle build succeeds. If prerequisites are missing, record the exact missing prerequisite message and stop without claiming packaged build success.

- [ ] **Step 4: Manual runtime smoke test**

Run:

```bash
npm run tauri -- dev
```

Expected manual checks:

```text
Control window opens.
Overlay window opens fullscreen and transparent.
Control window can select map and toggle loot filters.
Overlay shows sample diamond/keycard markers.
Browse mode is click-through.
Inspect mode allows clicking marker details.
Edit mode allows opening edit UI.
Saving map creates config/maps/zero-dam.json.bak before overwrite.
```

- [ ] **Step 5: Final status report**

Report:

```text
Implemented: Tauri + TypeScript map marker overlay with config-driven loot types, sample map, filtering, details, and editing foundation.
Verified: list exact commands run and pass/fail result.
Not verified: list any Tauri packaging/manual checks skipped due to missing local prerequisites.
```
