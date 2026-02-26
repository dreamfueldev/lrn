#!/bin/sh
set -eu

# lrn installer for macOS and Linux
# Usage: curl -fsSL https://uselrn.dev/install | sh

REPO="dreamfueldev/lrn"
INSTALL_DIR="${LRN_INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="lrn"

# Colors (if terminal supports it)
if [ -t 1 ]; then
  BOLD="\033[1m"
  GREEN="\033[32m"
  RED="\033[31m"
  RESET="\033[0m"
else
  BOLD="" GREEN="" RED="" RESET=""
fi

info() { printf "${GREEN}>${RESET} %s\n" "$1"; }
error() { printf "${RED}error${RESET}: %s\n" "$1" >&2; exit 1; }

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Darwin) OS="darwin" ;;
  Linux)  OS="linux" ;;
  *)      error "Unsupported operating system: $OS" ;;
esac

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)             error "Unsupported architecture: $ARCH" ;;
esac

BINARY="lrn-${OS}-${ARCH}"

# Determine fetch command
if command -v curl >/dev/null 2>&1; then
  FETCH="curl -fsSL"
elif command -v wget >/dev/null 2>&1; then
  FETCH="wget -qO-"
else
  error "curl or wget is required"
fi

# Get latest version from GitHub API
info "Fetching latest release..."
LATEST_URL="https://api.github.com/repos/${REPO}/releases/latest"
VERSION=$(${FETCH} "$LATEST_URL" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\(.*\)".*/\1/')

if [ -z "$VERSION" ]; then
  error "Could not determine latest version"
fi

info "Installing lrn ${VERSION} (${OS}-${ARCH})..."

# Download binary and checksums
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY}"
CHECKSUM_URL="https://github.com/${REPO}/releases/download/${VERSION}/checksums.txt"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

${FETCH} "$DOWNLOAD_URL" > "${TMPDIR}/${BINARY}"
${FETCH} "$CHECKSUM_URL" > "${TMPDIR}/checksums.txt"

# Verify checksum
info "Verifying checksum..."
EXPECTED=$(grep "${BINARY}" "${TMPDIR}/checksums.txt" | awk '{print $1}')
if [ -z "$EXPECTED" ]; then
  error "Checksum not found for ${BINARY}"
fi

if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL=$(sha256sum "${TMPDIR}/${BINARY}" | awk '{print $1}')
elif command -v shasum >/dev/null 2>&1; then
  ACTUAL=$(shasum -a 256 "${TMPDIR}/${BINARY}" | awk '{print $1}')
else
  error "sha256sum or shasum is required for checksum verification"
fi

if [ "$EXPECTED" != "$ACTUAL" ]; then
  error "Checksum mismatch!\n  Expected: ${EXPECTED}\n  Actual:   ${ACTUAL}"
fi

# Install
info "Installing to ${INSTALL_DIR}..."
chmod +x "${TMPDIR}/${BINARY}"

if [ -w "$INSTALL_DIR" ]; then
  mv "${TMPDIR}/${BINARY}" "${INSTALL_DIR}/${BINARY_NAME}"
else
  sudo mv "${TMPDIR}/${BINARY}" "${INSTALL_DIR}/${BINARY_NAME}"
fi

# Verify installation
if command -v lrn >/dev/null 2>&1; then
  INSTALLED_VERSION=$(lrn --version 2>/dev/null || echo "unknown")
  info "lrn ${INSTALLED_VERSION} installed successfully!"
else
  info "lrn installed to ${INSTALL_DIR}/${BINARY_NAME}"
  if ! echo "$PATH" | tr ':' '\n' | grep -q "^${INSTALL_DIR}$"; then
    printf "\n${BOLD}Note:${RESET} ${INSTALL_DIR} is not in your PATH.\n"
    printf "Add it with: export PATH=\"${INSTALL_DIR}:\$PATH\"\n"
  fi
fi

printf "\n${BOLD}Next steps:${RESET}\n"
printf "  lrn --help          Show available commands\n"
printf "  lrn add stripe      Add a package\n"
printf "  lrn login           Connect to the registry\n"
printf "\n"
