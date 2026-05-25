import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

// 格式化时间
export function formatTime(date: string | Date): string {
  return dayjs(date).fromNow()
}

// 格式化日期
export function formatDate(date: string | Date, format = 'YYYY-MM-DD HH:mm'): string {
  return dayjs(date).format(format)
}

// 截断文本
export function truncateText(text: string, length: number): string {
  if (!text) return ''
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}

// 获取分类颜色
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    '股票': 'blue',
    '基金': 'green',
    '宏观': 'yellow',
    '行业': 'red',
    '其他': 'gray',
  }
  return colors[category] || 'gray'
}

// 获取分类样式
export function getCategoryBadgeClass(category: string): string {
  const color = getCategoryColor(category)
  return `badge-${color}`
}
