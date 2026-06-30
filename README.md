# DFtool

DFtool 是一个面向《三角洲行动》PC 端的外部地图标点工具。第一版实现地图物资点位覆盖显示、配置化管理和编辑模式。

本项目只做外部桌面覆盖层：不注入游戏进程、不修改游戏文件、不读写游戏内存、不做反作弊绕过。

## 已实现功能

- 桌面覆盖层
  - Tauri 双窗口架构：控制台窗口 + 透明全屏覆盖层窗口。
  - 覆盖层默认隐藏，可从控制台或快捷键显示/隐藏。
  - 覆盖层置顶、透明显示。
  - 浏览模式下点击穿透，尽量不影响游戏操作。

- 地图与点位
  - 支持多地图配置。
  - 支持按地图切换点位。
  - 点位使用相对坐标 `x/y: 0~1`，第一版默认用户全屏显示游戏地图。
  - 预留地图校准字段：`offsetX`、`offsetY`、`scale`。

- 物资类型
  - 物资类型独立配置。
  - 不同物资类型可配置不同名称、图标、颜色、默认尺寸和默认显示状态。
  - 当前示例类型：钻石、房卡、保险箱。
  - 覆盖层点位显示对应 SVG logo。

- 交互模式
  - 点击点位显示详情。
  - 支持点位标题、描述、标签、截图列表。
  - 如果配置了截图路径，详情面板会显示截图。

- 编辑模式
  - 在覆盖层空白处点击新增点位。
  - 点击已有点位编辑点位。
  - 支持编辑点位 ID、类型、标题、描述、坐标、标签、截图路径。
  - 支持删除点位。
  - 支持拖拽移动点位。
  - 新增点位时截图可以为空。

- 保存
  - 支持保存用户设置。
  - 支持保存当前地图配置。
  - 覆盖地图配置前会生成 `.json.bak` 备份。

- 快捷键
  - `Ctrl+Alt+H`：显示/隐藏覆盖层。
  - `Ctrl+Alt+1`：浏览模式。
  - `Ctrl+Alt+2`：交互模式。
  - `Ctrl+Alt+3`：编辑模式。
  - `Ctrl+Alt+Space`：浏览/交互模式切换。
  - `Ctrl+Alt+E`：编辑/浏览模式切换。
  - `Ctrl+PageUp` / `Ctrl+PageDown`：上一张/下一张地图。

## 技术栈

- Tauri v2
- React 19
- TypeScript
- Vite
- pnpm
- Rust
- Zod
- Vitest

## 项目结构

```text
.
├── assets/                         # Tauri 打包资源
│   ├── icons/                       # 物资类型 SVG 图标
│   └── screenshots/                 # 截图资源目录
├── config/                          # 桌面端运行时配置源
│   ├── loot-types.json              # 物资类型配置
│   └── maps/                        # 地图点位配置
├── public/                          # Vite 浏览器预览静态资源
│   ├── assets/
│   └── config/
├── src/                             # 前端 React/TypeScript 代码
│   ├── components/                  # UI 组件
│   │   ├── ControlApp.tsx           # 控制台主界面
│   │   ├── OverlayApp.tsx           # 覆盖层主界面
│   │   ├── MarkerLayer.tsx          # 点位渲染、点击、拖拽
│   │   ├── MarkerDetails.tsx        # 点位详情和截图
│   │   ├── MarkerEditDialog.tsx     # 点位编辑表单
│   │   ├── GlobalShortcuts.tsx      # 快捷键事件处理
│   │   ├── MapSelector.tsx          # 地图选择
│   │   ├── LootTypeFilters.tsx      # 物资类型筛选
│   │   └── ModeControls.tsx         # 模式切换
│   ├── domain/                      # 纯业务逻辑和测试
│   │   ├── schemas.ts               # Zod 配置 schema
│   │   ├── configValidation.ts      # 配置解析和归一化
│   │   ├── markerPosition.ts        # 相对坐标/屏幕坐标转换
│   │   ├── markerEditing.ts         # 点位增删改移动逻辑
│   │   └── mapSelection.ts          # 地图切换逻辑
│   ├── services/                    # Tauri/API 封装
│   │   ├── configStore.ts           # 配置加载和保存
│   │   └── tauriApi.ts              # Tauri command/window API
│   ├── state/                       # 应用状态
│   │   └── appStore.ts              # reducer、跨窗口同步、保存入口
│   ├── test/                        # 测试配置和 fixtures
│   ├── main.tsx                     # React 入口，根据窗口 label 加载不同 App
│   └── styles.css                   # 控制台和覆盖层样式
├── src-tauri/                       # Tauri/Rust 后端
│   ├── capabilities/default.json    # Tauri 权限
│   ├── icons/icon.ico               # Windows 图标
│   ├── src/
│   │   ├── main.rs                  # Tauri app、窗口、快捷键、commands
│   │   └── config_io.rs             # 配置读写、备份、用户设置
│   ├── Cargo.toml
│   └── tauri.conf.json              # Tauri 窗口、打包、资源配置
├── index.html
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── vite.config.ts
```

## 环境准备

需要安装：

- Node.js
- pnpm
- Rust/Cargo
- Tauri 所需系统依赖

安装前端依赖：

```bash
pnpm install
```

## 开发和使用命令

启动桌面端开发模式：

```bash
pnpm tauri dev
```

只启动 Vite 浏览器预览：

```bash
pnpm dev
```

