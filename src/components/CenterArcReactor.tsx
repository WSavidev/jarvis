import React, { useState } from 'react';
import { Mic, MicOff, Camera } from 'lucide-react';
import { ReactorState } from '../types/hud';

export interface TrapezoidCommand {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  active?: boolean;
  critical?: boolean;
}

interface CenterArcReactorProps {
  now: Date;
  use24Hour: boolean;
  reactorState: ReactorState;
  audioLevel: number; // 0 to 1
  interactionCount: number;
  commands: TrapezoidCommand[];
  onCommandTrigger: (id: string) => void;
  onCoreClick: () => void;
  stealthMode: boolean;
  visionActive: boolean;
  onOpenVision: () => void;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function createAnnularSectorPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number
): string {
  const p1 = polarToCartesian(cx, cy, rOuter, startAngle);
  const p2 = polarToCartesian(cx, cy, rOuter, endAngle);
  const p3 = polarToCartesian(cx, cy, rInner, endAngle);
  const p4 = polarToCartesian(cx, cy, rInner, startAngle);
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 0 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'TH';
  switch (day % 10) {
    case 1:
      return 'ST';
    case 2:
      return 'ND';
    case 3:
      return 'RD';
    default:
      return 'TH';
  }
}

export const CenterArcReactor: React.FC<CenterArcReactorProps> = ({
  now,
  use24Hour,
  reactorState,
  audioLevel,
  interactionCount,
  commands,
  onCommandTrigger,
  onCoreClick,
  stealthMode,
  visionActive,
  onOpenVision,
}) => {
  const [hoveredCmd, setHoveredCmd] = useState<TrapezoidCommand | null>(null);

  const cx = 250;
  const cy = 250;

  const upperTime = now.toLocaleTimeString('pt-BR', {
    hour12: !use24Hour,
    hour: '2-digit',
    minute: '2-digit',
  });

  const day = now.getDate();
  const monthShort = now
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '')
    .toUpperCase();
  const lowerDate = `${day} DE ${monthShort}`;

  const clampedAudio = Math.min(1, Math.max(0, audioLevel));
  const turbineScale = 1 + clampedAudio * 0.16;
  const isAmber = reactorState === 'processing' || reactorState === 'alert';
  const activeColor = isAmber ? '#FF9E00' : '#00F0FF';

  const statusText =
    reactorState === 'listening'
      ? 'ESCUTANDO'
      : reactorState === 'speaking'
        ? 'FALANDO'
        : reactorState === 'processing'
          ? 'PROCESSANDO'
          : 'CLIQUE P/ FALAR';

  // 72 calibration outer tick marks
  const calibrationTicks = Array.from({ length: 72 }, (_, idx) => {
    const angle = idx * 5;
    const isMajor = idx % 6 === 0;
    const r1 = isMajor ? 224 : 229;
    const r2 = 236;
    const p1 = polarToCartesian(cx, cy, r1, angle);
    const p2 = polarToCartesian(cx, cy, r2, angle);
    return { idx, p1, p2, isMajor };
  });

  // 16 inner turbine teeth
  const turbineTeeth = Array.from({ length: 16 }, (_, idx) => {
    const angle = idx * 22.5;
    return createAnnularSectorPath(cx, cy, 88, 104, angle - 6, angle + 6);
  });

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* Radial Core Vignette Glow */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-500"
        style={{
          background: isAmber
            ? 'radial-gradient(circle, rgba(255,158,0,0.16) 0%, rgba(6,20,26,0.35) 45%, transparent 72%)'
            : `radial-gradient(circle, rgba(0,240,255,${
                stealthMode ? 0.06 : 0.14 + clampedAudio * 0.16
              }) 0%, rgba(6,20,26,0.4) 48%, transparent 74%)`,
        }}
      />

      {/* Main Concentric Arc Reactor SVG */}
      <div className="relative w-full max-w-[490px] aspect-square">
        <svg
          viewBox="0 0 500 500"
          className={`w-full h-full overflow-visible transition-all duration-300 ${
            stealthMode ? 'opacity-65' : 'opacity-100'
          }`}
        >
          <defs>
            <filter id="cyan-neon" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="amber-neon" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Ring 1: Outer Calibration & Coordinates */}
          <g className="origin-center animate-spin-cw-slow" style={{ transformOrigin: '250px 250px' }}>
            <circle
              cx={cx}
              cy={cy}
              r="242"
              fill="none"
              stroke="#0B2E36"
              strokeWidth="1"
              strokeDasharray="8 6 2 6"
            />
            <circle
              cx={cx}
              cy={cy}
              r="236"
              fill="none"
              stroke="#007A8C"
              strokeWidth="1.2"
              strokeOpacity="0.65"
            />
            {calibrationTicks.map((t) => (
              <line
                key={t.idx}
                x1={t.p1.x}
                y1={t.p1.y}
                x2={t.p2.x}
                y2={t.p2.y}
                stroke={t.isMajor ? '#00F0FF' : '#007A8C'}
                strokeWidth={t.isMajor ? '1.6' : '0.9'}
                strokeOpacity={t.isMajor ? 0.9 : 0.5}
              />
            ))}
          </g>

          {/* Static cardinal degree coordinates */}
          <g className="font-tech text-[9px] fill-[#007A8C]" textAnchor="middle">
            <text x="250" y="18">000°</text>
            <text x="484" y="253">090°</text>
            <text x="250" y="492">180°</text>
            <text x="18" y="253">270°</text>
          </g>

          {/* Outer segmented structural arc */}
          <g className="origin-center animate-spin-ccw-slow" style={{ transformOrigin: '250px 250px' }}>
            <circle
              cx={cx}
              cy={cy}
              r="214"
              fill="none"
              stroke="#00D8FF"
              strokeWidth="1.5"
              strokeDasharray="62 18 22 18"
              strokeOpacity="0.55"
            />
            <circle
              cx={cx}
              cy={cy}
              r="204"
              fill="none"
              stroke="#007A8C"
              strokeWidth="1"
              strokeDasharray="4 8"
            />
          </g>

          {/* Ring 2: 24 Interactive Trapezoidal Modules */}
          <g>
            {commands.slice(0, 24).map((cmd, index) => {
              const startAngle = index * 15 + 1.1;
              const endAngle = (index + 1) * 15 - 1.1;
              const midAngle = index * 15 + 7.5;
              const pathD = createAnnularSectorPath(cx, cy, 146, 196, startAngle, endAngle);
              const labelPos = polarToCartesian(cx, cy, 171, midAngle);
              const isHovered = hoveredCmd?.id === cmd.id;
              const isActive = Boolean(cmd.active);

              const fill = isActive
                ? cmd.critical
                  ? 'rgba(255, 158, 0, 0.28)'
                  : 'rgba(0, 240, 255, 0.28)'
                : isHovered
                  ? 'rgba(0, 240, 255, 0.22)'
                  : 'rgba(11, 46, 54, 0.34)';

              const stroke = isActive
                ? cmd.critical
                  ? '#FF9E00'
                  : '#00F0FF'
                : isHovered
                  ? '#E6FFFF'
                  : '#007A8C';

              // Flip bottom half labels so text stays readable
              const normalizedAngle = ((midAngle % 360) + 360) % 360;
              const textRotation =
                normalizedAngle > 90 && normalizedAngle < 270
                  ? midAngle + 180
                  : midAngle;

              return (
                <g
                  key={cmd.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${cmd.label}: ${cmd.description}`}
                  onClick={() => onCommandTrigger(cmd.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onCommandTrigger(cmd.id);
                    }
                  }}
                  onMouseEnter={() => setHoveredCmd(cmd)}
                  onMouseLeave={() => setHoveredCmd(null)}
                  className="cursor-pointer focus:outline-none"
                  filter={isActive || isHovered ? 'url(#cyan-neon)' : undefined}
                >
                  <path
                    d={pathD}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isActive || isHovered ? 1.8 : 1}
                    className="transition-all duration-150"
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    fill={isActive || isHovered ? '#E6FFFF' : '#00D8FF'}
                    fontSize="6.6"
                    fontFamily="Orbitron, sans-serif"
                    fontWeight="600"
                    letterSpacing="0.06em"
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${textRotation} ${labelPos.x} ${labelPos.y})`}
                    className="pointer-events-none select-none"
                  >
                    {cmd.shortLabel}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Upper Digital Visor Bracket (Time) */}
          <g>
            <path
              d="M 192 126 L 204 113 L 296 113 L 308 126 L 296 136 L 204 136 Z"
              fill="#06141A"
              fillOpacity="0.88"
              stroke={activeColor}
              strokeWidth="1.2"
              filter="url(#cyan-neon)"
            />
            <text
              x="250"
              y="125.5"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#E6FFFF"
              fontSize="12"
              fontFamily="Share Tech Mono, monospace"
              letterSpacing="0.14em"
            >
              {upperTime}
            </text>
          </g>

          {/* Lower Digital Visor Bracket (Day/Month) */}
          <g>
            <path
              d="M 192 374 L 204 364 L 296 364 L 308 374 L 296 387 L 204 387 Z"
              fill="#06141A"
              fillOpacity="0.88"
              stroke={activeColor}
              strokeWidth="1.2"
              filter="url(#cyan-neon)"
            />
            <text
              x="250"
              y="376"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#E6FFFF"
              fontSize="11.5"
              fontFamily="Share Tech Mono, monospace"
              letterSpacing="0.14em"
            >
              {lowerDate}
            </text>
          </g>

          {/* Ring 3: Audio-Reactive Inner Toothed Turbine */}
          <g
            style={{
              transformOrigin: '250px 250px',
              transform: `scale(${turbineScale})`,
              transition: 'transform 65ms linear',
            }}
          >
            <g
              className={
                reactorState === 'listening' || reactorState === 'speaking'
                  ? 'animate-spin-ccw-fast'
                  : 'animate-spin-cw-med'
              }
              style={{ transformOrigin: '250px 250px' }}
              filter={isAmber ? 'url(#amber-neon)' : 'url(#cyan-neon)'}
            >
              <circle
                cx={cx}
                cy={cy}
                r="112"
                fill="none"
                stroke={activeColor}
                strokeWidth="2.5"
                strokeDasharray="36 12 18 12"
              />
              <circle
                cx={cx}
                cy={cy}
                r="105"
                fill="none"
                stroke="#E6FFFF"
                strokeWidth="1.2"
                strokeOpacity={0.55 + clampedAudio * 0.45}
              />
              {turbineTeeth.map((toothPath, idx) => (
                <path
                  key={idx}
                  d={toothPath}
                  fill={idx % 2 === 0 ? activeColor : '#E6FFFF'}
                  fillOpacity={0.45 + clampedAudio * 0.55}
                  stroke={activeColor}
                  strokeWidth="0.9"
                />
              ))}
            </g>

            {/* Inner glowing ring around core button */}
            <circle
              cx={cx}
              cy={cy}
              r="76"
              fill="#020406"
              fillOpacity="0.9"
              stroke={activeColor}
              strokeWidth={2 + clampedAudio * 2.5}
              filter={isAmber ? 'url(#amber-neon)' : 'url(#cyan-neon)'}
            />
            <circle
              cx={cx}
              cy={cy}
              r="68"
              fill="none"
              stroke="#E6FFFF"
              strokeWidth="0.8"
              strokeDasharray="6 4"
              strokeOpacity="0.65"
            />
          </g>
        </svg>

        {/* Central Core HTML Overlay Button */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <button
            type="button"
            onClick={onCoreClick}
            className={`pointer-events-auto relative w-[124px] h-[124px] rounded-full flex flex-col items-center justify-center cursor-pointer transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] ${
              reactorState === 'listening'
                ? 'bg-[#00F0FF]/15'
                : reactorState === 'processing'
                  ? 'bg-[#FF9E00]/15'
                  : 'bg-[#06141A]/75 hover:bg-[#00F0FF]/10'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[#00D8FF]">
              {reactorState === 'listening' ? (
                <Mic className="w-5 h-5 text-[#00F0FF]" />
              ) : reactorState === 'processing' ? (
                <MicOff className="w-5 h-5 text-[#FF9E00]" />
              ) : (
                <Mic className="w-4 h-4 text-[#00D8FF]" />
              )}
              <span className="font-orbitron text-lg font-bold text-[#E6FFFF] tabular-nums hud-text-glow">
                {String(interactionCount).padStart(2, '0')}
              </span>
            </div>

            <span
              className={`font-orbitron text-[9px] font-semibold tracking-[0.16em] mt-1.5 ${
                isAmber ? 'text-[#FF9E00]' : 'text-[#00F0FF]'
              }`}
            >
              {statusText}
            </span>

            {visionActive && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenVision();
                }}
                className="mt-1 inline-flex items-center gap-1 text-[9px] font-tech text-[#E6FFFF] border border-[#00F0FF]/50 px-1.5 py-0.5 bg-[#020406]/80"
              >
                <Camera className="w-2.5 h-2.5 text-[#00F0FF]" />
                CÂMERA ATIVA
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Live Hovered Trapezoid Telemetry Readout */}
      <div className="h-6 mt-1 flex items-center justify-center">
        {hoveredCmd ? (
          <div className="flex items-center gap-2 font-tech text-xs tracking-wider text-[#00F0FF] hud-text-glow">
            <span className="text-[#E6FFFF] font-semibold">[{hoveredCmd.label}]</span>
            <span className="text-[#00D8FF]">{hoveredCmd.description}</span>
          </div>
        ) : (
          <div className="font-tech text-[11px] tracking-[0.18em] text-[#007A8C] uppercase">
            NÚCLEO ARC REACTOR · 24 MÓDULOS TÁTICOS EM ESPERA
          </div>
        )}
      </div>
    </div>
  );
};
