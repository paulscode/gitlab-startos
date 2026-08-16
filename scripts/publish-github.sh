#!/usr/bin/env bash
# Publish a built release to GitHub Releases, so users can sideload a specific
# version.
#
# This matters beyond convenience: when an update crosses GitLab's upgrade
# floor, the package tells the user to install a named older release and points
# them at the releases page. If that release is not published there, the
# instruction is a dead end.
#
# Deliberately manual. The checksum file is signed on an air-gapped machine, so
# the flow is: build here, carry SHA256SUMS off, sign it, bring back the
# signature, then run this. Automating it in CI would mean copying the StartOS
# developer key into GitHub, which this setup exists to avoid.
set -euo pipefail
cd "$(dirname "$0")/.."

BUILD_DIR="${1:?usage: publish-github.sh <build-dir> <tag>}"
TAG="${2:?usage: publish-github.sh <build-dir> <tag>}"

command -v gh >/dev/null || { echo "gh is not installed" >&2; exit 1; }

[ -d "$BUILD_DIR" ] || { echo "no such build directory: $BUILD_DIR" >&2; exit 1; }
SUMS="$BUILD_DIR/SHA256SUMS"
[ -f "$SUMS" ] || { echo "missing $SUMS -- run 'make release' first" >&2; exit 1; }

shopt -s nullglob
S9PKS=("$BUILD_DIR"/*.s9pk)
shopt -u nullglob
[ ${#S9PKS[@]} -gt 0 ] || { echo "no .s9pk in $BUILD_DIR" >&2; exit 1; }

# Re-verify rather than trust: the checksums were generated at build time and
# the files have since been carried around for signing.
echo "Verifying checksums..."
( cd "$BUILD_DIR" && sha256sum -c SHA256SUMS ) || {
  echo "checksum mismatch -- refusing to publish" >&2; exit 1; }

ASSETS=("${S9PKS[@]}" "$SUMS")

SIG=""
for candidate in "$SUMS.asc" "$SUMS.sig" "$SUMS.gpg"; do
  [ -f "$candidate" ] && { SIG="$candidate"; break; }
done
if [ -n "$SIG" ]; then
  ASSETS+=("$SIG")
  echo "Signature: $(basename "$SIG")"
else
  echo
  echo "WARNING: no detached signature next to SHA256SUMS."
  echo "Users verifying this release have nothing to check it against."
  echo
fi

# GitHub rejects any single asset over 2 GiB.
LIMIT=$((2 * 1024 * 1024 * 1024))
for f in "${ASSETS[@]}"; do
  size=$(stat -c %s "$f")
  if [ "$size" -ge "$LIMIT" ]; then
    echo "$(basename "$f") is $((size / 1024 / 1024)) MiB, over GitHub's 2 GiB asset limit" >&2
    exit 1
  fi
done

echo
echo "Tag:    $TAG"
echo "Assets:"
for f in "${ASSETS[@]}"; do
  printf '  %-40s %s\n' "$(basename "$f")" "$(du -h "$f" | cut -f1)"
done
echo
echo "This publishes publicly to $(gh repo view --json nameWithOwner -q .nameWithOwner)."
read -r -p "Proceed? [y/N] " ans
case "$ans" in [yY]*) ;; *) echo "Aborted."; exit 1 ;; esac

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG exists; uploading assets (use --clobber to replace)..."
  gh release upload "$TAG" "${ASSETS[@]}" --clobber
else
  gh release create "$TAG" "${ASSETS[@]}" \
    --title "$TAG" \
    --notes "Sideload the .s9pk matching your device's architecture. Verify with:

    sha256sum -c SHA256SUMS

\`SHA256SUMS\` covers every artifact in this release and is signed separately.

**aarch64 is untested.** It is built from upstream's official ARM image but has
not been run on ARM hardware, and GitLab documents outstanding issues on that
architecture. Take a backup before depending on it, and please report results.
The x86_64 build is tested.

Older releases stay available because GitLab limits how far an instance can
upgrade in one step; a long-dormant install may need one of them first."
fi

echo "Published: $(gh release view "$TAG" --json url -q .url)"
