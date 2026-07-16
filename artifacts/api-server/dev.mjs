import { execSync } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

process.env.NODE_ENV = 'development';

const cwd = dirname(fileURLToPath(import.meta.url));

execSync('node ./build.mjs && node --enable-source-maps ./dist/index.mjs', {
  stdio: 'inherit',
  shell: true,
  cwd,
});
