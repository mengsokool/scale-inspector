#!/usr/bin/env node
/**
 * ┌─────────────────────────────────────────┐
 * │   HP-06 Scale Inspector  •  Dev Tool    │
 * │ Scan ports, detect serial settings live │
 * └─────────────────────────────────────────┘
 *
 * Built as a standalone executable via Node SEA — no Node/npm needed on target machine.
 *
 * Optional flags:
 *   scale-inspector.exe --port COM3
 *   scale-inspector.exe --port COM3 --mode 7E1
 *   scale-inspector.exe --port COM3 --baud 9600
 */

import { SerialPort } from 'serialport';
import readline from 'node:readline/promises';

// ─── Config ───────────────────────────────────────────────────────────────────
const BAUD_RATES   = [9600, 4800, 19200, 2400, 1200];
const SERIAL_MODES = [
  { name: '8N1', dataBits: 8, parity: 'none', stopBits: 1 },
  { name: '7E1', dataBits: 7, parity: 'even', stopBits: 1 },
];
const SCAN_TIMEOUT = 3000;
const DISPLAY_HEX  = true;
const RESCAN = Symbol('rescan');
// ──────────────────────────────────────────────────────────────────────────────

const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  white:   '\x1b[97m',
};
function c(color, text) { return `${C[color]}${text}${C.reset}`; }
function bold(text)      { return `${C.bold}${text}${C.reset}`; }
function failCli(message) {
  console.error(`\n  ${C.red}✖ ${message}${C.reset}\n`);
  process.exit(1);
}

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let argPort = null, argBaud = null, argMode = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port') {
    if (!args[i+1]) failCli('Missing value for --port.');
    argPort = args[++i];
    continue;
  }
  if (args[i] === '--baud') {
    if (!args[i+1]) failCli('Missing value for --baud.');
    argBaud = parseInt(args[++i]);
    continue;
  }
  if (args[i] === '--mode') {
    if (!args[i+1]) failCli('Missing value for --mode.');
    argMode = normalizeMode(args[++i]);
  }
}

if (argBaud !== null && (!Number.isInteger(argBaud) || argBaud <= 0)) {
  failCli('Invalid baud rate. Use a positive integer.');
}

if (argMode === false) {
  failCli('Invalid mode. Supported values: 8N1, 7E1.');
}

function printHeader() {
  console.clear();
  console.log();
  console.log(c('cyan', bold('  ╔══════════════════════════════════════════╗')));
  console.log(c('cyan', bold('  ║')) + c('white', bold('   ⚖  HP-06 Scale Inspector  •  Dev Mode  ')) + c('cyan', bold('║')));
  console.log(c('cyan', bold('  ╚══════════════════════════════════════════╝')));
  console.log();
}

function normalizeMode(value) {
  const normalized = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return SERIAL_MODES.some(mode => mode.name === normalized) ? normalized : false;
}

function getSerialMode(name) {
  return SERIAL_MODES.find(mode => mode.name === name);
}

function formatSerialMode(settings) {
  return settings.name || `${settings.dataBits}${settings.parity === 'none' ? 'N' : settings.parity[0].toUpperCase()}${settings.stopBits}`;
}

function formatAttempt(settings) {
  return `${settings.baudRate}/${formatSerialMode(settings)}`;
}

function scorePort(port) {
  const path = (port.path || '').toLowerCase();
  const manufacturer = (port.manufacturer || '').toLowerCase();
  let score = 0;

  if (/^com\d+$/i.test(port.path || '')) score += 80;
  if (path.startsWith('/dev/cu.')) score += 70;
  if (path.startsWith('/dev/ttyusb') || path.startsWith('/dev/ttyacm')) score += 70;
  if (/usbserial|usbmodem|ttyusb|ttyacm|serial/.test(path)) score += 55;
  if (manufacturer.includes('serial') || manufacturer.includes('prolific') || manufacturer.includes('ftdi') ||
      manufacturer.includes('ch340') || manufacturer.includes('silicon') || manufacturer.includes('cp210')) score += 35;
  if (port.vendorId) score += 20;
  if (/bluetooth|incoming-port|debug-console/.test(path)) score -= 120;
  if (path.startsWith('/dev/tty.')) score -= 10;

  return score;
}

