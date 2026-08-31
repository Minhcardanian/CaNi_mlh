#!/usr/bin/env bash
set -euo pipefail

readonly max_text_bytes=$((1024 * 1024))
readonly max_file_bytes=$((5 * 1024 * 1024))
readonly forbidden_path_pattern='(^|/)(\.codex|\.claude|\.cursor|ai-artifacts|session-transcripts)(/|$)|(^|/)CLAUDE\.md$|(^|/)\.aider|\.chatlog$|(^|/)(node_modules|coverage|node-db|db-sync|kupo-db|proof-params|proof-cache)(/|$)|(^|/)\.env($|\.)'

mapfile -d '' tracked_files < <(git ls-files -z)

for path in "${tracked_files[@]}"; do
  if [[ $path =~ $forbidden_path_pattern ]] && [[ $path != .env.example ]]; then
    printf 'HYG-002 FAIL forbidden tracked path: %s\n' "$path" >&2
    exit 1
  fi

  size=$(stat -c '%s' -- "$path")
  if (( size > max_file_bytes )); then
    printf 'HYG-004 FAIL tracked file exceeds 5 MiB: %s\n' "$path" >&2
    exit 1
  fi

  if (( size > max_text_bytes )) && grep -Iq . -- "$path"; then
    printf 'HYG-004 FAIL reviewable text exceeds 1 MiB: %s\n' "$path" >&2
    exit 1
  fi

  if ! grep -Iq . -- "$path" && [[ ! $path =~ \.(png|jpe?g|gif|webp|woff2?)$ ]]; then
    printf 'HYG-005 FAIL unexpected binary: %s\n' "$path" >&2
    exit 1
  fi
done

git diff --check

gitleaks_bin=${GITLEAKS_BIN:-gitleaks}
if ! command -v "$gitleaks_bin" >/dev/null 2>&1; then
  printf 'HYG-003 FAIL gitleaks is not available\n' >&2
  exit 1
fi

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  "$gitleaks_bin" git --redact --no-banner --exit-code 1 .
else
  "$gitleaks_bin" dir --redact --no-banner --exit-code 1 .
fi

printf 'HYG-001 PASS formatting and whitespace\n'
printf 'HYG-002 PASS forbidden tracked paths\n'
printf 'HYG-003 PASS secret scan\n'
printf 'HYG-004 PASS tracked file sizes\n'
printf 'HYG-005 PASS unexpected binary scan\n'
