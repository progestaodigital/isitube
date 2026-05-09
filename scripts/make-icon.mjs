// Convert build/icon.png into a multi-resolution build/icon.ico for NSIS.
// Run via `node scripts/make-icon.mjs` (also wired into the prebuild hook).

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pngToIco from 'png-to-ico';

const root = process.cwd();
const src = join(root, 'build', 'icon.png');
const dest = join(root, 'build', 'icon.ico');

const buf = await pngToIco(src);
await writeFile(dest, buf);
console.log(`Wrote ${dest} (${buf.length} bytes).`);
