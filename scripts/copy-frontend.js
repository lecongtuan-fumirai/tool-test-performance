import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve(process.cwd(), 'frontend/dist');
const dest = path.resolve(process.cwd(), 'backend/public');

try {
  if (fs.existsSync(src)) {
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
    console.log('[KubePulse Build] Successfully copied frontend/dist to backend/public');
  } else {
    console.log('[KubePulse Build] frontend/dist not yet created, skipping copy');
  }
} catch (err) {
  console.warn('[KubePulse Build] Copy frontend notice:', err.message);
}

