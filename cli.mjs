#!/usr/bin/env node
import { parseArgs, HELP, fetchActivity, formatText, formatJSON, formatMarkdown } from "./src/index.mjs";

const opts = parseArgs(process.argv);

if (opts.help) {
  console.log(HELP);
  process.exit(0);
}

try {
  const events = fetchActivity(opts);

  if (opts.json) {
    console.log(formatJSON(events));
  } else if (opts.markdown) {
    console.log(formatMarkdown(events));
  } else {
    console.log(formatText(events));
  }

  process.exit(0);
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(2);
}
