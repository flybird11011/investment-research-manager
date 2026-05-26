// 语音播报工具 - 使用 Web Speech API

let voicesReady = false
let speechAwakened = false

// 检查浏览器是否支持语音合成
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
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
function wakeUpSpeech(): void {
  if (!isSpeechSupported() || speechAwakened) return

  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0.01 // 几乎静音但不是0
  u.rate = 10 // 最快速度
  u.onend = () => {
    speechAwakened = true
    console.log('[语音] 引擎唤醒完成')
  }
  u.onerror = (e) => {
    // 即使出错也标记为已尝试
    speechAwakened = true
    console.warn('[语音] 唤醒出错(可忽略):', e.error)
  }
  window.speechSynthesis.speak(u)
}

// 朗读文本
export function speak(text: string): void {
  if (!isSpeechSupported()) {
    console.warn('[语音] 浏览器不支持语音合成')
    return
  }

  // Chrome bug: 长时间不使用后 speechSynthesis 会暂停，需要 resume
  window.speechSynthesis.cancel()

  // Chrome bug workaround: resume 可能需要延迟
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume()
  }

  const utterance = new SpeechSynthesisUtterance(text)
  const voice = getFemaleVoice()

  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
    console.log('[语音] 使用语音:', voice.name, voice.lang)
  } else {
    utterance.lang = 'zh-CN'
    console.log('[语音] 使用默认语音, lang=zh-CN')
  }

  utterance.rate = 1.0
  utterance.pitch = 1.0
  utterance.volume = 1.0

  utterance.onstart = () => {
    console.log('[语音] 开始朗读')
  }

  utterance.onend = () => {
    console.log('[语音] 朗读结束')
  }

  utterance.onerror = (e) => {
    console.error('[语音] 朗读出错:', e.error)
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
  if (!isSpeechSupported()) {
    console.warn('[语音] 浏览器不支持 Web Speech API')
    return
  }

  console.log('[语音] 初始化语音合成...')

  const loadVoices = () => {
    const voices = window.speechSynthesis.getVoices()
    console.log('[语音] 可用语音数量:', voices.length)
    if (voices.length > 0) {
      voicesReady = true
      // 延迟唤醒，确保引擎就绪
      setTimeout(() => wakeUpSpeech(), 100)
    }
  }

  loadVoices()

  if (!voicesReady) {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      const voices = window.speechSynthesis.getVoices()
      console.log('[语音] voiceschanged 事件, 可用语音数量:', voices.length)
      voicesReady = true
      setTimeout(() => wakeUpSpeech(), 100)
    })
  }
}
