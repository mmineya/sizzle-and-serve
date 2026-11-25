// Sizzle & Serve — every tuning number, colour, ingredient and recipe in one
// place. The playfield is a fixed 1280x720 logical area; the renderer scales
// it to the window, so no rule below depends on the screen size.
//
// The kitchen: an order board across the top, a counter of ingredient bins on
// the left, three prep stations (grill, fryer, chopping board) in the middle,
// and the big assembly plate on the right with the SERVE button under it.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** One shift lasts this long; when it hits zero the shift is over. */
export const SHIFT_SECONDS = 150;

/** Missed orders before the shift ends early. */
export const STRIKES_MAX = 3;

/** Seconds after a serve during which the next serve keeps the combo alive. */
export const COMBO_WINDOW = 10;

/** Combo multiplier caps here (1 + 0.25 per streak step, capped). */
export const COMBO_CAP = 2.5;

/** How many orders sit on the board at once. */
export const BOARD_SLOTS = 3;

/** Seconds between a served/expired order and its replacement. */
export const ORDER_RESPAWN = 2.5;

// ------------------------------------------------------------------ layout

export const LAYOUT = {
  hud: { x: 0, y: 0, w: 1280, h: 54 },
  // Three order tickets across the top.
  board: { x: 24, y: 58, w: 392, h: 100, gap: 16 },
  // Ingredient bins: 2 rows x 4 columns, left side.
  bins: { x: 24, y: 188, w: 140, h: 80, gapX: 12, gapY: 8, cols: 4, rows: 2 },
  // Prep stations stacked under the bins: grill, fryer, chopping board.
  grill: { x: 24, y: 386, w: 300, h: 108, slots: 2 },
  fryer: { x: 336, y: 386, w: 132, h: 108, slots: 1 },
  board2: { x: 480, y: 386, w: 140, h: 108, slots: 2 },
  // The big assembly plate, right side: flatter, so the dish fills it.
  plate: { cx: 948, cy: 340, rx: 165, ry: 100 },
  serve: { x: 776, y: 508, w: 344, h: 64 },
  trash: { x: 776, y: 584, w: 164, h: 44 },
  undo: { x: 956, y: 584, w: 164, h: 44 },
  // Bottom help bar.
  help: { x: 24, y: 648, w: 1232, h: 56 },
};

// ------------------------------------------------------------------ ingredients

/** prep: 'ready' (straight to the plate), 'grill', 'fry' or 'chop'. */
export const INGREDIENTS = {
  bun: { name: 'Bun', prep: 'ready', color: '#e8b04b', dark: '#b97f2a', key: '1' },
  bowl: { name: 'Bowl', prep: 'ready', color: '#7ec8e3', dark: '#3d7ea6', key: '2' },
  cheese: { name: 'Cheese', prep: 'ready', color: '#f2c94c', dark: '#c39a1d', key: '3' },
  patty: { name: 'Patty', prep: 'grill', color: '#c96a5e', dark: '#7a4a2b', key: '4' },
  fries: { name: 'Fries', prep: 'fry', color: '#f2c94c', dark: '#d98e2b', key: '5' },
  lettuce: { name: 'Lettuce', prep: 'chop', color: '#7bc47f', dark: '#4a9a52', key: '6' },
  tomato: { name: 'Tomato', prep: 'chop', color: '#e5534b', dark: '#a82e28', key: '7' },
  onion: { name: 'Onion', prep: 'chop', color: '#d8b4e2', dark: '#9a6fb0', key: '8' },
};

/** The order bins appear in on the counter. */
export const BIN_ORDER = ['bun', 'patty', 'cheese', 'lettuce', 'tomato', 'onion', 'fries', 'bowl'];

/** Seconds a patty takes on the grill, and how long past done before it burns. */
export const GRILL = { cook: 6, burn: 13, slots: 2 };

/** Seconds fries take in the fryer, and how long past done before they burn. */
export const FRYER = { cook: 5, burn: 11, slots: 1 };

/** Chops to finish an item on the board, and the board's slots. */
export const CHOP = { chops: 2, slots: 2 };

// ------------------------------------------------------------------ recipes

/** Each dish: its name, the ingredients (as a multiset), its base value. */
export const RECIPES = [
  { id: 'classic', name: 'Classic Burger', needs: ['bun', 'patty', 'cheese', 'lettuce'], value: 120 },
  { id: 'salad', name: 'Garden Salad', needs: ['bowl', 'lettuce', 'tomato', 'onion'], value: 100 },
  { id: 'fries', name: 'Cheesy Fries', needs: ['bowl', 'fries', 'cheese'], value: 110 },
  { id: 'melt', name: 'Double Melt', needs: ['bun', 'patty', 'cheese', 'tomato', 'onion'], value: 150 },
  { id: 'stack', name: 'BBQ Stack', needs: ['bun', 'patty', 'patty', 'cheese', 'onion'], value: 180 },
];

/** A dish's ingredients draw on the plate in this order (base first). */
export const STACK_ORDER = ['bowl', 'bun', 'patty', 'fries', 'cheese', 'lettuce', 'tomato', 'onion'];

// ------------------------------------------------------------------ difficulty

/** Order spawn interval and order lifetime shrink as the level rises. */
export const DIFFICULTY = {
  /** Seconds of play per level. */
  secondsPerLevel: 30,
  maxLevel: 6,
  /** Order spawn interval at level 1 and how much it shrinks per level. */
  spawnInterval: 13,
  spawnShrink: 1.1,
  spawnMin: 7,
  /** Order lifetime at level 1 and how much it shrinks per level. */
  orderTime: 52,
  orderShrink: 3,
  orderMin: 34,
  /** Which recipes may appear: levels 1-2 use the first three, then all five. */
  earlyRecipes: 3,
};

// ------------------------------------------------------------------ palette

export const PALETTE = {
  backdrop: '#171310',
  wall: '#2b2118',
  wallTrim: '#3a2d20',
  floor: '#241a12',
  counter: '#6b4a2f',
  counterTop: '#8a5f3c',
  counterEdge: '#4a3120',
  steel: '#9aa5b1',
  steelDark: '#6b7683',
  board: '#f7ead0',
  boardEdge: '#c9a86a',
  ticket: '#fff8e7',
  ticketEdge: '#d9c08a',
  ticketHot: '#ffe9a8',
  plate: '#f4f1e8',
  plateEdge: '#c9c2ae',
  text: '#f7ead0',
  textDark: '#2b2118',
  muted: '#b8a88f',
  mutedDark: '#7a6a55',
  accent: '#ffb347',
  accentDark: '#e08a1e',
  green: '#7bc47f',
  greenDark: '#4a9a52',
  red: '#e5534b',
  redDark: '#a82e28',
  gold: '#f2c94c',
  grill: '#3a3f46',
  grillHot: '#e5534b',
  fryer: '#4a3b28',
  oil: '#e8a33d',
  boardWood: '#c89b6a',
  boardWoodDark: '#a67c52',
  panel: '#2b2118',
  panelEdge: '#4a3a28',
  serve: '#5cb85c',
  serveDark: '#3d8a3d',
  serveReady: '#7ee081',
  danger: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'sizzle-and-serve.best';
