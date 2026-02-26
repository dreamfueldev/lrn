#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
echo "Building lrn v${VERSION}..."

TARGETS=(
  "bun-darwin-arm64:lrn-darwin-arm64"
  "bun-darwin-x64:lrn-darwin-x64"
  "bun-linux-x64:lrn-linux-x64"
  "bun-linux-arm64:lrn-linux-arm64"
  "bun-windows-x64:lrn-windows-x64.exe"
)

rm -rf dist
mkdir -p dist

for entry in "${TARGETS[@]}"; do
  target="${entry%%:*}"
  name="${entry##*:}"
  echo "Building ${name} (${target})..."
  bun build src/index.ts --compile --target="$target" \
    --define "process.env.LRN_VERSION=\"${VERSION}\"" \
    --outfile "dist/$name"
done

echo "Generating checksums..."
cd dist
rm -f checksums.txt
for entry in "${TARGETS[@]}"; do
  name="${entry##*:}"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$name" >> checksums.txt
  else
    shasum -a 256 "$name" >> checksums.txt
  fi
done
cd ..

echo ""
echo "Build complete. Checksums:"
cat dist/checksums.txt
