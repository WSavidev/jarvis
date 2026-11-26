import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Copy,
  Check,
  Sparkles,
  Plus,
  Trash2,
  Camera,
  Upload,
  Send,
  FolderOpen,
} from 'lucide-react';
import {
  CodeStudioState,
  HudModuleId,
  NoteTaskItem,
  WorkspaceCategory,
} from '../types/hud';

interface HudModalsProps {
  activeModule: HudModuleId | null;
  activeCategory: WorkspaceCategory;
  onClose: () => void;
  codeStudio: CodeStudioState;
  onUpdateCodeStudio: (next: CodeStudioState) => void;
  notes: NoteTaskItem[];
  onAddNote: (text: string, type: 'note' | 'task') => void;
  onToggleNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onAskJarvis: (
    prompt: string,
    image?: { base64: string; mimeType: string; preview: string }
  ) => Promise<void>;
  terminalLines: string[];
  onRunTerminalCommand: (cmd: string) => void;
  isProcessing: boolean;
}

const WORKSPACE_PRESETS: Record<
  WorkspaceCategory,
  Array<{ name: string; meta: string; prompt: string }>
> = {
  Documentos: [
    {
      name: 'Relatório Executivo.md',
      meta: 'Resumo Tático · 4.2 KB',
      prompt: 'Gere um resumo executivo estruturado sobre meus objetivos e tarefas atuais.',
    },
    {
      name: 'Arquitetura_HUD.spec',
      meta: 'Especificação Técnica · 12.8 KB',
      prompt: 'Explique a arquitetura do sistema J.A.R.V.I.S. HUD e seus módulos conectados.',
    },
  ],
  Vídeos: [
    {
      name: 'Análise Visual Ao Vivo',
      meta: 'Câmera de Visão · 1080p',
      prompt: 'Ative o módulo Vision Cam para analisarmos o ambiente pela câmera.',
    },
    {
      name: 'Feed YouTube Tecnologia',
      meta: 'Atalho Externo · Transmissão',
      prompt: 'Prepare o atalho para abrir o YouTube no painel rápido.',
    },
  ],
  Músicas: [
    {
      name: 'Síntese Vocal Neural',
      meta: 'Gemini 3.8 TTS · 24 kHz WAV',
      prompt: 'Faça um teste de síntese de voz confirmando que o áudio do reator está calibrado.',
    },
    {
      name: 'Frequência de Foco',
      meta: 'Acústica · Concentração',
      prompt: 'Sugira uma trilha sonora ideal para sessões profundas de engenharia e código.',
    },
  ],
  Programas: [
    {
      name: 'Estúdio de Código',
      meta: 'Módulo Interno · Gerador e Auditor',
      prompt: 'Abra o módulo Code Studio com um script TypeScript útil de telemetria.',
    },
    {
      name: 'Terminal do Sistema',
      meta: 'Console Tático · CLI',
      prompt: 'Abra o módulo System Terminal para comandos diretos.',
    },
  ],
  Downloads: [
    {
      name: 'Exportar Log da Sessão',
      meta: 'Histórico JSON / Texto',
      prompt: 'Faça um resumo das últimas interações e decisões tomadas nesta sessão.',
    },
    {
      name: 'Sincronização Google Drive',
      meta: 'Nuvem · Repositório',
      prompt: 'Prepare o link de acesso ao Google Drive no painel rápido.',
    },
  ],
  Imagens: [
    {
      name: 'Analisador Multimodal',
      meta: 'Analisador de Dados · PNG/JPEG/WEBP',
      prompt: 'Abra o módulo Data Analyzer para inspecionarmos uma imagem ou documento.',
    },
    {
      name: 'Captura Óptica (Câmera)',
      meta: 'Captura → Visão Gemini',
      prompt: 'Abra a Vision Cam para capturar uma imagem e analisá-la.',
    },
  ],
};