async function listPorts() {
  const ports = await SerialPort.list();
  const ranked = ports
    .map((port, index) => ({ ...port, _score: scorePort(port), _index: index }))
    .sort((a, b) => b._score - a._score || a._index - b._index);
  const all = ranked.map(({ _score, _index, ...port }) => port);
  const candidates = ranked
    .filter(port => port._score > 0)
    .map(({ _score, _index, ...port }) => port);

  return { all, candidates };
}

async function promptForPort(ports, candidates) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Interactive port selection requires a terminal. Use --port <path> instead.');
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const answer = (await rl.question(
        `  ${c('cyan', '?')} Select port [1-${ports.length}], ${c('dim', 'r to rescan')}, or ${c('dim', 'q to quit')}: `,
      )).trim();

      if (/^q(?:uit)?$/i.test(answer)) {
        console.log();
        process.exit(0);
      }

      if (/^r(?:escan)?$/i.test(answer)) {
        console.log();
        return RESCAN;
      }

      const index = Number.parseInt(answer, 10);
      if (Number.isInteger(index) && index >= 1 && index <= ports.length) {
        const selected = ports[index - 1];
        const recommended = candidates.some(port => port.path === selected.path);
        console.log(`\n  ${c('green', '✔')} Selected: ${c('green', selected.path)}${recommended ? ` ${c('dim', '(recommended)')}` : ''}\n`);
        return selected.path;
      }

      console.log(`  ${c('yellow', '!')} Invalid selection. Choose ${bold(`1-${ports.length}`)}, ${bold('r')}, or ${bold('q')}.\n`);
    }
  } finally {
    rl.close();
  }
}

async function promptForRescan() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Interactive port selection requires a terminal. Use --port <path> instead.');
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const answer = (await rl.question(
        `  ${c('cyan', '?')} No ports found. Press ${c('dim', 'r to rescan')} or ${c('dim', 'q to quit')}: `,
      )).trim();

      if (/^q(?:uit)?$/i.test(answer)) {
        console.log();
        process.exit(0);
      }

      if (/^r(?:escan)?$/i.test(answer)) {
        console.log();
        return RESCAN;
      }

      console.log(`  ${c('yellow', '!')} Invalid selection. Choose ${bold('r')} or ${bold('q')}.\n`);
    }
  } finally {
    rl.close();
  }
}

function printPortList(all, candidates) {
  console.log(`\n\n  ${c('green','✔')} Found ${all.length} port(s):\n`);
  all.forEach((p, index) => {
    const recommended = candidates.some(port => port.path === p.path);
    const flag = recommended ? c('green','★') : c('dim','○');
    const info = [p.manufacturer, p.vendorId ? `VID:${p.vendorId}` : ''].filter(Boolean).join('  ');
    console.log(`  ${flag}  ${c('dim', `[${String(index + 1).padStart(2, ' ')}]`)}  ${bold(p.path.padEnd(10))}  ${c('dim', info)}`);
  });
  console.log();
  if (candidates.length > 0) {
    console.log(`  ${c('dim','★ Recommended ports look like USB/serial adapters.')}\n`);
  }
}

function tryPortSettings(portPath, settings) {
  return new Promise((resolve) => {
    let buf = Buffer.alloc(0);
    const port = new SerialPort({
      path: portPath,
      baudRate: settings.baudRate,
      dataBits: settings.dataBits,
      parity: settings.parity,
      stopBits: settings.stopBits,
      autoOpen: false,
    });

    const cleanup = (result) => {
      if (port.isOpen) port.close(() => resolve(result));
      else resolve(result);
    };

    const timer = setTimeout(() =>
      cleanup({ success: false, reason: 'timeout', data: buf }), SCAN_TIMEOUT);

    port.open((err) => {
      if (err) { clearTimeout(timer); return cleanup({ success: false, reason: err.message, data: buf }); }
      port.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        if (buf.length >= 8) { clearTimeout(timer); cleanup({ success: true, data: buf }); }
      });
      port.on('error', (err) => { clearTimeout(timer); cleanup({ success: false, reason: err.message, data: buf }); });
    });
  });
}

