import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Self-hosted design fonts (Flavor A): Hanken Grotesk (body) + Space Grotesk
// (display), weights 400/500/600/700. Bundled so they render regardless of
// network access to the Google Fonts CDN.
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/500.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/hanken-grotesk/700.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';

import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
