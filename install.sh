#!/usr/bin/env bash
# install.sh — HP-06 Scale Inspector installer for Linux/macOS
# Usage: curl -fsSL https://github.com/mengsokool/scale-inspector/releases/latest/download/install.sh | bash

set -e

REPO="mengsokool/scale-inspector"
SYSTEM_DEST="/usr/local/bin/scale-inspector"
LOCAL_BIN="$HOME/.local/bin"
LOCAL_DEST="$LOCAL_BIN/scale-inspector"

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

URL="${SCALE_INSPECTOR_RELEASE_URL:-https://github.com/$REPO/releases/latest/download/$BINARY}"
API_URL="${SCALE_INSPECTOR_RELEASE_API_URL:-https://api.github.com/repos/$REPO/releases/latest}"

pick_target() {
  if [ -x "$SYSTEM_DEST" ] || [ -f "${SYSTEM_DEST}.version" ]; then
    DEST="$SYSTEM_DEST"
    DEST_SCOPE="system"
    return
  fi

  if [ -x "$LOCAL_DEST" ] || [ -f "${LOCAL_DEST}.version" ]; then
    DEST="$LOCAL_DEST"
    DEST_SCOPE="local"
    return
  fi

  if [ -w "/usr/local/bin" ] || command -v sudo >/dev/null 2>&1; then
    DEST="$SYSTEM_DEST"
    DEST_SCOPE="system"
  else
    DEST="$LOCAL_DEST"
    DEST_SCOPE="local"
  fi
}

install_file() {
  src="$1"
  version="$2"
  if [ "$DEST_SCOPE" = "system" ]; then
    if [ -w "/usr/local/bin" ]; then
      mkdir -p "$(dirname "$DEST")"
      install -m 755 "$src" "$DEST"
      if [ -n "$version" ]; then
        printf '%s\n' "$version" > "${DEST}.version"
      else
        rm -f "${DEST}.version"
      fi
    else
      sudo mkdir -p "$(dirname "$DEST")"
      sudo install -m 755 "$src" "$DEST"
      if [ -n "$version" ]; then
        printf '%s\n' "$version" | sudo tee "${DEST}.version" >/dev/null
      else
        sudo rm -f "${DEST}.version"
      fi
    fi
  else
    mkdir -p "$LOCAL_BIN"
    install -m 755 "$src" "$DEST"
    if [ -n "$version" ]; then
      printf '%s\n' "$version" > "${DEST}.version"
    else
      rm -f "${DEST}.version"
    fi
  fi
}

fetch_latest_version() {
  release_json=""
  if command -v curl >/dev/null 2>&1; then
    release_json="$(curl -fsSL "$API_URL" 2>/dev/null)" || return 1
  elif command -v wget >/dev/null 2>&1; then
    release_json="$(wget -qO- "$API_URL" 2>/dev/null)" || return 1
  else
    return 1
  fi

  printf '%s\n' "$release_json" | sed -nE 's/.*"tag_name"[[:space:]]*:[[:space:]]*"v?([^"]+)".*/\1/p' | head -n 1
}

pick_target
INSTALLED_VERSION=""
if [ -f "${DEST}.version" ]; then
  INSTALLED_VERSION="$(tr -d '\r\n' < "${DEST}.version")"
fi
LATEST_VERSION="$(fetch_latest_version || true)"

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   ⚖  HP-06 Scale Inspector  installer   ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""
echo "  OS: $OS / $ARCH"
echo "  Binary: $BINARY"
echo "  Target: $DEST"
if [ -n "$LATEST_VERSION" ]; then
  echo "  Latest: $LATEST_VERSION"
fi
echo ""

if [ -x "$DEST" ] && [ -n "$LATEST_VERSION" ] && [ "$INSTALLED_VERSION" = "$LATEST_VERSION" ]; then
    echo "  ✔ Already up to date ($LATEST_VERSION)"
    echo "  Reusing installed binary"
    echo ""
elif [ -x "$DEST" ] && [ -z "$LATEST_VERSION" ]; then
    echo "  ! Could not check GitHub version right now"
    echo "  Reusing installed binary"
    echo ""
else
    if [ -n "$LATEST_VERSION" ]; then
        echo "  Downloading version $LATEST_VERSION..."
    else
        echo "  Downloading latest release..."
    fi
    echo ""

    TMP="$(mktemp)"
    trap 'rm -f "$TMP"' EXIT INT TERM
    if command -v curl &>/dev/null; then
        curl -L -# "$URL" -o "$TMP"
    elif command -v wget &>/dev/null; then
        wget -O "$TMP" "$URL"
    else
        echo "✖ Need curl or wget" && exit 1
    fi

    chmod +x "$TMP"
    install_file "$TMP" "$LATEST_VERSION"
    rm -f "$TMP"
    trap - EXIT INT TERM

    echo "  ✔ Installed to $DEST"
fi

if [ "$DEST_SCOPE" = "local" ]; then
    export PATH="$LOCAL_BIN:$PATH"
    echo "  (Add $LOCAL_BIN to your PATH to use globally)"
    echo ""
fi

"$DEST" "$@"
