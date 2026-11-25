// The game's rules and state, with no drawing and no browser in it: the
// order board, the ingredient bins, the grill, fryer and chopping board, the
// assembly plate, serving, score, combos, strikes and the shift timer.
// step() advances one fixed step and returns what happened as bit flags, so
// the caller can react (sounds, announcements) without the world knowing
// about screens or sound. Nothing here allocates after createWorld returns.
import {
  BOARD_SLOTS, CHOP, COMBO_CAP, COMBO_WINDOW, DIFFICULTY, FRYER, GRILL,
  INGREDIENTS, ORDER_RESPAWN, RECIPES, SHIFT_SECONDS, STEP, STRIKES_MAX,
} from './config.js';

export const EVENT_PLACE = 1; // an ingredient landed on the plate
export const EVENT_PREP = 2; // an item went onto a prep station
export const EVENT_CHOP = 4; // a chop landed on the board
export const EVENT_READY = 8; // a prep item finished cooking / chopping
export const EVENT_SERVED = 16; // a dish was served
export const EVENT_EXPIRED = 32; // an order ran out of time
export const EVENT_BURN = 64; // a prep item burnt
export const EVENT_OVER = 128; // the shift is over

/** Compare two ingredient lists as multisets (order does not matter). */
export function sameMultiset(a, b) {
  if (a.length !== b.length) return false;
  const counts = new Map();
  for (const item of a) counts.set(item, (counts.get(item) ?? 0) + 1);
  for (const item of b) {
    const left = counts.get(item) ?? 0;
    if (left === 0) return false;
    counts.set(item, left - 1);
  }
  return true;
}

/** How many of `needs` are already on `plate` (as a multiset). */
export function matchedCount(plate, needs) {
  const counts = new Map();
  for (const item of plate) counts.set(item, (counts.get(item) ?? 0) + 1);
  let matched = 0;
  for (const item of needs) {
    const left = counts.get(item) ?? 0;
    if (left > 0) {
      counts.set(item, left - 1);
      matched += 1;
    }
  }
  return matched;
}

