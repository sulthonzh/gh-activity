import { execSync } from "node:child_process";

/**
 * gh-activity — Show recent GitHub activity across your repos
 * Uses `gh` CLI, zero external deps.
 */

export function ghAvailable() {
  try {
    execSync("gh --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { user: null, days: 7, type: null, repo: null, json: false, markdown: false, limit: 30, help: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--user": opts.user = args[++i]; break;
      case "--days": { const d = parseInt(args[++i], 10); opts.days = Math.max(1, Number.isNaN(d) ? 7 : d); break; }
      case "--type": opts.type = args[++i]?.toLowerCase(); break;
      case "--repo": opts.repo = args[++i]; break;
      case "--limit": opts.limit = Math.max(1, parseInt(args[++i], 10) || 30); break;
      case "--json": opts.json = true; break;
      case "--markdown": opts.markdown = true; break;
      case "--help": case "-h": opts.help = true; break;
    }
  }
  return opts;
}

export const HELP = `gh-activity — Recent GitHub activity timeline

Usage:
  gh-activity                    Show last 7 days of activity
  gh-activity --days 30          Last 30 days
  gh-activity --repo owner/repo  Activity for one repo
  gh-activity --type push        Only pushes (push|pr|issue|release|star|fork|review)
  gh-activity --user octocat     Someone else's activity
  gh-activity --json             JSON output
  gh-activity --markdown         Markdown output
  gh-activity --limit 50         Show max 50 events (default 30)

Requires: gh CLI authenticated`;

export function fetchActivity(opts) {
  if (!ghAvailable()) throw new Error("gh CLI not found. Install: https://cli.github.com");

  const user = opts.user || execSync("gh api user -q .login", { encoding: "utf-8" }).trim();

  if (opts.repo) {
    return fetchRepoActivity(opts.repo, opts);
  }

  // Fetch user's public events
  const since = new Date(Date.now() - opts.days * 86400000).toISOString();
  const endpoint = `users/${user}/events?per_page=100`;

  let events;
  try {
    events = JSON.parse(execSync(`gh api "${endpoint}"`, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }));
  } catch (e) {
    throw new Error(`Failed to fetch events for ${user}: ${e.message}`);
  }

  // Filter by date
  events = events.filter(e => new Date(e.created_at) >= new Date(since));

  // Map to simplified format
  return events.map(e => ({
    type: mapEventType(e.type),
    repo: e.repo?.name || "",
    actor: e.actor?.login || user,
    payload: extractPayload(e),
    created_at: e.created_at,
  })).filter(e => e.type).slice(0, opts.limit);
}

function fetchRepoActivity(repo, opts) {
  const since = new Date(Date.now() - opts.days * 86400000).toISOString();
  const items = [];

  // Fetch commits
  if (!opts.type || opts.type === "push") {
    try {
      const commits = JSON.parse(execSync(
        `gh api "repos/${repo}/commits?per_page=50&since=${since}"`, { encoding: "utf-8", maxBuffer: 5 * 1024 * 1024 }
      ));
      for (const c of commits) {
        items.push({
          type: "push",
          repo,
          actor: c.author?.login || c.commit?.author?.name || "unknown",
          payload: { message: (c.commit?.message || "").split("\n")[0], sha: (c.sha || "").slice(0, 7) },
          created_at: c.commit?.author?.date || c.commit?.committer?.date,
        });
      }
    } catch {}
  }

  // Fetch PRs
  if (!opts.type || opts.type === "pr") {
    try {
      const prs = JSON.parse(execSync(
        `gh api "repos/${repo}/pulls?state=all&per_page=50&sort=updated&direction=desc"`, { encoding: "utf-8" }
      ));
      for (const p of prs) {
        if (new Date(p.updated_at) < new Date(since)) continue;
        items.push({
          type: "pr",
          repo,
          actor: p.user?.login || "unknown",
          payload: { number: p.number, title: p.title, state: p.state, action: p.merged_at ? "merged" : p.state },
          created_at: p.updated_at,
        });
      }
    } catch {}
  }

  // Fetch issues
  if (!opts.type || opts.type === "issue") {
    try {
      const issues = JSON.parse(execSync(
        `gh api "repos/${repo}/issues?state=all&per_page=50&sort=updated&direction=desc"`, { encoding: "utf-8" }
      ));
      for (const iss of issues) {
        if (iss.pull_request) continue; // skip PRs
        if (new Date(iss.updated_at) < new Date(since)) continue;
        items.push({
          type: "issue",
          repo,
          actor: iss.user?.login || "unknown",
          payload: { number: iss.number, title: iss.title, state: iss.state },
          created_at: iss.updated_at,
        });
      }
    } catch {}
  }

  // Fetch releases
  if (!opts.type || opts.type === "release") {
    try {
      const releases = JSON.parse(execSync(
        `gh api "repos/${repo}/releases?per_page=20"`, { encoding: "utf-8" }
      ));
      for (const r of releases) {
        if (new Date(r.published_at) < new Date(since)) continue;
        items.push({
          type: "release",
          repo,
          actor: r.author?.login || "unknown",
          payload: { tag: r.tag_name, name: r.name || r.tag_name },
          created_at: r.published_at,
        });
      }
    } catch {}
  }

  // Sort by date desc
  items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return items.slice(0, opts.limit);
}

