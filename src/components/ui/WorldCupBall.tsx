import React from 'react';
import { motion } from 'motion/react';

interface WorldCupBallProps {
  className?: string;
  animate?: boolean;
}

export const WorldCupBall: React.FC<WorldCupBallProps> = ({ className = "w-12 h-12", animate = true }) => {
  return (
    <motion.div 
      className={`relative rounded-full bg-white shadow-2xl overflow-hidden ${className}`}
      animate={animate ? { rotate: 360 } : {}}
      transition={animate ? { duration: 15, repeat: Infinity, ease: "linear" } : {}}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full scale-110">
        <defs>
          <radialGradient id="sphereGrad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#d1d5db" />
          </radialGradient>
          
          <linearGradient id="mexicoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#065f46" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>

          <linearGradient id="canadaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9f1239" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>

          <linearGradient id="usaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>

          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <feOffset dx="1" dy="1" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base Sphere */}
        <circle cx="50" cy="50" r="48" fill="url(#sphereGrad)" />

        {/* Pattern: Mexican Pre-Hispanic Geometrics (Greenish) */}
        <g opacity="0.9" filter="url(#shadow)">
          <path 
            d="M50 5 L60 15 L50 25 L40 15 Z" 
            fill="url(#mexicoGrad)" 
          />
          <path 
            d="M85 50 L95 60 L85 70 L75 60 Z" 
            fill="url(#mexicoGrad)" 
          />
          <path 
            d="M15 50 L25 60 L15 70 L5 60 Z" 
            fill="url(#mexicoGrad)" 
          />
          {/* Ornate lines between */}
          <path d="M50 25 L65 40 M35 40 L50 25" stroke="#065f46" strokeWidth="1" fill="none" />
        </g>

        {/* Pattern: Maple Leaf (Canada - Stylized Red) */}
        <g transform="translate(10, 5) scale(0.8)" filter="url(#shadow)">
           <path 
             d="M50 20 L55 35 L70 35 L60 45 L65 60 L50 50 L35 60 L40 45 L30 35 L45 35 Z" 
             fill="url(#canadaGrad)" 
           />
           {/* Detailed Leaf Shape Jagged Edges */}
           <path 
             d="M50 15 L53 25 L58 22 L56 32 L66 30 L60 38 L68 45 L58 45 L60 55 L50 48 L40 55 L42 45 L32 45 L40 38 L34 30 L44 32 L42 22 L47 25 Z" 
             fill="url(#canadaGrad)"
           />
        </g>

        {/* Pattern: USA Blue Waves/Stripes */}
        <g filter="url(#shadow)">
          <path 
            d="M20 80 Q 40 70 60 85 T 90 75" 
            fill="none" 
            stroke="url(#usaGrad)" 
            strokeWidth="8" 
            strokeLinecap="round"
            opacity="0.8"
          />
          <path 
            d="M10 85 Q 30 75 50 90 T 80 80" 
            fill="none" 
            stroke="url(#usaGrad)" 
            strokeWidth="4" 
            strokeLinecap="round"
            opacity="0.5"
          />
        </g>

        {/* Central 26 Branding */}
        <text 
          x="52" 
          y="58" 
          fontSize="22" 
          fontWeight="950" 
          textAnchor="middle" 
          fill="#111827" 
          style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.05em', fontStyle: 'italic' }}
        >
          26
        </text>

        {/* Overlay Lens and Shine */}
        <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
        <ellipse cx="35" cy="30" rx="15" ry="10" fill="white" opacity="0.4" transform="rotate(-30 35 30)" />
      </svg>
    </motion.div>
  );
};
