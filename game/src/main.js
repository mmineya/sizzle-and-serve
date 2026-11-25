// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens:
// title, play, paused and game over.
//
// ?seed=N fixes the order pattern. ?shot=start|play|serve|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BURN, EVENT_CHOP, EVENT_EXPIRED, EVENT_OVER, EVENT_PLACE, EVENT_PREP, EVENT_READY, EVENT_SERVED } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, world);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Serve the orders before their timers run out.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.over();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Shift over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleFlags() {
    const flags = input.takeFlags();
    if (flags & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      audio.unlock();
      startGame();
    } else if (flags & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (flags & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function playSounds(events) {
    if (events & EVENT_SERVED) audio.serve();
    else if (events & EVENT_EXPIRED) audio.expire();
    else if (events & EVENT_BURN) audio.burn();
    else if (events & EVENT_READY) audio.ready();
    else if (events & EVENT_CHOP) audio.chop();
    else if (events & EVENT_PREP) audio.prep();
    else if (events & EVENT_PLACE) audio.place();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, []);
      return;
    }
    const events = world.step(STEP, input.takeActions());
    playSounds(events);
    if (events & EVENT_SERVED) {
      announce(`Served! +${world.state.lastServeValue}. Score ${world.state.score}.`);
    } else if (events & EVENT_EXPIRED) {
      announce(`Order expired. ${world.state.strikes} strikes.`);
    }
    if (events & EVENT_OVER) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleFlags();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting orders expire unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // M mutes the kitchen.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM' && !event.repeat) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
  });

  announce('Sizzle and Serve. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
