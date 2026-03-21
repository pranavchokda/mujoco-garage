import './style.css';
import { MujocoApp } from './mujoco-app';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const app = new MujocoApp(canvas);
app.init().catch((err) => {
  const statusEl = document.getElementById('status');
  const msg = err instanceof Error ? err.message : String(err);
  if (statusEl) statusEl.textContent = `Error: ${msg}`;
  console.error(err);
});
