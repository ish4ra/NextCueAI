import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { readConfig } from './config.js';
import { createApp } from './app.js';

try {
  const config = readConfig(process.env);
  const staticDir = fileURLToPath(new URL('../../dist', import.meta.url));
  const server = createApp(config, fetch, staticDir).listen(config.port, '127.0.0.1', () => {
    console.info(`NextCueAI bridge: http://127.0.0.1:${config.port}`);
  });
  server.on('error', () => {
    console.error('Could not start NextCueAI. Check that PORT is available.');
    process.exitCode = 1;
  });
} catch {
  console.error(
    'Invalid configuration. Check .env.example: use a local Ollama URL and model, a valid port, and a timeout between 1000 and 600000 ms.',
  );
  process.exitCode = 1;
}
