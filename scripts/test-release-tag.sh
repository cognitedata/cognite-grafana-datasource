#!/usr/bin/env bash
set -euo pipefail

check="$(cd "$(dirname "$0")" && pwd)/check-release-tag.sh"
repo=$(mktemp -d)
trap 'rm -rf "$repo"' EXIT
cd "$repo"
git init -q
git config user.name "Release Tests"
git config user.email "release-tests@example.invalid"
commit() {
  git add package.json
  git -c commit.gpgsign=false commit -qm "$1"
}
expect_rejection() {
  if bash "$check" "$1"; then
    echo "Unexpectedly accepted $1 ($2)" >&2
    exit 1
  fi
}

echo '{"version":"4.7.1"}' > package.json
commit hotfix
git update-ref refs/remotes/origin/master HEAD
bash "$check" v4.7.1
expect_rejection v4.7.2 "version mismatch"

echo '{"version":"4.8.0"}' > package.json
commit integration
expect_rejection v4.8.0 "integration-only commit"

echo '{"version":"4.8.0-rc.1"}' > package.json
commit candidate
git update-ref refs/remotes/origin/master HEAD
expect_rejection v4.8.0-rc.1 "prerelease tag"
