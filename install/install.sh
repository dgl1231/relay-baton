#!/usr/bin/env sh
set -eu

REPO="${RELAY_BATON_REPO:-dgl1231/relay-baton}"
INSTALL_DIR="${RELAY_BATON_INSTALL_DIR:-$HOME/.local/bin}"
TMP_DIR="${TMPDIR:-/tmp}/relay-baton-install.$$"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "relay-baton install: missing required command: $1" >&2
    exit 1
  }
}

need curl
need awk
need grep
need chmod

OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS:$ARCH" in
  Linux:x86_64|Linux:amd64) ASSET="relay-baton-linux-x64" ;;
  Darwin:arm64|Darwin:aarch64) ASSET="relay-baton-macos-arm64" ;;
  *)
    echo "relay-baton install: unsupported platform $OS/$ARCH" >&2
    echo "Supported: Linux x64, macOS Apple Silicon." >&2
    exit 1
    ;;
esac

mkdir -p "$TMP_DIR" "$INSTALL_DIR"
BASE="https://github.com/$REPO/releases/latest/download"
echo "Downloading $ASSET from $REPO latest release..."
curl -fsSL "$BASE/$ASSET" -o "$TMP_DIR/$ASSET"
curl -fsSL "$BASE/SHA256SUMS" -o "$TMP_DIR/SHA256SUMS"

EXPECTED="$(grep "  $ASSET\$" "$TMP_DIR/SHA256SUMS" | awk '{print $1}')"
if [ -z "$EXPECTED" ]; then
  echo "relay-baton install: SHA256SUMS does not contain $ASSET" >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL="$(sha256sum "$TMP_DIR/$ASSET" | awk '{print $1}')"
else
  need shasum
  ACTUAL="$(shasum -a 256 "$TMP_DIR/$ASSET" | awk '{print $1}')"
fi

if [ "$EXPECTED" != "$ACTUAL" ]; then
  echo "relay-baton install: checksum mismatch for $ASSET" >&2
  exit 1
fi

chmod +x "$TMP_DIR/$ASSET"
mv "$TMP_DIR/$ASSET" "$INSTALL_DIR/relay-baton"

echo "Installed relay-baton to $INSTALL_DIR/relay-baton"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo "Add this to your shell profile if needed:"
    echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
    ;;
esac
echo "Next: relay-baton --version"
