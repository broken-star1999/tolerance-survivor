import { createApplication } from './application.ts'

try {
  const app = createApplication()
  app.startLoop()
  if (import.meta.env.DEV) {
    (window as unknown as { __game?: typeof app }).__game = app
    if (new URLSearchParams(location.search).get('preview') === 'repair') {
      app.start()
      const r = app.getRun()!
      r.passes = 1
      r.accepted.push({ slot: 0, kind: 'pass', tick: 3000 })
      r.nextShortcut = 3
      r.inspections.push({ slot: 1, tick: 6000, isolated: 12, recovery: 26 })
      r.hazardDamage = 48
      r.tick = 12700
      r.phase = 'boss'
      r.boss.active = true
      r.boss.hp = 0
    }
  }
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
