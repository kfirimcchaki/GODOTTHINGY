import { createApp } from './app.js';
import config from './config.js';
import { save } from './db.js';

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  const shown = config.publicUrl || `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`;
  console.log(`${config.siteName} listening on ${shown}`);
  console.log(`  auth mode : ${config.auth.mode}${config.auth.mode === 'mock' ? ' (bundled dev provider at /dev/connect)' : ''}`);
  console.log(`  beta gate : ${config.limits.betaRequired ? 'on' : 'off'}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    save();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}

export default server;
