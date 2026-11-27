// Both halves follow the same wandering seam. Smaller irregularities expose
// different widths of raw paper along its two edges.
function makeHalf(snapshot, side) {
  const left = side === 'left';
  const direction = left ? -1 : 1;
  const outer = left ? '0%' : '100%';
  const rim = [];
  const face = [];
  const joined = [];
  for (let i = 0; i <= 100; i++) {
    const bend = 0.95 * Math.sin(i * 0.14) + 0.46 * Math.sin(i * 0.51);
    const grain = 0.22 * Math.sin(i * 2.39);
    const edge = 50 + bend + grain;
    rim.push(edge.toFixed(3) + '% ' + i + '%');
    joined.push(`calc(${edge.toFixed(3)}% - var(--stroke-thin) * ${direction}) ${i}%`);
    const fiber = 0.45 + 0.55 * Math.abs(Math.sin(i * 1.73 + direction));
    face.push(`calc(${edge.toFixed(3)}% + var(--tear-fiber) * ${direction * fiber}) ${i}%`);
  }
  const polygon = points => `polygon(${outer} 0%, ${points.join(',')}, ${outer} 100%)`;
  const half = document.createElement('div');
  half.className = 'paper-half paper-' + side;
  const edge = document.createElement('div');
  edge.className = 'paper-edge';
  edge.style.clipPath = polygon(rim);
  const printed = document.createElement('div');
  printed.className = 'paper-face';
  printed.style.clipPath = polygon(face);
  printed.append(snapshot.cloneNode(true));
  edge.append(printed);
  const flap = document.createElement('div');
  flap.className = 'paper-flap';
  flap.append(edge);

  // The paper on either side of the moving fold meets on the same hinge.
  // The flat portion keeps its printed text in place until the seam reaches it.
  const flat = document.createElement('div');
  flat.className = 'paper-flat';
  const base = document.createElement('div');
  base.className = 'paper-base';
  base.style.clipPath = polygon(joined);
  base.append(snapshot.cloneNode(true));
  flat.append(base);
  half.append(flat, flap);
  return half;
}

async function finishAnimation(node) {
  await Promise.allSettled(node.getAnimations().map(animation => animation.finished));
}

export async function revealRole(app, dispatch) {
  const reveal = () => dispatch({ type: 'reveal-role' });
  if (app.inert) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) return reveal();

  const shell = app.firstElementChild;
  const snapshot = shell.cloneNode(true);
  snapshot.style.top = shell.getBoundingClientRect().top + 'px';

  const overlay = document.createElement('div');
  overlay.className = 'paper-reveal';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.inert = true;
  const left = makeHalf(snapshot, 'left');
  overlay.append(left, makeHalf(snapshot, 'right'));
  document.body.append(overlay);
  app.inert = true;
  try {
    await Promise.all([finishAnimation(overlay), reveal()]);
    if (app.firstElementChild?.dataset.screen !== 'S02' || reducedMotion.matches) return;
    overlay.classList.add('paper-opening');
    await finishAnimation(left);
  } finally {
    overlay.remove();
    app.inert = false;
    const current = app.firstElementChild;
    const focusTarget = current?.dataset.screen === 'role-briefing' ? '.screen-action' : '.brand';
    current?.querySelector(focusTarget)?.focus();
  }
}
