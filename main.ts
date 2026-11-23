// Entry program for the make.fun bounty
// "post-x-the-agent-builds-a-game-from-20261122-1709" (program/v1, Node 22,
// standard library only, no network).
//
// The entry itself is the X post: its address lives in POST.json at the
// repository root, and the house reads the post (and its views, likes,
// reposts, quotes and replies) from X. All this program has to do is hand
// POST.json to the gate: copy it from the repository into /output.
//
// Run it locally the way the grader does, with the two directories
// redirected:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
// out/POST.json is then byte for byte this repository's POST.json.

import { copyFileSync, mkdirSync, readFileSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const SOURCE = join(BOT_DIR, 'POST.json');
const TARGET = join(OUTPUT_DIR, 'POST.json');

// Read first, so a malformed POST.json fails loudly instead of being
// copied blindly: the gate needs a JSON object with a string `url`.
const raw = readFileSync(SOURCE, 'utf8');
let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch {
  console.error(`POST.json is not valid JSON: ${SOURCE}`);
  process.exit(1);
}
if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
  console.error('POST.json must be a JSON object, e.g. {"url": "https://x.com/<handle>/status/<id>"}');
  process.exit(1);
}
if (typeof (parsed as Record<string, unknown>).url !== 'string') {
  console.error('POST.json must hold a string `url`');
  process.exit(1);
}
if (raw.length > 16384) {
  console.error(`POST.json is ${raw.length} bytes, over the gate's 16384-byte cap`);
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
copyFileSync(SOURCE, TARGET);
// The grader collects /output as another user: leave the file readable.
chmodSync(TARGET, 0o644);

const sha = createHash('sha256').update(raw, 'utf8').digest('hex');
console.log(`POST.json -> ${TARGET} (${raw.length} bytes, sha256 ${sha})`);
console.log(`url: ${(parsed as Record<string, unknown>).url}`);
