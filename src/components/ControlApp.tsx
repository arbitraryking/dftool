import { useState } from 'react';
import { getAdjacentMapId } from '../domain/mapSelection';
import { getSelectedMap, saveCurrentMap, saveCurrentSettings, useAppDispatch, useAppState } from '../state/appStore';
import { isTauriRuntime, setOverlayVisible } from '../services/tauriApi';
import { LootTypeFilters } from './LootTypeFilters';
import { MapSelector } from './MapSelector';
import { ModeControls } from './ModeControls';
import { GlobalShortcuts } from './GlobalShortcuts';

export function ControlApp() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [message, setMessage] = useState('');
  const selectedMap = getSelectedMap(state);

  if (state.status === 'loading') {
    return <main className="control-app">加载配置中...</main>;
  }

  if (state.status === 'error') {
    return <main className="control-app error">配置加载失败：{state.error}</main>;
  }

  async function saveSettings() {
    await saveCurrentSettings(state);
    dispatch({ type: 'markSettingsClean' });
    setMessage('用户设置已保存');
  }

  async function saveMap() {
    const mapId = await saveCurrentMap(state);
    if (mapId) {
      dispatch({ type: 'markMapClean', mapId });
      setMessage('当前地图配置已保存，并已在覆盖原文件前生成 .bak 备份');
    }
  }

  async function toggleOverlay() {
    const visible = !state.overlayVisible;
    dispatch({ type: 'setOverlayVisible', visible });
    await setOverlayVisible(visible);
  }

  return (
    <main className="control-app">
      <GlobalShortcuts />
      <section className="panel">
        <h1>DFtool 地图标点</h1>
        <p className="muted">外部覆盖层工具；不注入游戏进程、不修改游戏文件、不读写游戏内存。</p>
        {!isTauriRuntime && (
          <p className="error">当前是浏览器预览页，不能控制桌面覆盖层。请使用 pnpm tauri dev 打开的 DFtool 控制台窗口。</p>
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
