import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

export function useJarvisAudio(onTranscriptReady: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const continuousModeRef = useRef(false);
  const onTranscriptRef = useRef(onTranscriptReady);
  onTranscriptRef.current = onTranscriptReady;

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const stopMeterLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startAnalyserMeter = useCallback(
    (analyser: AnalyserNode) => {
      stopMeterLoop();
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        const sampleCount = Math.min(dataArray.length, 48);
        for (let i = 0; i < sampleCount; i++) {
          sum += dataArray[i];
        }
        const avg = sum / Math.max(1, sampleCount) / 255;
        setAudioLevel(Math.min(1, avg * 1.9));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [stopMeterLoop]
  );

  const stopListening = useCallback(() => {
    continuousModeRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore stop errors
      }
      recognitionRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    setIsListening(false);
    stopMeterLoop();
  }, [stopMeterLoop]);

  const startListening = useCallback(
    async (continuous = false) => {
      if (isListening) {
        stopListening();
        return;
      }

      continuousModeRef.current = continuous;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        micStreamRef.current = stream;

        const ctx = getAudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.72;
        source.connect(analyser);
        startAnalyserMeter(analyser);

        setIsListening(true);

        const win = window as unknown as WindowWithSpeech;
        const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

        if (SpeechRec) {
          const rec = new SpeechRec();
          rec.lang = 'pt-BR';
          rec.continuous = continuous;
          rec.interimResults = false;

          rec.onresult = (event) => {
            const results = event.results;
            const last = results[results.length - 1];
            if (last && last.isFinal) {
              const transcript = last[0]?.transcript?.trim();
              if (transcript) {
                onTranscriptRef.current(transcript);
              }
            }
          };

          rec.onerror = () => {
            if (!continuousModeRef.current) {
              stopListening();
            }
          };

          rec.onend = () => {
            if (continuousModeRef.current && micStreamRef.current) {
              try {
                rec.start();
              } catch {
                stopListening();
              }
            } else {
              stopListening();
            }
          };

          recognitionRef.current = rec;
          rec.start();
        } else {
          // Fallback: MediaRecorder -> /api/jarvis/transcribe
          const mimeType = MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/mp4';
          const recorder = new MediaRecorder(stream, { mimeType });
          const chunks: Blob[] = [];
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };
          recorder.onstop = async () => {
            if (chunks.length === 0) return;
            const blob = new Blob(chunks, { type: mimeType });
            const reader = new FileReader();
            reader.onloadend = async () => {
              const dataUrl = String(reader.result || '');
              const base64 = dataUrl.split(',')[1];
              if (!base64) return;
              try {
                const res = await fetch('/api/jarvis/transcribe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ audioBase64: base64, mimeType }),
                });
                if (res.ok) {
                  const data = (await res.json()) as { transcript?: string };
                  if (data.transcript) {
                    onTranscriptRef.current(data.transcript);
                  }
                }
              } catch {
                // silent fallback
              }
            };
            reader.readAsDataURL(blob);
          };
          mediaRecorderRef.current = recorder;
          recorder.start();
        }
      } catch {
        stopListening();
      }
    },
    [getAudioContext, isListening, startAnalyserMeter, stopListening]
  );

  const stopSpeaking = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {
        // ignore
      }
      currentSourceRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    stopMeterLoop();
  }, [stopMeterLoop]);

  const speakText = useCallback(
    async (text: string) => {
      stopSpeaking();
      if (!text.trim()) return;

      setIsSpeaking(true);

      try {
        const res = await fetch('/api/jarvis/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) {
          throw new Error('TTS endpoint unavailable');
        }

        const data = (await res.json()) as {
          audioBase64: string;
          mimeType: string;
        };

        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const ctx = getAudioContext();
        const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.72;

        source.connect(analyser);
        analyser.connect(ctx.destination);

        currentSourceRef.current = source;
        startAnalyserMeter(analyser);

        source.onended = () => {
          currentSourceRef.current = null;
          setIsSpeaking(false);
          stopMeterLoop();
        };

        source.start(0);
      } catch {
        // Browser speechSynthesis fallback
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'pt-BR';
          utterance.rate = 1.02;
          utterance.pitch = 0.92;
          utterance.onend = () => {
            setIsSpeaking(false);
            stopMeterLoop();
          };
          utterance.onerror = () => {
            setIsSpeaking(false);
            stopMeterLoop();
          };
          window.speechSynthesis.speak(utterance);
        } else {
          setIsSpeaking(false);
        }
      }
    },
    [getAudioContext, startAnalyserMeter, stopMeterLoop, stopSpeaking]
  );

  useEffect(() => {
    return () => {
      stopListening();
      stopSpeaking();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopListening, stopSpeaking]);

  return {
    isListening,
    isSpeaking,
    audioLevel,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
  };
}
