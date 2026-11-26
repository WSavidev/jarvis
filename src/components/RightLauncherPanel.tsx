import React, { useState } from 'react';
import {
  ExternalLink,
  Code2,
  ListChecks,
  BarChart3,
  Terminal,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import {
  HudModuleId,
  QuickLinkItem,
  WeatherData,
  WorkspaceCategory,
} from '../types/hud';

interface RightLauncherPanelProps {
  quickLinks: QuickLinkItem[];
  highlightedLinkId: string | null;
  weather: WeatherData | null;
  weatherLoading: boolean;
  onRefreshWeather: (city?: string) => void;
  onOpenModule: (mod: HudModuleId) => void;
  onOpenCategory: (cat: WorkspaceCategory) => void;
  stealthMode: boolean;
}

const WORKSPACE_CATEGORIES: WorkspaceCategory[] = [
  'Documentos',
  'Vídeos',
  'Músicas',
  'Programas',
  'Downloads',
  'Imagens',
];

const PRODUCTIVITY_MODULES: Array<{
  id: HudModuleId;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'code_studio', label: 'Estúdio de Código', icon: Code2 },
  { id: 'notes_tasks', label: 'Notas e Tarefas', icon: ListChecks },
  { id: 'data_analyzer', label: 'Analisador de Dados', icon: BarChart3 },
  { id: 'system_terminal', label: 'Terminal do Sistema', icon: Terminal },
];

