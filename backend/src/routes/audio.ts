import fs from 'fs';
import { Router } from 'express';
import { getSpeechAudioFile } from '../services/tts';

const router = Router();

router.post('/speech', async (req, res) => {
  try {
    const { text, voice, rate } = req.body ?? {};
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: '请提供要朗读的文本' });
    }

    const audio = await getSpeechAudioFile({
      text,
      voice: typeof voice === 'string' ? voice : undefined,
      rate: typeof rate === 'string' ? rate : undefined,
    });

    const stat = fs.statSync(audio.filePath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-TTS-Cache', audio.cached ? 'HIT' : 'MISS');
    fs.createReadStream(audio.filePath).pipe(res);
  } catch (error: any) {
    console.error('生成语音失败:', error);
    res.status(500).json({ error: error?.message || '生成语音失败' });
  }
});

export { router as audioRouter };
