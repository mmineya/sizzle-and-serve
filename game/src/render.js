// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the
// margin filled with the backdrop colour. Flat shapes with warm kitchen
// colours, canvas text for the HUD and the panels. Text that holds a number
// is rebuilt only when the number changes, so a frame allocates nothing.
import {
  BIN_ORDER, FIELD, FONT, INGREDIENTS, LAYOUT, PALETTE, RECIPES,
  STACK_ORDER, STRIKES_MAX,
} from './config.js';
import { matchedCount, sameMultiset } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function recipeById(id) {
  for (const r of RECIPES) if (r.id === id) return r;
  return null;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const servedLabel = cachedLabel('SERVED ');
  const comboLabel = cachedLabel('COMBO x');
  const finalLabel = cachedLabel('SCORE ');
  const finalBestLabel = cachedLabel('BEST ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function plainText(value, x, y, size, color, align, baseline) {
    if (!fonts.has(`p${size}`)) fonts.set(`p${size}`, `${size}px ${FONT}`);
    context.font = fonts.get(`p${size}`);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function circle(x, y, r) {
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
  }

  // ---------------------------------------------------------- ingredients

  /** Draw one ingredient icon centred at (x, y) with the given diameter. */
  function drawIngredient(ing, x, y, size, opts) {
    const o = opts || {};
    const info = INGREDIENTS[ing];
    if (!info) return;
    const s = size;
    const half = s / 2;
    context.save();
    if (ing === 'bun') {
      // Golden dome with sesame seeds.
      context.fillStyle = info.color;
      context.beginPath();
      context.moveTo(x - half, y + half * 0.55);
      context.quadraticCurveTo(x - half, y - half * 0.7, x, y - half * 0.7);
      context.quadraticCurveTo(x + half, y - half * 0.7, x + half, y + half * 0.55);
      context.closePath();
      context.fill();
      context.fillStyle = info.dark;
      context.fillRect(x - half, y + half * 0.35, s, s * 0.2);
      context.fillStyle = '#fff3c4';
      const seeds = [[-0.35, -0.25], [0, -0.45], [0.35, -0.25], [-0.15, -0.05], [0.2, -0.05]];
      for (const [dx, dy] of seeds) {
        context.beginPath();
        context.ellipse(x + dx * s, y + dy * s, s * 0.06, s * 0.035, 0.4, 0, Math.PI * 2);
        context.fill();
      }
    } else if (ing === 'bowl') {
      // Blue bowl.
      context.fillStyle = info.color;
      context.beginPath();
      context.moveTo(x - half, y - half * 0.4);
      context.quadraticCurveTo(x - half, y + half * 0.8, x, y + half * 0.8);
      context.quadraticCurveTo(x + half, y + half * 0.8, x + half, y - half * 0.4);
      context.closePath();
      context.fill();
      context.fillStyle = info.dark;
      context.fillRect(x - half, y - half * 0.55, s, s * 0.16);
      context.fillStyle = '#eaf7ff';
      context.fillRect(x - half * 0.7, y - half * 0.2, s * 1.4, s * 0.1);
    } else if (ing === 'cheese') {
      // Yellow triangle with holes.
      context.fillStyle = info.color;
      context.beginPath();
      context.moveTo(x - half, y + half * 0.6);
      context.lineTo(x + half, y + half * 0.6);
      context.lineTo(x + half, y - half * 0.5);
      context.closePath();
      context.fill();
      context.fillStyle = info.dark;
      const holes = [[-0.3, 0.25], [0.15, 0.05], [0.35, 0.35]];
      for (const [dx, dy] of holes) {
        circle(x + dx * s, y + dy * s, s * 0.09);
        context.fill();
      }
    } else if (ing === 'patty') {
      // A thick round patty; colour by state.
      let fill = '#8a5a3b';
      if (o.state === 'raw') fill = info.color;
      else if (o.state === 'burnt') fill = '#232323';
      else if (o.state === 'cooking') fill = '#a86a48';
      context.fillStyle = fill;
      roundRect(x - half, y - half * 0.42, s, s * 0.84, s * 0.2);
      context.fill();
      context.fillStyle = 'rgba(0,0,0,0.18)';
      roundRect(x - half, y + half * 0.1, s, s * 0.32, s * 0.16);
      context.fill();
      if (o.state === 'done') {
        context.strokeStyle = '#7ee081';
        context.lineWidth = 3;
        circle(x, y, half + 3);
        context.stroke();
      }
    } else if (ing === 'fries') {
      // Red carton with golden sticks.
      context.fillStyle = info.color;
      for (let i = -1; i <= 1; i += 1) {
        roundRect(x + i * s * 0.26 - s * 0.09, y - half * 0.9, s * 0.18, s * 0.7, s * 0.05);
        context.fill();
      }
      context.fillStyle = '#d94f3d';
      context.beginPath();
      context.moveTo(x - half * 0.85, y - half * 0.1);
      context.lineTo(x + half * 0.85, y - half * 0.1);
      context.lineTo(x + half * 0.6, y + half * 0.85);
      context.lineTo(x - half * 0.6, y + half * 0.85);
      context.closePath();
      context.fill();
      context.fillStyle = '#fff';
      circle(x, y + half * 0.35, s * 0.12);
      context.fill();
    } else if (ing === 'lettuce') {
      // Green wavy leaves.
      context.fillStyle = info.color;
      for (let i = 0; i < 3; i += 1) {
        context.beginPath();
        context.ellipse(x + (i - 1) * s * 0.26, y, s * 0.24, s * 0.3, (i - 1) * 0.35, 0, Math.PI * 2);
        context.fill();
      }
      context.strokeStyle = info.dark;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x, y - s * 0.25);
      context.lineTo(x, y + s * 0.25);
      context.stroke();
    } else if (ing === 'tomato') {
      // Red round with a green star.
      context.fillStyle = info.color;
      circle(x, y, half * 0.9);
      context.fill();
      context.fillStyle = info.dark;
      circle(x - half * 0.3, y - half * 0.25, s * 0.1);
      context.fill();
      context.fillStyle = '#4a9a52';
      context.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const a2 = a + Math.PI / 5;
        context.lineTo(x + Math.cos(a) * s * 0.3, y - half * 0.75 + Math.sin(a) * s * 0.18);
        context.lineTo(x + Math.cos(a2) * s * 0.12, y - half * 0.75 + Math.sin(a2) * s * 0.08);
      }
      context.closePath();
      context.fill();
    } else if (ing === 'onion') {
      // Purple-white rings.
      context.fillStyle = '#f3e9f7';
      circle(x, y, half * 0.9);
      context.fill();
      context.strokeStyle = info.color;
      context.lineWidth = s * 0.09;
      circle(x, y, half * 0.62);
      context.stroke();
      circle(x, y, half * 0.32);
      context.stroke();
      context.fillStyle = info.dark;
      circle(x, y, s * 0.07);
      context.fill();
    }
    context.restore();
    if (o.chops) {
      // Chop marks across the icon.
      context.strokeStyle = 'rgba(43,33,24,0.75)';
      context.lineWidth = 2.5;
      for (let i = 0; i < o.chops; i += 1) {
        const yy = y - half * 0.4 + (i * s) / 2;
        context.beginPath();
        context.moveTo(x - half * 0.7, yy);
        context.lineTo(x + half * 0.7, yy + s * 0.08);
        context.stroke();
      }
    }
  }

  // ---------------------------------------------------------- kitchen

  function drawKitchen(state) {
    // Wall and floor.
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, 0, FIELD.width, 178);
    context.fillStyle = PALETTE.wallTrim;
    context.fillRect(0, 170, FIELD.width, 8);
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 178, FIELD.width, FIELD.height - 178);
    // Wall tiles.
    context.fillStyle = 'rgba(255,255,255,0.04)';
    for (let x = 0; x < FIELD.width; x += 96) {
      context.fillRect(x, 0, 2, 170);
    }
    for (let y = 0; y < 170; y += 56) {
      context.fillRect(0, y, FIELD.width, 2);
    }
    // Hanging lamps.
    for (const lx of [320, 640, 960]) {
      context.fillStyle = '#1c1712';
      context.fillRect(lx - 2, 0, 4, 26);
      context.fillStyle = PALETTE.accent;
      context.beginPath();
      context.moveTo(lx - 22, 34);
      context.lineTo(lx + 22, 34);
      context.lineTo(lx + 12, 22);
      context.lineTo(lx - 12, 22);
      context.closePath();
      context.fill();
      context.fillStyle = 'rgba(255,179,71,0.14)';
      context.beginPath();
      context.moveTo(lx - 22, 34);
      context.lineTo(lx + 22, 34);
      context.lineTo(lx + 90, 178);
      context.lineTo(lx - 90, 178);
      context.closePath();
      context.fill();
    }
    // Counter top under the bins and stations.
    context.fillStyle = PALETTE.counterTop;
    roundRect(12, 168, 620, 332, 10);
    context.fill();
    context.fillStyle = PALETTE.counterEdge;
    context.fillRect(12, 492, 620, 8);
    // Counter under the plate.
    context.fillStyle = PALETTE.counterTop;
    roundRect(648, 168, 608, 332, 10);
    context.fill();
    context.fillStyle = PALETTE.counterEdge;
    context.fillRect(648, 492, 608, 8);
  }

  // ---------------------------------------------------------- HUD

  function drawHud(state, best) {
    context.fillStyle = PALETTE.panel;
    context.fillRect(0, 0, FIELD.width, LAYOUT.hud.h);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(0, LAYOUT.hud.h - 3, FIELD.width, 3);
    text(scoreLabel(state.score), 24, 34, 30, PALETTE.text, 'left');
    plainText(bestLabel(best), 24, 50, 15, PALETTE.muted, 'left');
    plainText(servedLabel(state.served), 200, 50, 15, PALETTE.muted, 'left');
    // Shift timer, centre.
    const mins = Math.floor(state.shiftLeft / 60);
    const secs = Math.floor(state.shiftLeft % 60);
    const timerText = `SHIFT ${mins}:${secs < 10 ? '0' : ''}${secs}`;
    text(timerText, FIELD.width / 2, 32, 28, state.shiftLeft < 20 ? PALETTE.red : PALETTE.text, 'center');
    const frac = state.shiftLeft / 150;
    context.fillStyle = '#3a2d20';
    roundRect(FIELD.width / 2 - 130, 40, 260, 8, 4);
    context.fill();
    context.fillStyle = frac > 0.5 ? PALETTE.green : frac > 0.25 ? PALETTE.gold : PALETTE.red;
    roundRect(FIELD.width / 2 - 130, 40, 260 * frac, 8, 4);
    context.fill();
    // Combo and strikes, right.
    if (state.combo > 1) {
      text(comboLabel(state.combo), FIELD.width - 170, 34, 26, PALETTE.gold, 'right');
    }
    plainText('MISSED', FIELD.width - 24, 18, 13, PALETTE.muted, 'right');
    for (let i = 0; i < STRIKES_MAX; i += 1) {
      const x = FIELD.width - 24 - i * 30;
      drawFlame(x - 12, 40, i < state.strikes);
    }
  }

  function drawFlame(x, y, lit) {
    context.fillStyle = lit ? PALETTE.red : '#4a3a28';
    context.beginPath();
    context.moveTo(x, y - 12);
    context.quadraticCurveTo(x + 9, y - 2, x + 6, y + 6);
    context.quadraticCurveTo(x + 3, y + 12, x, y + 12);
    context.quadraticCurveTo(x - 3, y + 12, x - 6, y + 6);
    context.quadraticCurveTo(x - 9, y - 2, x, y - 12);
    context.closePath();
    context.fill();
    if (lit) {
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.moveTo(x, y - 4);
      context.quadraticCurveTo(x + 5, y + 2, x + 3, y + 7);
      context.quadraticCurveTo(x, y + 10, x - 3, y + 7);
      context.quadraticCurveTo(x - 5, y + 2, x, y - 4);
      context.closePath();
      context.fill();
    }
  }

  // ---------------------------------------------------------- order board

  function drawTicket(order, x, y, w, h, plate, ready) {
    const recipe = recipeById(order.dish);
    const matched = matchedCount(plate, order.needs);
    const frac = Math.max(0, order.timeLeft / order.timeMax);
    const urgent = frac < 0.35;
    // Ticket card.
    context.fillStyle = ready ? PALETTE.ticketHot : PALETTE.ticket;
    roundRect(x, y, w, h, 10);
    context.fill();
    context.strokeStyle = ready ? PALETTE.accentDark : PALETTE.ticketEdge;
    context.lineWidth = ready ? 3 : 2;
    roundRect(x, y, w, h, 10);
    context.stroke();
    // Dish name.
    text(order.name, x + 14, y + 30, 21, PALETTE.textDark, 'left');
    plainText(`$${order.value}`, x + w - 14, y + 28, 16, PALETTE.mutedDark, 'right');
    // Ingredient icons, with a tick on the ones already on the plate.
    const iconSize = 30;
    const startX = x + 14;
    const iconY = y + 58;
    const counts = new Map();
    for (const item of plate) counts.set(item, (counts.get(item) ?? 0) + 1);
    const needCounts = new Map();
    for (const item of order.needs) needCounts.set(item, (needCounts.get(item) ?? 0) + 1);
    let ix = startX;
    for (const item of order.needs) {
      drawIngredient(item, ix + iconSize / 2, iconY, iconSize, {});
      const have = counts.get(item) ?? 0;
      const need = needCounts.get(item) ?? 0;
      if (have > 0 && matched > 0) {
        // A small green tick when this copy is covered.
        context.fillStyle = PALETTE.greenDark;
        circle(ix + iconSize - 4, iconY - iconSize / 2 + 4, 9);
        context.fill();
        context.strokeStyle = '#fff';
        context.lineWidth = 2.5;
        context.beginPath();
        context.moveTo(ix + iconSize - 9, iconY - iconSize / 2 + 4);
        context.lineTo(ix + iconSize - 5, iconY - iconSize / 2 + 8);
        context.lineTo(ix + iconSize + 1, iconY - iconSize / 2 - 1);
        context.stroke();
        counts.set(item, have - 1);
      }
      ix += iconSize + 8;
    }
    plainText(`${matched}/${order.needs.length}`, x + w - 14, y + 66, 15, PALETTE.mutedDark, 'right');
    // Timer bar.
    context.fillStyle = '#e8dcc0';
    roundRect(x + 14, y + h - 22, w - 28, 10, 5);
    context.fill();
    context.fillStyle = frac > 0.5 ? PALETTE.greenDark : frac > 0.25 ? PALETTE.gold : PALETTE.red;
    if (frac > 0) {
      roundRect(x + 14, y + h - 22, (w - 28) * frac, 10, 5);
      context.fill();
    }
    plainText(`${Math.ceil(order.timeLeft)}s`, x + w - 14, y + h - 26, 13, urgent ? PALETTE.red : PALETTE.mutedDark, 'right');
    if (ready) {
      text('READY — SERVE!', x + 14, y + h - 26, 14, PALETTE.greenDark, 'left');
    }
  }

  function drawBoard(state) {
    const b = LAYOUT.board;
    plainText('ORDER BOARD', b.x, b.y - 8, 14, PALETTE.muted, 'left');
    for (let i = 0; i < state.orders.length; i += 1) {
      const order = state.orders[i];
      const x = b.x + i * (b.w + b.gap);
      if (!order) {
        context.fillStyle = 'rgba(247,234,208,0.10)';
        roundRect(x, b.y, b.w, b.h, 10);
        context.fill();
        context.strokeStyle = 'rgba(247,234,208,0.25)';
        context.setLineDash([6, 6]);
        context.lineWidth = 2;
        roundRect(x, b.y, b.w, b.h, 10);
        context.stroke();
        context.setLineDash([]);
        plainText('Next order coming…', x + b.w / 2, b.y + b.h / 2 + 5, 16, PALETTE.muted, 'center');
        continue;
      }
      const ready = state.plate.length > 0 && sameMultiset(state.plate, order.needs);
      drawTicket(order, x, b.y, b.w, b.h, state.plate, ready);
    }
  }

  // ---------------------------------------------------------- bins

  function drawBins(state) {
    const b = LAYOUT.bins;
    plainText('INGREDIENTS — click to use  ·  keys 1–8', b.x, b.y - 8, 14, PALETTE.muted, 'left');
    for (let row = 0; row < b.rows; row += 1) {
      for (let col = 0; col < b.cols; col += 1) {
        const index = row * b.cols + col;
        if (index >= BIN_ORDER.length) break;
        const ing = BIN_ORDER[index];
        const info = INGREDIENTS[ing];
        const x = b.x + col * (b.w + b.gapX);
        const y = b.y + row * (b.h + b.gapY);
        context.fillStyle = PALETTE.counter;
        roundRect(x, y, b.w, b.h, 10);
        context.fill();
        context.strokeStyle = PALETTE.counterEdge;
        context.lineWidth = 2;
        roundRect(x, y, b.w, b.h, 10);
        context.stroke();
        drawIngredient(ing, x + 34, y + b.h / 2, 52, {});
        text(info.name, x + 66, y + 38, 18, PALETTE.text, 'left');
        plainText(info.prep === 'ready' ? 'ready' : info.prep === 'grill' ? '→ grill' : info.prep === 'fry' ? '→ fryer' : '→ chop', x + 66, y + 62, 13, PALETTE.muted, 'left');
        // Key badge.
        context.fillStyle = PALETTE.panel;
        circle(x + b.w - 16, y + 16, 11);
        context.fill();
        plainText(info.key, x + b.w - 16, y + 20, 13, PALETTE.text, 'center');
      }
    }
  }

  // ---------------------------------------------------------- prep stations

  function drawProgressRing(x, y, r, frac, color) {
    context.strokeStyle = 'rgba(255,255,255,0.18)';
    context.lineWidth = 5;
    circle(x, y, r);
    context.stroke();
    if (frac > 0) {
      context.strokeStyle = color;
      context.beginPath();
      context.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      context.stroke();
    }
  }

  function drawGrill(state) {
    const g = LAYOUT.grill;
    plainText('GRILL  ·  G to take', g.x, g.y - 8, 14, PALETTE.muted, 'left');
    context.fillStyle = PALETTE.grill;
    roundRect(g.x, g.y, g.w, g.h, 10);
    context.fill();
    context.strokeStyle = '#22262b';
    context.lineWidth = 2;
    for (let i = 1; i < 5; i += 1) {
      context.beginPath();
      context.moveTo(g.x + 10, g.y + (i * g.h) / 5);
      context.lineTo(g.x + g.w - 10, g.y + (i * g.h) / 5);
      context.stroke();
    }
    const slotW = g.w / g.slots;
    for (let i = 0; i < state.grill.length; i += 1) {
      const slot = state.grill[i];
      const cx = g.x + slotW * i + slotW / 2;
      const cy = g.y + g.h / 2;
      if (slot.state === 'empty') {
        context.fillStyle = 'rgba(255,255,255,0.06)';
        roundRect(cx - 56, cy - 40, 112, 80, 10);
        context.fill();
        plainText('empty', cx, cy + 5, 14, PALETTE.muted, 'center');
        continue;
      }
      const st = slot.state === 'burnt' ? 'burnt' : slot.state === 'done' ? 'done' : slot.t >= 3 ? 'cooking' : 'raw';
      drawIngredient('patty', cx, cy, 72, { state: st });
      if (slot.state === 'cooking') {
        drawProgressRing(cx, cy, 46, Math.min(1, slot.t / 6), PALETTE.accent);
      } else if (slot.state === 'done') {
        drawProgressRing(cx, cy, 46, 1, PALETTE.green);
        text('READY!', cx, cy - 56, 15, PALETTE.serveReady, 'center');
      } else if (slot.state === 'burnt') {
        text('BURNT — click to trash', cx, cy - 56, 13, PALETTE.red, 'center');
      }
    }
  }

  function drawFryer(state) {
    const f = LAYOUT.fryer;
    plainText('FRYER  ·  F', f.x, f.y - 8, 14, PALETTE.muted, 'left');
    context.fillStyle = PALETTE.fryer;
    roundRect(f.x, f.y, f.w, f.h, 10);
    context.fill();
    const slot = state.fryer[0];
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    if (slot.state === 'empty') {
      context.fillStyle = 'rgba(255,255,255,0.06)';
      roundRect(cx - 44, cy - 40, 88, 80, 10);
      context.fill();
      plainText('empty', cx, cy + 5, 14, PALETTE.muted, 'center');
      return;
    }
    // Oil.
    context.fillStyle = PALETTE.oil;
    roundRect(cx - 48, cy - 30, 96, 62, 8);
    context.fill();
    if (slot.state === 'burnt') {
      context.fillStyle = '#232323';
      roundRect(cx - 40, cy - 24, 80, 50, 6);
      context.fill();
      text('BURNT', cx, cy - 48, 13, PALETTE.red, 'center');
      return;
    }
    drawIngredient('fries', cx, cy - 6, 64, {});
    if (slot.state === 'cooking') {
      drawProgressRing(cx, cy, 44, Math.min(1, slot.t / 5), PALETTE.accent);
    } else if (slot.state === 'done') {
      drawProgressRing(cx, cy, 44, 1, PALETTE.green);
      text('READY!', cx, cy - 52, 14, PALETTE.serveReady, 'center');
    }
  }

  function drawBoardStation(state) {
    const b = LAYOUT.board2;
    plainText('CHOP  ·  B', b.x, b.y - 8, 14, PALETTE.muted, 'left');
    context.fillStyle = PALETTE.boardWood;
    roundRect(b.x, b.y, b.w, b.h, 10);
    context.fill();
    context.strokeStyle = PALETTE.boardWoodDark;
    context.lineWidth = 2;
    roundRect(b.x, b.y, b.w, b.h, 10);
    context.stroke();
    const slotW = b.w / b.slots;
    for (let i = 0; i < state.board.length; i += 1) {
      const slot = state.board[i];
      const cx = b.x + slotW * i + slotW / 2;
      const cy = b.y + b.h / 2;
      if (slot.state === 'empty') {
        context.fillStyle = 'rgba(0,0,0,0.10)';
        circle(cx, cy, 26);
        context.fill();
        continue;
      }
      drawIngredient(slot.ing, cx, cy, 56, { chops: slot.chops });
      if (slot.state === 'whole') {
        text(`chop ${2 - slot.chops}×`, cx, cy - 40, 13, PALETTE.textDark, 'center');
      }
    }
  }

  // ---------------------------------------------------------- plate & serve

  function drawPlate(state) {
    const p = LAYOUT.plate;
    // Plate shadow and dish.
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.beginPath();
    context.ellipse(p.cx, p.cy + 10, p.rx, p.ry, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.plate;
    context.beginPath();
    context.ellipse(p.cx, p.cy, p.rx, p.ry, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.plateEdge;
    context.lineWidth = 3;
    context.beginPath();
    context.ellipse(p.cx, p.cy, p.rx, p.ry, 0, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = 'rgba(0,0,0,0.10)';
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(p.cx, p.cy, p.rx - 26, p.ry - 22, 0, 0, Math.PI * 2);
    context.stroke();
    // The dish, stacked in canonical order, base at the bottom.
    const ordered = [...state.plate].sort((a, b) => STACK_ORDER.indexOf(a) - STACK_ORDER.indexOf(b));
    const layerH = 30;
    const baseY = p.cy + p.ry - 40;
    for (let i = 0; i < ordered.length; i += 1) {
      const ing = ordered[i];
      const y = baseY - i * layerH;
      const w = 215 - i * 8;
      drawPlateLayer(ing, p.cx, y, w, layerH);
    }
    if (state.plate.length === 0) {
      plainText('Your plate — build a dish here', p.cx, p.cy + 6, 16, PALETTE.mutedDark, 'center');
    }
    plainText('PLATE — click to undo last', p.cx, p.cy - p.ry - 12, 14, PALETTE.muted, 'center');
  }

  function drawPlateLayer(ing, cx, y, w, h) {
    const info = INGREDIENTS[ing];
    context.save();
    if (ing === 'bun') {
      context.fillStyle = info.color;
      context.beginPath();
      context.moveTo(cx - w / 2, y);
      context.quadraticCurveTo(cx - w / 2, y - h - 14, cx, y - h - 14);
      context.quadraticCurveTo(cx + w / 2, y - h - 14, cx + w / 2, y);
      context.closePath();
      context.fill();
      context.fillStyle = '#fff3c4';
      for (const dx of [-0.3, 0, 0.3]) {
        context.beginPath();
        context.ellipse(cx + dx * w, y - h - 8, 4, 2.5, 0.3, 0, Math.PI * 2);
        context.fill();
      }
    } else if (ing === 'bowl') {
      context.fillStyle = info.color;
      context.beginPath();
      context.moveTo(cx - w / 2, y - h);
      context.quadraticCurveTo(cx - w / 2, y + 8, cx, y + 8);
      context.quadraticCurveTo(cx + w / 2, y + 8, cx + w / 2, y - h);
      context.closePath();
      context.fill();
      context.fillStyle = info.dark;
      context.fillRect(cx - w / 2, y - h - 4, w, 6);
    } else if (ing === 'patty') {
      context.fillStyle = '#8a5a3b';
      roundRect(cx - w / 2, y - h, w, h, 8);
      context.fill();
      context.fillStyle = 'rgba(0,0,0,0.15)';
      roundRect(cx - w / 2, y - h / 2, w, h / 2, 8);
      context.fill();
    } else if (ing === 'cheese') {
      context.fillStyle = info.color;
      context.beginPath();
      context.moveTo(cx - w / 2, y);
      context.lineTo(cx + w / 2, y);
      context.lineTo(cx + w / 2 - 14, y - h);
      context.lineTo(cx - w / 2 + 14, y - h);
      context.closePath();
      context.fill();
      context.fillStyle = info.dark;
      circle(cx - w * 0.2, y - h / 2, 4);
      context.fill();
      circle(cx + w * 0.25, y - h / 2 - 3, 3);
      context.fill();
    } else if (ing === 'fries') {
      context.fillStyle = info.color;
      for (let i = -2; i <= 2; i += 1) {
        roundRect(cx + i * 16 - 5, y - h - 16, 10, h + 16, 3);
        context.fill();
      }
      context.fillStyle = '#d94f3d';
      roundRect(cx - w / 2, y - h, w, h * 0.7, 6);
      context.fill();
    } else if (ing === 'lettuce') {
      context.fillStyle = info.color;
      for (let i = -2; i <= 2; i += 1) {
        context.beginPath();
        context.ellipse(cx + i * (w / 5), y - h / 2, w / 10, h / 2 + 4, (i % 2 ? 0.3 : -0.3), 0, Math.PI * 2);
        context.fill();
      }
    } else if (ing === 'tomato') {
      context.fillStyle = info.color;
      roundRect(cx - w / 2, y - h, w, h, 10);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.25)';
      roundRect(cx - w / 2 + 8, y - h + 3, w - 16, 5, 3);
      context.fill();
    } else if (ing === 'onion') {
      context.fillStyle = '#f3e9f7';
      roundRect(cx - w / 2, y - h, w, h, 10);
      context.fill();
      context.strokeStyle = info.color;
      context.lineWidth = 3;
      roundRect(cx - w / 2 + 10, y - h + 4, w - 20, h - 8, 8);
      context.stroke();
    }
    context.restore();
  }

  function drawServe(state) {
    const s = LAYOUT.serve;
    // Is the plate a complete order?
    let ready = false;
    for (const order of state.orders) {
      if (!order) continue;
      if (sameMultiset(state.plate, order.needs)) { ready = true; break; }
    }
    context.fillStyle = ready ? PALETTE.serveReady : '#4a5a48';
    roundRect(s.x, s.y, s.w, s.h, 12);
    context.fill();
    context.strokeStyle = ready ? PALETTE.serveDark : '#333d31';
    context.lineWidth = 3;
    roundRect(s.x, s.y, s.w, s.h, 12);
    context.stroke();
    text(ready ? 'SERVE  ✓  (Space)' : 'SERVE  (Space)', s.x + s.w / 2, s.y + 42, 28, ready ? '#173d17' : '#c9d4c2', 'center');
    // Trash and undo.
    const t = LAYOUT.trash;
    context.fillStyle = '#5a3a30';
    roundRect(t.x, t.y, t.w, t.h, 10);
    context.fill();
    text('TRASH  (T)', t.x + t.w / 2, t.y + 30, 18, '#f7ead0', 'center');
    const u = LAYOUT.undo;
    context.fillStyle = '#3a3f46';
    roundRect(u.x, u.y, u.w, u.h, 10);
    context.fill();
    text('UNDO  (Bksp)', u.x + u.w / 2, u.y + 30, 18, '#eef1f5', 'center');
  }

  // ---------------------------------------------------------- messages / fx

  function drawMessages(state) {
    const help = LAYOUT.help;
    // Help bar.
    context.fillStyle = PALETTE.panel;
    roundRect(help.x, help.y, help.w, help.h, 10);
    context.fill();
    plainText('Click bins to use ingredients · grill patties, fry fries, chop veg · build the dish on the plate · serve before the ticket timer runs out · P pause · M mute', help.x + 16, help.y + 24, 15, PALETTE.muted, 'left');
    plainText('Sizzle & Serve — a fast kitchen game', help.x + 16, help.y + 44, 13, PALETTE.mutedDark, 'left');
    // Floating messages above the help bar.
    let y = help.y - 12;
    for (let i = state.messages.length - 1; i >= 0; i -= 1) {
      const m = state.messages[i];
      const alpha = m.t > 2.5 ? Math.max(0, 1 - (m.t - 2.5)) : 1;
      context.globalAlpha = alpha;
      const color = m.kind === 'good' ? PALETTE.serveReady : m.kind === 'bad' ? PALETTE.red : m.kind === 'warn' ? PALETTE.gold : PALETTE.text;
      text(m.text, FIELD.width / 2, y, 20, color, 'center');
      context.globalAlpha = 1;
      y -= 26;
    }
    // Serve flash.
    if (state.flash > 0) {
      context.globalAlpha = Math.min(0.25, state.flash * 0.4);
      context.fillStyle = PALETTE.gold;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      context.globalAlpha = 1;
    }
    // Particles.
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, 1 - p.t / p.life);
      context.fillStyle = p.color;
      circle(p.x, p.y, p.size);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  // ---------------------------------------------------------- panels

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 34 + 70;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10,8,6,0.42)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = accent || PALETTE.accent;
    context.lineWidth = 3;
    roundRect(x, y, width, height, 14);
    context.stroke();
    text(title, FIELD.width / 2, y + 72, 46, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      plainText(lines[i], FIELD.width / 2, y + 122 + i * 34, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'Orders land on the board — build each dish on the plate',
    'and serve it before its timer runs out.',
    'Grill patties · fry fries · chop veg · 3 missed orders ends the shift.',
    'Click or use keys 1–8 · Space serves · P pauses.',
    '',
  ];
  const PAUSED_LINES = ['The tickets will wait for you.'];
  const OVER_LINES = ['', ''];

  /** Paint one frame: the kitchen, then the HUD or a panel for the screen. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawKitchen(state);
    drawBoard(state);
    drawBins(state);
    drawGrill(state);
    drawFryer(state);
    drawBoardStation(state);
    drawPlate(state);
    drawServe(state);
    drawHud(state, best);
    drawMessages(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = bestLabel(best);
      drawPanel('SIZZLE & SERVE', TITLE_LINES, 'Press Space or click to start');
      return;
    }
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = `${finalBestLabel(best)}  ·  ${state.served} dishes served`;
      const title = state.overReason === 'strikes' ? 'Shift over — too many missed orders' : 'Shift complete!';
      drawPanel(title, OVER_LINES, 'Press Space or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, drawIngredient };
}
