import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

try {
  document.documentElement.classList.toggle('dark', window.localStorage.getItem('pokedex-rpg-theme') !== 'light');
} catch {
  document.documentElement.classList.add('dark');
}

createRoot(document.getElementById('root')!).render(<App />);
