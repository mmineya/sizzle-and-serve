// Keyboard and pointer input. Pointer taps are turned into world actions
// (bin, grill, fryer, board, plate, serve, trash, ticket) by hit-testing the
// tap against the kitchen layout; one-shot presses are queued and taken once
// by the loop, so a press between two frames is never lost or counted twice.
import { BIN_ORDER, FIELD, INGREDIENTS, LAYOUT } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const PAUSE = new Set(['KeyP', 'Escape']);
const CONFIRM = new Set(['Space', 'Enter']);
const UNDO = new Set(['Backspace', 'Delete']);
const TRASH = new Set(['KeyT']);
const GRILL_KEY = new Set(['KeyG']);
const FRYER_KEY = new Set(['KeyF']);
const BOARD_KEY = new Set(['KeyB', 'KeyC']);

/** Bin key: Digit1..Digit8 map to BIN_ORDER. */
function binKey(code) {
  if (!code.startsWith('Digit')) return null;
  const n = Number.parseInt(code.slice(5), 10);
  if (n >= 1 && n <= BIN_ORDER.length) return BIN_ORDER[n - 1];
  return null;
}

/** Hit-test a logical point against a rectangle. */
function inRect(x, y, r) {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** Hit-test a logical point against the plate ellipse. */
function inPlate(x, y) {
  const p = LAYOUT.plate;
  const dx = (x - p.cx) / p.rx;
  const dy = (y - p.cy) / p.ry;
  return dx * dx + dy * dy <= 1;
}

/** Which bin (ingredient id) a logical point falls in, or null. */
function binAt(x, y) {
  const b = LAYOUT.bins;
  for (let row = 0; row < b.rows; row += 1) {
    for (let col = 0; col < b.cols; col += 1) {
      const index = row * b.cols + col;
      if (index >= BIN_ORDER.length) return null;
      const rect = {
        x: b.x + col * (b.w + b.gapX),
        y: b.y + row * (b.h + b.gapY),
        w: b.w,
        h: b.h,
      };
      if (inRect(x, y, rect)) return BIN_ORDER[index];
    }
  }
  return null;
}

/** Which grill slot (0/1) a point falls in, or -1. */
function grillAt(x, y) {
  const g = LAYOUT.grill;
  if (!inRect(x, y, g)) return -1;
  const slotW = g.w / g.slots;
  return Math.min(g.slots - 1, Math.floor((x - g.x) / slotW));
}

/** Which fryer slot (0) a point falls in, or -1. */
function fryerAt(x, y) {
  const f = LAYOUT.fryer;
  if (!inRect(x, y, f)) return -1;
  return 0;
}

/** Which board slot (0/1) a point falls in, or -1. */
function boardAt(x, y) {
  const b = LAYOUT.board2;
  if (!inRect(x, y, b)) return -1;
  const slotW = b.w / b.slots;
  return Math.min(b.slots - 1, Math.floor((x - b.x) / slotW));
}

/** Which order ticket (0/1/2) a point falls in, or -1. */
function ticketAt(x, y) {
  const b = LAYOUT.board;
  for (let i = 0; i < 3; i += 1) {
    const rect = { x: b.x + i * (b.w + b.gap), y: b.y, w: b.w, h: b.h };
    if (inRect(x, y, rect)) return i;
  }
  return -1;
}

/** Turn a pointer position into a world action, or null. */
export function actionAt(clientX, clientY, canvas) {
  const rect = canvas.getBoundingClientRect();
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
  const ox = (rect.width - FIELD.width * scale) / 2;
  const oy = (rect.height - FIELD.height * scale) / 2;
  const x = (px - ox) / scale;
  const y = (py - oy) / scale;
  if (x < 0 || x >= FIELD.width || y < 0 || y >= FIELD.height) return null;

  const bin = binAt(x, y);
  if (bin) return { type: 'bin', ing: bin };
  const grill = grillAt(x, y);
  if (grill >= 0) return { type: 'grill', index: grill };
  const fryer = fryerAt(x, y);
  if (fryer >= 0) return { type: 'fryer', index: fryer };
  const board = boardAt(x, y);
  if (board >= 0) return { type: 'board', index: board };
  const ticket = ticketAt(x, y);
  if (ticket >= 0) return { type: 'ticket', index: ticket };
  if (inRect(x, y, LAYOUT.serve)) return { type: 'serve' };
  if (inRect(x, y, LAYOUT.trash)) return { type: 'trash' };
  if (inRect(x, y, LAYOUT.undo)) return { type: 'undo' };
  if (inPlate(x, y)) return { type: 'undo' };
  return null;
}

export function createInput(canvas, world) {
  let queued = [];
  let flags = 0;

  function push(action) {
    if (action) queued.push(action);
  }

  window.addEventListener('keydown', (event) => {
    const bin = binKey(event.code);
    if (bin) {
      if (!event.repeat) push({ type: 'bin', ing: bin });
      event.preventDefault();
      return;
    }
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) flags |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) flags |= ACTION_PAUSE;
      event.preventDefault();
    } else if (UNDO.has(event.code)) {
      if (!event.repeat) push({ type: 'undo' });
      event.preventDefault();
    } else if (TRASH.has(event.code)) {
      if (!event.repeat) push({ type: 'trash' });
      event.preventDefault();
    } else if (GRILL_KEY.has(event.code)) {
      if (!event.repeat) {
        // Take a done patty (or trash a burnt one) from the first such slot.
        const st = world.state;
        for (let i = 0; i < st.grill.length; i += 1) {
          if (st.grill[i].state === 'done' || st.grill[i].state === 'burnt') {
            push({ type: 'grill', index: i });
            break;
          }
        }
      }
      event.preventDefault();
    } else if (FRYER_KEY.has(event.code)) {
      if (!event.repeat) {
        const st = world.state;
        for (let i = 0; i < st.fryer.length; i += 1) {
          if (st.fryer[i].state === 'done' || st.fryer[i].state === 'burnt') {
            push({ type: 'fryer', index: i });
            break;
          }
        }
      }
      event.preventDefault();
    } else if (BOARD_KEY.has(event.code)) {
      if (!event.repeat) {
        const st = world.state;
        for (let i = 0; i < st.board.length; i += 1) {
          if (st.board[i].state !== 'empty') {
            push({ type: 'board', index: i });
            break;
          }
        }
      }
      event.preventDefault();
    }
  });

  canvas.addEventListener('pointerdown', (event) => {
    // A tap is both a world action (where it lands) and a confirm press
    // (start / restart / resume on the title, over and paused screens).
    flags |= ACTION_CONFIRM;
    push(actionAt(event.clientX, event.clientY, canvas));
  });

  return {
    /** The queued world actions since the last call, in order. */
    takeActions() {
      const taken = queued;
      queued = [];
      return taken;
    },
    /** The one-shot screen flags since the last call (confirm/pause). */
    takeFlags() {
      const taken = flags;
      flags = 0;
      return taken;
    },
  };
}

/** The ingredient names, for the renderer's bin labels. */
export function ingredientName(ing) {
  return INGREDIENTS[ing] ? INGREDIENTS[ing].name : ing;
}
