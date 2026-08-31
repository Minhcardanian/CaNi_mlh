#!/usr/bin/env bash
set -euo pipefail

readonly max_text_bytes=$((1024 * 1024))
readonly max_file_bytes=$((5 * 1024 * 1024))
readonly forbidden_path_pattern='(^|/)(\.codex|\.claude|\.cursor|ai-artifacts|session-transcripts|docs/execution)(/|$)|(^|/)CLAUDE\.md$|(^|/)\.aider|\.chatlog$|(^|/)(node_modules|coverage|node-db|db-sync|kupo-db|proof-params|proof-cache)(/|$)|(^|/)\.env($|\.)'
status_before=$(git status --porcelain=v1)

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

mapfile -t lockfiles < <(git ls-files | grep -E '(^|/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$' || true)
declare -A lockfile_count_by_directory=()
for lockfile in "${lockfiles[@]}"; do
  directory=${lockfile%/*}
  if [[ $directory == "$lockfile" ]]; then
    directory=.
  fi
  if [[ ! -f $directory/package.json ]]; then
    printf 'HYG-006 FAIL lockfile has no package manifest: %s\n' "$lockfile" >&2
    exit 1
  fi
  lockfile_count_by_directory[$directory]=$(( ${lockfile_count_by_directory[$directory]:-0} + 1 ))
done

for directory in "${!lockfile_count_by_directory[@]}"; do
  if (( lockfile_count_by_directory[$directory] > 1 )); then
    printf 'HYG-008 FAIL competing lockfiles in package boundary: %s\n' "$directory" >&2
    exit 1
  fi
done

if git ls-files | grep -Eq '(^|/)(generated(/|$)|plutus\.json$)' && [[ ! -x scripts/check-generated.sh ]]; then
  printf 'HYG-007 FAIL committed generated output lacks a reproducibility check\n' >&2
  exit 1
fi

test -r README.md
bash -n scripts/check-hygiene.sh

gitleaks_bin=${GITLEAKS_BIN:-gitleaks}
if ! command -v "$gitleaks_bin" >/dev/null 2>&1; then
  printf 'HYG-003 FAIL gitleaks is not available\n' >&2
  exit 1
fi

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  "$gitleaks_bin" git --redact --no-banner --exit-code 1 .
fi
"$gitleaks_bin" dir --redact --no-banner --exit-code 1 .

status_after=$(git status --porcelain=v1)
if [[ $status_before != "$status_after" ]]; then
  printf 'HYG-010 FAIL hygiene checks changed the working tree\n' >&2
  exit 1
fi

printf 'HYG-001 PASS formatting and whitespace\n'
printf 'HYG-002 PASS forbidden tracked paths\n'
printf 'HYG-003 PASS secret scan\n'
printf 'HYG-004 PASS tracked file sizes\n'
printf 'HYG-005 PASS unexpected binary scan\n'
printf 'HYG-006 PASS manifest and lockfile consistency\n'
printf 'HYG-007 PASS generated artifact policy\n'
printf 'HYG-008 PASS package manager boundaries\n'
printf 'HYG-009 PASS public documentation smoke check\n'
printf 'HYG-010 PASS checks leave the working tree unchanged\n'
