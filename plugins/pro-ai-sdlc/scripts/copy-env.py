#!/usr/bin/env python3
"""Copy the main checkout's git-ignored env files into a new worktree for /execute.

  python3 copy-env.py <main checkout> <worktree>

Copies only files git ignores in the main checkout whose name is .env, .env.*,
.dev.vars or .dev.vars.*, at any depth outside node_modules. A path the worktree
tracks or already has is left alone. Every copy must be ignored in the worktree
too; if one is not, all copies made by this run are removed and the run stops.
Never prints, logs or reads file contents: output is relative paths only.
Exit 0 on success (prints "none" when there is nothing to copy), 1 on bad
arguments, 2 when a copy would not be ignored in the worktree.
"""
import os
import shutil
import subprocess
import sys

PATTERNS = (":(glob)**/.env", ":(glob)**/.env.*", ":(glob)**/.dev.vars", ":(glob)**/.dev.vars.*")


def git(top, *args):
    return subprocess.run(["git", "-C", top, *args], capture_output=True, text=True, timeout=120)


def toplevel(path):
    return git(path, "rev-parse", "--show-toplevel").stdout.strip() if os.path.isdir(path) else ""


def main():
    if len(sys.argv) != 3:
        print("usage: copy-env.py <main checkout> <worktree>", file=sys.stderr)
        sys.exit(1)
    src, dst = toplevel(sys.argv[1]), toplevel(sys.argv[2])
    if not src or not dst:
        print("copy-env: both arguments must be git checkouts", file=sys.stderr)
        sys.exit(1)
    if os.path.realpath(src) == os.path.realpath(dst):
        print("copy-env: the worktree is the main checkout", file=sys.stderr)
        sys.exit(1)

    listed = git(src, "ls-files", "--others", "--ignored", "--exclude-standard", "-z", "--", *PATTERNS)
    candidates = sorted(p for p in listed.stdout.split("\0") if p and "node_modules" not in p.split("/"))
    if not candidates:
        print("none")
        return

    copied, kept = [], []
    for rel in candidates:
        target = os.path.join(dst, rel)
        if git(dst, "ls-files", "--error-unmatch", "--", rel).returncode == 0 or os.path.lexists(target):
            kept.append(rel)
            continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copy2(os.path.join(src, rel), target)
        copied.append(rel)

    exposed = [rel for rel in copied if git(dst, "check-ignore", "-q", "--", rel).returncode != 0]
    if exposed:
        for rel in copied:
            try:
                os.remove(os.path.join(dst, rel))
            except OSError:
                pass
        print(f"copy-env: not ignored in the worktree: {', '.join(exposed)}", file=sys.stderr)
        print(f"copy-env: removed all {len(copied)} copies; add the ignore rule on the default branch first", file=sys.stderr)
        sys.exit(2)

    for rel in copied:
        print(f"copied {rel}")
    for rel in kept:
        print(f"kept {rel} (already in the worktree)")


if __name__ == "__main__":
    main()
