// blockrun.js：按处理预算处理并留账
import { insertKey } from "./blocks.js";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function codesOf(spec) {
  return {
    dup: spec.dup_error_code || "E_DUP_KEY",
    key: spec.key_error_code || "E_BAD_KEY",
    event: spec.event_error_code || "E_BAD_EVENT"
  };
}

function checkEvent(event, codes) {
  if (!event || typeof event !== "object" || event.kind !== "insert") fail(codes.event);
  if (!Number.isInteger(event.key) || event.key <= 0) fail(codes.key);
}

function runQueue(state, queue, budget, branch, codes) {
  let blocks = (state.blocks || []).map((block) => block.slice());
  const keys = (state.keys || []).slice();
  const applied = (state.applied || []).slice();
  const known = new Set(keys);
  const ledger = [];
  let splits = state.splits || 0;
  let served = 0;
  for (const item of queue) {
    if (served >= budget) { ledger.push(item); continue; }
    if (known.has(item.key)) fail(codes.dup);
    const grown = insertKey(blocks, item.key, branch);
    if (blocks.length > 0 && grown.length > blocks.length) splits += 1;
    blocks = grown;
    let at = 0;
    while (at < keys.length && keys[at] < item.key) at += 1;
    keys.splice(at, 0, item.key);
    known.add(item.key);
    if (item.id !== undefined) applied.push(item.id);
    served += 1;
  }
  return { state: { blocks, keys, splits, ledger, applied }, served };
}

export function step(spec) {
  const codes = codesOf(spec);
  const state = spec.state || { blocks: [], keys: [], splits: 0, ledger: [], applied: [] };
  const events = spec.events || [];
  for (const event of events) checkEvent(event, codes);
  const done = new Set(state.applied || []);
  const queue = (state.ledger || []).slice();
  for (const event of events) {
    if (event.id !== undefined && done.has(event.id)) continue;
    queue.push(event);
  }
  const budget = Math.max(0, Math.floor(spec.budget || 0));
  const run = runQueue(state, queue, budget, spec.branch, codes);
  return {
    state: run.state,
    served: run.served,
    ledger_before: run.state.ledger.length,
    ledger: run.state.ledger.map((item) => [item.kind, item.key]),
    judged: run.served,
    judged_bound: queue.length
  };
}

export function close(spec) {
  const codes = codesOf(spec);
  const state = spec.state || { blocks: [], keys: [], splits: 0, ledger: [], applied: [] };
  const queue = (state.ledger || []).slice();
  const run = runQueue(state, queue, queue.length, spec.branch, codes);
  return { state: run.state, catchup: run.served };
}
