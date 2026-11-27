// Each spoke runs from the impact, through a chipped inner ring, to the edge.
// Adjacent spokes also define the exact cutouts that carry the briefing away.
const impact = [48, 39];
const spokes = [
  [[41, 32], [24, 19], [0, 0]],
  [[47, 29], [43, 18], [38, 0]],
  [[54, 34], [68, 17], [77, 0]],
  [[57, 36], [79, 26], [100, 0]],
  [[63, 38], [78, 40], [100, 35]],
  [[58, 43], [81, 49], [100, 58]],
  [[54, 48], [73, 69], [100, 100]],
  [[49, 45], [53, 68], [49, 100]],
  [[40, 47], [25, 75], [0, 100]],
  [[38, 42], [21, 54], [0, 61]],
  [[34, 38], [19, 39], [0, 32]],
];

function crackDrawing() {
  const ns = 'http://www.w3.org/2000/svg';
  const drawing = document.createElementNS(ns, 'svg');
  drawing.setAttribute('viewBox', '0 0 100 100');
  drawing.setAttribute('preserveAspectRatio', 'none');
  function line(points) {
    const path = document.createElementNS(ns, 'polyline');
    path.setAttribute('points', points.join(' '));
    drawing.append(path);
  }
  const chips = [];
  for (const [index, [inner, bend, edge]] of spokes.entries()) {
    line([impact, inner, bend, edge]);
    const fraction = 0.23 + (index % 3) * 0.09;
    chips.push(inner.map((value, axis) => impact[axis] + (value - impact[axis]) * fraction));
    if (index % 2 === 0) {
      const neighbor = spokes[(index + 1) % spokes.length][1];
      const tip = bend.map((value, axis) => value + (neighbor[axis] - value) * 0.26);
      line([bend, tip]);
    }
  }
  line([...chips, chips[0]]);
  line([...spokes.map(([inner]) => inner), spokes[0][0]]);
  return drawing;
}

function makeShards(pane) {
  const pieces = document.createDocumentFragment();
  function shard(points) {
    const piece = pane.cloneNode(true);
    piece.className = 'glass-shard';
    piece.style.clipPath = 'polygon(' + points.map(([x, y]) => x + '% ' + y + '%').join(',') + ')';
    const x = points.reduce((sum, point) => sum + point[0], 0) / points.length;
    const y = points.reduce((sum, point) => sum + point[1], 0) / points.length;
    piece.style.transformOrigin = x + '% ' + y + '%';
    piece.style.setProperty('--drift', (x - impact[0]) * 0.7 + 'vw');
    piece.style.setProperty('--spin', (x - impact[0]) * 0.8 + 'deg');
    piece.style.setProperty('--drop', (60 + y * 0.5) + 'vh');
    pieces.append(piece);
  }
  spokes.forEach((spoke, index) => {
    const next = spokes[(index + 1) % spokes.length];
    shard([impact, spoke[0], next[0]]);
    shard([...spoke, ...next.slice().reverse()]);
  });
  return pieces;
}

async function finishAnimation(node) {
  await Promise.allSettled(node.getAnimations().map(animation => animation.finished));
}

export async function revealRole(app, dispatch) {
  const reveal = () => dispatch({ type: 'reveal-role' });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return reveal();
  if (app.inert) return;

  const shell = app.firstElementChild;
  const snapshot = shell.cloneNode(true);
  snapshot.style.top = shell.getBoundingClientRect().top + 'px';
  const overlay = document.createElement('div');
  overlay.className = 'glass-reveal';
  overlay.setAttribute('aria-hidden', 'true');
  const pane = document.createElement('div');
  pane.className = 'glass-pane';
  const mark = document.createElement('div');
  mark.className = 'glass-impact';
  overlay.style.setProperty('--impact-x', impact[0] + '%');
  overlay.style.setProperty('--impact-y', impact[1] + '%');
  pane.append(snapshot, crackDrawing(), mark);
  overlay.append(pane);
  overlay.inert = true;
  document.body.append(overlay);
  app.inert = true;
  try {
    await Promise.all([finishAnimation(mark), reveal()]);
    if (app.firstElementChild?.dataset.screen !== 'S02' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    overlay.replaceChildren(makeShards(pane));
    await finishAnimation(overlay.firstElementChild);
  } finally {
    overlay.remove();
    app.inert = false;
    const current = app.firstElementChild;
    const focusTarget = current?.dataset.screen === 'role-briefing' ? '.screen-action' : '.brand';
    current?.querySelector(focusTarget)?.focus();
  }
}
