// Test suite murni (Node.js test runner built-in; tanpa dependency baru).
// Jalankan: node --test tests/*.test.ts atau npm test

import test from "node:test";
import assert from "node:assert/strict";
import { createJob, pushJobEvent, subscribeJob } from "../src/lib/prd/job-store.ts";
import { validateDocMarkdown, parseSseBlock } from "../src/lib/prd/parse.ts";

test("job-store: snapshot di buffer, delta live ke listener", () => {
  const job = createJob("generate");
  const liveEvents: unknown[] = [];
  subscribeJob(job, (evt) => liveEvents.push(evt));

  pushJobEvent(job, "stage_start", { stage: 1, name: "Stage 1" });
  pushJobEvent(job, "chunk", { stage: 1, text: "Halo " });
  pushJobEvent(job, "chunk", { stage: 1, text: "Dunia!" });

  // 1. Buffer internal harus di-coalesce untuk replay: 2 entri (stage_start + snapshot chunk)
  assert.equal(job.events.length, 2);
  const snapshotChunk = job.events[1].data as { text: string };
  assert.equal(snapshotChunk.text, "Halo Dunia!");

  // 2. Pendengar live harus menerima 3 event terpisah dengan id monotonik
  assert.equal(liveEvents.length, 3);
  const ids = liveEvents.map((e) => (e as { id: number }).id);
  assert.equal(ids[0] < ids[1] && ids[1] < ids[2], true, "id live harus strictly monotonic");
  assert.equal(((liveEvents[2] as { data: { text: string } }).data).text, "Dunia!");
});

test("parse: sse block parsing dengan id", () => {
  const raw = "id: 42\nevent: chunk\ndata: {\"stage\":1,\"text\":\"tes\"}\n\n";
  const parsed = parseSseBlock(raw);
  assert.equal(parsed.id, 42);
  assert.equal(parsed.event, "chunk");
});

test("parse: markdown validator mendeteksi missing H1 & non-ASCII", () => {
  const issues = validateDocMarkdown("TEST-DOC", "Tanpa H1 disini\n\n## 1. Bagian\nKarakter unicode \u2601");
  const codes = issues.map((i) => i.code);
  assert.equal(codes.includes("MISSING_H1"), true);
  assert.equal(codes.includes("NON_ASCII"), true);
});
