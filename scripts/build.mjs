import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcRoot = path.join(repoRoot, 'src');

const order = [
  'header.user.js',
  'core/constants.js',
  'core/defaultConfig.js',
  'core/configStore.js',
  'infra/gmRequestJson.js',
  'ui/dom.js',
  'ui/styles.js',
  'ui/logger.js',
  'ui/tableCard.js',
  'ui/modal.js',
  'domain/api.js',
  'app/mount.js',
  'footer.user.js',
];

function read(file) {
  return fs.readFileSync(path.join(srcRoot, file), 'utf8').replace(/\r\n/g, '\n');
}

function build() {
  const chunks = order.map((p) => {
    const text = read(p);
    return `\n// ---- ${p} ----\n${text}\n`;
  });

  const out = chunks.join('').replace(/\n{3,}/g, '\n\n').trimStart() + '\n';
  const outFile = path.join(repoRoot, 'permission_matrix_maintainer.user.js');
  fs.writeFileSync(outFile, out, 'utf8');
  console.log(`Built: ${path.relative(repoRoot, outFile)} (${out.length} bytes)`);
}

build();
