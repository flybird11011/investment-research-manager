// 语音播报工具 - 使用 Web Speech API

let voicesReady = false

// 检查浏览器是否支持语音合成
export function isSpeechSupported(): boolean {
  return 'speechSynthesis' in window
}

// 获取女声（优先选择中文女声）
function getFemaleVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  // 优先选择中文女声
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

  // 其次选择任何中文语音
  const zhVoice = voices.find((v) => v.lang.startsWith('zh') || v.lang.startsWith('cmn'))
  if (zhVoice) return zhVoice

  // 最后选择默认语音
  return voices.find((v) => v.default) || voices[0] || null
}

// 唤醒语音引擎（Chrome 首次调用 speak 可能被静默吞掉）
function wakeUpSpeech(): Promise<void> {
  return new Promise((resolve) => {
    if (!isSpeechSupported()) {
      resolve()
      return
    }
    const u = new SpeechSynthesisUtterance('')
    u.volume = 0 // 静音
    u.onend = () => resolve()
    u.onerror = () => resolve()
    // 超时保底
    setTimeout(resolve, 200)
    window.speechSynthesis.speak(u)
  })
}

// 朗读文本
export function speak(text: string): void {
  if (!isSpeechSupported()) {
    console.warn('浏览器不支持语音合成')
    return
  }

  // 停止当前正在播放的语音
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

  utterance.onerror = (e) => {
    console.error('语音播报出错:', e)
  }

  window.speechSynthesis.speak(utterance)
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

// 初始化语音列表（某些浏览器需要异步加载）
export function initSpeech(): void {
  if (!isSpeechSupported()) return

  const loadVoices = () => {
    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      voicesReady = true
      // Chrome bug workaround: 首次调用 speak 可能被吞掉，先唤醒
      wakeUpSpeech()
    }
  }

  loadVoices()

  if (!voicesReady) {
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
  }
}