function mapEventType(type) {
  const map = {
    PushEvent: "push",
    PullRequestEvent: "pr",
    IssuesEvent: "issue",
    ReleaseEvent: "release",
    WatchEvent: "star",
    ForkEvent: "fork",
    PullRequestReviewEvent: "review",
  };
  return map[type] || null;
}

function extractPayload(event) {
  const p = event.payload || {};
  switch (mapEventType(event.type)) {
    case "push":
      return { branch: (p.ref || "").replace("refs/heads/", ""), commits: p.size || 0, message: (p.commits?.[0]?.message || "").split("\n")[0] };
    case "pr":
      return { number: p.pull_request?.number, title: p.pull_request?.title, action: p.action, state: p.pull_request?.merged ? "merged" : p.pull_request?.state };
    case "issue":
      return { number: p.issue?.number, title: p.issue?.title, action: p.action };
    case "release":
      return { tag: p.release?.tag_name, name: p.release?.name };
    case "star":
      return { action: "starred" };
    case "fork":
      return { forkee: p.forkee?.full_name };
    case "review":
      return { number: p.pull_request?.number, state: p.review?.state };
    default:
      return {};
  }
}

export function typeIcon(type) {
  const icons = { push: "⬆️", pr: "🔀", issue: "🐛", release: "📦", star: "⭐", fork: "🍴", review: "👀" };
  return icons[type] || "•";
}

export function formatDays(isoDate) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function formatText(events) {
  if (!events.length) return "No recent activity found.";

  const lines = [];
  let currentRepo = null;

  for (const e of events) {
    if (e.repo !== currentRepo) {
      currentRepo = e.repo;
      lines.push(`\n📁 ${currentRepo}`);
    }
    const icon = typeIcon(e.type);
    const time = formatDays(e.created_at);
    let detail = "";
    switch (e.type) {
      case "push": detail = `${e.payload.branch || "main"} (+${e.payload.commits} commits) ${e.payload.message ? "— " + e.payload.message : ""}`; break;
      case "pr": detail = `#${e.payload.number || ""} ${e.payload.action || ""} — ${e.payload.title || ""}`; break;
      case "issue": detail = `#${e.payload.number || ""} ${e.payload.action || ""} — ${e.payload.title || ""}`; break;
      case "release": detail = `${e.payload.tag || ""} ${e.payload.name || ""}`; break;
      case "star": detail = "starred"; break;
      case "fork": detail = `→ ${e.payload.forkee || ""}`; break;
      case "review": detail = `#${e.payload.number || ""} ${e.payload.state || ""}`; break;
    }
    lines.push(`  ${icon} ${detail.trim()}  ${time}`);
  }

  return lines.join("\n").trim();
}

export function formatJSON(events) {
  return JSON.stringify(events, null, 2);
}

export function formatMarkdown(events) {
  if (!events.length) return "_No recent activity found._";
  const lines = ["# GitHub Activity\n"];
  let currentRepo = null;
  for (const e of events) {
    if (e.repo !== currentRepo) {
      currentRepo = e.repo;
      lines.push(`\n## ${currentRepo}\n`);
    }
    const time = formatDays(e.created_at);
    let detail = "";
    switch (e.type) {
      case "push": detail = `Pushed ${e.payload.commits} commit(s) to \`${e.payload.branch || "main"}\` — ${e.payload.message || ""}`; break;
      case "pr": detail = `PR #${e.payload.number} ${e.payload.action} — ${e.payload.title}`; break;
      case "issue": detail = `Issue #${e.payload.number} ${e.payload.action} — ${e.payload.title}`; break;
      case "release": detail = `Released \`${e.payload.tag}\`${e.payload.name ? " " + e.payload.name : ""}`; break;
      case "star": detail = "Starred"; break;
      case "fork": detail = `Forked → ${e.payload.forkee}`; break;
      case "review": detail = `Reviewed PR #${e.payload.number} (${e.payload.state})`; break;
    }
    lines.push(`- ${detail} — ${time}`);
  }
  return lines.join("\n").trim();
}
