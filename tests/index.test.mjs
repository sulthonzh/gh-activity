import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseArgs, HELP, typeIcon, formatDays,
  formatText, formatJSON, formatMarkdown,
} from "../src/index.mjs";

// --- parseArgs ---
describe("parseArgs", () => {
  it("defaults", () => {
    const opts = parseArgs(["node", "cli"]);
    assert.equal(opts.days, 7);
    assert.equal(opts.limit, 30);
    assert.equal(opts.user, null);
    assert.equal(opts.repo, null);
    assert.equal(opts.type, null);
    assert.equal(opts.json, false);
    assert.equal(opts.markdown, false);
    assert.equal(opts.help, false);
  });

  it("parses --days --user --limit", () => {
    const opts = parseArgs(["node", "cli", "--days", "14", "--user", "octocat", "--limit", "50"]);
    assert.equal(opts.days, 14);
    assert.equal(opts.user, "octocat");
    assert.equal(opts.limit, 50);
  });

  it("parses --repo --type --json", () => {
    const opts = parseArgs(["node", "cli", "--repo", "foo/bar", "--type", "push", "--json"]);
    assert.equal(opts.repo, "foo/bar");
    assert.equal(opts.type, "push");
    assert.equal(opts.json, true);
  });

  it("--markdown", () => {
    assert.equal(parseArgs(["node", "cli", "--markdown"]).markdown, true);
  });

  it("-h and --help", () => {
    assert.equal(parseArgs(["node", "cli", "-h"]).help, true);
    assert.equal(parseArgs(["node", "cli", "--help"]).help, true);
  });

  it("clamps days to 1 minimum", () => {
    const opts = parseArgs(["node", "cli", "--days", "0"]);
    assert.equal(opts.days, 1);
  });

  it("clamps limit to 1 minimum", () => {
    const opts = parseArgs(["node", "cli", "--limit", "-5"]);
    assert.equal(opts.limit, 1);
  });

  it("defaults days on NaN", () => {
    const opts = parseArgs(["node", "cli", "--days", "abc"]);
    assert.equal(opts.days, 7);
  });
});

// --- HELP ---
describe("HELP", () => {
  it("is a non-empty string", () => {
    assert.ok(typeof HELP === "string" && HELP.length > 50);
  });
});

// --- typeIcon ---
describe("typeIcon", () => {
  it("returns icons for known types", () => {
    assert.equal(typeIcon("push"), "⬆️");
    assert.equal(typeIcon("pr"), "🔀");
    assert.equal(typeIcon("issue"), "🐛");
    assert.equal(typeIcon("release"), "📦");
    assert.equal(typeIcon("star"), "⭐");
    assert.equal(typeIcon("fork"), "🍴");
    assert.equal(typeIcon("review"), "👀");
  });

  it("returns bullet for unknown", () => {
    assert.equal(typeIcon("unknown"), "•");
  });
});

// --- formatDays ---
describe("formatDays", () => {
  it("just now", () => {
    assert.equal(formatDays(new Date().toISOString()), "just now");
  });

  it("minutes ago", () => {
    const d = new Date(Date.now() - 5 * 60000);
    assert.equal(formatDays(d.toISOString()), "5m ago");
  });

  it("hours ago", () => {
    const d = new Date(Date.now() - 3 * 3600000);
    assert.equal(formatDays(d.toISOString()), "3h ago");
  });

  it("days ago", () => {
    const d = new Date(Date.now() - 5 * 86400000);
    assert.equal(formatDays(d.toISOString()), "5d ago");
  });

  it("months ago", () => {
    const d = new Date(Date.now() - 90 * 86400000);
    assert.equal(formatDays(d.toISOString()), "3mo ago");
  });
});

// --- formatText ---
describe("formatText", () => {
  it("empty events", () => {
    assert.equal(formatText([]), "No recent activity found.");
  });

  it("formats push event", () => {
    const events = [{
      type: "push", repo: "foo/bar", actor: "me",
      payload: { branch: "main", commits: 3, message: "fix stuff" },
      created_at: new Date().toISOString(),
    }];
    const out = formatText(events);
    assert.ok(out.includes("foo/bar"));
    assert.ok(out.includes("main"));
    assert.ok(out.includes("fix stuff"));
  });

  it("groups by repo", () => {
    const events = [
      { type: "push", repo: "a/b", actor: "me", payload: { branch: "main", commits: 1 }, created_at: new Date().toISOString() },
      { type: "push", repo: "a/b", actor: "me", payload: { branch: "dev", commits: 1 }, created_at: new Date().toISOString() },
      { type: "issue", repo: "c/d", actor: "me", payload: { number: 1, title: "bug", action: "opened" }, created_at: new Date().toISOString() },
    ];
    const out = formatText(events);
    // "a/b" header should appear once
    assert.equal((out.match(/📁 a\/b/g) || []).length, 1);
    assert.ok(out.includes("c/d"));
  });
});

// --- formatJSON ---
describe("formatJSON", () => {
  it("returns valid JSON", () => {
    const events = [{ type: "push", repo: "x/y", payload: { commits: 1 }, created_at: new Date().toISOString() }];
    const parsed = JSON.parse(formatJSON(events));
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].type, "push");
  });

  it("empty array", () => {
    const parsed = JSON.parse(formatJSON([]));
    assert.equal(parsed.length, 0);
  });
});

// --- formatMarkdown ---
describe("formatMarkdown", () => {
  it("empty events", () => {
    const out = formatMarkdown([]);
    assert.ok(out.includes("No recent activity"));
  });

  it("formats events with headers", () => {
    const events = [
      { type: "pr", repo: "foo/bar", actor: "me", payload: { number: 42, action: "opened", title: "cool pr" }, created_at: new Date().toISOString() },
    ];
    const out = formatMarkdown(events);
    assert.ok(out.includes("# GitHub Activity"));
    assert.ok(out.includes("## foo/bar"));
    assert.ok(out.includes("#42"));
  });
});
