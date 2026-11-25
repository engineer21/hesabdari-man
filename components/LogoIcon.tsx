import React from 'react';

const LogoIcon: React.FC<{ className?: string }> = ({ className = 'h-24 w-24' }) => {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#00b8a9" />
        </linearGradient>
      </defs>
      <path
        fill="url(#logoGradient)"
        d="M10 20 L20 80 L50 40 L80 80 L90 20 L50 60 Z"
        transform="matrix(1 0 0 -1 0 100)"
      />
    </svg>
  );
};

export default LogoIcon;
