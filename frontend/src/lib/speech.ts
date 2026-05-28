// 语音播报工具 - 使用 Web Speech API
// Chrome bug workaround: speechSynthesis 在页面打开 ~15秒后会进入假死状态
// 解决方案: 使用定时器周期性 pause/resume 保持引擎活跃

let keepAliveTimer: ReturnType<typeof setInterval> | null = null
let currentUtterance: SpeechSynthesisUtterance | null = null
let speakTimer: ReturnType<typeof setTimeout> | null = null
let speakRequestId = 0

// 检查浏览器是否支持语音合成
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// 启动 Chrome 语音引擎保活定时器（每10秒 pause/resume 一次）
function startKeepAlive(): void {
  if (keepAliveTimer) return
  keepAliveTimer = setInterval(() => {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) return
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

function waitForCancelToSettle(callback: () => void): void {
  const startedAt = Date.now()

  const check = () => {
    const synth = window.speechSynthesis
    if (!synth.speaking && !synth.pending) {
      callback()
      return
    }

    if (Date.now() - startedAt > 500) {
      console.warn('[语音] 等待上一次朗读停止超时，继续尝试播放')
      callback()
      return
    }

    setTimeout(check, 50)
  }

  check()
}

// 朗读文本
export function speak(text: string): void {
  if (!isSpeechSupported()) {
    console.warn('[语音] 浏览器不支持语音合成')
    return
  }

  const content = text.trim()
  if (!content) return

  const requestId = ++speakRequestId

  if (speakTimer) {
    clearTimeout(speakTimer)
    speakTimer = null
  }

  const synth = window.speechSynthesis
  const shouldCancel = synth.speaking || synth.pending
  if (shouldCancel) {
    synth.cancel()
  }

  const utterance = new SpeechSynthesisUtterance(content)
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

  utterance.onstart = () => {
    console.log('[语音] 开始朗读')
  }

  utterance.onend = () => {
    currentUtterance = null
    console.log('[语音] 朗读结束')
  }

  utterance.onerror = (event) => {
    currentUtterance = null
    console.warn('[语音] 朗读出错:', event.error)
  }

  currentUtterance = utterance

  const play = () => {
    if (requestId !== speakRequestId) return

    if (synth.paused) {
      synth.resume()
    }

    speakTimer = setTimeout(() => {
      if (requestId !== speakRequestId) return
      synth.resume()
      synth.speak(utterance)
      speakTimer = null
    }, shouldCancel ? 200 : 0)
  }

  if (shouldCancel) {
    waitForCancelToSettle(play)
  } else {
    play()
  }
}

// 停止朗读
export function stop(): void {
  if (isSpeechSupported()) {
    speakRequestId++
    if (speakTimer) {
      clearTimeout(speakTimer)
      speakTimer = null
    }
    window.speechSynthesis.cancel()
    currentUtterance = null
  }
}

// 检查是否正在朗读
export function isSpeaking(): boolean {
  return isSpeechSupported() && (window.speechSynthesis.speaking || currentUtterance !== null)
}

// 初始化
export function initSpeech(): void {
  if (!isSpeechSupported()) return
  // 预加载语音列表
  window.speechSynthesis.getVoices()
  // 启动保活定时器
  startKeepAlive()
}
