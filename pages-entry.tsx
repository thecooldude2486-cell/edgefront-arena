import { createRoot } from 'react-dom/client';
import { GameShell } from './components/GameShell';
import './app/globals.css';

// This is the same component and game engine used in the local preview.
createRoot(document.getElementById('root')!).render(<GameShell />);
