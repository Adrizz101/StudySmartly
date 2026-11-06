import { PocketTTS, StreamingPlayer } from 'pocket-tts-js';

const VOICE_REFERENCE_KEY = 'studysmartly_neural_voice_reference';

let enginePromise: Promise<PocketTTS> | null = null;
let player: StreamingPlayer | null = null;
let cachedReference: string | null = null;
let cachedClonedVoice: string | null = null;

async function getEngine(): Promise<PocketTTS> {
  if (!enginePromise) {
    enginePromise = (async () => {
      // pocket-tts-js delegates ONNX Runtime Web inference to its own Web Worker.
      // Its current browser backend is WebAssembly/CPU rather than WebGPU.
      const instance = new PocketTTS({
        language: 'english_2026-04',
        quantized: true,
        voiceCloning: true,
        cache: true,
      });
      try {
        await instance.load();
        player = new StreamingPlayer({ sampleRate: instance.sampleRate });
        return instance;
      } catch (error) {
        instance.destroy();
        throw error;
      }
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

async function getVoice(instance: PocketTTS, referenceAudioUrl?: string): Promise<string> {
  const reference = referenceAudioUrl
    ?? (typeof window !== 'undefined' ? window.localStorage.getItem(VOICE_REFERENCE_KEY) ?? undefined : undefined);

  if (!reference) return instance.loadVoice('alba');
  if (cachedReference === reference && cachedClonedVoice) return cachedClonedVoice;

  const response = await fetch(reference);
  if (!response.ok) throw new Error('Could not load the saved voice reference.');
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(await response.arrayBuffer());
    const mono = new Float32Array(decoded.length);
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const channelData = decoded.getChannelData(channel);
      for (let sample = 0; sample < decoded.length; sample += 1) {
        mono[sample] += channelData[sample] / decoded.numberOfChannels;
      }
    }
    cachedClonedVoice = await instance.cloneVoice(mono, { inputSampleRate: decoded.sampleRate });
    cachedReference = reference;
    return cachedClonedVoice;
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

function speakWithBrowserVoice(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve();
      return;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.96;
      utterance.pitch = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      resolve();
    }
  });
}

export async function speakWithNeuralVoice(text: string, referenceAudioUrl?: string): Promise<void> {
  const cleanText = text.trim();
  if (!cleanText) return;

  try {
    const instance = await getEngine();
    const voice = await getVoice(instance, referenceAudioUrl);
    if (!player) player = new StreamingPlayer({ sampleRate: instance.sampleRate });
    await player.resume();
    await instance.generate(cleanText, {
      voice,
      onChunk: (audio, meta) => player?.play(audio, meta),
    });
    player.flush();
  } catch (error) {
    console.warn('[Neural Voice] Local synthesis unavailable; using browser speech synthesis.', error);
    try {
      player?.stop();
      await speakWithBrowserVoice(cleanText);
    } catch {
      // Speech is an enhancement; a failed voice backend must not break study flows.
    }
  }
}

export function stopNeuralVoice(): void {
  try {
    player?.stop();
    void enginePromise?.then((instance) => instance.stop()).catch(() => undefined);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  } catch {
    // Ignore shutdown errors during route changes or component cleanup.
  }
}
