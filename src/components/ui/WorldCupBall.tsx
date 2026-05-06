import React from 'react';
import { motion } from 'motion/react';

interface WorldCupBallProps {
  className?: string;
  animate?: boolean;
}

/**
 * WorldCupBall - FIFA WC 2026 Trinational Elite Ball
 * Based on the trinational specification (CAN, MEX, USA)
 */
export const WorldCupBall: React.FC<WorldCupBallProps> = ({ className = "w-12 h-12", animate = true }) => {
  return (
    <motion.div 
      className={`relative rounded-full bg-white shadow-2xl overflow-hidden ${className}`}
      animate={animate ? { rotate: 360 } : {}}
      transition={animate ? { duration: 18, repeat: Infinity, ease: "linear" } : {}}
      style={{ perspective: '1000px' }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full scale-105">
        <defs>
          <radialGradient id="sphereGrad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f3f4f6" />
          </radialGradient>
          
          <linearGradient id="mexicoGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#006847" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          <linearGradient id="canadaRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF0000" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>

          <linearGradient id="usaBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#002868" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>

          <pattern id="microTexture" x="0" y="0" width="2" height="2" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.2" fill="rgba(0,0,0,0.05)" />
          </pattern>

          <filter id="innerShadow">
            <feOffset dx="0" dy="0" />
            <feGaussianBlur stdDeviation="3" result="offset-blur" />
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
            <feFlood floodColor="black" floodOpacity="0.2" result="color" />
            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base Sphere */}
        <circle cx="50" cy="50" r="48" fill="url(#sphereGrad)" />
        <circle cx="50" cy="50" r="48" fill="url(#microTexture)" />

        {/* High-Frequency Thermal Bonding Seams */}
        <g stroke="rgba(0,0,0,0.12)" strokeWidth="0.6" fill="none" opacity="0.6">
          <path d="M50 2 C 70 20 80 50 50 98" />
          <path d="M2 50 C 20 30 50 20 98 50" />
          <path d="M15 15 L 85 85" />
          <path d="M85 15 L 15 85" />
        </g>

        {/* Mexican Sector: Snake Feather Pattern (Aztec Relief) */}
        <g transform="rotate(45 50 50)" opacity="0.9">
          <path 
            d="M50 10 Q 65 25 50 40 Q 35 25 50 10" 
            fill="url(#mexicoGreen)" 
          />
          <path d="M45 15 L50 20 L55 15 M45 25 L50 30 L55 25" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" fill="none" />
          <circle cx="50" cy="25" r="2" fill="#10b981" opacity="0.3" />
        </g>

        {/* Canadian Sector: Maple Leaf 3D Element */}
        <g transform="translate(68, 22) scale(0.6)" filter="url(#innerShadow)">
          <path 
            d="M50 10 L54 28 L62 25 L58 38 L72 35 L62 48 L75 60 L58 60 L62 80 L50 70 L38 80 L42 60 L25 60 L38 48 L28 35 L42 38 L38 25 L46 28 Z" 
            fill="url(#canadaRed)" 
          />
        </g>

        {/* USA Sector: Deep Blue Inset with Star Motifs */}
        <g transform="translate(15, 65) scale(0.9)" opacity="0.85">
          <path 
            d="M0 0 Q 30 -10 60 10 L 50 30 Q 20 10 0 20 Z" 
            fill="url(#usaBlue)" 
          />
          <circle cx="10" cy="5" r="1.2" fill="white" opacity="0.7" />
          <circle cx="25" cy="8" r="1.2" fill="white" opacity="0.7" />
          <circle cx="40" cy="12" r="1.2" fill="white" opacity="0.7" />
        </g>

        {/* Central Branding 26 */}
        <text 
          x="51" 
          y="57" 
          fontSize="24" 
          fontWeight="950" 
          textAnchor="middle" 
          fill="#111827" 
          style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.1em', filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.5))' }}
        >
          26
        </text>

        {/* Aero-Sipe Grip System (Micro-texture) Overlay */}
        <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" strokeDasharray="0.5 2" />
        
        {/* Final Surface Polish / Pearl Gloss */}
        <ellipse cx="32" cy="28" rx="14" ry="8" fill="white" opacity="0.4" transform="rotate(-35 32 28)" />
        <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      </svg>
    </motion.div>
  );
};
