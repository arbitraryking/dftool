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

void getWindowLabel().then((label) => {
  const App = label === 'overlay' ? OverlayApp : ControlApp;

  createRoot(rootElement).render(
    <React.StrictMode>
      <AppStoreProvider>
        <App />
      </AppStoreProvider>
    </React.StrictMode>,
  );
});
