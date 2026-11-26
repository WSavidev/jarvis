import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { ReactorState } from '../types/hud';

interface LeftTelemetryPanelProps {
  now: Date;
  use24Hour: boolean;
  onToggle24Hour: () => void;
  memoryPercent: number;
  memoryDetail: string;
  contextPercent: number;
  contextCount: number;
  batteryLevel: number;
  batteryCharging: boolean;
  latencyMs: number | null;
  isOnline: boolean;
  reactorState: ReactorState;
  stealthMode: boolean;
  onPingDiagnostic: () => void;
}

export const LeftTelemetryPanel: React.FC<LeftTelemetryPanelProps> = ({
  now,
  use24Hour,
  onToggle24Hour,
  memoryPercent,
  memoryDetail,
  contextPercent,
  contextCount,
  batteryLevel,
  batteryCharging,
  latencyMs,
  isOnline,
  reactorState,
  stealthMode,
  onPingDiagnostic,
}) => {
  const monthName = now.toLocaleDateString('pt-BR', { month: 'long' }).toLowerCase();
  const dayNumber = String(now.getDate()).padStart(2, '0');
  const weekday = now.toLocaleDateString('pt-BR', { weekday: 'long' }).toLowerCase();

  const formattedClock = now.toLocaleTimeString('pt-BR', {
    hour12: !use24Hour,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const batteryStatusLabel = batteryLevel >= 75 ? 'Alta' : batteryLevel >= 35 ? 'Normal' : 'Baixa';
  const batteryStrokeDashoffset = 226.2 * (1 - Math.max(0, Math.min(100, batteryLevel)) / 100);

  const commStatus = !isOnline
    ? 'DESCONECTADO'
    : reactorState === 'processing'
      ? 'SINCRONIZANDO'
      : 'GEMINI CONECTADO';

  return (
    <aside
      className={`flex flex-col justify-between gap-5 transition-opacity duration-300 ${
        stealthMode ? 'opacity-45 hover:opacity-90' : 'opacity-100'
      }`}
    >
      {/* Top-Left: Orbital Chronometer */}
      <section className="relative flex items-center gap-3.5">
        <button
          type="button"
          onClick={onToggle24Hour}
          title="Alternar formato 12h / 24h"
          className="group relative w-32 h-32 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00F0FF] rounded-full"
        >
          <svg viewBox="0 0 140 140" className="w-full h-full hud-glow">
            {/* Outer rotating segmented ring */}
            <g className="origin-center animate-spin-cw-slow">
              <circle
                cx="70"
                cy="70"
                r="64"
                fill="none"
                stroke="#007A8C"
                strokeWidth="1.5"
                strokeDasharray="18 8 6 8"
              />
              <circle
                cx="70"
                cy="70"
                r="58"
                fill="none"
                stroke="#00F0FF"
                strokeWidth="2.5"
                strokeDasharray="46 14 28 14"
                strokeOpacity="0.85"
              />
            </g>
            {/* Inner static dial */}
            <circle
              cx="70"
              cy="70"
              r="49"
              fill="#06141A"
              fillOpacity="0.65"
              stroke="#0B2E36"
              strokeWidth="1"
            />
            <circle
              cx="70"
              cy="70"
              r="45"
              fill="none"
              stroke="#00D8FF"
              strokeWidth="0.8"
              strokeOpacity="0.5"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <span className="font-rajdhani text-xs tracking-[0.16em] text-[#00D8FF] lowercase leading-none">
              {monthName}
            </span>
            <span className="font-orbitron text-3xl font-bold text-[#E6FFFF] hud-text-glow tabular-nums leading-tight mt-0.5">
              {dayNumber}
            </span>
          </div>
        </button>

        {/* Clock & Weekday readout */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-4 h-[1px] bg-[#00F0FF]/70" />
            <span className="font-tech text-[11px] tracking-[0.2em] text-[#007A8C] uppercase">
              CRONÔMETRO
            </span>
          </div>
          <button
            type="button"
            onClick={onToggle24Hour}
            className="text-left font-tech text-2xl xl:text-[26px] text-[#00F0FF] hud-text-glow tracking-wider tabular-nums cursor-pointer hover:text-[#E6FFFF] transition-colors mt-0.5"
          >
            {formattedClock}
          </button>
          <span className="font-rajdhani text-lg font-medium tracking-[0.1em] text-[#00D8FF] lowercase leading-none mt-0.5">
            {weekday}
          </span>
          <span className="font-tech text-[10px] text-[#007A8C] tracking-widest mt-1.5">
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </span>
        </div>
      </section>

      {/* Center-Left: Capacity & Energy */}
      <section className="flex flex-col gap-4 pl-1">
        {/* Capacity Bars */}
        <div className="flex flex-col gap-3">
          <div>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="font-rajdhani font-semibold tracking-[0.12em] text-[#00D8FF] uppercase">
                ALOCAÇÃO DE MEMÓRIA
              </span>
              <span className="font-tech text-xs text-[#E6FFFF] tabular-nums">
                {memoryDetail}
              </span>
            </div>
            <div className="relative h-2.5 w-full bg-[#0B2E36]/60 border border-[#007A8C]/60 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#007A8C] via-[#00D8FF] to-[#00F0FF] transition-all duration-500"
                style={{ width: `${memoryPercent}%` }}
              />
              <div
                className="absolute inset-0 pointer-events-none opacity-40"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg, transparent, transparent 6px, #020406 6px, #020406 8px)',
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="font-rajdhani font-semibold tracking-[0.12em] text-[#00D8FF] uppercase">
                CAPACIDADE DE CONTEXTO
              </span>
              <span className="font-tech text-xs text-[#E6FFFF] tabular-nums">
                {contextPercent}% · {contextCount} MSG
              </span>
            </div>
            <div className="relative h-2.5 w-full bg-[#0B2E36]/60 border border-[#007A8C]/60 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#007A8C] via-[#00D8FF] to-[#E6FFFF] transition-all duration-500"
                style={{ width: `${Math.max(6, contextPercent)}%` }}
              />
              <div
                className="absolute inset-0 pointer-events-none opacity-40"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg, transparent, transparent 6px, #020406 6px, #020406 8px)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Circular Energy Gauge */}
        <div className="flex items-center gap-4 pt-1">
          <div className="relative w-24 h-24 shrink-0">
            <svg viewBox="0 0 96 96" className="w-full h-full hud-glow">
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke="#0B2E36"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <circle
                cx="48"
                cy="48"
                r="36"
                fill="#06141A"
                fillOpacity="0.5"
                stroke="#007A8C"
                strokeWidth="4"
                strokeOpacity="0.35"
              />
              <circle
                cx="48"
                cy="48"
                r="36"
                fill="none"
                stroke={batteryLevel <= 20 ? '#FF9E00' : '#00F0FF'}
                strokeWidth="4"
                strokeLinecap="butt"
                strokeDasharray="226.2"
                strokeDashoffset={batteryStrokeDashoffset}
                transform="rotate(-90 48 48)"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
              <span className="font-orbitron text-lg font-bold text-[#E6FFFF] tabular-nums leading-none">
                {batteryLevel}%
              </span>
              <span className="font-tech text-[9px] text-[#00D8FF] tracking-widest uppercase mt-1">
                {batteryCharging ? 'CARREGANDO' : 'ENERGIA'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-[1px] bg-[#00F0FF]" />
              <span className="font-rajdhani text-sm font-semibold tracking-[0.12em] text-[#E6FFFF] uppercase">
                Energia: {batteryLevel}% {batteryStatusLabel}
              </span>
            </div>
            <span className="font-tech text-[11px] text-[#007A8C] pl-8">
              {batteryCharging ? 'REDE EXTERNA CONECTADA' : 'CÉLULA ARC ESTÁVEL'}
            </span>
          </div>
        </div>
      </section>

      {/* Bottom-Left: Communication & Gemini Link */}
      <section className="flex items-center gap-3.5 pt-1">
        <button
          type="button"
          onClick={onPingDiagnostic}
          title="Executar ping de latência na API"
          className="group relative w-24 h-24 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00F0FF] rounded-full"
        >
          <svg viewBox="0 0 96 96" className="w-full h-full hud-glow">
            <g className="origin-center animate-spin-ccw-slow">
              <circle
                cx="48"
                cy="48"
                r="43"
                fill="none"
                stroke="#007A8C"
                strokeWidth="1"
                strokeDasharray="12 6"
              />
              <circle
                cx="48"
                cy="48"
                r="37"
                fill="none"
                stroke={
                  !isOnline
                    ? '#FF9E00'
                    : reactorState === 'processing'
                      ? '#FF9E00'
                      : '#00F0FF'
                }
                strokeWidth="2"
                strokeDasharray="34 10 14 10"
              />
            </g>
            <circle cx="48" cy="48" r="29" fill="#06141A" fillOpacity="0.7" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isOnline ? (
              <Wifi className="w-5 h-5 text-[#00F0FF] group-hover:scale-110 transition-transform" />
            ) : (
              <WifiOff className="w-5 h-5 text-[#FF9E00]" />
            )}
            <span className="font-tech text-[10px] text-[#E6FFFF] tabular-nums mt-1">
              {latencyMs !== null ? `${latencyMs}ms` : '-- ms'}
            </span>
          </div>
        </button>

        <div className="flex flex-col min-w-0">
          <span className="font-tech text-[10px] tracking-[0.2em] text-[#007A8C] uppercase">
            Comunicação
          </span>
          <span
            className={`font-orbitron text-sm font-semibold tracking-wider truncate ${
              !isOnline
                ? 'text-[#FF9E00]'
                : reactorState === 'processing'
                  ? 'text-[#FF9E00]'
                  : 'text-[#00F0FF] hud-text-glow'
            }`}
          >
            {commStatus}
          </span>
          <button
            type="button"
            onClick={onPingDiagnostic}
            className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-tech text-[#00D8FF] hover:text-[#E6FFFF] transition-colors w-fit cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>TESTAR LATÊNCIA</span>
          </button>
        </div>
      </section>
    </aside>
  );
};
