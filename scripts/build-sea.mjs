import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  chmodSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const buildDir = path.join(rootDir, '.sea-build');
const appDir = path.join(buildDir, 'app');
const distDir = path.join(rootDir, 'dist');
const blobPath = path.join(buildDir, 'sea-prep.blob');
const configPath = path.join(buildDir, 'sea-config.json');
const manifestPath = path.join(buildDir, 'asset-manifest.json');

function run(command, args) {
  execFileSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
  });
}

function quoteForCmd(arg) {
  return `"${String(arg).replace(/"/g, '""')}"`;
}

function runPostject(args) {
  if (process.platform === 'win32') {
    const commandLine = ['npx', ...args].map(quoteForCmd).join(' ');
    run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine]);
    return;
  }

  run('npx', args);
}

function toAssetKey(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function collectAssetEntries(dir, baseDir = dir, output = []) {
  for (const entry of readdirSync(dir)) {
    const absolutePath = path.join(dir, entry);
    const stat = statSync(absolutePath);

    if (stat.isDirectory()) {
      collectAssetEntries(absolutePath, baseDir, output);
      continue;
    }

    if (stat.isFile()) {
      output.push(toAssetKey(path.relative(baseDir, absolutePath)));
    }
  }

  return output;
}

function outputNameFor(platform, arch) {
  if (platform === 'win32') {
    return 'scale-inspector.exe';
  }

  const osName = platform === 'darwin' ? 'macos' : platform;
  return `scale-inspector-${osName}-${arch}`;
}

function createBuildId(baseDir, assetFiles, version) {
  const hash = createHash('sha256');

  for (const assetKey of assetFiles) {
    hash.update(assetKey);
    hash.update('\0');
    hash.update(readFileSync(path.join(baseDir, assetKey)));
    hash.update('\0');
  }

  return `${version}-${hash.digest('hex').slice(0, 12)}`;
}

if (!existsSync(path.join(rootDir, 'node_modules'))) {
  throw new Error('Missing node_modules. Run "npm install" first.');
}

rmSync(buildDir, { recursive: true, force: true });
rmSync(distDir, { recursive: true, force: true });
mkdirSync(appDir, { recursive: true });
mkdirSync(distDir, { recursive: true });

cpSync(path.join(rootDir, 'node_modules'), path.join(appDir, 'node_modules'), { recursive: true });
copyFileSync(path.join(rootDir, 'scale-inspector.js'), path.join(appDir, 'scale-inspector.js'));

const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
packageJson.scripts = undefined;
writeFileSync(path.join(appDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);

const assetFiles = collectAssetEntries(appDir, buildDir).sort();
const buildId = createBuildId(buildDir, assetFiles, packageJson.version);
const manifest = {
  buildId,
  version: packageJson.version,
  entry: 'app/scale-inspector.js',
  files: assetFiles,
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const assetMap = Object.fromEntries(
  assetFiles.map((assetKey) => [assetKey, path.join(buildDir, assetKey)]),
);

const seaConfig = {
  main: path.join(rootDir, 'scripts', 'sea-launcher.cjs'),
  output: blobPath,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
  assets: {
    'asset-manifest.json': manifestPath,
    ...assetMap,
  },
};

writeFileSync(configPath, `${JSON.stringify(seaConfig, null, 2)}\n`);

run(process.execPath, ['--experimental-sea-config', configPath]);

const outputPath = path.join(distDir, outputNameFor(process.platform, process.arch));
copyFileSync(process.execPath, outputPath);
chmodSync(outputPath, 0o755);

if (process.platform === 'darwin') {
  run('codesign', ['--remove-signature', outputPath]);
}

const postjectArgs = [
  '--yes',
  'postject',
  outputPath,
  'NODE_SEA_BLOB',
  blobPath,
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
];

if (process.platform === 'darwin') {
  postjectArgs.push('--macho-segment-name', 'NODE_SEA');
}

runPostject(postjectArgs);

if (process.platform === 'darwin') {
  run('codesign', ['--sign', '-', outputPath]);
}

console.log(`Built ${outputPath}`);
