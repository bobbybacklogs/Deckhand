---
description: Detect diffs and run add, commit, push, or pull with safe git defaults.
---

# Git sync

1. Call `git_status`. If clean, stop.
2. Summarize changes for the user.
3. On explicit sync: `git_add`, draft a conventional commit with `draft_commit_message`, then `git_commit`.
4. Push only when asked. If push needs an upstream, say so and use setUpstream.
5. Pull with fast-forward only.
