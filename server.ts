import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Content, GoogleGenAI, Part, Type } from '@google/genai';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

const JARVIS_SYSTEM_INSTRUCTION = `Você é o J.A.R.V.I.S. (Just A Rather Very Intelligent System), uma inteligência artificial avançada de assistência pessoal, engenharia, análise estratégica e automação.

DIRETRIZES DE PERSONALIDADE E COMUNICAÇÃO:
1. Tom de Voz: Sofisticado, calmo, extremamente articulado, levemente formal e ocasionalmente dotado de humor sutil e refinado (estilo mordomo britânico tecnológico). Trate o usuário por "Senhor" ou pelo nome configurado.
2. Concisão Tática: Como você opera em uma interface de voz e HUD visual em tempo real, suas respostas faladas devem ser diretas, precisas e bem estruturadas (idealmente entre 1 e 3 frases para comandos rápidos, expandindo apenas quando solicitado uma análise técnica ou explicação profunda).
3. Proatividade e Controle do HUD: Responda sempre no formato JSON estruturado exigido pelo schema. Escolha o campo "action" apropriado quando o usuário pedir para abrir módulos, gerenciar tarefas, atualizar clima, abrir links, gerar código, alterar modos ou buscar notícias atuais na web ("web_search").
4. Capacidades: Você tem acesso à busca em tempo real, controle dos módulos visuais do HUD, análise de código, cálculos complexos, análise visual de imagens/câmera e organização de tarefas. Nunca quebre o personagem nem mencione ser um modelo de linguagem genérico; aja como o sistema central operacional da interface.`;

const jarvisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description:
        'Resposta textual e falada do J.A.R.V.I.S. em português, direta e no estilo mordomo britânico.',
    },
    action: {
      type: Type.STRING,
      description:
        'Ação de controle do HUD: "none", "open_code_studio", "open_notes_tasks", "open_data_analyzer", "open_system_terminal", "open_vision_cam", "close_module", "stealth_on", "stealth_off", "diagnostics", "clear_log", "mute_tts", "unmute_tts", "update_weather", "open_link", "add_task", "add_note", "complete_task", "delete_task", "clear_completed_tasks", "write_code" ou "web_search".',
    },
    actionTarget: {
      type: Type.STRING,
      description:
        'Parâmetro alvo da ação (ex.: nome da cidade para clima, nome/URL do site, texto da tarefa/nota, título do código ou consulta de busca).',
    },
    actionCode: {
      type: Type.STRING,
      description:
        'Código fonte completo quando action for "write_code". Caso contrário, string vazia.',
    },
    actionLanguage: {
      type: Type.STRING,
      description:
        'Linguagem de programação quando action for "write_code" (ex.: "typescript", "python").',
    },
    status: {
      type: Type.STRING,
      description:
        'Estado operacional do HUD: "nominal", "executing", "standby" ou "alert".',
    },
  },
  required: ['reply', 'action', 'status'],
};

interface ParsedJarvisOutput {
  reply: string;
  action: string;
  actionTarget?: string;
  actionCode?: string;
  actionLanguage?: string;
  status: string;
}

function parseJarvisStructuredOutput(rawText: string): ParsedJarvisOutput {
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  if (!cleaned) {
    return {
      reply: 'Diretiva processada nos sistemas centrais do HUD, Senhor.',
      action: 'none',
      status: 'nominal',
    };
  }

  try {
    const parsed = JSON.parse(cleaned) as Partial<ParsedJarvisOutput>;
    if (parsed && typeof parsed === 'object' && typeof parsed.reply === 'string') {
      return {
        reply: parsed.reply.trim() || cleaned,
        action: typeof parsed.action === 'string' ? parsed.action : 'none',
        actionTarget:
          typeof parsed.actionTarget === 'string' ? parsed.actionTarget : undefined,
        actionCode:
          typeof parsed.actionCode === 'string' ? parsed.actionCode : undefined,
        actionLanguage:
          typeof parsed.actionLanguage === 'string'
            ? parsed.actionLanguage
            : undefined,
        status: typeof parsed.status === 'string' ? parsed.status : 'nominal',
      };
    }
  } catch {
    // Se não for JSON válido, retorna o texto bruto diretamente sem exibir erro técnico
  }

  return {
    reply: cleaned,
    action: 'none',
    status: 'nominal',
  };
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'Chave GEMINI_API_KEY não configurada. Verifique o painel Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(error: unknown): { statusCode: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('GEMINI_API_KEY')) {
    return { statusCode: 500, message: raw };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      statusCode: 429,
      message:
        'Cota da API Gemini excedida no momento (429 RESOURCE_EXHAUSTED). Verifique seu plano/limites ou selecione uma chave com faturamento ativo em Settings > Secrets.',
    };
  }
  if (
    raw.includes('403') ||
    raw.includes('PERMISSION_DENIED') ||
    raw.includes('API_KEY_INVALID')
  ) {
    return {
      statusCode: 403,
      message:
        'Chave da API Gemini inválida ou sem permissão. Verifique sua chave em Settings > Secrets.',
    };
  }
  return {
    statusCode: 502,
    message: `Falha na comunicação com o núcleo Gemini: ${raw.slice(0, 260)}`,
  };
}