export const HudModals: React.FC<HudModalsProps> = ({
  activeModule,
  activeCategory,
  onClose,
  codeStudio,
  onUpdateCodeStudio,
  notes,
  onAddNote,
  onToggleNote,
  onDeleteNote,
  onAskJarvis,
  terminalLines,
  onRunTerminalCommand,
  isProcessing,
}) => {
  const [copied, setCopied] = useState(false);
  const [codePrompt, setCodePrompt] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteType, setNewNoteType] = useState<'task' | 'note'>('task');
  const [dataInput, setDataInput] = useState('');
  const [uploadedImage, setUploadedImage] = useState<{
    base64: string;
    mimeType: string;
    preview: string;
  } | null>(null);
  const [termInput, setTermInput] = useState('');

  // Vision Cam state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeModule) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeModule, onClose]);

  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      if (activeModule !== 'vision_cam') return;
      setCamError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setCamError(
          err instanceof Error
            ? err.message
            : 'Não foi possível acessar a câmera do dispositivo.'
        );
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [activeModule]);

  if (!activeModule) return null;

  const moduleTitleMap: Record<HudModuleId, string> = {
    code_studio: 'ESTÚDIO DE CÓDIGO // IDE HOLOGRÁFICA',
    notes_tasks: 'NOTAS E TAREFAS // MEMÓRIA TÁTICA',
    data_analyzer: 'ANALISADOR DE DADOS // MOTOR MULTIMODAL',
    system_terminal: 'TERMINAL DO SISTEMA // CONSOLE DE COMANDOS',
    vision_cam: 'CÂMERA DE VISÃO // SENSOR ÓPTICO',
    workspace_dir: `DIRETÓRIO DE TRABALHO // ${activeCategory.toUpperCase()}`,
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeStudio.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const commaIdx = result.indexOf(',');
        if (commaIdx !== -1) {
          setUploadedImage({
            base64: result.slice(commaIdx + 1),
            mimeType: file.type,
            preview: result,
          });
        }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setDataInput(String(reader.result || '').slice(0, 12000));
      };
      reader.readAsText(file);
    }
  };

  const handleCaptureVision = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1] || '';
    await onAskJarvis(
      'Analise detalhadamente o que você vê nesta captura da câmera óptica e informe ao Senhor.',
      { base64, mimeType: 'image/jpeg', preview: dataUrl }
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#020406]/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[82vh] flex flex-col bg-[#040B0F]/95 border border-[#00F0FF]/55 shadow-[0_0_40px_rgba(0,240,255,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Corner brackets */}
        <span className="absolute -top-[1px] -left-[1px] w-3 h-3 border-t-2 border-l-2 border-[#E6FFFF]" />
        <span className="absolute -top-[1px] -right-[1px] w-3 h-3 border-t-2 border-r-2 border-[#E6FFFF]" />
        <span className="absolute -bottom-[1px] -left-[1px] w-3 h-3 border-b-2 border-l-2 border-[#E6FFFF]" />
        <span className="absolute -bottom-[1px] -right-[1px] w-3 h-3 border-b-2 border-r-2 border-[#E6FFFF]" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#007A8C]/50 bg-[#06141A]/80">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rotate-45 bg-[#00F0FF]" />
            <h2 className="font-orbitron text-xs sm:text-sm font-semibold tracking-[0.18em] text-[#E6FFFF]">
              {moduleTitleMap[activeModule]}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar módulo"
            className="p-1 text-[#00D8FF] hover:text-[#E6FFFF] hover:bg-[#00F0FF]/15 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto hud-scroll flex-1">
          {activeModule === 'code_studio' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={codeStudio.title}
                    onChange={(e) =>
                      onUpdateCodeStudio({ ...codeStudio, title: e.target.value })
                    }
                    className="px-2.5 py-1 text-xs font-tech bg-[#06141A] border border-[#007A8C] text-[#E6FFFF] focus:outline-none focus:border-[#00F0FF]"
                  />
                  <input
                    type="text"
                    value={codeStudio.language}
                    onChange={(e) =>
                      onUpdateCodeStudio({
                        ...codeStudio,
                        language: e.target.value,
                      })
                    }
                    className="w-28 px-2.5 py-1 text-xs font-tech bg-[#06141A] border border-[#007A8C] text-[#00F0FF] uppercase focus:outline-none focus:border-[#00F0FF]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-tech border border-[#00F0FF]/50 text-[#00F0FF] hover:bg-[#00F0FF]/15 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>COPIADO</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>COPIAR CÓDIGO</span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                value={codeStudio.code}
                onChange={(e) =>
                  onUpdateCodeStudio({ ...codeStudio, code: e.target.value })
                }
                rows={11}
                spellCheck={false}
                className="w-full p-3 font-tech text-xs leading-relaxed bg-[#020406] border border-[#007A8C]/70 text-[#E6FFFF] focus:outline-none focus:border-[#00F0FF] hud-scroll"
              />

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!codePrompt.trim()) return;
                  const p = codePrompt.trim();
                  setCodePrompt('');
                  await onAskJarvis(
                    `No módulo Code Studio (linguagem atual: ${codeStudio.language}), execute esta solicitação e use a ferramenta write_to_code_studio se for gerar código:\n${p}\n\nCódigo atual:\n${codeStudio.code.slice(0, 3000)}`
                  );
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={codePrompt}
                  onChange={(e) => setCodePrompt(e.target.value)}
                  placeholder="Peça ao J.A.R.V.I.S. para gerar, refatorar ou explicar código..."
                  className="flex-1 px-3 py-2 text-xs font-tech bg-[#06141A] border border-[#007A8C] text-[#E6FFFF] placeholder-[#007A8C] focus:outline-none focus:border-[#00F0FF]"
                />
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-orbitron bg-[#00F0FF]/20 border border-[#00F0FF] text-[#E6FFFF] hover:bg-[#00F0FF]/35 disabled:opacity-40 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>EXECUTAR</span>
                </button>
              </form>
            </div>
          )}

          {activeModule === 'notes_tasks' && (
            <div className="flex flex-col gap-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newNoteText.trim()) return;
                  onAddNote(newNoteText.trim(), newNoteType);
                  setNewNoteText('');
                }}
                className="flex flex-wrap gap-2"
              >
                <select
                  value={newNoteType}
                  onChange={(e) =>
                    setNewNoteType(e.target.value as 'task' | 'note')
                  }
                  className="px-2.5 py-2 text-xs font-tech bg-[#06141A] border border-[#007A8C] text-[#00F0FF] uppercase focus:outline-none"
                >
                  <option value="task">TAREFA</option>
                  <option value="note">NOTA</option>
                </select>
                <input
                  type="text"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Nova diretiva, tarefa ou anotação..."
                  className="flex-1 min-w-[180px] px-3 py-2 text-xs font-tech bg-[#06141A] border border-[#007A8C] text-[#E6FFFF] placeholder-[#007A8C] focus:outline-none focus:border-[#00F0FF]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-orbitron bg-[#00F0FF]/20 border border-[#00F0FF] text-[#E6FFFF] hover:bg-[#00F0FF]/35 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ADICIONAR</span>
                </button>
              </form>

              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto hud-scroll">
                {notes.length === 0 ? (
                  <p className="text-xs font-tech text-[#007A8C] py-6 text-center">
                    Nenhum registro ativo na memória tática.
                  </p>
                ) : (
                  notes.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 bg-[#06141A]/75 border border-[#0B2E36] hover:border-[#007A8C]"
                    >
                      <button
                        type="button"
                        onClick={() => onToggleNote(item.id)}
                        className="flex items-center gap-2.5 text-left flex-1 cursor-pointer"
                      >
                        <span
                          className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 ${
                            item.completed
                              ? 'border-[#00F0FF] bg-[#00F0FF]/25'
                              : 'border-[#007A8C]'
                          }`}
                        >
                          {item.completed && (
                            <Check className="w-2.5 h-2.5 text-[#E6FFFF]" />
                          )}
                        </span>
                        <span className="font-tech text-[10px] uppercase text-[#00D8FF] shrink-0">
                          [{item.type}]
                        </span>
                        <span
                          className={`font-rajdhani text-sm ${
                            item.completed
                              ? 'line-through text-[#007A8C]'
                              : 'text-[#E6FFFF]'
                          }`}
                        >
                          {item.text}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteNote(item.id)}
                        aria-label="Remover item"
                        className="text-[#007A8C] hover:text-[#FF9E00] p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isProcessing || notes.length === 0}
                  onClick={() => {
                    const summaryList = notes
                      .map(
                        (n) =>
                          `- [${n.completed ? 'OK' : 'PENDENTE'}] (${n.type}) ${n.text}`
                      )
                      .join('\n');
                    onAskJarvis(
                      `Analise e priorize estas minhas notas e tarefas atuais de forma concisa:\n${summaryList}`
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-orbitron border border-[#00F0FF]/60 text-[#00F0FF] hover:bg-[#00F0FF]/15 disabled:opacity-40 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>PRIORIZAR COM J.A.R.V.I.S.</span>
                </button>
              </div>
            </div>
          )}

          {activeModule === 'data_analyzer' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-tech text-xs text-[#00D8FF]">
                  Cole dados (JSON, CSV, logs) ou carregue uma imagem/documento:
                </span>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-tech border border-[#00F0FF]/60 text-[#00F0FF] hover:bg-[#00F0FF]/15 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>ENVIAR ARQUIVO / IMG</span>
                  <input
                    type="file"
                    accept="image/*,.txt,.json,.csv,.md,.log"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {uploadedImage && (
                <div className="relative border border-[#00F0FF]/40 bg-[#020406] p-2 flex items-center gap-3">
                  <img
                    src={uploadedImage.preview}
                    alt="Uploaded visual preview"
                    className="h-24 w-auto object-contain border border-[#007A8C]"
                  />
                  <div className="flex-1 text-xs font-tech text-[#00D8FF]">
                    Imagem pronta para inspeção multimodal ({uploadedImage.mimeType}).
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadedImage(null)}
                    className="text-xs font-tech text-[#FF9E00] hover:underline cursor-pointer"
                  >
                    REMOVER
                  </button>
                </div>
              )}

              <textarea
                value={dataInput}
                onChange={(e) => setDataInput(e.target.value)}
                rows={7}
                placeholder="Cole JSON, CSV, relatório técnico ou pergunta sobre o arquivo carregado..."
                className="w-full p-3 font-tech text-xs bg-[#020406] border border-[#007A8C] text-[#E6FFFF] placeholder-[#007A8C] focus:outline-none focus:border-[#00F0FF] hud-scroll"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isProcessing || (!dataInput.trim() && !uploadedImage)}
                  onClick={async () => {
                    await onAskJarvis(
                      dataInput.trim() ||
                        'Analise detalhadamente a imagem fornecida e destaque os pontos principais.',
                      uploadedImage ?? undefined
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-orbitron bg-[#00F0FF]/20 border border-[#00F0FF] text-[#E6FFFF] hover:bg-[#00F0FF]/35 disabled:opacity-40 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ANALISAR DADOS</span>
                </button>
              </div>
            </div>
          )}

          {activeModule === 'system_terminal' && (
            <div className="flex flex-col gap-3">
              <div className="h-64 p-3 bg-[#020406] border border-[#007A8C]/70 font-tech text-xs text-[#00F0FF] overflow-y-auto hud-scroll space-y-1">
                {terminalLines.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                    {line}
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!termInput.trim()) return;
                  onRunTerminalCommand(termInput.trim());
                  setTermInput('');
                }}
                className="flex items-center gap-2"
              >
                <span className="font-tech text-xs text-[#00F0FF]">
                  jarvis@hud:~$
                </span>
                <input
                  type="text"
                  value={termInput}
                  onChange={(e) => setTermInput(e.target.value)}
                  placeholder="Digite 'help', 'scan', 'weather Tokyo', 'stealth' ou um comando..."
                  className="flex-1 px-3 py-2 text-xs font-tech bg-[#06141A] border border-[#007A8C] text-[#E6FFFF] placeholder-[#007A8C] focus:outline-none focus:border-[#00F0FF]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-orbitron bg-[#00F0FF]/20 border border-[#00F0FF] text-[#E6FFFF] hover:bg-[#00F0FF]/35 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

          {activeModule === 'vision_cam' && (
            <div className="flex flex-col gap-3">
              {camError ? (
                <div className="p-6 border border-[#FF9E00]/60 bg-[#06141A] text-xs font-tech text-[#FF9E00] text-center">
                  Sensor óptico indisponível: {camError}
                </div>
              ) : (
                <div className="relative border border-[#00F0FF]/50 bg-[#020406] overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-h-72 object-cover"
                  />
                  {/* HUD Reticle overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-28 h-28 border border-[#00F0FF]/50 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-[#00F0FF]/80 rounded-full" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <span className="font-tech text-xs text-[#007A8C]">
                  CAPTURAR QUADRO ÓPTICO PARA ANÁLISE VISUAL GEMINI
                </span>
                <button
                  type="button"
                  disabled={Boolean(camError) || isProcessing}
                  onClick={handleCaptureVision}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-orbitron bg-[#00F0FF]/20 border border-[#00F0FF] text-[#E6FFFF] hover:bg-[#00F0FF]/35 disabled:opacity-40 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>CAPTURAR E ANALISAR</span>
                </button>
              </div>
            </div>
          )}

          {activeModule === 'workspace_dir' && (
            <div className="flex flex-col gap-3">
              <p className="font-tech text-xs text-[#00D8FF]">
                Ações rápidas vinculadas à categoria {activeCategory}:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {WORKSPACE_PRESETS[activeCategory].map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    disabled={isProcessing}
                    onClick={async () => {
                      onClose();
                      await onAskJarvis(item.prompt);
                    }}
                    className="flex items-start gap-3 p-3.5 text-left bg-[#06141A]/80 border border-[#007A8C]/60 hover:border-[#00F0FF] hover:bg-[#00F0FF]/10 transition-colors cursor-pointer"
                  >
                    <FolderOpen className="w-4 h-4 text-[#00F0FF] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-rajdhani text-sm font-semibold text-[#E6FFFF]">
                        {item.name}
                      </div>
                      <div className="font-tech text-[11px] text-[#007A8C] mt-0.5">
                        {item.meta}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
