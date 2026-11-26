import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  Content,
  FunctionDeclaration,
  GoogleGenAI,
  Part,
  Type,
} from '@google/genai';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

const JARVIS_SYSTEM_INSTRUCTION = `Você é o J.A.R.V.I.S. (Just A Rather Very Intelligent System), uma inteligência artificial avançada de assistência pessoal, engenharia, análise estratégica e automação.

DIRETRIZES DE PERSONALIDADE E COMUNICAÇÃO:
1. Tom de Voz: Sofisticado, calmo, extremamente articulado, levemente formal e ocasionalmente dotado de humor sutil e refinado (estilo mordomo britânico tecnológico). Trate o usuário por "Senhor" ou pelo nome configurado.
2. Concisão Tática: Como você opera em uma interface de voz e HUD visual em tempo real, suas respostas faladas devem ser diretas, precisas e bem estruturadas (idealmente entre 1 e 3 frases para comandos rápidos, expandindo apenas quando solicitado uma análise técnica ou explicação profunda).
3. Proatividade: Ao executar uma ferramenta (abrir um site, atualizar o clima no painel direito, iniciar diagnóstico, gerenciar notas/tarefas, escrever código no Code Studio ou alterar o modo do HUD), confirme a execução de forma natural (ex.: "Análise atmosférica atualizada no painel inferior direito, Senhor. A temperatura atual é de 30 graus.").
4. Capacidades: Você tem acesso à busca em tempo real (Google Search), controle dos módulos visuais do HUD, análise de código, cálculos complexos, análise visual de imagens/câmera e organização de tarefas. Nunca quebre o personagem nem mencione ser um modelo de linguagem genérico; aja como o sistema central operacional da interface.`;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment.');
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
      throw new Error(`Geocoding failed with status ${geoRes.status}`);
    }
    const geoJson = (await geoRes.json()) as {
      results?: Array<{
        name: string;
        country_code?: string;
        admin1?: string;
        latitude: number;
        longitude: number;
      }>;
    };
    const top = geoJson.results?.[0];
    if (!top) {
      throw new Error(`City "${params.city}" not found`);
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
    // Default coordinates: Sao Paulo if geolocation unavailable
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
    throw new Error(`Weather API failed with status ${weatherRes.status}`);
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
    throw new Error('Weather data unavailable');
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

const jarvisFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'update_weather',
    description:
      'Atualiza o módulo de Análise Atmosférica no painel inferior direito do HUD com o clima em tempo real de uma cidade específica.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        city: {
          type: Type.STRING,
          description:
            'Nome da cidade para buscar a previsão do tempo (ex.: "São Paulo", "London", "Tokyo").',
        },
      },
      required: ['city'],
    },
  },
  {
    name: 'open_external_link',
    description:
      'Prepara e destaca um atalho de site externo solicitado pelo usuário (ex.: Gmail, Wikipedia, LinkedIn, YouTube, Google Drive, GitHub ou URL segura).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        siteName: {
          type: Type.STRING,
          description: 'Nome do site ou serviço (ex.: "YouTube", "GitHub", "Gmail").',
        },
        url: {
          type: Type.STRING,
          description: 'URL completa iniciando com https:// (opcional para sites conhecidos).',
        },
      },
      required: ['siteName'],
    },
  },
  {
    name: 'open_hud_module',
    description:
      'Abre ou fecha um módulo de produtividade translúcido dentro do HUD.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        module: {
          type: Type.STRING,
          description:
            'ID do módulo: "code_studio", "notes_tasks", "data_analyzer", "system_terminal", "vision_cam", ou "close".',
        },
      },
      required: ['module'],
    },
  },
  {
    name: 'manage_notes_tasks',
    description:
      'Adiciona, conclui ou remove uma nota ou tarefa no módulo Notes & Tasks do HUD.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: 'Ação: "add", "complete", "delete" ou "clear_completed".',
        },
        text: {
          type: Type.STRING,
          description: 'Texto da nota ou tarefa (necessário ao adicionar ou buscar).',
        },
        itemType: {
          type: Type.STRING,
          description: '"note" ou "task" (padrão: "task").',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'set_hud_mode',
    description:
      'Altera o modo operacional ou visual do HUD (Modo Furtivo, Diagnóstico, Voz Contínua, Limpar Log, Silenciar Voz).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: {
          type: Type.STRING,
          description:
            'Modo desejado: "stealth", "normal", "diagnostics", "clear_log", "voice_live", "mute_tts", "unmute_tts".',
        },
      },
      required: ['mode'],
    },
  },
  {
    name: 'write_to_code_studio',
    description:
      'Escreve um bloco de código gerado diretamente no módulo Code Studio do HUD e o exibe na tela.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Título curto do script ou componente.',
        },
        language: {
          type: Type.STRING,
          description: 'Linguagem de programação (ex.: "typescript", "python", "html").',
        },
        code: {
          type: Type.STRING,
          description: 'Código fonte completo e bem formatado.',
        },
      },
      required: ['title', 'language', 'code'],
    },
  },
];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: Date.now() });
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
        res.status(400).json({ error: 'Invalid latitude parameter.' });
        return;
      }
      if (lon !== undefined && (Number.isNaN(lon) || lon < -180 || lon > 180)) {
        res.status(400).json({ error: 'Invalid longitude parameter.' });
        return;
      }

      const weather = await fetchOpenMeteoWeather({ city, lat, lon });
      res.json(weather);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Unable to fetch weather';
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
        res.status(400).json({ error: 'Message must be a non-empty string.' });
        return;
      }

      if (message.length > 16000) {
        res.status(400).json({ error: 'Message exceeds maximum allowed length.' });
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

      const tools = [
        { googleSearch: {} },
        { functionDeclarations: jarvisFunctionDeclarations },
      ];
      const toolConfig = { includeServerSideToolInvocations: true };

      const clientActions: Array<{
        type: string;
        payload: Record<string, unknown>;
      }> = [];
      let weatherUpdate: WeatherResult | undefined;

      let response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction: JARVIS_SYSTEM_INSTRUCTION + contextBanner,
          tools,
          toolConfig,
        },
      });

      // Handle up to 3 sequential function-calling turns
      let rounds = 0;
      while (response.functionCalls && response.functionCalls.length > 0 && rounds < 3) {
        rounds += 1;
        const previousContent = response.candidates?.[0]?.content;
        if (!previousContent) break;

        contents.push(previousContent);

        const functionResponseParts: Part[] = [];
        for (const fc of response.functionCalls) {
          const fnName = fc.name ?? '';
          const args = (fc.args ?? {}) as Record<string, unknown>;
          let toolResult: Record<string, unknown> = { status: 'ok' };

          if (fnName === 'update_weather') {
            const city = typeof args.city === 'string' ? args.city : 'São Paulo';
            try {
              const weather = await fetchOpenMeteoWeather({ city });
              weatherUpdate = weather;
              clientActions.push({
                type: 'update_weather',
                payload: weather as unknown as Record<string, unknown>,
              });
              toolResult = {
                status: 'updated',
                temperatureC: weather.temperatureC,
                condition: weather.condition,
                locationName: weather.locationName,
                humidity: weather.humidity,
                windKmh: weather.windKmh,
              };
            } catch (err) {
              toolResult = {
                status: 'error',
                message:
                  err instanceof Error ? err.message : 'Weather lookup failed',
              };
            }
          } else if (fnName === 'open_external_link') {
            const siteName =
              typeof args.siteName === 'string' ? args.siteName : 'Website';
            const mapped = QUICK_LINKS_MAP[siteName.toLowerCase().trim()];
            const rawUrl =
              typeof args.url === 'string' && args.url.trim().length > 0
                ? args.url
                : mapped || `https://www.google.com/search?q=${encodeURIComponent(siteName)}`;
            const safeUrl = sanitizeExternalUrl(rawUrl);
            if (safeUrl) {
              clientActions.push({
                type: 'open_external_link',
                payload: { siteName, url: safeUrl },
              });
              toolResult = {
                status: 'ready_to_open',
                siteName,
                url: safeUrl,
              };
            } else {
              toolResult = { status: 'rejected_invalid_url' };
            }
          } else if (fnName === 'open_hud_module') {
            const mod = typeof args.module === 'string' ? args.module : 'close';
            clientActions.push({
              type: 'open_hud_module',
              payload: { module: mod },
            });
            toolResult = { status: 'opened', module: mod };
          } else if (fnName === 'manage_notes_tasks') {
            clientActions.push({
              type: 'manage_notes_tasks',
              payload: args,
            });
            toolResult = { status: 'executed', ...args };
          } else if (fnName === 'set_hud_mode') {
            const mode = typeof args.mode === 'string' ? args.mode : 'normal';
            clientActions.push({
              type: 'set_hud_mode',
              payload: { mode },
            });
            toolResult = { status: 'mode_applied', mode };
          } else if (fnName === 'write_to_code_studio') {
            clientActions.push({
              type: 'write_to_code_studio',
              payload: args,
            });
            toolResult = {
              status: 'written_to_code_studio',
              title: args.title,
              language: args.language,
            };
          }

          functionResponseParts.push({
            functionResponse: {
              id: fc.id,
              name: fnName,
              response: toolResult,
            },
          });
        }

        contents.push({
          role: 'user',
          parts: functionResponseParts,
        });

        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction: JARVIS_SYSTEM_INSTRUCTION + contextBanner,
            tools,
            toolConfig,
          },
        });
      }

      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const groundingLinks: Array<{ title: string; uri: string }> = [];
      for (const chunk of groundingChunks) {
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

      const latencyMs = Date.now() - startedAt;
      const reply =
        response.text?.trim() ||
        'Diretiva processada nos sistemas centrais do HUD, Senhor.';

      res.json({
        reply,
        clientActions,
        groundingLinks,
        latencyMs,
        weatherUpdate,
      });
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Gemini API request failed.';
      const statusCode = msg.includes('GEMINI_API_KEY') ? 500 : 502;
      res.status(statusCode).json({ error: msg });
    }
  });

  app.post('/api/jarvis/tts', async (req: Request, res: Response) => {
    try {
      const { text } = req.body as { text?: unknown };
      if (typeof text !== 'string' || text.trim().length === 0) {
        res.status(400).json({ error: 'Text must be a non-empty string.' });
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
        res.status(502).json({ error: 'No audio generated by TTS model.' });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
      });
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'TTS generation failed.';
      res.status(502).json({ error: msg });
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
        res.status(400).json({ error: 'Valid audioBase64 and mimeType required.' });
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
      const msg =
        error instanceof Error ? error.message : 'Audio transcription failed.';
      res.status(502).json({ error: msg });
    }
  });

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