export const RightLauncherPanel: React.FC<RightLauncherPanelProps> = ({
  quickLinks,
  highlightedLinkId,
  weather,
  weatherLoading,
  onRefreshWeather,
  onOpenModule,
  onOpenCategory,
  stealthMode,
}) => {
  const [editingCity, setEditingCity] = useState(false);
  const [cityInput, setCityInput] = useState('');

  const handleCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cityInput.trim()) {
      onRefreshWeather(cityInput.trim());
      setCityInput('');
      setEditingCity(false);
    }
  };

  return (
    <aside
      className={`flex flex-col justify-between gap-4 transition-opacity duration-300 ${
        stealthMode ? 'opacity-45 hover:opacity-90' : 'opacity-100'
      }`}
    >
      {/* Top-Right: Secondary Radial Turbine + Categories + Quick Links */}
      <section className="flex flex-col gap-3">
        <div className="flex items-start justify-end gap-3">
          {/* Categories Circuit Branch */}
          <div className="flex flex-col items-end gap-1.5 pt-1">
            {WORKSPACE_CATEGORIES.map((cat, idx) => (
              <button
                key={cat}
                type="button"
                onClick={() => onOpenCategory(cat)}
                className="group flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00F0FF]"
              >
                <span className="font-rajdhani text-xs font-semibold tracking-[0.12em] text-[#00D8FF] group-hover:text-[#E6FFFF] transition-colors">
                  {cat}
                </span>
                <span
                  className="h-[1px] bg-[#007A8C] group-hover:bg-[#00F0FF] transition-colors"
                  style={{ width: `${18 + (idx % 3) * 8}px` }}
                />
                <span className="w-2 h-2 rounded-full border border-[#00F0FF] bg-[#06141A] group-hover:bg-[#00F0FF] transition-colors" />
              </button>
            ))}
          </div>

          {/* Secondary Circular Turbine SVG */}
          <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full hud-glow">
              <g className="origin-center animate-spin-ccw-slow">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#007A8C"
                  strokeWidth="1.5"
                  strokeDasharray="16 6 8 6"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke="#00F0FF"
                  strokeWidth="3"
                  strokeDasharray="24 10"
                />
              </g>
              <g className="origin-center animate-spin-cw-med">
                <circle
                  cx="60"
                  cy="60"
                  r="30"
                  fill="#06141A"
                  stroke="#00D8FF"
                  strokeWidth="1.5"
                  strokeDasharray="10 4"
                />
              </g>
              <circle cx="60" cy="60" r="14" fill="#00F0FF" fillOpacity="0.2" stroke="#E6FFFF" strokeWidth="1.2" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="font-tech text-[9px] text-[#E6FFFF] tracking-widest">
                RADIAL
              </span>
            </div>
          </div>
        </div>

        {/* Vertical Quick Links with Glowing Nodes */}
        <div className="flex flex-col items-end gap-1 pr-1 border-r border-[#007A8C]/40">
          <span className="font-tech text-[10px] tracking-[0.2em] text-[#007A8C] uppercase mb-0.5 pr-3">
            ACESSO RÁPIDO
          </span>
          {quickLinks.map((link) => {
            const isHighlighted = highlightedLinkId === link.id;
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex items-center gap-2.5 pr-3 py-0.5 transition-all ${
                  isHighlighted
                    ? 'text-[#E6FFFF] hud-text-glow'
                    : 'text-[#00D8FF] hover:text-[#E6FFFF]'
                }`}
              >
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#00F0FF]" />
                <span className="font-rajdhani text-sm font-medium tracking-[0.1em]">
                  {link.label}
                </span>
                <span className="w-4 h-[1px] bg-[#007A8C] group-hover:bg-[#00F0FF]" />
                <span
                  className={`w-2.5 h-2.5 rounded-full border transition-all ${
                    isHighlighted
                      ? 'border-[#E6FFFF] bg-[#00F0FF] scale-125'
                      : 'border-[#00F0FF] bg-[#06141A] group-hover:bg-[#00F0FF]'
                  }`}
                />
              </a>
            );
          })}
        </div>
      </section>

      {/* Center-Right: Productivity Modules */}
      <section className="flex flex-col items-end gap-1.5 pr-1">
        <span className="font-tech text-[10px] tracking-[0.2em] text-[#007A8C] uppercase mb-0.5">
          MÓDULOS DO SISTEMA
        </span>
        {PRODUCTIVITY_MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => onOpenModule(mod.id)}
              className="group flex items-center gap-2.5 py-1 px-2 border border-transparent hover:border-[#00F0FF]/40 hover:bg-[#00F0FF]/10 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00F0FF]"
            >
              <Icon className="w-3.5 h-3.5 text-[#007A8C] group-hover:text-[#00F0FF] transition-colors" />
              <span className="font-rajdhani text-sm font-semibold tracking-[0.1em] text-[#00D8FF] group-hover:text-[#E6FFFF]">
                {mod.label}
              </span>
              <span className="w-5 h-[1px] bg-[#007A8C] group-hover:bg-[#00F0FF]" />
              <span className="w-2 h-2 rotate-45 border border-[#00F0FF] bg-[#06141A] group-hover:bg-[#00F0FF]" />
            </button>
          );
        })}
      </section>

      {/* Bottom-Right: Atmospheric Analysis */}
      <section className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-3.5">
          <div className="flex flex-col items-end text-right">
            <span className="font-orbitron text-xs font-semibold tracking-[0.16em] text-[#E6FFFF] uppercase hud-text-glow">
              {weather ? weather.condition : 'CALIBRANDO...'}
            </span>
            <span className="font-rajdhani text-xs tracking-[0.12em] text-[#00D8FF] uppercase mt-0.5">
              Análise Atmosférica
            </span>
            <button
              type="button"
              onClick={() => setEditingCity((prev) => !prev)}
              className="mt-1 inline-flex items-center gap-1 font-tech text-[11px] text-[#007A8C] hover:text-[#00F0FF] transition-colors cursor-pointer"
            >
              <MapPin className="w-3 h-3" />
              <span>{weather ? weather.locationName : 'LOCALIZANDO...'}</span>
            </button>
            {weather && (
              <span className="font-tech text-[10px] text-[#007A8C] tabular-nums mt-0.5">
                UMID {weather.humidity}% · VENTO {weather.windKmh} KM/H
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onRefreshWeather()}
            title="Sincronizar Análise Atmosférica"
            className="group relative w-28 h-28 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00F0FF] rounded-full"
          >
            <svg viewBox="0 0 120 120" className="w-full h-full hud-glow">
              <g className="origin-center animate-spin-cw-slow">
                <circle
                  cx="60"
                  cy="60"
                  r="55"
                  fill="none"
                  stroke="#007A8C"
                  strokeWidth="1.2"
                  strokeDasharray="10 6"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="#00F0FF"
                  strokeWidth="2.8"
                  strokeDasharray="55 18 28 18"
                />
              </g>
              <circle
                cx="60"
                cy="60"
                r="40"
                fill="#06141A"
                fillOpacity="0.72"
                stroke="#0B2E36"
                strokeWidth="1"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
              {weatherLoading ? (
                <RefreshCw className="w-6 h-6 text-[#00F0FF] animate-spin" />
              ) : (
                <>
                  <span className="font-orbitron text-3xl font-bold text-[#E6FFFF] tabular-nums hud-text-glow leading-none">
                    {weather ? `${weather.temperatureC}°` : '--°'}
                  </span>
                  <span className="font-tech text-[9px] text-[#00D8FF] tracking-widest mt-1">
                    CELSIUS
                  </span>
                </>
              )}
            </div>
          </button>
        </div>

        {editingCity && (
          <form onSubmit={handleCitySubmit} className="flex items-center gap-1.5">
            <input
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="Cidade (ex: São Paulo)..."
              className="w-44 px-2.5 py-1 text-xs font-tech bg-[#06141A] border border-[#00F0FF]/50 text-[#E6FFFF] placeholder-[#007A8C] focus:outline-none focus:border-[#00F0FF]"
            />
            <button
              type="submit"
              className="px-2.5 py-1 text-xs font-orbitron bg-[#00F0FF]/20 border border-[#00F0FF] text-[#E6FFFF] hover:bg-[#00F0FF]/35 cursor-pointer"
            >
              BUSCAR
            </button>
          </form>
        )}
      </section>
    </aside>
  );
};
