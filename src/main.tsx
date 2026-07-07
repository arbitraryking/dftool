import React from 'react';
import { createRoot } from 'react-dom/client';
import { ControlApp } from './components/ControlApp';
import { OverlayApp } from './components/OverlayApp';
import { AppStoreProvider } from './state/appStore';
import { getWindowLabel } from './services/tauriApi';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

void getWindowLabel().then((label) => {
  const App = label === 'overlay' ? OverlayApp : ControlApp;

  root.render(
    <React.StrictMode>
      <AppStoreProvider>
        <App />
      </AppStoreProvider>
    </React.StrictMode>,
  );
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  root.render(<main className="control-app error">程序启动失败：{message}</main>);
});
