import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {startInternalIngress} from './internal-ingress.mjs';

const entry = resolve(process.argv[2] ?? new URL('./server.js', import.meta.url).pathname);
const ingress = await startInternalIngress();
if (!ingress) {
  await import(pathToFileURL(entry).href);
} else {
  const child = spawn(process.execPath, [...process.execArgv, entry], {stdio: 'inherit', env: process.env});
  let stopping = false;
  function stop(signal) {
    if (stopping) return;
    stopping = true;
    // Drain authenticated responses before asking Next to drain and exit.
    const deadline = setTimeout(() => {
      console.warn('Internal ingress drain exceeded 20 seconds');
      ingress.closeAllConnections();
    }, 20000);
    deadline.unref();
    ingress.close(() => {
      clearTimeout(deadline);
      child.kill(signal);
    });
  }
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
  child.on('error', () => {
    console.error('Next child process failed');
    ingress.closeAllConnections();
    ingress.close(() => process.exit(1));
  });
  child.on('exit', code => {
    ingress.closeAllConnections();
    ingress.close(() => process.exit(stopping ? 0 : code || 1));
  });
}
