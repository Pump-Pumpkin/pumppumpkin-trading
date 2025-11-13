import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import UnderConstruction from './components/UnderConstruction.tsx';
import { MAINTENANCE_MODE } from './config/maintenance.ts';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {MAINTENANCE_MODE ? (
      <>
        {/* MAINTENANCE MODE - Under Construction Page */}
        <UnderConstruction />
        {/* TO DISABLE: Set MAINTENANCE_MODE = false in src/config/maintenance.ts */}
      </>
    ) : (
      <>
        {/* NORMAL MODE - Full App */}
        <App />
        {/* TO ENABLE MAINTENANCE: Set MAINTENANCE_MODE = true in src/config/maintenance.ts */}
      </>
    )}
  </StrictMode>
);// Bug fixes applied: position filter + liquidation price calculation - Mon Jul  7 09:32:14 PM EEST 2025