function parseScaleData(raw) {
  const text  = raw.toString('ascii').replace(/[\x00-\x08\x0e-\x1f\x7f]/g, '?');
  const lines = text.split(/[\r\n]+/).filter(l => l.trim());
  return lines.map(line => {
    const m = line.match(/([+-]?\s*[\d,]+\.?\d*)\s*(kg|KG|lb|LB|g|t|T)?/);
    if (m) {
      const weight = parseFloat(m[1].replace(/[,\s]/g, ''));
      return { raw: line.trim(), weight, unit: m[2] || 'kg', valid: !isNaN(weight) };
    }
    return { raw: line.trim(), weight: null, unit: null, valid: false };
  });
}

function hexDump(buf) {
  const lines = [];
  for (let i = 0; i < buf.length; i += 16) {
    const slice = buf.slice(i, i + 16);
    const hex   = [...slice].map(b => b.toString(16).padStart(2,'0')).join(' ');
    const ascii = [...slice].map(b => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : '.').join('');
    lines.push(`  ${c('dim', i.toString(16).padStart(4,'0'))}  ${c('yellow', hex.padEnd(47))}  ${c('green', ascii)}`);
  }
  return lines.join('\n');
}

function startMonitor(portPath, settings) {
  console.log();
  console.log(c('cyan', '  ╔══════════════════════════════════════════╗'));
  console.log(c('cyan', '  ║') + bold('          📡  LIVE MONITOR MODE           ') + c('cyan', '║'));
  console.log(c('cyan', '  ╚══════════════════════════════════════════╝'));
  console.log(`\n  ${c('dim','Port')}  ${c('green', portPath)}   ${c('dim','Baud')}  ${c('green', String(settings.baudRate))}   ${c('dim','Mode')}  ${c('green', formatSerialMode(settings))}`);
  console.log(`  ${c('dim','Press Ctrl+C to exit')}\n`);
  console.log('  ' + '─'.repeat(58));

  const port = new SerialPort({
    path: portPath,
    baudRate: settings.baudRate,
    dataBits: settings.dataBits,
    parity: settings.parity,
    stopBits: settings.stopBits,
  });
  let lineBuf = '', pktCount = 0;

  port.on('open', () => console.log(`  ${c('green','●')} Port opened\n`));

  port.on('data', (chunk) => {
    lineBuf += chunk.toString('binary');
    const parts = lineBuf.split(/\r?\n/);
    lineBuf = parts.pop();

    for (const line of parts) {
      if (!line.trim()) continue;
      pktCount++;
      const ts  = new Date().toLocaleTimeString('en-GB', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits:3 });
      const raw = Buffer.from(line, 'binary');
      const parsed = parseScaleData(raw);

      console.log(`  ${c('dim','#'+String(pktCount).padStart(4,'0'))}  ${c('dim', ts)}`);
      console.log(`  ${c('cyan','RAW')}   ${line.replace(/[^\x20-\x7e]/g, c('red','·'))}`);
      if (DISPLAY_HEX) {
        const hex = [...raw].map(b => b.toString(16).padStart(2,'0')).join(' ');
        console.log(`  ${c('dim','HEX')}   ${c('yellow', hex)}`);
      }
      for (const p of parsed) {
        if (p.valid) {
          const bar = '█'.repeat(Math.min(Math.round(Math.abs(p.weight)/1000), 20));
          console.log(`  ${c('green','⚖ ')}   ${bold(c('white', p.weight.toLocaleString()))} ${c('green', p.unit)}   ${c('dim', bar)}`);
        } else {
          console.log(`  ${c('dim','---')}  ${c('dim', p.raw)}`);
        }
      }
      console.log('  ' + c('dim','─'.repeat(58)));
    }
  });

  port.on('error', (err) => console.error(`\n  ${c('red','✖')} Error: ${err.message}`));
  process.on('SIGINT', () => {
    console.log(`\n\n  ${c('yellow','⏹')}  Closed. Total packets: ${pktCount}`);
    port.close(() => process.exit(0));
  });
}

