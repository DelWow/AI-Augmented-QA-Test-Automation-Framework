const { readFile, writeFile, mkdir } = require('node:fs/promises');
const path = require('node:path');
const { PNG } = require('pngjs');
const { createHash } = require('node:crypto');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function compareScreenshot(baselineFile, currentFile, diffFile) {
  let baselineBytes;
  try { baselineBytes = await readFile(baselineFile); } catch (error) {
    if (error.code === 'ENOENT') return { status: 'failed', reason: 'Missing baseline; generate and review it explicitly' };
    throw error;
  }
  const baseline = PNG.sync.read(baselineBytes);
  const currentBytes = await readFile(currentFile);
  const current = PNG.sync.read(currentBytes);
  const hashes = { baseline: hash(baselineBytes), current: hash(currentBytes) };
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return { status: 'failed', reason: 'Image dimensions differ', hashes,
      baselineSize: [baseline.width, baseline.height], currentSize: [current.width, current.height] };
  }
  const { default: pixelmatch } = await import('pixelmatch');
  const diff = new PNG({ width: current.width, height: current.height });
  const changedPixels = pixelmatch(baseline.data, current.data, diff.data, current.width, current.height, {
    threshold: 0.1, includeAA: false
  });
  if (changedPixels) {
    await mkdir(path.dirname(diffFile), { recursive: true });
    const diffBytes = PNG.sync.write(diff);
    await writeFile(diffFile, diffBytes);
    hashes.diff = hash(diffBytes);
  }
  return { status: changedPixels ? 'failed' : 'passed', changedPixels, hashes,
    totalPixels: current.width * current.height };
}
module.exports = { compareScreenshot };
