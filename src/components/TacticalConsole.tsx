import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Globe,
  Trash2,
} from 'lucide-react';
import { ChatMessage, ReactorState } from '../types/hud';

interface TacticalConsoleProps {
  messages: ChatMessage[];
  reactorState: ReactorState;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  isListening: boolean;
  onToggleListen: () => void;
  onSendMessage: (text: string) => Promise<void>;
  onClearLog: () => void;
  stealthMode: boolean;
  errorBanner: string | null;
  onDismissError: () => void;
}

export const TacticalConsole: React.FC<TacticalConsoleProps> = ({
  messages,
  reactorState,
  ttsEnabled,
  onToggleTts,
  isListening,
  onToggleListen,
  onSendMessage,
  onClearLog,
  stealthMode,
  errorBanner,
  onDismissError,
}) => {
  const [input, setInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const latestJarvis = [...messages]
    .reverse()
    .find((m) => m.role === 'jarvis' || m.role === 'system');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || reactorState === 'processing') return;
    setInput('');
    await onSendMessage(trimmed);
  };

  return (
    <footer
      className={`relative z-30 w-full max-w-4xl mx-auto transition-opacity duration-300 ${
        stealthMode ? 'opacity-65 hover:opacity-100' : 'opacity-100'
      }`}
    >
      {/* Expandable Full Transcript Drawer */}
      {drawerOpen && (
        <div className="mb-2 max-h-60 overflow-y-auto hud-scroll bg-[#040B0F]/92 backdrop-blur-md border border-[#00F0FF]/45 p-3.5 space-y-2.5 shadow-[0_0_25px_rgba(0,240,255,0.14)]">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#007A8C]/40">
            <span className="font-orbitron text-[11px] tracking-[0.18em] text-[#00D8FF]">
              REGISTRO DE COMUNICAÇÃO ({messages.length})
            </span>
            <button
              type="button"
              onClick={onClearLog}
              className="inline-flex items-center gap-1 font-tech text-[11px] text-[#007A8C] hover:text-[#FF9E00] cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>LIMPAR</span>
            </button>
          </div>
          {messages.length === 0 ? (
            <div className="font-tech text-xs text-[#007A8C] py-3 text-center">
              Nenhuma transmissão registrada nesta sessão.
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="text-xs leading-relaxed">
                <div className="flex items-center gap-2 font-tech text-[10px] text-[#007A8C]">
                  <span
                    className={
                      msg.role === 'user'
                        ? 'text-[#E6FFFF]'
                        : msg.role === 'system'
                          ? 'text-[#FF9E00]'
                          : 'text-[#00F0FF]'
                    }
                  >
                    {msg.role === 'user'
                      ? 'SENHOR'
                      : msg.role === 'system'
                        ? 'SISTEMA'
                        : 'J.A.R.V.I.S.'}
                  </span>
                  <span>·</span>
                  <span>{msg.timestamp}</span>
                </div>
                <p className="font-rajdhani text-sm text-[#E6FFFF]/95 mt-0.5 whitespace-pre-wrap">
                  {msg.text}
                </p>
                {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {msg.groundingLinks.slice(0, 4).map((gl, idx) => (
                      <a
                        key={idx}
                        href={gl.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-tech text-[10px] text-[#00D8FF] hover:text-[#E6FFFF] underline underline-offset-2"
                      >
                        <Globe className="w-2.5 h-2.5" />
                        <span className="max-w-[180px] truncate">{gl.title}</span>
                      </a>
                    ))}
                  </div>
                )}
                {msg.quickLinkAction && (
                  <div className="mt-1.5">
                    <a
                      href={msg.quickLinkAction.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-orbitron border border-[#00F0FF] bg-[#00F0FF]/15 text-[#E6FFFF] hover:bg-[#00F0FF]/30"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>ABRIR {msg.quickLinkAction.siteName.toUpperCase()}</span>
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Error Alert Banner if API key / network issue occurs */}
      {errorBanner && (
        <div className="mb-2 flex items-center justify-between gap-3 px-3.5 py-2 bg-[#1A0D02]/90 border border-[#FF9E00]/70 text-xs font-tech text-[#FF9E00]">
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={onDismissError}
            className="text-[#E6FFFF] hover:underline cursor-pointer shrink-0"
          >
            FECHAR
          </button>
        </div>
      )}

      {/* Latest Reply Strip + Grounding/Action shortcut */}
      {latestJarvis && !drawerOpen && (
        <div className="mb-2 px-4 py-2 bg-[#040B0F]/85 backdrop-blur-sm border border-[#007A8C]/50 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-tech text-[10px] text-[#00D8FF]">
              <span>J.A.R.V.I.S.</span>
              <span>·</span>
              <span>{latestJarvis.timestamp}</span>
              {latestJarvis.groundingLinks &&
                latestJarvis.groundingLinks.length > 0 && (
                  <>
                    <span>·</span>
                    <a
                      href={latestJarvis.groundingLinks[0].uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#00F0FF] hover:underline"
                    >
                      <Globe className="w-2.5 h-2.5" />
                      <span className="truncate max-w-[160px]">
                        {latestJarvis.groundingLinks[0].title}
                      </span>
                    </a>
                  </>
                )}
            </div>
            <p className="font-rajdhani text-sm text-[#E6FFFF] truncate">
              {latestJarvis.text}
            </p>
          </div>
          {latestJarvis.quickLinkAction && (
            <a
              href={latestJarvis.quickLinkAction.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-orbitron border border-[#00F0FF] bg-[#00F0FF]/15 text-[#E6FFFF] hover:bg-[#00F0FF]/30 shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
              <span>{latestJarvis.quickLinkAction.siteName}</span>
            </a>
          )}
        </div>
      )}

      {/* Command Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-3 py-2 bg-[#040B0F]/90 backdrop-blur-md border border-[#00F0FF]/45 shadow-[0_0_20px_rgba(0,240,255,0.1)]"
      >
        <button
          type="button"
          onClick={onToggleListen}
          title={isListening ? 'Parar captura de voz' : 'Ativar comando de voz'}
          className={`p-2 border transition-colors cursor-pointer shrink-0 ${
            isListening
              ? 'border-[#00F0FF] bg-[#00F0FF]/25 text-[#E6FFFF]'
              : 'border-[#007A8C]/70 text-[#00D8FF] hover:border-[#00F0FF] hover:text-[#E6FFFF]'
          }`}
        >
          {isListening ? (
            <Mic className="w-4 h-4" />
          ) : (
            <MicOff className="w-4 h-4" />
          )}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isListening
              ? 'Escutando comando de voz...'
              : 'Transmitir diretiva ao J.A.R.V.I.S. (ex: "Qual o clima em Tóquio?", "Abrir Code Studio")...'
          }
          className="flex-1 min-w-0 bg-transparent px-2 py-1 font-rajdhani text-sm sm:text-base text-[#E6FFFF] placeholder-[#007A8C] focus:outline-none"
        />

        <button
          type="button"
          onClick={onToggleTts}
          title={ttsEnabled ? 'Silenciar voz J.A.R.V.I.S.' : 'Ativar voz J.A.R.V.I.S.'}
          className={`p-2 border transition-colors cursor-pointer shrink-0 ${
            ttsEnabled
              ? 'border-[#007A8C]/70 text-[#00F0FF] hover:border-[#00F0FF]'
              : 'border-[#0B2E36] text-[#007A8C] hover:text-[#00D8FF]'
          }`}
        >
          {ttsEnabled ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setDrawerOpen((prev) => !prev)}
          title="Alternar histórico completo"
          className="inline-flex items-center gap-1 px-2.5 py-2 border border-[#007A8C]/70 text-[#00D8FF] hover:border-[#00F0FF] hover:text-[#E6FFFF] transition-colors cursor-pointer shrink-0"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="font-tech text-xs tabular-nums">{messages.length}</span>
          {drawerOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          type="submit"
          disabled={!input.trim() || reactorState === 'processing'}
          className="inline-flex items-center gap-1.5 px-4 py-2 font-orbitron text-xs font-semibold tracking-wider bg-[#00F0FF]/20 border border-[#00F0FF] text-[#E6FFFF] hover:bg-[#00F0FF]/35 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">ENVIAR</span>
        </button>
      </form>
    </footer>
  );
};
