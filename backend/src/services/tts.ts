import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const TTS_CACHE_DIR = path.join(DATA_DIR, 'tts-cache');
const EDGE_TTS_VOICE = (process.env.TTS_VOICE as string | undefined) || 'zh-CN-XiaoxiaoNeural';
const EDGE_TTS_RATE = (process.env.TTS_RATE as string | undefined) || '+0%';
const MAX_INPUT_LENGTH = 1500;
const EDGE_TTS_SCRIPT = path.resolve(process.cwd(), 'src', 'scripts', 'edge_tts_runner.py');

if (!fs.existsSync(TTS_CACHE_DIR)) {
  fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
}

const inFlightRequests = new Map<string, Promise<string>>();

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function buildCacheKey(text: string, voice: string, rate: string): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ text, voice, rate }))
    .digest('hex');
}

function getCachePath(cacheKey: string): string {
  return path.join(TTS_CACHE_DIR, `${cacheKey}.mp3`);
}

function runEdgeTts(outputPath: string, text: string, voice: string, rate: string): Promise<void> {
  if (!fs.existsSync(EDGE_TTS_SCRIPT)) {
    return Promise.reject(new Error(`找不到 TTS 脚本: ${EDGE_TTS_SCRIPT}`));
  }

  return new Promise((resolve, reject) => {
    const child = spawn('python3', [
      EDGE_TTS_SCRIPT,
      '--text',
      text,
      '--voice',
      voice,
      '--rate',
      rate,
      '--output',
      outputPath,
    ]);

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `edge-tts 执行失败，退出码 ${code}`));
    });
  });
}

export async function getSpeechAudioFile(options: {
  text: string;
  voice?: string;
  rate?: string;
}): Promise<{ filePath: string; cacheKey: string; cached: boolean }> {
  const normalizedText = normalizeText(options.text);
  if (!normalizedText) {
    throw new Error('朗读文本不能为空');
  }

  const text = normalizedText.slice(0, MAX_INPUT_LENGTH);
  const voice = options.voice || EDGE_TTS_VOICE;
  const rate = options.rate || EDGE_TTS_RATE;
  const cacheKey = buildCacheKey(text, voice, rate);
  const filePath = getCachePath(cacheKey);

  if (fs.existsSync(filePath)) {
    return { filePath, cacheKey, cached: true };
  }

  const existingPromise = inFlightRequests.get(cacheKey);
  if (existingPromise) {
    await existingPromise;
    return { filePath, cacheKey, cached: true };
  }

  const task = (async () => {
    await runEdgeTts(filePath, text, voice, rate);
    return filePath;
  })();

  inFlightRequests.set(cacheKey, task);

  try {
    await task;
    return { filePath, cacheKey, cached: false };
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}
