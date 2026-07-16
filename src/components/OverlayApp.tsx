import { MarkerDetails } from './MarkerDetails';
import { MarkerEditDialog } from './MarkerEditDialog';
import { MarkerLayer } from './MarkerLayer';
import { OverlayInteractivityController } from './OverlayInteractivityController';
import { useAppState } from '../state/appStore';

export function OverlayApp() {
  const state = useAppState();

  if (state.status === 'loading') {
    return (
      <>
        <OverlayInteractivityController />
        <div className="overlay-app muted">加载配置中...</div>
      </>
    );
  }

  if (state.status === 'error') {
    return (
      <>
        <OverlayInteractivityController />
        <div className="overlay-app error">配置加载失败：{state.error}</div>
      </>
    );
  }

  if (!state.overlayVisible) {
    return <OverlayInteractivityController />;
  }

  return (
    <main className="overlay-app">
      <OverlayInteractivityController />
      <MarkerLayer />
      <MarkerDetails />
      <MarkerEditDialog />
    </main>
  );
}
