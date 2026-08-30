import { useEffect, useRef } from 'react';

const shapes = ['circle', 'square', 'bar', 'ring', 'half', 'dot'];

export default function FloatingBackground() {
  const layerRef = useRef(null);

  useEffect(() => {
    const layer = layerRef.current;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!layer || !finePointer || reducedMotion) return undefined;

    let frame = 0;
    const handlePointerMove = (event) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const x = ((event.clientX / window.innerWidth) - 0.5) * 18;
        const y = ((event.clientY / window.innerHeight) - 0.5) * 18;
        layer.style.setProperty('--pointer-x', `${x.toFixed(2)}px`);
        layer.style.setProperty('--pointer-y', `${y.toFixed(2)}px`);
      });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, []);

  return (
    <div ref={layerRef} className="motion-backdrop" aria-hidden="true">
      {shapes.map((shape, index) => (
        <span key={shape} className={`motion-shape motion-shape--${index + 1}`}>
          <i className={`motion-shape__form motion-shape__form--${shape}`} />
        </span>
      ))}
    </div>
  );
}
