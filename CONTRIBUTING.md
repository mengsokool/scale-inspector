# Contributing

Thank you for contributing to Scale Inspector.

## Development Setup

Requirements:

- Node.js
- npm

Install dependencies:

```bash
npm install
```

Build the executable for the current platform:

```bash
npm run build
```

Run from source:

```bash
npm start -- --help
```

## Project Scope

This project focuses on inspecting serial output from scales and similar RS-232 or USB-serial devices.

Changes that are generally welcome:

- serial port detection improvements
- baud and framing detection improvements
- clearer diagnostics and monitoring output
- packaging and release workflow fixes
- documentation improvements

## Pull Requests

When opening a pull request:

- describe the device or adapter used for testing when relevant
- include the serial settings used during verification if they matter
- mention any platform-specific behavior that changed

## Releases

Releases are published from Git tags:

```bash
git tag v1.0.9
git push --tags
```

GitHub Actions builds release binaries for Windows, macOS, and Linux, then attaches them to the GitHub Release.