注意：浏览器预览页不能控制桌面覆盖层，也不能验证 Tauri 窗口和全局快捷键。实际使用请运行 `pnpm tauri dev`。

运行单元测试：

```bash
pnpm test
```

监听模式运行测试：

```bash
pnpm test:watch
```

运行 TypeScript 类型检查：

```bash
pnpm typecheck
```

构建前端：

```bash
pnpm build
```

检查 Rust/Tauri 后端：

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

构建桌面应用安装包：

```bash
pnpm tauri build
```

## 基本使用流程

1. 启动：

   ```bash
   pnpm tauri dev
   ```

2. 打开游戏并呼出游戏地图，第一版默认游戏地图为全屏显示。

3. 在 DFtool 控制台选择地图、模式和物资筛选。

4. 点击“显示覆盖层”或按 `Ctrl+Alt+H` 显示覆盖层。

5. 根据需要切换模式：
   - 浏览模式：点击穿透。
   - 交互模式：点击点位查看详情和截图。
   - 编辑模式：新增、编辑、删除、拖拽点位。

6. 修改后在控制台保存：
   - “保存用户设置”保存当前地图和筛选状态。
   - “保存当前地图配置”保存点位配置。

## 配置详情

### 物资类型配置

文件：`config/loot-types.json`

示例：

```json
{
  "version": 1,
  "types": [
    {
      "id": "diamond",
      "name": "钻石",
      "icon": "assets/icons/diamond.svg",
      "color": "#40D9FF",
      "defaultSize": 30,
      "valueLevel": 5,
      "defaultVisible": true
    }
  ]
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `version` | 配置版本，当前必须为 `1`。 |
| `types` | 物资类型列表。 |
| `id` | 类型 ID，地图点位通过 `type` 引用它。 |
| `name` | 控制台显示名称。 |
| `icon` | 图标路径，相对于静态资源根路径，例如 `assets/icons/diamond.svg`。 |
| `color` | 点位高亮颜色。 |
| `defaultSize` | 覆盖层点位默认尺寸，单位 px。 |
| `valueLevel` | 价值等级，当前用于配置表达，后续可用于排序/筛选。 |
| `defaultVisible` | 默认是否显示该类型点位。 |

添加新物资类型时，需要：

1. 在 `config/loot-types.json` 中新增类型。
2. 将图标放到 `assets/icons/`。
3. 如果需要浏览器预览同步可用，也同步放到 `public/assets/icons/` 并更新 `public/config/loot-types.json`。

### 地图点位配置

文件目录：`config/maps/`

示例文件：`config/maps/zero-dam.json`

示例：

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
      "title": "二楼保险旁",
      "description": "靠近保险箱刷新点，注意窗口方向。",
      "x": 0.532,
      "y": 0.418,
      "screenshots": [],
      "tags": ["高价值", "室内"]
    }
  ]
}
```

地图字段说明：

| 字段 | 说明 |
| --- | --- |
| `version` | 配置版本，当前必须为 `1`。 |
| `id` | 地图 ID。保存时也用于生成文件名。 |
| `name` | 控制台显示的地图名称。 |
| `defaultCalibration` | 地图校准字段，第一版预留。 |
| `points` | 点位列表。 |

点位字段说明：

| 字段 | 说明 |
| --- | --- |
| `id` | 点位唯一 ID。 |
| `type` | 物资类型 ID，必须对应 `loot-types.json` 中的类型。 |
| `title` | 点位标题。 |
| `description` | 点位描述。 |
| `x` | 横向相对坐标，范围通常为 `0~1`。 |
| `y` | 纵向相对坐标，范围通常为 `0~1`。 |
| `screenshots` | 截图路径列表，可以为空。 |
| `tags` | 标签列表。 |

### 截图配置

截图可以放在：

```text
assets/screenshots/<map-id>/
```

点位中通过 `screenshots` 引用，例如：

```json
{
  "screenshots": ["assets/screenshots/zero-dam/diamond-001.png"]
}
```

如果截图为空：

```json
{
  "screenshots": []
}
```

交互模式下仍可显示点位详情，只是不显示截图图片。

### 用户设置

桌面端用户设置保存到：

```text
user-data/settings.json
```

该文件不提交到 Git。它保存：

- 当前选择的地图 ID。
- 各物资类型是否显示。

### 配置保存和备份

在控制台点击“保存当前地图配置”时：

- 当前地图配置会写回 `config/maps/<map-id>.json`。
- 如果原文件存在，会先生成备份：`config/maps/<map-id>.json.bak`。
- `.bak` 文件已被 `.gitignore` 忽略。

## 窗口和运行时说明

Tauri 配置在 `src-tauri/tauri.conf.json`：

- `control` 窗口：DFtool 控制台。
- `overlay` 窗口：透明全屏置顶覆盖层，默认隐藏。

浏览器预览模式只用于调试前端页面：

```bash
pnpm dev
```

实际覆盖层、窗口控制、全局快捷键、配置写入等桌面能力，需要使用：

```bash
pnpm tauri dev
```

## 注意事项

- 第一版坐标基于全屏地图假设，不保证适配窗口化或非标准缩放场景。
- 若全局快捷键无效，可能是快捷键被系统或其他软件占用，需查看 `pnpm tauri dev` 终端输出。
- 若构建时遇到 `dist` 目录权限问题，先关闭正在运行的 Vite/Tauri 窗口或占用该目录的程序后重试。
