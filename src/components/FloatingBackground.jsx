import { useEffect, useRef } from 'react';

const shapes = ['circle', 'square', 'bar', 'ring', 'half', 'dot'];
const asciiSignals = [
  { text: 'SAT', left: '8%', duration: '24s', delay: '-7s' },
  { text: '[A]', left: '18%', duration: '28s', delay: '-20s' },
  { text: 'NOUN', left: '31%', duration: '31s', delay: '-12s' },
  { text: '×', left: '43%', duration: '21s', delay: '-16s' },
  { text: '{ }', left: '55%', duration: '29s', delay: '-4s' },
  { text: 'VERB', left: '67%', duration: '26s', delay: '-23s' },
  { text: '///', left: '78%', duration: '33s', delay: '-18s' },
  { text: '[D]', left: '90%', duration: '25s', delay: '-9s' },
];

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
      <div className="ascii-field">
        {asciiSignals.map((signal) => (
          <span
            key={`${signal.text}-${signal.left}`}
            className="ascii-signal"
            style={{
              '--ascii-left': signal.left,
              '--ascii-duration': signal.duration,
              '--ascii-delay': signal.delay,
            }}
          >
            {signal.text}
          </span>
        ))}
      </div>
    </div>
  );
}
