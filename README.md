# Scale Inspector

Scale Inspector is a cross-platform command-line utility for inspecting serial output from scales and other RS-232 or USB-serial devices. It helps identify the correct port, baud rate, and framing mode, then shows the live stream in raw, hex, and parsed forms.

## Features

- Interactive serial port selection with rescan support
- Automatic detection of common serial settings, ranked by payload quality
- Manual baud rate and framing selection when auto-detection is not enough
- Live monitor output with raw text, hex bytes, and parsed weight values
- Single-binary releases for Windows, macOS, and Linux
- Installers that reuse the local binary when it is already up to date

## Installation

### Windows (PowerShell)

```powershell
irm https://github.com/mengsokool/scale-inspector/releases/latest/download/install.ps1 | iex
```

### Linux / macOS (bash)

```bash
curl -fsSL https://github.com/mengsokool/scale-inspector/releases/latest/download/install.sh | bash
```

The installer detects the current platform, checks the installed version, and only downloads a new binary when needed.

## Usage

```text
scale-inspector.exe
scale-inspector.exe --manual
scale-inspector.exe --version
scale-inspector.exe --port COM3
scale-inspector.exe --port COM3 --mode 7E1
scale-inspector.exe --port COM3 --baud 2400 --mode 8N1
```

Default flow:

- Select a serial port from the interactive list
- Press `Enter` to continue with auto-detection
- Type `m` to switch to manual baud and mode selection
- Type `r` to rescan ports
- Type `q` to quit

When multiple baud or framing combinations return data, Scale Inspector can ask for confirmation instead of assuming the first result is correct.

## Device Notes

Scale Inspector is not tied to a specific vendor or indicator model. It works best with devices that emit readable serial data continuously or on demand.

Example configuration for a Commandor HP-06 running in stream mode:

| Function | Setting | Recommended value |
|----------|---------|-------------------|
| F-01     | Output  | `3` (`Stream mode`) |
| F-02     | Baud    | `4` (`9600`) |
| F-03     | Parity  | `1` (`7E1`) or `0` (`8N1`) |

## Build From Source

Requirements:

- Node.js
- npm

```bash
npm install
npm run build
```

The build step pins Node.js `22.16.0` for SEA packaging so local output matches CI.

## Release

```bash
git tag v1.0.9
git push --tags
```

GitHub Actions builds release binaries for Windows, macOS, and Linux, then publishes them as GitHub Release assets.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, scope, and release notes.

## License

This project is licensed under the [MIT License](./LICENSE).

## Troubleshooting

| Symptom | Notes |
|---------|-------|
| No serial ports found | Check drivers, USB adapters, and cable connections |
| No data at any baud | Check cable type, device transmit mode, or trigger a print/send action on the device |
| Garbled output | Baud rate or framing mode is likely incorrect |
| Auto-detection picks the wrong baud | Use `--manual` or pass `--baud` and `--mode` explicitly |
| No continuous stream | Enable stream/continuous transmit mode on the device if available |
