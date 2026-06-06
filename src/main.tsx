import React from 'react';
import ReactDOM from 'react-dom/client';
import { Assets } from 'pixi.js';
import App from './App';
import './styles/tokens.css';
import './styles/global.css';

// Pixi v8 decodes images via `createImageBitmap` by default, which hangs on
// some Android Chrome builds for SVGs that omit an intrinsic width/height
// (e.g. the weapon art). That stalls the combat texture preload forever, so no
// units or painted floors ever mount. Decode through an <img> element instead —
// it honours the SVG's viewBox and is reliable across mobile GPUs/drivers.
Assets.setPreferences({ preferCreateImageBitmap: false });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
