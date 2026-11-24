import { createApplication } from './application.ts'

try {
  createApplication().startLoop()
} catch (error) {
  const start = document.getElementById('start-button') as HTMLButtonElement | null
  const message = document.getElementById('boot-message')
  if (start) start.disabled = true
  if (message) {
    message.textContent = '游戏需要 WebGL 2。可以在已启用图形加速的 Chrome 或 Edge 中重新打开。'
    message.hidden = false
  }
  console.error('Could not open the workshop.', error)
}
