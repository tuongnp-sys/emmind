import { execSync } from 'node:child_process';

process.env.VITE_PORTAL = '1';
execSync('npm run build', { stdio: 'inherit', env: process.env });