export function createWorld(random) {
  const orders = [];
  for (let i = 0; i < BOARD_SLOTS; i += 1) orders.push(null);
  const grill = [];
  for (let i = 0; i < GRILL.slots; i += 1) grill.push({ ing: null, t: 0, state: 'empty' });
  const fryer = [];
  for (let i = 0; i < FRYER.slots; i += 1) fryer.push({ ing: null, t: 0, state: 'empty' });
  const board = [];
  for (let i = 0; i < CHOP.slots; i += 1) board.push({ ing: null, chops: 0, state: 'empty' });
  const plate = [];
  const messages = [];
  const particles = [];

  const state = {
    orders, grill, fryer, board, plate, messages, particles,
    score: 0, served: 0, strikes: 0, combo: 0, comboTimer: 0,
    elapsed: 0, shiftLeft: SHIFT_SECONDS, level: 1,
    spawnTimer: 0, respawnTimer: 0, over: false, overReason: '',
    flash: 0, // counts down after a serve, for the renderer's flash
    lastServeValue: 0,
  };

  let nextOrderId = 1;

  function level() {
    return Math.min(DIFFICULTY.maxLevel, 1 + Math.floor(state.elapsed / DIFFICULTY.secondsPerLevel));
  }

  function spawnInterval() {
    return Math.max(DIFFICULTY.spawnMin, DIFFICULTY.spawnInterval - DIFFICULTY.spawnShrink * (level() - 1));
  }

  function orderTime() {
    return Math.max(DIFFICULTY.orderMin, DIFFICULTY.orderTime - DIFFICULTY.orderShrink * (level() - 1));
  }

  function pickRecipe() {
    const pool = level() <= 2 ? RECIPES.slice(0, DIFFICULTY.earlyRecipes) : RECIPES;
    return pool[Math.floor(random() * pool.length)];
  }

  function spawnOrder() {
    for (let i = 0; i < orders.length; i += 1) {
      if (orders[i] === null) {
        const recipe = pickRecipe();
        const time = orderTime();
        orders[i] = {
          id: nextOrderId,
          dish: recipe.id,
          name: recipe.name,
          needs: [...recipe.needs],
          value: recipe.value,
          timeLeft: time,
          timeMax: time,
          slot: i,
        };
        nextOrderId += 1;
        return true;
      }
    }
    return false;
  }

  function reset() {
    for (let i = 0; i < orders.length; i += 1) orders[i] = null;
    for (const slot of grill) { slot.ing = null; slot.t = 0; slot.state = 'empty'; }
    for (const slot of fryer) { slot.ing = null; slot.t = 0; slot.state = 'empty'; }
    for (const slot of board) { slot.ing = null; slot.chops = 0; slot.state = 'empty'; }
    plate.length = 0;
    messages.length = 0;
    particles.length = 0;
    state.score = 0;
    state.served = 0;
    state.strikes = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.elapsed = 0;
    state.shiftLeft = SHIFT_SECONDS;
    state.level = 1;
    state.spawnTimer = 1.2;
    state.respawnTimer = 0;
    state.over = false;
    state.overReason = '';
    state.flash = 0;
    state.lastServeValue = 0;
    nextOrderId = 1;
    spawnOrder();
    spawnOrder();
  }

  function addMessage(text, kind) {
    messages.push({ text, kind: kind || 'info', t: 0 });
    if (messages.length > 3) messages.shift();
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      particles.push({
        x, y,
        vx: (random() - 0.5) * 260,
        vy: -40 - random() * 160,
        t: 0, life: 0.5 + random() * 0.4,
        size: 3 + random() * 5,
        color,
      });
    }
    if (particles.length > 120) particles.splice(0, particles.length - 120);
  }

  /** The order the plate currently completes, or null. */
  function matchingOrder() {
    for (const order of orders) {
      if (order !== null && sameMultiset(plate, order.needs)) return order;
    }
    return null;
  }

  /** Add one ingredient to the plate (no prep). Returns true when added. */
  function addToPlate(ing) {
    plate.push(ing);
    return true;
  }

  // ---------------------------------------------------------- player actions

  function clickBin(ing) {
    const info = INGREDIENTS[ing];
    if (!info) return 0;
    if (info.prep === 'ready') {
      addToPlate(ing);
      return EVENT_PLACE;
    }
    if (info.prep === 'grill') {
      for (const slot of grill) {
        if (slot.state === 'empty') {
          slot.ing = ing;
          slot.t = 0;
          slot.state = 'cooking';
          return EVENT_PREP;
        }
      }
      addMessage('Grill is full!', 'warn');
      return 0;
    }
    if (info.prep === 'fry') {
      for (const slot of fryer) {
        if (slot.state === 'empty') {
          slot.ing = ing;
          slot.t = 0;
          slot.state = 'cooking';
          return EVENT_PREP;
        }
      }
      addMessage('Fryer is busy!', 'warn');
      return 0;
    }
    // chop
    for (const slot of board) {
      if (slot.state === 'empty') {
        slot.ing = ing;
        slot.chops = 0;
        slot.state = 'whole';
        return EVENT_PREP;
      }
    }
    addMessage('Chopping board is full!', 'warn');
    return 0;
  }

  function clickGrill(index) {
    const slot = grill[index];
    if (!slot || slot.state === 'empty' || slot.state === 'cooking') return 0;
    if (slot.state === 'burnt') {
      slot.ing = null;
      slot.t = 0;
      slot.state = 'empty';
      addMessage('Burnt patty trashed.', 'warn');
      return 0;
    }
    // done: take it to the plate
    addToPlate(slot.ing);
    slot.ing = null;
    slot.t = 0;
    slot.state = 'empty';
    return EVENT_PLACE;
  }

  function clickFryer(index) {
    const slot = fryer[index];
    if (!slot || slot.state === 'empty' || slot.state === 'cooking') return 0;
    if (slot.state === 'burnt') {
      slot.ing = null;
      slot.t = 0;
      slot.state = 'empty';
      addMessage('Burnt fries trashed.', 'warn');
      return 0;
    }
    addToPlate(slot.ing);
    slot.ing = null;
    slot.t = 0;
    slot.state = 'empty';
    return EVENT_PLACE;
  }

  function clickBoard(index) {
    const slot = board[index];
    if (!slot || slot.state === 'empty') return 0;
    if (slot.state === 'whole' || slot.state === 'chopped') {
      slot.chops += 1;
      if (slot.chops >= CHOP.chops) {
        slot.state = 'chopped';
        addToPlate(slot.ing);
        slot.ing = null;
        slot.chops = 0;
        slot.state = 'empty';
        return EVENT_PLACE | EVENT_CHOP;
      }
      slot.state = 'whole';
      return EVENT_CHOP;
    }
    return 0;
  }

  /** Take the last ingredient back off the plate. */
  function undoPlate() {
    if (plate.length === 0) return 0;
    plate.pop();
    return EVENT_PLACE;
  }

  function clearPlate() {
    if (plate.length === 0) return 0;
    plate.length = 0;
    addMessage('Plate cleared.', 'info');
    return 0;
  }

  function serveOrder(order) {
    if (!order) return 0;
    const timeBonus = Math.round(order.timeLeft * 2);
    const streak = state.comboTimer > 0 ? state.combo + 1 : 1;
    const mult = Math.min(COMBO_CAP, 1 + 0.25 * (streak - 1));
    const value = Math.round((order.value + timeBonus) * mult);
    state.score += value;
    state.lastServeValue = value;
    state.served += 1;
    state.combo = streak;
    state.comboTimer = COMBO_WINDOW;
    state.flash = 0.6;
    for (let i = 0; i < orders.length; i += 1) {
      if (orders[i] === order) {
        orders[i] = null;
        break;
      }
    }
    plate.length = 0;
    state.respawnTimer = ORDER_RESPAWN;
    addMessage(`Served ${order.name}! +${value}`, 'good');
    return EVENT_SERVED;
  }

  function clickServe() {
    const order = matchingOrder();
    if (!order) {
      addMessage('Plate does not match any order yet.', 'warn');
      return 0;
    }
    return serveOrder(order);
  }

  function clickTicket(index) {
    const order = orders[index];
    if (!order) return 0;
    if (!sameMultiset(plate, order.needs)) {
      addMessage(`That ticket needs ${order.name}.`, 'info');
      return 0;
    }
    return serveOrder(order);
  }

  // ---------------------------------------------------------- simulation

  function step(dt, actions) {
    let events = 0;
    if (state.over) return events;
    state.elapsed += dt;
    state.level = level();
    state.shiftLeft = Math.max(0, state.shiftLeft - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);

    // The caller's clicks, in the order they arrived.
    if (actions) {
      for (const action of actions) {
        if (action.type === 'bin') events |= clickBin(action.ing);
        else if (action.type === 'grill') events |= clickGrill(action.index);
        else if (action.type === 'fryer') events |= clickFryer(action.index);
        else if (action.type === 'board') events |= clickBoard(action.index);
        else if (action.type === 'undo') events |= undoPlate();
        else if (action.type === 'trash') events |= clearPlate();
        else if (action.type === 'serve') events |= clickServe();
        else if (action.type === 'ticket') events |= clickTicket(action.index);
      }
    }

    // Grill progress.
    for (let i = 0; i < grill.length; i += 1) {
      const slot = grill[i];
      if (slot.state !== 'cooking' && slot.state !== 'done') continue;
      slot.t += dt;
      if (slot.state === 'cooking' && slot.t >= GRILL.cook) {
        slot.state = 'done';
        events |= EVENT_READY;
      } else if (slot.t >= GRILL.burn) {
        slot.state = 'burnt';
        events |= EVENT_BURN;
        addMessage('A patty burnt on the grill!', 'warn');
      }
    }
    // Fryer progress.
    for (let i = 0; i < fryer.length; i += 1) {
      const slot = fryer[i];
      if (slot.state !== 'cooking' && slot.state !== 'done') continue;
      slot.t += dt;
      if (slot.state === 'cooking' && slot.t >= FRYER.cook) {
        slot.state = 'done';
        events |= EVENT_READY;
      } else if (slot.t >= FRYER.burn) {
        slot.state = 'burnt';
        events |= EVENT_BURN;
        addMessage('Fries burnt in the fryer!', 'warn');
      }
    }

    // Order timers and expiry.
    for (let i = 0; i < orders.length; i += 1) {
      const order = orders[i];
      if (order === null) continue;
      order.timeLeft -= dt;
      if (order.timeLeft <= 0) {
        orders[i] = null;
        state.strikes += 1;
        state.respawnTimer = ORDER_RESPAWN;
        addMessage(`Order expired! Strike ${state.strikes}/${STRIKES_MAX}.`, 'bad');
        events |= EVENT_EXPIRED;
        if (state.strikes >= STRIKES_MAX) {
          state.over = true;
          state.overReason = 'strikes';
          events |= EVENT_OVER;
          return events;
        }
      }
    }

    // New orders arrive on a timer.
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      if (spawnOrder()) state.spawnTimer = spawnInterval();
      else state.spawnTimer = 1;
    }
    if (state.respawnTimer > 0) {
      state.respawnTimer -= dt;
      if (state.respawnTimer <= 0) spawnOrder();
    }

    // Shift timer ends the shift.
    if (state.shiftLeft <= 0) {
      state.over = true;
      state.overReason = 'time';
      events |= EVENT_OVER;
      return events;
    }

    // Messages age out.
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      messages[i].t += dt;
      if (messages[i].t > 3.5) messages.splice(i, 1);
    }
    // Particles age out.
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      if (p.t >= p.life) particles.splice(i, 1);
    }
    return events;
  }

  reset();
  return {
    state, reset, step,
    clickBin, clickGrill, clickFryer, clickBoard, undoPlate, clearPlate,
    clickServe, clickTicket, matchingOrder, addParticles, addMessage,
    sameMultiset, matchedCount,
  };
}
