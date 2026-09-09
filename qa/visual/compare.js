const { readFile, writeFile, mkdir } = require('node:fs/promises');
const path = require('node:path');
const { PNG } = require('pngjs');

async function compareScreenshot(baselineFile, currentFile, diffFile) {
  let baselineBytes;
  try { baselineBytes = await readFile(baselineFile); } catch (error) {
    if (error.code === 'ENOENT') return { status: 'failed', reason: 'Missing baseline; generate and review it explicitly' };
    throw error;
  }
  const baseline = PNG.sync.read(baselineBytes);
  const current = PNG.sync.read(await readFile(currentFile));
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return { status: 'failed', reason: 'Image dimensions differ',
      baselineSize: [baseline.width, baseline.height], currentSize: [current.width, current.height] };
  }
  const { default: pixelmatch } = await import('pixelmatch');
  const diff = new PNG({ width: current.width, height: current.height });
  const changedPixels = pixelmatch(baseline.data, current.data, diff.data, current.width, current.height, {
    threshold: 0.1, includeAA: false
  });
  if (changedPixels) {
    await mkdir(path.dirname(diffFile), { recursive: true });
    await writeFile(diffFile, PNG.sync.write(diff));
  }
  return { status: changedPixels ? 'failed' : 'passed', changedPixels,
    totalPixels: current.width * current.height };
}
module.exports = { compareScreenshot };
