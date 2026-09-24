// Build the static site into dist/ — the only folder GitHub Pages publishes.
//   src/     → dist/          (index.html is also written to dist/terminal/ for the /terminal/ route)
//   public/  → dist/          (copied as-is: fonts, media, encrypted data, favicon)
// No bundling or transpiling: browsers load the same ES modules the tests import.
import { cp, mkdir, readdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const src = join(root, 'src');
const pub = join(root, 'public');
const output = join(root, 'dist');

// src/ and public/ share the site root, so a name in both would silently overwrite.
const publicNames = new Set(await readdir(pub));
const clash = (await readdir(src)).filter(name => publicNames.has(name));
if (clash.length) throw new Error(`src/ and public/ both contain: ${clash.join(', ')}`);

await rm(output, { recursive: true, force: true });
await cp(src, output, { recursive: true });
await cp(pub, output, { recursive: true });
await mkdir(join(output, 'terminal'), { recursive: true });
await copyFile(join(src, 'index.html'), join(output, 'terminal/index.html'));
// Serve files as-is on GitHub Pages (no Jekyll processing).
await writeFile(join(output, '.nojekyll'), '');
console.log(`Static site built: ${output}`);
