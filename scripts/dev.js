const { spawn } = require('child_process');
const path = require('path');

// Set environment to development
process.env.NODE_ENV = 'development';

// Helper to log with prefix
function log(prefix, data) {
  const text = data.toString().trim();
  if (!text) return;
  console.log(`[${prefix}] ${text}`);
}

// 1. Start Vite dev server for the React frontend
const vite = spawn('npx', ['vite'], {
  shell: true,
  stdio: 'pipe'
});

vite.stdout.on('data', (data) => log('Vite', data));
vite.stderr.on('data', (data) => log('Vite-Error', data));

// 2. Start tsup watch compilation and run Electron when main files build
// We wait 2 seconds before launching tsup to let Vite startup
setTimeout(() => {
  console.log('[Dev] Starting main process compilation & Electron watcher...');
  
  const electronDev = spawn(
    'npx tsup src/main/index.ts src/main/preload.ts --out-dir dist/main --format cjs --external electron --external sqlite3 --watch --onSuccess "electron ."',
    [],
    {
      shell: true,
      stdio: 'inherit'
    }
  );

  process.on('SIGINT', () => {
    electronDev.kill();
    vite.kill();
    process.exit(0);
  });

  process.on('exit', () => {
    electronDev.kill();
    vite.kill();
  });
}, 2000);
