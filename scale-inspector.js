#!/usr/bin/env node
/**
 * ┌─────────────────────────────────────────┐
 * │   HP-06 Scale Inspector  •  Dev Tool    │
 * │   Auto-scan port + baud, show raw data  │
 * └─────────────────────────────────────────┘
 *
 * Built as single .exe via Bun — no Node/npm needed on target machine.
 *
 * Optional flags:
 *   scale-inspector.exe --port COM3
 *   scale-inspector.exe --port COM3 --baud 9600
 */

const { SerialPort } = require('serialport');

// ─── Config ───────────────────────────────────────────────────────────────────
const BAUD_RATES   = [9600, 4800, 19200, 2400, 1200];
const SCAN_TIMEOUT = 3000;
const DISPLAY_HEX  = true;
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

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let argPort = null, argBaud = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i+1]) argPort = args[++i];
  if (args[i] === '--baud' && args[i+1]) argBaud = parseInt(args[++i]);
}

function printHeader() {
  console.clear();
  console.log();
  console.log(c('cyan', bold('  ╔══════════════════════════════════════════╗')));
  console.log(c('cyan', bold('  ║')) + c('white', bold('   ⚖  HP-06 Scale Inspector  •  Dev Mode  ')) + c('cyan', bold('║')));
  console.log(c('cyan', bold('  ╚══════════════════════════════════════════╝')));
  console.log();
}

async function listPorts() {
  const ports = await SerialPort.list();
  const candidates = ports.filter(p => {
    const path = (p.path || '').toUpperCase();
    const mfr  = (p.manufacturer || '').toLowerCase();
    return (
      /COM\d+/.test(path) ||
      path.includes('TTYS') || path.includes('TTYUSB') ||
      mfr.includes('serial') || mfr.includes('prolific') ||
      mfr.includes('ftdi') || mfr.includes('ch340') ||
      mfr.includes('silicon') || p.vendorId
    );
  });
  return { all: ports, candidates };
}

function tryPortBaud(portPath, baud) {
  return new Promise((resolve) => {
    let buf = Buffer.alloc(0);
    const port = new SerialPort({
      path: portPath,
      baudRate: baud,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
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

function startMonitor(portPath, baud) {
  console.log();
  console.log(c('cyan', '  ╔══════════════════════════════════════════╗'));
  console.log(c('cyan', '  ║') + bold('          📡  LIVE MONITOR MODE           ') + c('cyan', '║'));
  console.log(c('cyan', '  ╚══════════════════════════════════════════╝'));
  console.log(`\n  ${c('dim','Port')}  ${c('green', portPath)}   ${c('dim','Baud')}  ${c('green', String(baud))}`);
  console.log(`  ${c('dim','Press Ctrl+C to exit')}\n`);
  console.log('  ' + '─'.repeat(58));

  const port = new SerialPort({ path: portPath, baudRate: baud, dataBits: 8, parity: 'none', stopBits: 1 });
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
    process.stdout.write(`  ${c('cyan','→')} Scanning serial ports...`);
    const { all, candidates } = await listPorts();
    if (all.length === 0) {
      console.log(`\n\n  ${c('red','✖')} No serial ports found.\n`); process.exit(1);
    }
    console.log(`\n\n  ${c('green','✔')} Found ${all.length} port(s):\n`);
    all.forEach(p => {
      const flag = candidates.includes(p) ? c('green','★') : c('dim','○');
      const info = [p.manufacturer, p.vendorId ? `VID:${p.vendorId}` : ''].filter(Boolean).join('  ');
      console.log(`  ${flag}  ${bold(p.path.padEnd(10))}  ${c('dim', info)}`);
    });
    console.log();
    portPath = (candidates[0] || all[0]).path;
    console.log(`  ${c('dim','Auto-selected:')} ${c('green', portPath)}\n`);
  } else {
    console.log(`  ${c('dim','Port:')} ${c('green', portPath)}  ${c('dim','(--port flag)')}\n`);
  }

  // ── Baud ──────────────────────────────────────────────────────────────────
  let baud = argBaud;
  if (!baud) {
    console.log(`  ${c('cyan','→')} Auto-detecting baud rate...`);
    console.log(`  ${c('dim',`  Testing: ${BAUD_RATES.join(' → ')}`)}\n`);
    for (const b of BAUD_RATES) {
      process.stdout.write(`  ${c('dim','  Testing')} ${String(b).padEnd(6)} ... `);
      const result = await tryPortBaud(portPath, b);
      if (result.success) {
        baud = b;
        console.log(c('green', `✔  got ${result.data.length} bytes`));
        console.log(`\n  ${c('green','✔')} Baud rate: ${bold(c('white', String(baud)))}\n`);
        console.log(`  ${c('dim','First bytes received:')}`);
        console.log(hexDump(result.data.slice(0, 32)));
        console.log();
        break;
      } else {
        console.log(result.reason === 'timeout' ? c('dim','timeout') : c('red', result.reason.slice(0,30)));
      }
    }
    if (!baud) {
      console.log(`\n  ${c('red','✖')} No data on any baud rate.\n`);
      console.log(`  ${c('yellow','Hints:')}`);
      console.log(`    • Check cable (straight vs null modem)`);
      console.log(`    • HP-06 Stream mode: F-01 = 3`);
      console.log(`    • Try pressing [PRINT] on the scale`);
      console.log();
      process.exit(1);
    }
  } else {
    console.log(`  ${c('dim','Baud:')} ${c('green', String(baud))}  ${c('dim','(--baud flag)')}\n`);
  }

  await new Promise(r => setTimeout(r, 400));
  startMonitor(portPath, baud);
}

main().catch(err => {
  console.error(`\n  ${C.red}✖ Fatal: ${err.message}${C.reset}\n`);
  process.exit(1);
});
