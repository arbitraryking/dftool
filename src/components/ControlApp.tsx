import { useEffect, useState } from 'react';
import { getAdjacentMapId } from '../domain/mapSelection';
import { getSelectedMap, saveCurrentMap, saveCurrentSettings, useAppDispatch, useAppState } from '../state/appStore';
import { ConfigPaths, commitImportedScreenshots, discardImportedScreenshots, getConfigPaths, getStartupWarnings, isTauriRuntime, setOverlayVisible } from '../services/tauriApi';
import { LootTypeFilters } from './LootTypeFilters';
import { MapSelector } from './MapSelector';
import { ModeControls } from './ModeControls';
import { GlobalShortcuts } from './GlobalShortcuts';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function ControlApp() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [startupWarnings, setStartupWarnings] = useState<string[]>([]);
  const [configPaths, setConfigPaths] = useState<ConfigPaths | undefined>();
  const selectedMap = getSelectedMap(state);

  useEffect(() => {
    getStartupWarnings()
      .then(setStartupWarnings)
      .catch((error: unknown) => setError(`读取启动警告失败：${errorMessage(error)}`));

    getConfigPaths()
      .then(setConfigPaths)
      .catch((error: unknown) => setError(`读取配置路径失败：${errorMessage(error)}`));
  }, []);

  if (state.status === 'loading') {
    return <main className="control-app">加载配置中...</main>;
  }

  if (state.status === 'error') {
    return <main className="control-app error">配置加载失败：{state.error}</main>;
  }

  async function saveSettings() {
    setError('');
    setMessage('');

    try {
      await saveCurrentSettings(state);
      dispatch({ type: 'markSettingsClean' });
      setMessage('用户设置已保存');
    } catch (error: unknown) {
      setError(`保存用户设置失败：${errorMessage(error)}`);
    }
  }

  async function saveMap() {
    setError('');
    setMessage('');

    try {
      const mapId = await saveCurrentMap(state);
      if (mapId) {
        const savedMap = state.maps.find((map) => map.id === mapId);
        const referencedScreenshots = new Set(savedMap?.points.flatMap((point) => point.screenshots) ?? []);
        const pendingImportedScreenshots = state.pendingImportedScreenshotsByMapId[mapId] ?? [];
        const retainedScreenshots = pendingImportedScreenshots.filter((path) => referencedScreenshots.has(path));
        const orphanedScreenshots = pendingImportedScreenshots.filter((path) => !referencedScreenshots.has(path));
        await commitImportedScreenshots(retainedScreenshots);
        await discardImportedScreenshots(orphanedScreenshots);
        dispatch({ type: 'clearPendingImportedScreenshots', mapId });
        dispatch({ type: 'markMapClean', mapId });
        setMessage('当前地图配置已保存到内置地图目录；如存在旧版本，已生成 .bak 备份');
      }
    } catch (error: unknown) {
      setError(`保存地图配置失败：${errorMessage(error)}`);
    }
  }

  async function toggleOverlay() {
    const visible = !state.overlayVisible;
    setError('');
    setMessage('');
    dispatch({ type: 'setOverlayVisible', visible });

    try {
      await setOverlayVisible(visible);
    } catch (error: unknown) {
      dispatch({ type: 'setOverlayVisible', visible: !visible });
      setError(`切换覆盖层显示失败：${errorMessage(error)}`);
    }
  }

  return (
    <main className="control-app">
      <GlobalShortcuts onError={setError} />
      <section className="panel">
        <h1>DFtool 地图标点</h1>
        <p className="muted">外部覆盖层工具；不注入游戏进程、不修改游戏文件、不读写游戏内存。</p>
        {!isTauriRuntime && (
          <p className="error">当前是浏览器预览页，不能控制桌面覆盖层。请使用 pnpm tauri dev 打开的 DFtool 控制台窗口。</p>
        )}
        {startupWarnings.map((warning) => <p className="error" key={warning}>{warning}</p>)}
        {state.runtimeError && <p className="error">{state.runtimeError}</p>}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="panel">
        <h2>配置位置</h2>
        {!isTauriRuntime && <p className="muted">浏览器预览模式下不显示桌面端路径。</p>}
        {configPaths && (
          <div className="path-groups">
            <div>
              <h3>配置文件</h3>
              <dl className="path-list">
                <div className="path-item">
                  <dt>配置目录</dt>
                  <dd title={configPaths.bundled_config_dir}>{configPaths.bundled_config_dir}</dd>
                </div>
                <div className="path-item">
                  <dt>地图目录</dt>
                  <dd title={configPaths.bundled_maps_dir}>{configPaths.bundled_maps_dir}</dd>
                </div>
                <div className="path-item">
                  <dt>物资类型</dt>
                  <dd title={configPaths.bundled_loot_types_path}>{configPaths.bundled_loot_types_path}</dd>
                </div>
              </dl>
            </div>
            <div>
              <h3>图片资源</h3>
              <dl className="path-list">
                <div className="path-item">
                  <dt>资源目录</dt>
                  <dd title={configPaths.bundled_assets_dir}>{configPaths.bundled_assets_dir}</dd>
                </div>
                <div className="path-item">
                  <dt>图标目录</dt>
                  <dd title={configPaths.bundled_icons_dir}>{configPaths.bundled_icons_dir}</dd>
                </div>
                <div className="path-item">
                  <dt>截图目录</dt>
                  <dd title={configPaths.bundled_screenshots_dir}>{configPaths.bundled_screenshots_dir}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>当前地图</h2>
        <MapSelector />
        <div className="row">
          <button onClick={() => selectedMap && dispatch({ type: 'selectMap', mapId: getAdjacentMapId(state.maps, selectedMap.id, -1) })}>上一张地图</button>
          <button onClick={() => selectedMap && dispatch({ type: 'selectMap', mapId: getAdjacentMapId(state.maps, selectedMap.id, 1) })}>下一张地图</button>
        </div>
        {selectedMap && <span className="muted">点位数量：{selectedMap.points.length}</span>}
      </section>

      <section className="panel">
        <h2>模式</h2>
        <ModeControls />
        <button onClick={toggleOverlay}>{state.overlayVisible ? '隐藏覆盖层' : '显示覆盖层'}</button>
      </section>

      <section className="panel">
        <h2>物资筛选</h2>
        <LootTypeFilters />
      </section>

      <section className="panel">
        <h2>保存</h2>
        <div className="row">
          <button onClick={saveSettings}>保存用户设置</button>
          <button onClick={saveMap} disabled={!selectedMap}>保存当前地图配置</button>
        </div>
        {state.settingsDirty && <strong>用户设置有未保存更改</strong>}
        {selectedMap && state.dirtyMapIds.includes(selectedMap.id) && <strong>当前地图有未保存更改</strong>}
        {message && <span className="muted">{message}</span>}
      </section>

      <section className="panel">
        <h2>快捷键</h2>
        <p className="muted">Ctrl+Alt+H 显隐覆盖层；Ctrl+Alt+1 浏览模式；Ctrl+Alt+2 交互模式；Ctrl+Alt+3 编辑模式；Ctrl+PageUp/PageDown 切换地图。</p>
        <p className="muted">兼容快捷键：Ctrl+Alt+Space 浏览/交互切换；Ctrl+Alt+E 编辑/浏览切换。</p>
      </section>
    </main>
  );
}
