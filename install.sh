#!/usr/bin/env bash
# install.sh — HP-06 Scale Inspector installer for Linux/macOS
# Usage: curl -fsSL https://github.com/mengsokool/scale-inspector/releases/latest/download/install.sh | bash

set -e

REPO="mengsokool/scale-inspector"
DEST="/usr/local/bin/scale-inspector"

# ── Detect OS + arch ──────────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux*)
    case "$ARCH" in
      x86_64)  BINARY="scale-inspector-linux-x64" ;;
      aarch64) BINARY="scale-inspector-linux-arm64" ;;
      *)        echo "✖ Unsupported arch: $ARCH" && exit 1 ;;
    esac
    ;;
  Darwin*)
    case "$ARCH" in
      x86_64)  BINARY="scale-inspector-macos-x64" ;;
      arm64)   BINARY="scale-inspector-macos-arm64" ;;
      *)        echo "✖ Unsupported arch: $ARCH" && exit 1 ;;
    esac
    ;;
  *)
    echo "✖ Unsupported OS: $OS"
    exit 1
    ;;
esac

URL="https://github.com/$REPO/releases/latest/download/$BINARY"

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   ⚖  HP-06 Scale Inspector  installer   ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""
echo "  OS: $OS / $ARCH"
echo "  Binary: $BINARY"
echo "  Downloading..."
echo ""

# ── Download ──────────────────────────────────────────────────────────────────
TMP="$(mktemp)"
if command -v curl &>/dev/null; then
    curl -fsSL "$URL" -o "$TMP"
elif command -v wget &>/dev/null; then
    wget -qO "$TMP" "$URL"
else
    echo "✖ Need curl or wget" && exit 1
fi

chmod +x "$TMP"

# ── Install (try system-wide, fallback to ~/bin) ──────────────────────────────
if [ -w "/usr/local/bin" ] || sudo -n true 2>/dev/null; then
    sudo mv "$TMP" "$DEST" 2>/dev/null || mv "$TMP" "$DEST"
    echo "  ✔ Installed to $DEST"
    echo ""
    scale-inspector "$@"
else
    LOCAL_BIN="$HOME/.local/bin"
    mkdir -p "$LOCAL_BIN"
    mv "$TMP" "$LOCAL_BIN/scale-inspector"
    export PATH="$LOCAL_BIN:$PATH"
    echo "  ✔ Installed to $LOCAL_BIN/scale-inspector"
    echo "  (Add $LOCAL_BIN to your PATH to use globally)"
    echo ""
    "$LOCAL_BIN/scale-inspector" "$@"
fi
