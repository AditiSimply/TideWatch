import React from 'react'

export const BackgroundWaves: React.FC = () => {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Vertical fade overlay from top so content stays clean and readable */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-[#FAFBF8] via-[#FAFBF8]/85 to-[#FAFBF8]/40" />

      {/* SVG Layer Container anchored at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[480px] w-full overflow-hidden">
        {/* Layer 1: Mint to Sage (Deepest, slow drift) */}
        <div className="absolute -bottom-8 -left-[50%] w-[200%] h-full animate-wave-slow opacity-25">
          <svg
            className="w-full h-full"
            viewBox="0 0 2880 480"
            fill="none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#D1FAE5" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#A7C4B5" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#D1FAE5" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <path
              d="M0,192 C360,280 720,110 1080,210 C1440,310 1800,140 2160,220 C2520,300 2880,180 2880,180 L2880,480 L0,480 Z"
              fill="url(#waveGrad1)"
            />
          </svg>
        </div>

        {/* Layer 2: Emerald to Mint (Mid layer, medium drift) */}
        <div className="absolute -bottom-4 -left-[30%] w-[200%] h-full animate-wave-medium opacity-18">
          <svg
            className="w-full h-full"
            viewBox="0 0 2880 480"
            fill="none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="waveGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.5" />
                <stop offset="50%" stopColor="#D1FAE5" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.5" />
              </linearGradient>
            </defs>
            <path
              d="M0,250 C400,160 800,310 1200,220 C1600,130 2000,290 2400,200 C2640,150 2880,240 2880,240 L2880,480 L0,480 Z"
              fill="url(#waveGrad2)"
            />
          </svg>
        </div>

        {/* Layer 3: Sage to Forest mist (Foreground wave, fast subtle drift) */}
        <div className="absolute bottom-0 -left-[20%] w-[200%] h-full animate-wave-fast opacity-12">
          <svg
            className="w-full h-full"
            viewBox="0 0 2880 480"
            fill="none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="waveGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#A7C4B5" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#0F3D2E" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#A7C4B5" stopOpacity="0.6" />
              </linearGradient>
            </defs>
            <path
              d="M0,310 C320,240 640,360 960,300 C1280,240 1600,350 1920,290 C2240,230 2560,340 2880,280 L2880,480 L0,480 Z"
              fill="url(#waveGrad3)"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}
