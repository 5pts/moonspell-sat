import React, { useMemo } from 'react';

const FloatingBackground = () => {
  const symbols = ['+', '×', '÷', '=', '>', '<', '[ ]', '{ }', 'SAT', 'VERB', 'NOUN', '☽', '☾', '✧', 'A', 'B', 'C', 'D', '///', '\\\\'];
  const colors = [
    'var(--text-primary)', 'var(--text-primary)', 'var(--text-primary)', 
    'var(--accent-blue)', 'var(--accent-orange)', 'var(--accent-red)'
  ];
  
  const elements = useMemo(() => {
    return Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      char: symbols[Math.floor(Math.random() * symbols.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
      left: `${Math.random() * 100}%`,
      fontSize: `${Math.random() * 4 + 2}rem`,
      animationDuration: `${Math.random() * 20 + 10}s`,
      animationDelay: `-${Math.random() * 30}s`,
      opacity: Math.random() * 0.15 + 0.05,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      {elements.map(el => (
        <div
          key={el.id}
          className="absolute font-pixel-eng theme-transition"
          style={{
            left: el.left,
            top: '100%',
            color: el.color,
            fontSize: el.fontSize,
            opacity: el.opacity,
            fontWeight: 'bold',
            '--duration': el.animationDuration,
            animation: `asciiFloat calc(var(--duration) * var(--bg-speed, 1)) linear infinite`,
            animationDelay: el.animationDelay,
          }}
        >
          {el.char}
        </div>
      ))}
    </div>
  );
};

export default FloatingBackground;
