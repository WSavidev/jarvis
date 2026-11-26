import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LeftTelemetryPanel } from './components/LeftTelemetryPanel';
import {
  CenterArcReactor,
  TrapezoidCommand,
} from './components/CenterArcReactor';
import { RightLauncherPanel } from './components/RightLauncherPanel';
import { HudModals } from './components/HudModals';
import { TacticalConsole } from './components/TacticalConsole';
import { useJarvisAudio } from './hooks/useJarvisAudio';
import {
  ChatMessage,
  CodeStudioState,
  HudClientAction,
  HudModuleId,
  JarvisChatResponse,
  NoteTaskItem,
  QuickLinkItem,
  ReactorState,
  WeatherData,
  WorkspaceCategory,
} from './types/hud';

const QUICK_LINKS: QuickLinkItem[] = [
  { id: 'gmail', label: 'Gmail', url: 'https://mail.google.com', category: 'Mail' },
  { id: 'wikipedia', label: 'Wikipedia', url: 'https://www.wikipedia.org', category: 'Knowledge' },
  { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com', category: 'Network' },
  { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com', category: 'Media' },
  { id: 'google drive', label: 'Google Drive', url: 'https://drive.google.com', category: 'Storage' },
  { id: 'github', label: 'GitHub', url: 'https://github.com', category: 'Code' },
];

const INITIAL_CODE_STUDIO: CodeStudioState = {
  title: 'sonda_telemetria.ts',
  language: 'typescript',
  code: `// Estúdio de Código J.A.R.V.I.S. Pronto\nexport function calcularEstabilidadeNucleo(carga: number, tempC: number): string {\n  const indice = Math.max(0, 100 - carga * 0.45 - Math.max(0, tempC - 28) * 1.2);\n  return \`ESTABILIDADE: \${indice.toFixed(1)}%\`;\n}`,
};

function formatShortTime(d: Date): string {
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface BatteryManagerLike {
  level: number;
  charging: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export default function App() {
  const [now, setNow] = useState<Date>(() => new Date());
  const [use24Hour, setUse24Hour] = useState(true);
  const [stealthMode, setStealthMode] = useState(false);
  const [voiceLiveMode, setVoiceLiveMode] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);

  // Telemetry state
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [batteryCharging, setBatteryCharging] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [memoryPercent, setMemoryPercent] = useState(68);
  const [memoryDetail, setMemoryDetail] = useState('133G / 61G LIVRES');

  // Weather state
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // HUD Modals & Productivity state
  const [activeModule, setActiveModule] = useState<HudModuleId | null>(null);
  const [activeCategory, setActiveCategory] =
    useState<WorkspaceCategory>('Documentos');
  const [highlightedLinkId, setHighlightedLinkId] = useState<string | null>(null);
  const [codeStudio, setCodeStudio] =
    useState<CodeStudioState>(INITIAL_CODE_STUDIO);
  const [notes, setNotes] = useState<NoteTaskItem[]>(() => {
    try {
      const saved = localStorage.getItem('jarvis_hud_notes');
      if (saved) return JSON.parse(saved) as NoteTaskItem[];
    } catch {
      // ignore storage errors
    }
    return [
      {
        id: 'init-1',
        text: 'Calibrar telemetria do núcleo Arc Reactor',
        type: 'task',
        completed: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'init-2',
        text: 'Sincronizar análise atmosférica e busca em tempo real',
        type: 'task',
        completed: false,
        createdAt: new Date().toISOString(),
      },
    ];
  });
  const [terminalLines, setTerminalLines] = useState<string[]>([
    'CONSOLE TÁTICO J.A.R.V.I.S. v4.0 — CONECTADO',
    "Digite 'help' para listar comandos locais ou envie qualquer diretiva diretamente ao J.A.R.V.I.S.",
  ]);

  // Conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'jarvis',
      text: 'Todos os sistemas do HUD estão operacionais e calibrados, Senhor. Em que posso auxiliá-lo hoje?',
      timestamp: formatShortTime(new Date()),
    },
  ]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Persist notes locally
  useEffect(() => {
    try {
      localStorage.setItem('jarvis_hud_notes', JSON.stringify(notes));
    } catch {
      // ignore
    }
  }, [notes]);

  // Clock tick & memory telemetry
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      const perf = performance as Performance & {
        memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
      };
      if (perf.memory) {
        const usedMb = Math.round(perf.memory.usedJSHeapSize / (1024 * 1024));
        const limitMb = Math.round(perf.memory.jsHeapSizeLimit / (1024 * 1024));
        const pct = Math.min(96, Math.max(18, Math.round((usedMb / 512) * 100)));
        setMemoryPercent(pct);
        setMemoryDetail(`${usedMb}MB / ${limitMb}MB`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Online/offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Battery API
  useEffect(() => {
    let batteryRef: BatteryManagerLike | null = null;
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManagerLike>;
    };
    const updateBattery = () => {
      if (!batteryRef) return;
      setBatteryLevel(Math.round(batteryRef.level * 100));
      setBatteryCharging(batteryRef.charging);
    };
    if (nav.getBattery) {
      nav
        .getBattery()
        .then((bat) => {
          batteryRef = bat;
          updateBattery();
          bat.addEventListener('levelchange', updateBattery);
          bat.addEventListener('chargingchange', updateBattery);
        })
        .catch(() => {});
    }
    return () => {
      if (batteryRef) {
        batteryRef.removeEventListener('levelchange', updateBattery);
        batteryRef.removeEventListener('chargingchange', updateBattery);
      }
    };
  }, []);

  // Initial latency ping & weather sync
  const pingServerLatency = useCallback(async () => {
    const t0 = performance.now();
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        setLatencyMs(Math.max(1, Math.round(performance.now() - t0)));
      }
    } catch {
      setLatencyMs(null);
    }
  }, []);

  const syncWeather = useCallback(async (city?: string) => {
    setWeatherLoading(true);
    try {
      if (city) {
        const res = await fetch(
          `/api/weather?city=${encodeURIComponent(city)}`
        );
        if (!res.ok) throw new Error('Falha ao buscar clima da cidade.');
        const data = (await res.json()) as WeatherData;
        setWeather(data);
        return;
      }

      if ('geolocation' in navigator) {
        const coords = await new Promise<{ lat: number; lon: number } | null>(
          (resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) =>
                resolve({
                  lat: pos.coords.latitude,
                  lon: pos.coords.longitude,
                }),
              () => resolve(null),
              { timeout: 4500 }
            );
          }
        );
        const query = coords
          ? `/api/weather?lat=${coords.lat}&lon=${coords.lon}`
          : '/api/weather';
        const res = await fetch(query);
        if (res.ok) {
          const data = (await res.json()) as WeatherData;
          setWeather(data);
        }
      } else {
        const res = await fetch('/api/weather');
        if (res.ok) {
          const data = (await res.json()) as WeatherData;
          setWeather(data);
        }
      }
    } catch {
      // Keep previous weather if request fails
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    pingServerLatency();
    syncWeather();
  }, [pingServerLatency, syncWeather]);

  // Notes helpers
  const addNoteItem = useCallback((text: string, type: 'note' | 'task' = 'task') => {
    setNotes((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text,
        type,
        completed: false,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, []);

  const toggleNoteItem = useCallback((id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, completed: !n.completed } : n))
    );
  }, []);

  const deleteNoteItem = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Handle client actions returned by Gemini function calling
  const applyClientActions = useCallback(
    (
      actions: HudClientAction[]
    ): { siteName: string; url: string } | undefined => {
      let quickLinkAction: { siteName: string; url: string } | undefined;

      for (const act of actions) {
        const p = act.payload;
        if (act.type === 'update_weather') {
          setWeather(p as unknown as WeatherData);
        } else if (act.type === 'open_external_link') {
          const siteName = String(p.siteName || 'Website');
          const url = String(p.url || '');
          if (url) {
            quickLinkAction = { siteName, url };
            const match = QUICK_LINKS.find(
              (l) =>
                l.id === siteName.toLowerCase() ||
                l.label.toLowerCase() === siteName.toLowerCase()
            );
            if (match) {
              setHighlightedLinkId(match.id);
              setTimeout(() => setHighlightedLinkId(null), 6000);
            }
          }
        } else if (act.type === 'open_hud_module') {
          const mod = String(p.module || 'close');
          if (mod === 'close') {
            setActiveModule(null);
          } else if (
            mod === 'code_studio' ||
            mod === 'notes_tasks' ||
            mod === 'data_analyzer' ||
            mod === 'system_terminal' ||
            mod === 'vision_cam'
          ) {
            setActiveModule(mod);
          }
        } else if (act.type === 'manage_notes_tasks') {
          const action = String(p.action || 'add');
          const text = typeof p.text === 'string' ? p.text : '';
          const itemType = p.itemType === 'note' ? 'note' : 'task';
          if (action === 'add' && text) {
            addNoteItem(text, itemType);
          } else if (action === 'complete' && text) {
            const lower = text.toLowerCase();
            setNotes((prev) =>
              prev.map((n) =>
                n.text.toLowerCase().includes(lower)
                  ? { ...n, completed: true }
                  : n
              )
            );
          } else if (action === 'delete' && text) {
            const lower = text.toLowerCase();
            setNotes((prev) =>
              prev.filter((n) => !n.text.toLowerCase().includes(lower))
            );
          } else if (action === 'clear_completed') {
            setNotes((prev) => prev.filter((n) => !n.completed));
          }
        } else if (act.type === 'set_hud_mode') {
          const mode = String(p.mode || 'normal');
          if (mode === 'stealth') setStealthMode(true);
          if (mode === 'normal') setStealthMode(false);
          if (mode === 'clear_log') setMessages([]);
          if (mode === 'mute_tts') setTtsEnabled(false);
          if (mode === 'unmute_tts') setTtsEnabled(true);
          if (mode === 'diagnostics') {
            pingServerLatency();
            syncWeather();
            setActiveModule('system_terminal');
          }
        } else if (act.type === 'write_to_code_studio') {
          setCodeStudio({
            title: String(p.title || 'jarvis_script.ts'),
            language: String(p.language || 'typescript'),
            code: String(p.code || ''),
          });
          setActiveModule('code_studio');
        }
      }

      return quickLinkAction;
    },
    [addNoteItem, pingServerLatency, syncWeather]
  );

  // Ref-bridged sendMessage so voice hook always uses latest state
  const sendMessageRef = React.useRef<
    (
      text: string,
      image?: { base64: string; mimeType: string; preview: string }
    ) => Promise<void>
  >(async () => {});

  const {
    isListening,
    isSpeaking,
    audioLevel,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
  } = useJarvisAudio((transcript) => {
    sendMessageRef.current(transcript);
  });

  const handleSendMessage = useCallback(
    async (
      text: string,
      image?: { base64: string; mimeType: string; preview: string }
    ) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: trimmed,
        timestamp: formatShortTime(new Date()),
        imagePreview: image?.preview,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);
      setErrorBanner(null);

      try {
        const historyPayload = messages
          .filter((m) => m.role === 'user' || m.role === 'jarvis')
          .slice(-10)
          .map((m) => ({
            role: m.role as 'user' | 'jarvis',
            text: m.text,
          }));

        const res = await fetch('/api/jarvis/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            history: historyPayload,
            imageBase64: image?.base64,
            imageMimeType: image?.mimeType,
            currentContext: {
              userName: 'Senhor',
              weather: weather ?? undefined,
              stealthMode,
              tasksCount: notes.filter((n) => !n.completed).length,
            },
          }),
        });

        const data = (await res.json()) as JarvisChatResponse & {
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.error || 'Erro ao comunicar com o núcleo Gemini.');
        }

        if (typeof data.latencyMs === 'number') {
          setLatencyMs(data.latencyMs);
        }

        const quickLinkAction = applyClientActions(data.clientActions || []);

        const jarvisMsg: ChatMessage = {
          id: `j-${Date.now()}`,
          role: 'jarvis',
          text: data.reply,
          timestamp: formatShortTime(new Date()),
          groundingLinks: data.groundingLinks,
          quickLinkAction,
        };

        setMessages((prev) => [...prev, jarvisMsg]);
        setTerminalLines((prev) => [
          ...prev.slice(-30),
          `> ${trimmed}`,
          `[J.A.R.V.I.S.] ${data.reply}`,
        ]);

        if (ttsEnabled) {
          speakText(data.reply);
        }
      } catch (err) {
        const errMsg =
          err instanceof Error
            ? err.message
            : 'Falha na transmissão com o servidor.';
        setErrorBanner(errMsg);
      } finally {
        setIsProcessing(false);
      }
    },
    [
      applyClientActions,
      messages,
      notes,
      speakText,
      stealthMode,
      ttsEnabled,
      weather,
    ]
  );

  sendMessageRef.current = handleSendMessage;

  const handleToggleListen = useCallback(() => {
    if (isListening) {
      setVoiceLiveMode(false);
      stopListening();
    } else {
      stopSpeaking();
      startListening(voiceLiveMode);
    }
  }, [isListening, startListening, stopListening, stopSpeaking, voiceLiveMode]);

  const handleRunDiagnostics = useCallback(async () => {
    await pingServerLatency();
    await syncWeather();
    const report = `DIAGNÓSTICO COMPLETO: Rede=${isOnline ? 'ONLINE' : 'OFFLINE'} | Bateria=${batteryLevel}% | Clima=${weather ? `${weather.temperatureC}°C ${weather.condition}` : 'SYNC'} | Notas=${notes.length}`;
    setTerminalLines((prev) => [...prev.slice(-30), report]);
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        role: 'system',
        text: report,
        timestamp: formatShortTime(new Date()),
      },
    ]);
  }, [batteryLevel, isOnline, notes.length, pingServerLatency, syncWeather, weather]);

  const handleRunTerminalCommand = useCallback(
    async (cmd: string) => {
      const lower = cmd.toLowerCase().trim();
      setTerminalLines((prev) => [...prev.slice(-30), `jarvis@hud:~$ ${cmd}`]);

      if (lower === 'help') {
        setTerminalLines((prev) => [
          ...prev,
          'Comandos locais: help | scan | stealth | normal | clear | weather <cidade> | open <code_studio|notes_tasks|data_analyzer|vision_cam>',
          'Qualquer outro texto é encaminhado diretamente à inteligência do J.A.R.V.I.S.',
        ]);
        return;
      }
      if (lower === 'clear') {
        setTerminalLines(['TERMINAL LIMPO.']);
        return;
      }
      if (lower === 'scan') {
        await handleRunDiagnostics();
        return;
      }
      if (lower === 'stealth') {
        setStealthMode(true);
        setTerminalLines((prev) => [...prev, 'Modo Furtivo ativado.']);
        return;
      }
      if (lower === 'normal') {
        setStealthMode(false);
        setTerminalLines((prev) => [...prev, 'Modo Padrão restaurado.']);
        return;
      }
      if (lower.startsWith('weather ')) {
        const city = cmd.slice(8).trim();
        await syncWeather(city);
        setTerminalLines((prev) => [
          ...prev,
          `Análise atmosférica sincronizada para: ${city}`,
        ]);
        return;
      }
      if (lower.startsWith('open ')) {
        const mod = lower.slice(5).trim() as HudModuleId;
        setActiveModule(mod);
        return;
      }

      await handleSendMessage(cmd);
    },
    [handleRunDiagnostics, handleSendMessage, syncWeather]
  );

  // 24 Interactive Trapezoid Commands around the Arc Reactor
  const trapezoidCommands: TrapezoidCommand[] = useMemo(
    () => [
      {
        id: 'voice_live',
        label: 'VOZ AO VIVO',
        shortLabel: 'VOZ',
        description: 'Alternar escuta contínua por voz',
        active: voiceLiveMode || isListening,
      },
      {
        id: 'web_search',
        label: 'BUSCA WEB',
        shortLabel: 'BUSCA',
        description: 'Pesquisar notícias atuais com Google Search',
      },
      {
        id: 'system_scan',
        label: 'VARREDURA',
        shortLabel: 'SCAN',
        description: 'Varredura completa de telemetria e latência',
        critical: true,
      },
      {
        id: 'stealth_mode',
        label: 'MODO FURTIVO',
        shortLabel: 'FURTIVO',
        description: 'Reduzir luminosidade e brilho do HUD',
        active: stealthMode,
      },
      {
        id: 'clear_log',
        label: 'LIMPAR LOG',
        shortLabel: 'LIMPAR',
        description: 'Limpar histórico de conversas',
      },
      {
        id: 'diagnostics',
        label: 'DIAGNÓSTICO',
        shortLabel: 'DIAG',
        description: 'Abrir terminal com relatório técnico',
      },
      {
        id: 'weather_sync',
        label: 'CLIMA',
        shortLabel: 'CLIMA',
        description: 'Atualizar clima via geolocalização',
        active: weatherLoading,
      },
      {
        id: 'vision_cam',
        label: 'CÂMERA',
        shortLabel: 'VISÃO',
        description: 'Ativar câmera óptica e análise visual',
        active: activeModule === 'vision_cam',
      },
      {
        id: 'code_studio',
        label: 'ESTÚDIO CÓDIGO',
        shortLabel: 'CÓDIGO',
        description: 'Abrir módulo holográfico de programação',
        active: activeModule === 'code_studio',
      },
      {
        id: 'notes_tasks',
        label: 'NOTAS E TAREFAS',
        shortLabel: 'NOTAS',
        description: 'Gerenciar tarefas e anotações táticas',
        active: activeModule === 'notes_tasks',
      },
      {
        id: 'data_analyzer',
        label: 'ANALISADOR DADOS',
        shortLabel: 'DADOS',
        description: 'Analisar arquivos, JSON, CSV ou imagens',
        active: activeModule === 'data_analyzer',
      },
      {
        id: 'system_terminal',
        label: 'TERMINAL',
        shortLabel: 'TERM',
        description: 'Abrir shell tático do HUD',
        active: activeModule === 'system_terminal',
      },
      {
        id: 'tts_toggle',
        label: 'ÁUDIO TTS',
        shortLabel: 'ÁUDIO',
        description: 'Ativar ou silenciar síntese de voz',
        active: ttsEnabled,
      },
      {
        id: 'briefing',
        label: 'RESUMO DIÁRIO',
        shortLabel: 'RESUMO',
        description: 'Solicitar briefing diário ao J.A.R.V.I.S.',
      },
      {
        id: 'news_sync',
        label: 'NOTÍCIAS',
        shortLabel: 'JORNAL',
        description: 'Buscar principais notícias de tecnologia e mundo',
      },
      {
        id: 'time_sync',
        label: 'RELÓGIO',
        shortLabel: 'HORA',
        description: 'Alternar relógio 12h / 24h',
      },
      {
        id: 'cat_docs',
        label: 'DOCUMENTOS',
        shortLabel: 'DOCS',
        description: 'Abrir diretório de documentos',
      },
      {
        id: 'cat_programs',
        label: 'PROGRAMAS',
        shortLabel: 'APPS',
        description: 'Abrir diretório de programas',
      },
      {
        id: 'cat_images',
        label: 'IMAGENS',
        shortLabel: 'IMGS',
        description: 'Abrir ferramentas visuais e imagens',
      },
      {
        id: 'link_gmail',
        label: 'NÓ GMAIL',
        shortLabel: 'GMAIL',
        description: 'Destacar e preparar acesso ao Gmail',
      },
      {
        id: 'link_github',
        label: 'NÓ GITHUB',
        shortLabel: 'GITHUB',
        description: 'Destacar e preparar acesso ao GitHub',
      },
      {
        id: 'link_youtube',
        label: 'NÓ YOUTUBE',
        shortLabel: 'YTUBE',
        description: 'Destacar e preparar acesso ao YouTube',
      },
      {
        id: 'link_drive',
        label: 'NÓ DRIVE',
        shortLabel: 'DRIVE',
        description: 'Destacar e preparar acesso ao Google Drive',
      },
      {
        id: 'help_cmd',
        label: 'AJUDA',
        shortLabel: 'AJUDA',
        description: 'Exibir guia de comandos de voz',
      },
    ],
    [
      activeModule,
      isListening,
      stealthMode,
      ttsEnabled,
      voiceLiveMode,
      weatherLoading,
    ]
  );

  const handleTrapezoidTrigger = useCallback(
    (id: string) => {
      switch (id) {
        case 'voice_live': {
          const next = !voiceLiveMode;
          setVoiceLiveMode(next);
          if (next) {
            stopSpeaking();
            startListening(true);
          } else {
            stopListening();
          }
          break;
        }
        case 'web_search':
          handleSendMessage(
            'J.A.R.V.I.S., realize uma busca em tempo real sobre os avanços científicos e tecnológicos mais relevantes de hoje.'
          );
          break;
        case 'system_scan':
          handleRunDiagnostics();
          break;
        case 'stealth_mode':
          setStealthMode((prev) => !prev);
          break;
        case 'clear_log':
          setMessages([]);
          break;
        case 'diagnostics':
          handleRunDiagnostics();
          setActiveModule('system_terminal');
          break;
        case 'weather_sync':
          syncWeather();
          break;
        case 'vision_cam':
          setActiveModule('vision_cam');
          break;
        case 'code_studio':
          setActiveModule('code_studio');
          break;
        case 'notes_tasks':
          setActiveModule('notes_tasks');
          break;
        case 'data_analyzer':
          setActiveModule('data_analyzer');
          break;
        case 'system_terminal':
          setActiveModule('system_terminal');
          break;
        case 'tts_toggle':
          if (ttsEnabled) stopSpeaking();
          setTtsEnabled((prev) => !prev);
          break;
        case 'briefing':
          handleSendMessage(
            'J.A.R.V.I.S., faça um briefing executivo rápido com o clima atual, minhas tarefas pendentes e uma recomendação tática para o dia.'
          );
          break;
        case 'news_sync':
          handleSendMessage(
            'Quais são as principais notícias de tecnologia e mercado mundial neste momento?'
          );
          break;
        case 'time_sync':
          setUse24Hour((prev) => !prev);
          break;
        case 'cat_docs':
          setActiveCategory('Documentos');
          setActiveModule('workspace_dir');
          break;
        case 'cat_programs':
          setActiveCategory('Programas');
          setActiveModule('workspace_dir');
          break;
        case 'cat_images':
          setActiveCategory('Imagens');
          setActiveModule('workspace_dir');
          break;
        case 'link_gmail':
          handleSendMessage('Prepare o atalho para abrir o Gmail.');
          break;
        case 'link_github':
          handleSendMessage('Prepare o atalho para abrir o GitHub.');
          break;
        case 'link_youtube':
          handleSendMessage('Prepare o atalho para abrir o YouTube.');
          break;
        case 'link_drive':
          handleSendMessage('Prepare o atalho para abrir o Google Drive.');
          break;
        case 'help_cmd':
          setActiveModule('system_terminal');
          handleRunTerminalCommand('help');
          break;
      }
    },
    [
      handleRunDiagnostics,
      handleRunTerminalCommand,
      handleSendMessage,
      startListening,
      stopListening,
      stopSpeaking,
      syncWeather,
      ttsEnabled,
      voiceLiveMode,
    ]
  );

  const reactorState: ReactorState = isProcessing
    ? 'processing'
    : isListening
      ? 'listening'
      : isSpeaking
        ? 'speaking'
        : 'idle';

  const contextCount = messages.length;
  const contextPercent = Math.min(100, Math.round((contextCount / 30) * 100));

  return (
    <div
      className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden px-4 sm:px-6 lg:px-8 py-4 select-none"
      style={{
        background:
          'radial-gradient(circle at 50% 48%, #06141A 0%, #020406 66%)',
      }}
    >
      {/* Subtle Blueprint Grid Overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #007A8C 1px, transparent 1px), linear-gradient(to bottom, #007A8C 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* HUD Corner Framing Brackets */}
      <div className="pointer-events-none fixed inset-3 border border-[#0B2E36]/60" />

      {/* Main 3-Column Panoramic HUD */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[290px_1fr_290px] xl:grid-cols-[330px_1fr_330px] items-center gap-6 max-w-[1600px] w-full mx-auto my-auto">
        <LeftTelemetryPanel
          now={now}
          use24Hour={use24Hour}
          onToggle24Hour={() => setUse24Hour((prev) => !prev)}
          memoryPercent={memoryPercent}
          memoryDetail={memoryDetail}
          contextPercent={contextPercent}
          contextCount={contextCount}
          batteryLevel={batteryLevel}
          batteryCharging={batteryCharging}
          latencyMs={latencyMs}
          isOnline={isOnline}
          reactorState={reactorState}
          stealthMode={stealthMode}
          onPingDiagnostic={handleRunDiagnostics}
        />

        <CenterArcReactor
          now={now}
          use24Hour={use24Hour}
          reactorState={reactorState}
          audioLevel={audioLevel}
          interactionCount={messages.filter((m) => m.role === 'user').length}
          commands={trapezoidCommands}
          onCommandTrigger={handleTrapezoidTrigger}
          onCoreClick={handleToggleListen}
          stealthMode={stealthMode}
          visionActive={activeModule === 'vision_cam'}
          onOpenVision={() => setActiveModule('vision_cam')}
        />

        <RightLauncherPanel
          quickLinks={QUICK_LINKS}
          highlightedLinkId={highlightedLinkId}
          weather={weather}
          weatherLoading={weatherLoading}
          onRefreshWeather={syncWeather}
          onOpenModule={(mod) => setActiveModule(mod)}
          onOpenCategory={(cat) => {
            setActiveCategory(cat);
            setActiveModule('workspace_dir');
          }}
          stealthMode={stealthMode}
        />
      </main>

      {/* Bottom Integrated Tactical Console */}
      <div className="mt-3">
        <TacticalConsole
          messages={messages}
          reactorState={reactorState}
          ttsEnabled={ttsEnabled}
          onToggleTts={() => {
            if (ttsEnabled) stopSpeaking();
            setTtsEnabled((prev) => !prev);
          }}
          isListening={isListening}
          onToggleListen={handleToggleListen}
          onSendMessage={(txt) => handleSendMessage(txt)}
          onClearLog={() => setMessages([])}
          stealthMode={stealthMode}
          errorBanner={errorBanner}
          onDismissError={() => setErrorBanner(null)}
        />
      </div>

      {/* Holographic Modals */}
      <HudModals
        activeModule={activeModule}
        activeCategory={activeCategory}
        onClose={() => setActiveModule(null)}
        codeStudio={codeStudio}
        onUpdateCodeStudio={setCodeStudio}
        notes={notes}
        onAddNote={addNoteItem}
        onToggleNote={toggleNoteItem}
        onDeleteNote={deleteNoteItem}
        onAskJarvis={handleSendMessage}
        terminalLines={terminalLines}
        onRunTerminalCommand={handleRunTerminalCommand}
        isProcessing={isProcessing}
      />
    </div>
  );
}
