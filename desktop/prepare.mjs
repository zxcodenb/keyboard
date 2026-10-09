import { mkdirSync, writeFileSync, accessSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const python = fileURLToPath(new URL('../.venv/bin/python', import.meta.url));
accessSync(python);
mkdirSync(new URL('resources/', import.meta.url), { recursive: true });
writeFileSync(new URL('resources/local.json', import.meta.url), JSON.stringify({ python }));