const QUICK_LINKS_MAP: Record<string, string> = {
  gmail: 'https://mail.google.com',
  wikipedia: 'https://www.wikipedia.org',
  linkedin: 'https://www.linkedin.com',
  youtube: 'https://www.youtube.com',
  'google drive': 'https://drive.google.com',
  drive: 'https://drive.google.com',
  github: 'https://github.com',
};

function sanitizeExternalUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function mapWeatherCode(code: number): string {
  if (code === 0) return 'CÉU LIMPO';
  if (code === 1) return 'PREDOM. LIMPO';
  if (code === 2) return 'PARC. NUBLADO';
  if (code === 3) return 'MUITO NUBLADO';
  if (code === 45 || code === 48) return 'NEBLINA';
  if (code >= 51 && code <= 57) return 'GAROA';
  if (code >= 61 && code <= 67) return 'CHUVOSO';
  if (code >= 71 && code <= 77) return 'NEVE';
  if (code >= 80 && code <= 82) return 'PANCADAS DE CHUVA';
  if (code >= 85 && code <= 86) return 'NEVE INTENSA';
  if (code >= 95) return 'TEMPESTADE';
  return 'ATMOSFERA ESTÁVEL';
}

interface WeatherResult {
  temperatureC: number;
  apparentTempC: number;
  condition: string;
  locationName: string;
  windKmh: number;
  humidity: number;
  updatedAt: string;
}

