// The screenshot scenes behind ?shot=start|play|serve|end. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot (take finished prep, chop what is on the
// board, add ready ingredients, start prep for what is missing), so the
// frame is what a short game really looks like and the same seed always
// gives the same frame.
import { INGREDIENTS, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SETTLE_SECONDS = 3;
const PLAY_SECONDS = 30;
const SERVE_LIMIT_SECONDS = 120;
const SERVE_WARMUP_SECONDS = 12;
const END_PLAY_SECONDS = 40;
const END_LIMIT_SECONDS = 600;
/** The autopilot acts at most this often, so it plays at a human pace. */
const ACT_EVERY = 6;

/** True when `sub` is a sub-multiset of `whole`. */
function isSubMultiset(sub, whole) {
  const counts = new Map();
  for (const item of whole) counts.set(item, (counts.get(item) ?? 0) + 1);
  for (const item of sub) {
    const left = counts.get(item) ?? 0;
    if (left === 0) return false;
    counts.set(item, left - 1);
  }
  return true;
}

/** The items in `needs` that are not yet on `plate` (as a multiset). */
function missingOf(needs, plate) {
  const counts = new Map();
  for (const item of plate) counts.set(item, (counts.get(item) ?? 0) + 1);
  const missing = [];
  for (const item of needs) {
    const left = counts.get(item) ?? 0;
    if (left > 0) counts.set(item, left - 1);
    else missing.push(item);
  }
  return missing;
}

/**
 * One autopilot decision: the next world action, or null to wait. When
 * `allowServe` is false it returns the string 'COMPLETE' instead of serving,
 * so the caller can stop with a finished plate.
 */
function autopilot(world, allowServe) {
  const st = world.state;
  if (st.over) return null;
  let target = null;
  for (const order of st.orders) {
    if (order && (!target || order.id < target.id)) target = order;
  }
  if (!target) return null;
  if (world.matchingOrder()) {
    if (allowServe) return { type: 'serve' };
    return 'COMPLETE';
  }
  if (!isSubMultiset(st.plate, target.needs)) return { type: 'trash' };
  const missing = missingOf(target.needs, st.plate);
  // 1. Take finished prep that is missing.
  for (let i = 0; i < st.grill.length; i += 1) {
    const slot = st.grill[i];
    if (slot.state === 'done' && missing.includes(slot.ing)) return { type: 'grill', index: i };
  }
  for (let i = 0; i < st.fryer.length; i += 1) {
    const slot = st.fryer[i];
    if (slot.state === 'done' && missing.includes(slot.ing)) return { type: 'fryer', index: i };
  }
  // 2. Chop what is on the board and still missing (the second chop adds it).
  for (let i = 0; i < st.board.length; i += 1) {
    const slot = st.board[i];
    if (slot.state === 'whole' && missing.includes(slot.ing)) return { type: 'board', index: i };
  }
  // 3. Add ready ingredients that are missing.
  for (const ing of missing) {
    if (INGREDIENTS[ing].prep === 'ready') return { type: 'bin', ing };
  }
  // 4. Start prep for missing prep ingredients, where a slot is free.
  for (const ing of missing) {
    const prep = INGREDIENTS[ing].prep;
    if (prep === 'grill' && st.grill.some((s) => s.state === 'empty')) return { type: 'bin', ing };
    if (prep === 'fry' && st.fryer.some((s) => s.state === 'empty')) return { type: 'bin', ing };
    if (prep === 'chop' && st.board.some((s) => s.state === 'empty')) return { type: 'bin', ing };
  }
  // 5. Clear burnt items so their slots free up.
  for (let i = 0; i < st.grill.length; i += 1) {
    if (st.grill[i].state === 'burnt') return { type: 'grill', index: i };
  }
  for (let i = 0; i < st.fryer.length; i += 1) {
    if (st.fryer[i].state === 'burnt') return { type: 'fryer', index: i };
  }
  return null;
}

/** Run the world forward, acting through the autopilot, for `seconds`. */
function runFor(world, seconds, allowServe, stopOnComplete) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    let action = null;
    if (i % ACT_EVERY === 0) action = autopilot(world, allowServe);
    if (action === 'COMPLETE' && stopOnComplete) return 'complete';
    const events = world.step(STEP, action ? [action] : []);
    if (events & EVENT_OVER) return 'over';
  }
  return 'time';
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    runFor(world, PLAY_SECONDS, true, false);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'serve') {
    // Play a little first so the frame has a score and a served dish behind
    // it, then build the next dish and stop with the plate ready to serve.
    runFor(world, SERVE_WARMUP_SECONDS, true, false);
    runFor(world, SERVE_LIMIT_SECONDS, false, true);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    runFor(world, END_PLAY_SECONDS, true, false);
    // Then stop playing and let the orders expire until the shift ends.
    const steps = Math.floor(END_LIMIT_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      const events = world.step(STEP, []);
      if (events & EVENT_OVER) break;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  // start: a kitchen that already looks alive — a patty on the grill, veg on
  // the board, a bun and cheese on the plate, orders on the board.
  world.clickBin('patty');
  world.clickBin('lettuce');
  world.clickBin('bun');
  world.clickBin('cheese');
  const steps = Math.floor(START_SETTLE_SECONDS / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, []);
  return { screen: SCREEN_TITLE, best: 0 };
}
