import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App.tsx';
import { LanguageProvider } from './utils/useI18n.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <App />
    <Analytics />
  </LanguageProvider>,
);
