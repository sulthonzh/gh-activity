# gh-activity

See your recent GitHub activity timeline across all repos, right in the terminal.

## Why

GitHub's activity feed is buried in the web UI. When you come back after a weekend, you want to see what happened — commits, PRs, issues, releases — without clicking through 10 pages. This gives you a quick timeline.

Also useful for standups: `gh-activity --days 1` shows yesterday's work across all your repos.

## Install

```bash
npm install -g gh-activity
```

Requires [gh CLI](https://cli.github.com) authenticated (`gh auth login`).

## Usage

```bash
# Last 7 days (default)
gh-activity

# Yesterday's work (standup prep)
gh-activity --days 1

# Last month
gh-activity --days 30

# One repo
gh-activity --repo sulthonzh/my-project

# Only push events
gh-activity --type push

# Types: push, pr, issue, release, star, fork, review
gh-activity --type pr

# Someone else
gh-activity --user octocat

# JSON output
gh-activity --json

# Markdown (for docs/reports)
gh-activity --markdown

# More events
gh-activity --limit 100
```

## Output

Text (default):
```
📁 sulthonzh/my-app
  ⬆️ main (+3 commits) — fix login bug  2h ago
  🔀 #42 opened — Add dark mode  1d ago

📁 sulthonzh/oss-tool
  📦 v2.1.0  3d ago
  ⭐ starred  4d ago
```

## As a module

```js
import { fetchActivity, formatText } from "gh-activity";

const events = await fetchActivity({ days: 7, user: "octocat" });
console.log(formatText(events));
```

## Zero dependencies

Uses only Node.js built-ins and your existing `gh` auth. No API tokens to manage.

## License

MIT
