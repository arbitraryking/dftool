import { MarkerDetails } from './MarkerDetails';
import { MarkerEditDialog } from './MarkerEditDialog';
import { MarkerLayer } from './MarkerLayer';
import { useAppState } from '../state/appStore';

export function OverlayApp() {
  const state = useAppState();

  if (state.status === 'loading') {
    return <div className="overlay-app muted">加载配置中...</div>;
  }

  if (state.status === 'error') {
    return <div className="overlay-app error">配置加载失败：{state.error}</div>;
  }

  if (!state.overlayVisible) {
    return null;
  }

  return (
    <main className="overlay-app">
      <MarkerLayer />
      <MarkerDetails />
      <MarkerEditDialog />
    </main>
  );
}
