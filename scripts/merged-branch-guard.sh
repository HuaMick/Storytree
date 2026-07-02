#!/usr/bin/env bash
# The merged-branch guard (ADR-0142): a branch is ONE landed unit — it dies on merge.
#
# The CI merge job machine-clears the merged branch's board state (presence retire + node_claim
# release, ADR-0138 cap D) keyed on the PR's head branch. A session that keeps working on the same
# branch after its PR merges is therefore ERASED from the map while actively working (the observed
# 2026-07-02 invisible-wisp failure), and branch reuse also feeds the stale-CONFLICTING /
# green-but-unmerged PR trap family. This step makes the fresh-branch discipline a GATE, not
# guidance: it fails any PR whose head branch already has a MERGED PR.
#
# CI-only (needs `gh` + the Actions token). FAIL-OPEN on tooling errors (gh/network) and FAIL-CLOSED
# only on a genuine reuse — a flaky API never blocks all merges (same contract as
# adr-pr-collision-check.sh).
#
# Env: GH_TOKEN (the Actions token), GITHUB_REPOSITORY (owner/repo), HEAD_REF (this PR's head branch).
set -uo pipefail

repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"
branch="${HEAD_REF:?HEAD_REF required}"

merged="$(gh pr list --repo "$repo" --head "$branch" --state merged --json number --jq '.[].number' 2>/dev/null)"
status=$?
if [ "$status" -ne 0 ]; then
  echo "warning: could not query merged PRs for head '$branch' (gh error) — failing open." >&2
  exit 0
fi

if [ -n "$merged" ]; then
  nums="$(echo "$merged" | sed 's/^/#/' | paste -sd', ' -)"
  echo "::error::Branch '$branch' already landed as merged PR ${nums} — a branch dies on merge (ADR-0142). Cut a fresh branch for this unit (git checkout -b claude/<new-name> && git push -u origin HEAD), open a new PR from it, and re-declare presence (storytree noticeboard declare --node <story> --pg) so the story claim re-lights on the fresh branch."
  exit 1
fi

echo "Head branch '$branch' has no merged PR — fresh unit, proceed."
exit 0
