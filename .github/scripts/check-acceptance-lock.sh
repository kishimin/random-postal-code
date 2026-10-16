#!/usr/bin/env bash
# The acceptance-test lock (ADR-0067). An acceptance test is fixed before
# the implementation is written, so a pull request may add one and must not
# change one. Comparing against the merge base catches an edit that was
# committed, which a working-tree check cannot see.
#
# One exception: when a human has approved rewriting a committed acceptance
# test on its Issue (ADR-0062's unlock, ADR-0079), the pull request carries
# the atdd-unlock-approved label and the caller sets ATDD_UNLOCK_APPROVED=true.
# Then modifications pass, listed in a notice so the approval is never
# silent. Deleting or renaming an acceptance test, or changing its type
# (T: replacing the file with a symlink or a submodule, which can point the
# test anywhere), is refused even then: the approval is to strengthen a
# test, never to drop or redirect one.
#
# Usage: ATDD_UNLOCK_APPROVED=true|false check-acceptance-lock.sh <merge-base>
set -euo pipefail

base="$1"
changed=$(git diff --diff-filter=MDRT --name-only "$base"..HEAD -- acceptance/)

if [ -z "$changed" ]; then
  echo "No acceptance test was modified."
  exit 0
fi

removed=$(git diff --diff-filter=DRT --name-only "$base"..HEAD -- acceptance/)

if [ -n "$removed" ]; then
  echo "::error::An acceptance test was deleted, renamed, or replaced by a symlink or submodule. No approval allows that:"
  echo "$removed"
  exit 1
fi

if [ "${ATDD_UNLOCK_APPROVED:-false}" = "true" ]; then
  echo "::notice::Approved acceptance-test change (label atdd-unlock-approved):"
  echo "$changed"
  exit 0
fi

echo "::error::An acceptance test was modified:"
echo "$changed"
echo "If a human approved this on the Issue, label the pull request atdd-unlock-approved."
exit 1
