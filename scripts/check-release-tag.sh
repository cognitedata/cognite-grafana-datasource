#!/usr/bin/env bash
set -euo pipefail

tag=${1:?expected a release tag}
number='(0|[1-9][0-9]*)'
if ! [[ $tag =~ ^v${number}\.${number}\.${number}$ ]]; then
  echo "Expected a stable vMAJOR.MINOR.PATCH tag, got $tag" >&2
  exit 1
fi

version=$(node -p "require('./package.json').version")
if [[ $tag != "v$version" ]]; then
  echo "Tag $tag does not match package.json version $version" >&2
  exit 1
fi

if ! git merge-base --is-ancestor HEAD refs/remotes/origin/master; then
  echo "The tagged commit must be reachable from master" >&2
  exit 1
fi
