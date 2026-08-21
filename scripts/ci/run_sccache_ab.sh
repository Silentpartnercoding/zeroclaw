#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
namespace="${2:-}"

case "$mode" in
  seed) rw_mode="READ_WRITE" ;;
  reader) rw_mode="READ_ONLY" ;;
  *) echo "usage: $0 <seed|reader> <namespace>" >&2; exit 2 ;;
esac

case "$namespace" in
  zeroclaw-pr10154-ab-github-v1|zeroclaw-pr10154-ab-blacksmith-v1) ;;
  *) echo "error: unexpected diagnostic namespace: $namespace" >&2; exit 2 ;;
esac

[[ -n "${ACTIONS_RESULTS_URL:-}" ]] || {
  echo "error: ACTIONS_RESULTS_URL is unavailable" >&2
  exit 1
}
[[ -n "${ACTIONS_RUNTIME_TOKEN:-}" ]] || {
  echo "error: ACTIONS_RUNTIME_TOKEN is unavailable" >&2
  exit 1
}

bash scripts/ci/install_sccache.sh

export SCCACHE_GHA_ENABLED=on
export SCCACHE_GHA_VERSION="$namespace"
export SCCACHE_GHA_RW_MODE="$rw_mode"
export SCCACHE_BASEDIRS="$GITHUB_WORKSPACE"
export RUSTC_WRAPPER=sccache
export CARGO_INCREMENTAL=0
export CARGO_TARGET_DIR="$RUNNER_TEMP/sccache-ab-target"

echo "sccache_ab_mode=$mode"
echo "sccache_ab_namespace=$namespace"
echo "sccache_ab_runner=${RUNNER_NAME:-unknown}"
echo "sccache_ab_results_scheme=${ACTIONS_RESULTS_URL%%:*}"

cargo fetch --locked
sccache --stop-server >/dev/null 2>&1 || true
sccache --zero-stats

SECONDS=0
cargo check --locked -p zeroclaw-runtime
duration_seconds=$SECONDS

echo "sccache_ab_duration_seconds=$duration_seconds"
sccache --show-stats
sccache --show-stats --stats-format=json
sccache --stop-server >/dev/null
