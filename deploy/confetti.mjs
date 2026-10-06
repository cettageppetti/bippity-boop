export function createConfetti(canvas, { viewport, random, requestFrame, cancelFrame, reducedMotion }) {
  const ctx = canvas.getContext('2d');
  let confettiPieces = [];
  let confettiFrame = 0;
  function resizeConfetti() {
    const ratio = Math.max(1, Math.min(2, viewport.devicePixelRatio || 1));
    canvas.width = Math.round(viewport.innerWidth * ratio);
    canvas.height = Math.round(viewport.innerHeight * ratio);
    canvas.style.width = `${viewport.innerWidth}px`;
    canvas.style.height = `${viewport.innerHeight}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function launchConfetti() {
    if (reducedMotion()) return;
    const colors = ['#ff63c3', '#ffb24d', '#ffe66d', '#57f0b1', '#46d9ff', '#9b7cff'];
    const burst = (side) => Array.from({ length: 85 }, () => ({
      x: side === 'left' ? viewport.innerWidth * .08 : viewport.innerWidth * .92,
      y: viewport.innerHeight * (.72 + (random() - .5) * .08),
      vx: (side === 'left' ? 1 : -1) * (3.5 + random() * 8.5),
      vy: -7 - random() * 10,
      size: 6 + random() * 9,
      rot: random() * Math.PI,
      vr: (random() - .5) * .45,
      color: colors[Math.floor(random() * colors.length)],
      life: 95 + random() * 55
    }));

    confettiPieces = [...burst('left'), ...burst('right')];
    cancelFrame(confettiFrame);
    animateConfetti();
  }

  function animateConfetti() {
    ctx.clearRect(0, 0, viewport.innerWidth, viewport.innerHeight);
    confettiPieces = confettiPieces.filter(p => p.life > 0 && p.y < viewport.innerHeight + 30);
    for (const p of confettiPieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += .22;
      p.vx *= .992;
      p.rot += p.vr;
      p.life -= 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.life / 25);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * .66);
      ctx.restore();
    }
    if (confettiPieces.length) confettiFrame = requestFrame(animateConfetti);
    else ctx.clearRect(0, 0, viewport.innerWidth, viewport.innerHeight);
  }

  return { resize: resizeConfetti, launch: launchConfetti };
}
