let currentAudio: HTMLAudioElement | null = null
let currentObjectUrl: string | null = null
let currentAbortController: AbortController | null = null
let speakRequestId = 0

const TTS_VOICE = 'zh-CN-XiaoxiaoNeural'

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined' && typeof fetch !== 'undefined'
}

function cleanupPlayback(): void {
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
  }

  if (currentAudio) {
    currentAudio.pause()
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio.src = ''
    currentAudio.load()
    currentAudio = null
  }

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

async function fetchSpeechAudio(text: string, requestId: number): Promise<Blob> {
  if (currentAbortController) {
    currentAbortController.abort()
  }

  const controller = new AbortController()
  currentAbortController = controller

  const response = await fetch('/api/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice: TTS_VOICE,
      rate: '+0%',
    }),
    signal: controller.signal,
  })

  if (requestId !== speakRequestId) {
    throw new Error('speech_request_cancelled')
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message = payload?.error || `语音生成失败 (${response.status})`
    throw new Error(message)
  }

  return response.blob()
}

// 朗读文本
export async function speak(text: string): Promise<void> {
  if (!isSpeechSupported()) {
    console.warn('[语音] 当前浏览器不支持音频播放')
    return
  }

  const content = normalizeText(text)
  if (!content) return

  const requestId = ++speakRequestId
  cleanupPlayback()

  try {
    const blob = await fetchSpeechAudio(content, requestId)
    if (requestId !== speakRequestId) return

    const objectUrl = URL.createObjectURL(blob)
    const audio = new Audio(objectUrl)
    audio.preload = 'auto'
    audio.volume = 1.0

    currentAudio = audio
    currentObjectUrl = objectUrl

    audio.onended = () => {
      if (requestId !== speakRequestId) return
      cleanupPlayback()
      console.log('[语音] 播放结束')
    }

    audio.onerror = () => {
      if (requestId !== speakRequestId) return
      console.warn('[语音] 音频播放失败')
      cleanupPlayback()
    }

    await audio.play()
    if (requestId !== speakRequestId) {
      cleanupPlayback()
      return
    }

    console.log('[语音] 开始播放')
  } catch (error: any) {
    if (error?.message === 'speech_request_cancelled') return
    console.warn('[语音] 语音播放失败:', error?.message || error)
    cleanupPlayback()
  }
}

// 停止朗读
export function stop(): void {
  speakRequestId++
  cleanupPlayback()
}

// 检查是否正在朗读
export function isSpeaking(): boolean {
  return Boolean(currentAudio && !currentAudio.paused && !currentAudio.ended)
}

// 初始化
export function initSpeech(): void {
  // 保留接口，当前实现由后端生成音频，不需要额外预热浏览器语音引擎
  if (!isSpeechSupported()) return
}
