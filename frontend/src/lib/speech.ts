// 语音播报工具 - 使用 Web Speech API
// Chrome bug workaround: speechSynthesis 在页面打开 ~15秒后会进入假死状态
// 解决方案: 使用定时器周期性 pause/resume 保持引擎活跃

let keepAliveTimer: ReturnType<typeof setInterval> | null = null

// 检查浏览器是否支持语音合成
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// 启动 Chrome 语音引擎保活定时器（每10秒 pause/resume 一次）
function startKeepAlive(): void {
  if (keepAliveTimer) return
  keepAliveTimer = setInterval(() => {
    if (window.speechSynthesis.speaking) return
    window.speechSynthesis.pause()
    window.speechSynthesis.resume()
  }, 10000)
}

// 获取女声（优先选择中文女声）
function getFemaleVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  const zhFemaleVoice = voices.find(
    (v) =>
      (v.lang.startsWith('zh') || v.lang.startsWith('cmn')) &&
      (v.name.includes('女') ||
        v.name.includes('Female') ||
        v.name.includes('Xiaoxiao') ||
        v.name.includes('Xiaoyi') ||
        v.name.includes('Tingting') ||
        v.name.includes('Huihui') ||
        v.name.includes('Yaoyao'))
  )

  if (zhFemaleVoice) return zhFemaleVoice

  const zhVoice = voices.find((v) => v.lang.startsWith('zh') || v.lang.startsWith('cmn'))
  if (zhVoice) return zhVoice

  return voices.find((v) => v.default) || voices[0] || null
}

// 朗读文本
export function speak(text: string): void {
  if (!isSpeechSupported()) {
    console.warn('[语音] 浏览器不支持语音合成')
    return
  }

  // 停止当前播放
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  const voice = getFemaleVoice()

  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = 'zh-CN'
  }

  utterance.rate = 1.0
  utterance.pitch = 1.0
  utterance.volume = 1.0

  // Chrome/Edge 自动播放策略：需要用户交互后才能播放
  // 使用 resume() 解锁音频上下文
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume()
  }

  // Chrome bug fix: cancel() 后必须延迟再 speak
  setTimeout(() => {
    window.speechSynthesis.speak(utterance)
  }, 100)
}

// 停止朗读
export function stop(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel()
  }
}

// 检查是否正在朗读
export function isSpeaking(): boolean {
  return isSpeechSupported() && window.speechSynthesis.speaking
}

// 初始化
export function initSpeech(): void {
  if (!isSpeechSupported()) return
  // 预加载语音列表
  window.speechSynthesis.getVoices()
  // 启动保活定时器
  startKeepAlive()
}
