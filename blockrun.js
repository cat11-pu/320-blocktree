// blockrun.js：按处理预算处理事件，预算用尽压账；收尾不限预算清账
import { insertKey } from "./blocks.js";

function freshState(state) {
  const src = state || {};
  return {
    blocks: (src.blocks || []).map((block) => block.slice()),
    keys: (src.keys || []).slice(),
    splits: src.splits || 0,
    ledger: (src.ledger || []).map((entry) => ({ id: entry.id, kind: entry.kind, key: entry.key })),
    applied: (src.applied || []).slice()
  };
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function checkEvent(spec, event) {
  if (!event || typeof event !== "object" || event.kind !== "insert") {
    fail(spec.event_error_code || "E_BAD_EVENT", "事件结构不合法");
  }
  if (!Number.isInteger(event.key) || event.key <= 0) {
    fail(spec.key_error_code || "E_BAD_KEY", "键必须是正整数");
  }
}

function applyKey(spec, state, key) {
  if (state.keys.includes(key)) {
    fail(spec.dup_error_code || "E_DUP_KEY", "键已存在");
  }
  const before = state.blocks.length;
  state.blocks = insertKey(state.blocks, key, spec.branch);
  if (before > 0 && state.blocks.length === before + 1) state.splits += 1;
  let at = 0;
  while (at < state.keys.length && state.keys[at] < key) at += 1;
  state.keys.splice(at, 0, key);
}

export function step(spec) {
  const state = freshState(spec.state);
  const events = spec.events || [];
  let budget = spec.budget || 0;
  let served = 0;
  let judged = 0;
  for (const event of events) {
    checkEvent(spec, event);
    if (state.applied.includes(event.id)) continue;
    judged += 1;
    if (budget > 0) {
      applyKey(spec, state, event.key);
      state.applied.push(event.id);
      budget -= 1;
      served += 1;
    } else {
      state.ledger.push({ id: event.id, kind: event.kind, key: event.key });
    }
  }
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map((entry) => [entry.kind, entry.key]),
    judged: judged,
    judged_bound: events.length
  };
}

export function close(spec) {
  const state = freshState(spec.state);
  const pending = state.ledger;
  state.ledger = [];
  let catchup = 0;
  for (const entry of pending) {
    applyKey(spec, state, entry.key);
    state.applied.push(entry.id);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