async function fetchOpenMeteoWeather(params: {
  city?: string;
  lat?: number;
  lon?: number;
}): Promise<WeatherResult> {
  let latitude = params.lat;
  let longitude = params.lon;
  let locationName = 'SETOR LOCAL';

  if (params.city && params.city.trim().length > 0) {
    const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
    geoUrl.searchParams.set('name', params.city.trim());
    geoUrl.searchParams.set('count', '1');
    geoUrl.searchParams.set('language', 'pt');
    geoUrl.searchParams.set('format', 'json');

    const geoRes = await fetch(geoUrl.toString());
    if (!geoRes.ok) {
      throw new Error(`Falha na geocodificação (status ${geoRes.status})`);
    }
    const geoJson = (await geoRes.json()) as {
      results?: Array<{
        name: string;
        country_code?: string;
        latitude: number;
        longitude: number;
      }>;
    };
    const top = geoJson.results?.[0];
    if (!top) {
      throw new Error(`Cidade "${params.city}" não encontrada`);
    }
    latitude = top.latitude;
    longitude = top.longitude;
    locationName = top.country_code
      ? `${top.name.toUpperCase()}, ${top.country_code.toUpperCase()}`
      : top.name.toUpperCase();
  } else if (typeof latitude === 'number' && typeof longitude === 'number') {
    try {
      const revUrl = new URL(
        'https://api.bigdatacloud.net/data/reverse-geocode-client'
      );
      revUrl.searchParams.set('latitude', String(latitude));
      revUrl.searchParams.set('longitude', String(longitude));
      revUrl.searchParams.set('localityLanguage', 'pt');
      const revRes = await fetch(revUrl.toString());
      if (revRes.ok) {
        const revJson = (await revRes.json()) as {
          city?: string;
          locality?: string;
          countryCode?: string;
        };
        const cityPart = revJson.city || revJson.locality;
        if (cityPart) {
          locationName = revJson.countryCode
            ? `${cityPart.toUpperCase()}, ${revJson.countryCode.toUpperCase()}`
            : cityPart.toUpperCase();
        }
      }
    } catch {
      locationName = `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
    }
  } else {
    latitude = -23.5505;
    longitude = -46.6333;
    locationName = 'SÃO PAULO, BR';
  }

  const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
  weatherUrl.searchParams.set('latitude', String(latitude));
  weatherUrl.searchParams.set('longitude', String(longitude));
  weatherUrl.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m'
  );
  weatherUrl.searchParams.set('timezone', 'auto');

  const weatherRes = await fetch(weatherUrl.toString());
  if (!weatherRes.ok) {
    throw new Error(`Falha na API de clima (status ${weatherRes.status})`);
  }
  const weatherJson = (await weatherRes.json()) as {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      apparent_temperature?: number;
      weather_code?: number;
      wind_speed_10m?: number;
    };
  };

  const current = weatherJson.current;
  if (!current) {
    throw new Error('Dados climáticos indisponíveis');
  }

  return {
    temperatureC: Math.round(current.temperature_2m ?? 0),
    apparentTempC: Math.round(current.apparent_temperature ?? 0),
    condition: mapWeatherCode(current.weather_code ?? 0),
    locationName,
    windKmh: Math.round(current.wind_speed_10m ?? 0),
    humidity: Math.round(current.relative_humidity_2m ?? 0),
    updatedAt: new Date().toISOString(),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const hasApiKey =
    Boolean(process.env.GEMINI_API_KEY?.trim()) &&
    process.env.GEMINI_API_KEY?.trim() !== 'MY_GEMINI_API_KEY';
  console.log(
    `[HUD] GEMINI_API_KEY carregada: ${hasApiKey ? 'SIM' : 'NÃO (verifique Settings > Secrets)'}`
  );

  app.get('/api/health', (_req: Request, res: Response) => {
    const keyReady =
      Boolean(process.env.GEMINI_API_KEY?.trim()) &&
      process.env.GEMINI_API_KEY?.trim() !== 'MY_GEMINI_API_KEY';
    res.json({ ok: true, apiKeyConfigured: keyReady, timestamp: Date.now() });
  });

  app.get('/api/weather', async (req: Request, res: Response) => {
    try {
      const city =
        typeof req.query.city === 'string' ? req.query.city : undefined;
      const lat =
        typeof req.query.lat === 'string' && req.query.lat !== ''
          ? Number(req.query.lat)
          : undefined;
      const lon =
        typeof req.query.lon === 'string' && req.query.lon !== ''
          ? Number(req.query.lon)
          : undefined;

      if (lat !== undefined && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
        res.status(400).json({ error: 'Latitude inválida.' });
        return;
      }
      if (lon !== undefined && (Number.isNaN(lon) || lon < -180 || lon > 180)) {
        res.status(400).json({ error: 'Longitude inválida.' });
        return;
      }

      const weather = await fetchOpenMeteoWeather({ city, lat, lon });
      res.json(weather);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Não foi possível obter o clima.';
      res.status(502).json({ error: msg });
    }
  });

  app.post('/api/jarvis/chat', async (req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const {
        message,
        history,
        imageBase64,
        imageMimeType,
        currentContext,
      } = req.body as {
        message?: unknown;
        history?: Array<{ role: 'user' | 'jarvis'; text: string }>;
        imageBase64?: unknown;
        imageMimeType?: unknown;
        currentContext?: {
          userName?: string;
          weather?: WeatherResult;
          stealthMode?: boolean;
          tasksCount?: number;
        };
      };

      if (typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({ error: 'A mensagem não pode estar vazia.' });
        return;
      }

      if (message.length > 16000) {
        res.status(400).json({ error: 'A mensagem excede o limite permitido.' });
        return;
      }

      const ai = getGeminiClient();

      const contextBanner = currentContext
        ? `\n[TELEMETRIA ATUAL DO HUD] Usuário: "${currentContext.userName || 'Senhor'}" | Clima atual: ${currentContext.weather ? `${currentContext.weather.temperatureC}°C (${currentContext.weather.condition}) em ${currentContext.weather.locationName}` : 'Sincronizando'} | Modo Furtivo: ${currentContext.stealthMode ? 'ATIVO' : 'INATIVO'} | Tarefas ativas: ${currentContext.tasksCount ?? 0}.`
        : '';

      const contents: Content[] = [];
      if (Array.isArray(history)) {
        for (const item of history.slice(-12)) {
          if (
            item &&
            typeof item.text === 'string' &&
            item.text.trim().length > 0
          ) {
            contents.push({
              role: item.role === 'jarvis' ? 'model' : 'user',
              parts: [{ text: item.text.slice(0, 4000) }],
            });
          }
        }
      }

      const userParts: Part[] = [];
      if (
        typeof imageBase64 === 'string' &&
        imageBase64.length > 0 &&
        typeof imageMimeType === 'string' &&
        /^image\/(png|jpeg|jpg|webp|gif)$/.test(imageMimeType)
      ) {
        userParts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: imageBase64,
          },
        });
      }
      userParts.push({ text: message.trim() });
      contents.push({ role: 'user', parts: userParts });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction: JARVIS_SYSTEM_INSTRUCTION + contextBanner,
          responseMimeType: 'application/json',
          responseSchema: jarvisResponseSchema,
        },
      });

      const parsed = parseJarvisStructuredOutput(response.text ?? '');
      let finalReply = parsed.reply;
      const status = parsed.status || 'nominal';

      const clientActions: Array<{
        type: string;
        payload: Record<string, unknown>;
      }> = [];
      const groundingLinks: Array<{ title: string; uri: string }> = [];
      let weatherUpdate: WeatherResult | undefined;

      const act = parsed.action;
      const target = parsed.actionTarget?.trim() || '';

      if (act === 'open_code_studio') {
        clientActions.push({
          type: 'open_hud_module',
          payload: { module: 'code_studio' },
        });
      } else if (act === 'open_notes_tasks') {
        clientActions.push({
          type: 'open_hud_module',
          payload: { module: 'notes_tasks' },
        });
      } else if (act === 'open_data_analyzer') {
        clientActions.push({
          type: 'open_hud_module',
          payload: { module: 'data_analyzer' },
        });
      } else if (act === 'open_system_terminal') {
        clientActions.push({
          type: 'open_hud_module',
          payload: { module: 'system_terminal' },
        });
      } else if (act === 'open_vision_cam') {
        clientActions.push({
          type: 'open_hud_module',
          payload: { module: 'vision_cam' },
        });
      } else if (act === 'close_module') {
        clientActions.push({
          type: 'open_hud_module',
          payload: { module: 'close' },
        });
      } else if (act === 'stealth_on') {
        clientActions.push({
          type: 'set_hud_mode',
          payload: { mode: 'stealth' },
        });
      } else if (act === 'stealth_off') {
        clientActions.push({
          type: 'set_hud_mode',
          payload: { mode: 'normal' },
        });
      } else if (act === 'diagnostics') {
        clientActions.push({
          type: 'set_hud_mode',
          payload: { mode: 'diagnostics' },
        });
      } else if (act === 'clear_log') {
        clientActions.push({
          type: 'set_hud_mode',
          payload: { mode: 'clear_log' },
        });
      } else if (act === 'mute_tts') {
        clientActions.push({
          type: 'set_hud_mode',
          payload: { mode: 'mute_tts' },
        });
      } else if (act === 'unmute_tts') {
        clientActions.push({
          type: 'set_hud_mode',
          payload: { mode: 'unmute_tts' },
        });
      } else if (act === 'update_weather') {
        try {
          const w = await fetchOpenMeteoWeather({
            city: target || 'São Paulo',
          });
          weatherUpdate = w;
          clientActions.push({
            type: 'update_weather',
            payload: w as unknown as Record<string, unknown>,
          });
          finalReply = `Análise atmosférica atualizada para ${w.locationName}, Senhor. Temperatura de ${w.temperatureC}°C com condição ${w.condition.toLowerCase()} e umidade de ${w.humidity}%.`;
        } catch {
          // Mantém reply do modelo se a cidade falhar
        }
      } else if (act === 'open_link') {
        const siteName = target || 'Website';
        const mapped = QUICK_LINKS_MAP[siteName.toLowerCase()];
        const rawUrl =
          siteName.startsWith('http://') || siteName.startsWith('https://')
            ? siteName
            : mapped || `https://www.google.com/search?q=${encodeURIComponent(siteName)}`;
        const safeUrl = sanitizeExternalUrl(rawUrl);
        if (safeUrl) {
          clientActions.push({
            type: 'open_external_link',
            payload: { siteName, url: safeUrl },
          });
        }
      } else if (act === 'add_task' || act === 'add_note') {
        if (target) {
          clientActions.push({
            type: 'manage_notes_tasks',
            payload: {
              action: 'add',
              text: target,
              itemType: act === 'add_note' ? 'note' : 'task',
            },
          });
        }
      } else if (act === 'complete_task') {
        clientActions.push({
          type: 'manage_notes_tasks',
          payload: { action: 'complete', text: target },
        });
      } else if (act === 'delete_task') {
        clientActions.push({
          type: 'manage_notes_tasks',
          payload: { action: 'delete', text: target },
        });
      } else if (act === 'clear_completed_tasks') {
        clientActions.push({
          type: 'manage_notes_tasks',
          payload: { action: 'clear_completed' },
        });
      } else if (act === 'write_code') {
        clientActions.push({
          type: 'write_to_code_studio',
          payload: {
            title: target || 'jarvis_script.ts',
            language: parsed.actionLanguage || 'typescript',
            code: parsed.actionCode || '// Código gerado pelo J.A.R.V.I.S.',
          },
        });
      } else if (act === 'web_search') {
        try {
          const searchRes = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: target || message.trim(),
            config: {
              systemInstruction: JARVIS_SYSTEM_INSTRUCTION,
              tools: [{ googleSearch: {} }],
            },
          });
          if (searchRes.text?.trim()) {
            finalReply = searchRes.text.trim();
          }
          const chunks =
            searchRes.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
          for (const chunk of chunks) {
            const web = chunk.web;
            if (web?.uri) {
              const safe = sanitizeExternalUrl(web.uri);
              if (safe) {
                groundingLinks.push({
                  title: web.title || safe,
                  uri: safe,
                });
              }
            }
          }
        } catch {
          // Mantém a resposta estruturada inicial se a busca web falhar
        }
      }

      const latencyMs = Date.now() - startedAt;

      res.json({
        reply: finalReply,
        action: act,
        status,
        clientActions,
        groundingLinks,
        latencyMs,
        weatherUpdate,
      });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.statusCode).json({ error: formatted.message });
    }
  });

  app.post('/api/jarvis/tts', async (req: Request, res: Response) => {
    try {
      const { text } = req.body as { text?: unknown };
      if (typeof text !== 'string' || text.trim().length === 0) {
        res.status(400).json({ error: 'O texto não pode estar vazio.' });
        return;
      }

      const cleanText = text
        .replace(/[`*_#[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1200);

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style:
                    'Calm, sophisticated, articulate British AI butler tone, crisp tactical diction',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Charon' },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'Nenhum áudio gerado pelo modelo TTS.' });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
      });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.statusCode).json({ error: formatted.message });
    }
  });

  app.post('/api/jarvis/transcribe', async (req: Request, res: Response) => {
    try {
      const { audioBase64, mimeType } = req.body as {
        audioBase64?: unknown;
        mimeType?: unknown;
      };
      if (
        typeof audioBase64 !== 'string' ||
        audioBase64.length === 0 ||
        typeof mimeType !== 'string' ||
        !/^audio\/(webm|mp3|mpeg|wav|ogg|mp4)/.test(mimeType)
      ) {
        res.status(400).json({ error: 'Áudio ou mimeType inválido.' });
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Transcreva exatamente o que foi dito neste áudio em português ou inglês, retornando apenas o texto transcrito.',
            },
          ],
        },
      });

      res.json({ transcript: (response.text ?? '').trim() });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.statusCode).json({ error: formatted.message });
    }
  });

  // Garante que qualquer rota /api/* inexistente ou com erro retorne JSON e nunca HTML do Vite
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Rota da API não encontrada.' });
  });

  app.use(
    '/api',
    (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const formatted = formatGeminiError(err);
      res.status(formatted.statusCode).json({ error: formatted.message });
    }
  );

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`J.A.R.V.I.S. AI HUD server active on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start J.A.R.V.I.S. server:', err);
  process.exit(1);
});