async function main() {
  printHeader();

  // ── Port ──────────────────────────────────────────────────────────────────
  let portPath = argPort;
  if (!portPath) {
    while (!portPath) {
      process.stdout.write(`  ${c('cyan','→')} Scanning serial ports...`);
      const { all, candidates } = await listPorts();
      if (all.length === 0) {
        console.log(`\n\n  ${c('yellow','!')} No serial ports found.\n`);
        const action = await promptForRescan();
        if (action === RESCAN) {
          continue;
        }
      }

      printPortList(all, candidates);
      const selection = await promptForPort(all, candidates);
      if (selection === RESCAN) {
        continue;
      }
      portPath = selection;
    }
  } else {
    console.log(`  ${c('dim','Port:')} ${c('green', portPath)}  ${c('dim','(--port flag)')}\n`);
  }

  // ── Baud ──────────────────────────────────────────────────────────────────
  let selectedSettings = null;
  if (argBaud !== null && argMode) {
    selectedSettings = { ...getSerialMode(argMode), baudRate: argBaud };
    console.log(`  ${c('dim','Baud:')} ${c('green', String(selectedSettings.baudRate))}  ${c('dim','(--baud flag)')}`);
    console.log(`  ${c('dim','Mode:')} ${c('green', formatSerialMode(selectedSettings))}  ${c('dim','(--mode flag)')}\n`);
  } else {
    const bauds = argBaud !== null ? [argBaud] : BAUD_RATES;
    const modes = argMode ? [getSerialMode(argMode)] : SERIAL_MODES;
    const attempts = bauds.flatMap(baudRate => modes.map(mode => ({ ...mode, baudRate })));

    console.log(`  ${c('cyan','→')} Auto-detecting serial settings...`);
    console.log(`  ${c('dim',`  Testing: ${attempts.map(formatAttempt).join(' → ')}`)}\n`);

    for (const settings of attempts) {
      process.stdout.write(`  ${c('dim','  Testing')} ${String(settings.baudRate).padEnd(6)} ${formatSerialMode(settings).padEnd(4)} ... `);
      const result = await tryPortSettings(portPath, settings);
      if (result.success) {
        selectedSettings = settings;
        console.log(c('green', `✔  got ${result.data.length} bytes`));
        console.log(`\n  ${c('green','✔')} Serial settings: ${bold(c('white', formatAttempt(settings)))}\n`);
        console.log(`  ${c('dim','First bytes received:')}`);
        console.log(hexDump(result.data.slice(0, 32)));
        console.log();
        break;
      } else {
        console.log(result.reason === 'timeout' ? c('dim','timeout') : c('red', result.reason.slice(0,30)));
      }
    }
    if (!selectedSettings) {
      console.log(`\n  ${c('red','✖')} No data on any tested serial settings.\n`);
      console.log(`  ${c('yellow','Hints:')}`);
      console.log(`    • Check cable (straight vs null modem)`);
      console.log(`    • HP-06 Stream mode: F-01 = 3`);
      console.log(`    • HP-06 serial mode: F-03 = 1 (7E1) or 0 (8N1)`);
      console.log(`    • Try pressing [PRINT] on the scale`);
      console.log();
      process.exit(1);
    }
  }

  await new Promise(r => setTimeout(r, 400));
  startMonitor(portPath, selectedSettings);
}

main().catch(err => {
  console.error(`\n  ${C.red}✖ Fatal: ${err.message}${C.reset}\n`);
  process.exit(1);
});
