const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const sea = require('node:sea');

function getBaseDir() {
  if (process.platform === 'win32') {
    return path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      'scale-inspector',
    );
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'scale-inspector');
  }

  return path.join(
    process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'),
    'scale-inspector',
  );
}

function ensureExtracted(versionDir, manifest) {
  const readyFile = path.join(versionDir, '.ready');
  const entryFile = path.join(versionDir, manifest.entry);

  if (fs.existsSync(readyFile) && fs.existsSync(entryFile)) {
    return;
  }

  const parentDir = path.dirname(versionDir);
  const workDir = `${versionDir}.tmp-${process.pid}-${Date.now()}`;
  fs.mkdirSync(parentDir, { recursive: true });
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  try {
    for (const assetKey of manifest.files) {
      const outPath = path.join(workDir, assetKey);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, Buffer.from(sea.getRawAsset(assetKey)));
    }

    fs.writeFileSync(readyFile.replace(versionDir, workDir), manifest.version);

    try {
      fs.renameSync(workDir, versionDir);
    } catch (error) {
      if (fs.existsSync(readyFile) && fs.existsSync(entryFile)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      } else {
        throw error;
      }
    }
  } catch (error) {
    fs.rmSync(workDir, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  const manifest = JSON.parse(sea.getAsset('asset-manifest.json', 'utf8'));
  const buildId = manifest.buildId || manifest.version;
  const versionDir = path.join(getBaseDir(), 'versions', buildId);

  ensureExtracted(versionDir, manifest);

  const entryFile = path.join(versionDir, manifest.entry);
  process.chdir(path.dirname(entryFile));
  await import(pathToFileURL(entryFile).href);
}

main().catch((error) => {
  const message = error && error.stack ? error.stack : String(error);
  console.error(message);
  process.exit(1);
});
