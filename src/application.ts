import {
  BOSS_HP, CALIBRATIONS, HZ, INCIDENTS, INSPECTION_HOLD, INSPECTION_RADIUS, SHORTCUTS, Signal, UPGRADES,
  WEAPON_IDS, WEAPON_SLOTS, advanceRun, chooseUpgrade, previewToolStats,
  createPracticeRun, createRun, hazardValue, isWeapon, nearestShortcut, nearestTool, waveCount, waveGapDegrees, weaponCount,
  type Input, type Run,
} from './simulation.hot.ts'
import { createSound } from './sound.ts'
import { LESSON_COPY, advanceLesson, createLesson, equipInLesson, type Lesson } from './lesson.ts'
import { createGameView } from './view.ts'
import type { SpriteName } from './sprites.ts'

function element<T extends HTMLElement = HTMLElement>(id: string) {
  const found = document.getElementById(id)
  if (!found) throw new Error('Missing game element ' + id)
  return found as T
}

function text(target: HTMLElement, value: string) {
  if (target.textContent !== value) target.textContent = value
}

function meter(target: HTMLElement, value: number) {
  const amount = Math.max(0, Math.min(1, value)).toFixed(3)
  const transform = 'scaleX(' + amount + ')'
  if (target.style.transform !== transform) target.style.transform = transform
}

export function clockText(tick: number) {
  const total = Math.floor(tick / HZ)
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0')
}

export function createApplication() {
  const workstation = element('workstation')
  const stage = element('stage')
  const titleScreen = element('title-screen')
  const startButton = element<HTMLButtonElement>('start-button')
  const learnButton = element<HTMLButtonElement>('learn-button')
  const skipTraining = element<HTMLButtonElement>('skip-training')
  const finishTraining = element<HTMLButtonElement>('finish-training')
  const trainingPanel = element('training-panel')
  const lessonProgress = element('training-progress')
  const lessonTitle = element('training-title')
  const lessonDetail = element('training-detail')
  const pauseButton = element<HTMLButtonElement>('pause-button')
  const soundButton = element<HTMLButtonElement>('sound-button')
  const fullButton = element<HTMLButtonElement>('full-button')
  const soundLabel = element('sound-label')
  const fullLabel = element('full-label')
  const hud = element('hud')
  const healthValue = element('health-value')
  const healthMeter = element('health-meter')
  const healthFill = element('health-fill')
  const xpFill = element('xp-fill')
  const clock = element('clock-text')
  const phase = element('phase-text')
  const level = element('level-text')
  const kills = element('kills-text')
  const bossMeter = element('boss-meter')
  const bossFill = element('boss-fill')
  const waveInfo = element('wave-info')
  const incidentPanel = element('incident-panel')
  const incidentTitle = element('incident-title')
  const incidentTime = element('incident-time')
  const incidentDetail = element('incident-detail')
  const inspectionCard = element('inspection-card')
  const inspectionProgress = element('inspection-progress')
  const inspectionHint = element('inspection-hint')
  const inspectionFill = element('inspection-fill')
  const toast = element('toast')
  const toastTitle = element('toast-title')
  const toastDetail = element('toast-detail')
  const shortcutCard = element('shortcut-card')
  const toolCard = element('tool-card')
  const toolName = element('tool-name')
  const shortcutName = element('shortcut-name')
  const shortcutBenefit = element('shortcut-benefit')
  const shortcutConsequence = element('shortcut-consequence')
  const shortcutAction = element('shortcut-action')
  const weaponStatus = element('weapon-status')
  const weaponIcons = element('weapon-icons')
  const gearCount = element('gear-count')
  const riskPanel = element('risk-panel')
  const riskValue = element('risk-value')
  const riskSegments = element('risk-segments').children
  const dashText = element('dash-text')
  const dashFill = element('dash-fill')
  const upgradeScreen = element('upgrade-screen')
  const upgradeLevel = element('upgrade-level')
  const upgradeOptions = element('upgrade-options')
  const pauseScreen = element('pause-screen')
  const resumeButton = element<HTMLButtonElement>('resume-button')
  const endScreen = element('end-screen')
  const endDialog = endScreen.querySelector<HTMLDivElement>('.end-dialog')!
  const endTitle = element('end-title')
  const endReason = element('end-reason')
  const endTime = element('end-time')
  const endKills = element('end-kills')
  const endRisk = element('end-risk')
  const endLog = element('end-log')
  const retryButton = element<HTMLButtonElement>('retry-button')
  const touch = element('touch-controls')
  const joystick = element('joystick')
  const stick = element('joystick-stick')
  const floatingJoystick = element('floating-joystick')
  const floatingStick = element('floating-stick')
  const touchAccept = element<HTMLButtonElement>('touch-accept')
  const touchDash = element<HTMLButtonElement>('touch-dash')
  const view = createGameView(element('game-view'))
  const sound = createSound()

  let run: Run | null = null
  let lesson: Lesson | null = null
  let trained = readTrainingPreference()
  let paused = false
  let soundEnabled = true
  let toastUntil = 0
  let lastTickTime = 0
  let accumulator = 0
  let dashQueued = false
  let acceptQueued = false
  let joystickId = -1
  let touchX = 0
  let touchZ = 0
  let flickX = 0
  let flickZ = 0
  let stickOriginX = 0
  let stickOriginZ = 0
  let stickRadius = 1
  let pointerSince = 0
  let dragAnywhere = false
  let frameRequest = 0

  const held = new Set<string>()
  const frameInput: Input = { x: 0, z: 0, dash: false, accept: false }
  const movementCodes = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])
  const codeToOption: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }

  function clearControls() {
    held.clear()
    dashQueued = false
    acceptQueued = false
    touchX = 0
    touchZ = 0
    joystickId = -1
    flickX = 0
    flickZ = 0
    stick.style.transform = ''
    floatingStick.style.transform = ''
    floatingJoystick.hidden = true
  }

  function note(title: string, detail: string, ticks = 132, warning = false) {
    if (!run) return
    text(toastTitle, title)
    text(toastDetail, detail)
    toast.dataset.tone = warning ? 'warning' : ''
    toast.hidden = false
    toastUntil = run.tick + ticks
  }

  function status() {
    if (!run) return
    const hp = String(Math.ceil(run.player.hp))
    const maximum = String(run.player.maximumHp)
    const isBoss = run.phase === 'boss'
    text(healthValue, hp + ' / ' + maximum)
    if (healthMeter.getAttribute('aria-valuenow') !== hp) healthMeter.setAttribute('aria-valuenow', hp)
    if (healthMeter.getAttribute('aria-valuemax') !== maximum) healthMeter.setAttribute('aria-valuemax', maximum)
    meter(healthFill, run.player.hp / run.player.maximumHp)
    meter(xpFill, run.xp / run.xpGoal)
    text(clock, lesson ? '练习' : clockText(run.tick))
    text(phase, lesson ? '新手训练' : isBoss ? '事故处置' : '守住产线')
    text(level, '等级 ' + String(run.level).padStart(2, '0'))
    text(kills, '击退 ' + run.kills)
    stage.classList.toggle('boss-active', isBoss)
    bossMeter.hidden = !isBoss
    if (isBoss) {
      text(waveInfo, waveCount(run) + ' 道波 · 缺口 ' + waveGapDegrees(run) + '°')
      meter(bossFill, run.boss.hp / BOSS_HP)
    }
    if (run.tick >= toastUntil) toast.hidden = true
    const hazard = hazardValue(run)
    text(riskValue, hazard + ' / 3')
    riskPanel.classList.toggle('risk-raised', hazard > 0)
    for (let i = 0; i < riskSegments.length; i++) riskSegments[i].classList.toggle('filled', i < hazard)
    const boost = Math.ceil(Math.max(0, run.boostUntil - run.tick) / HZ)
    text(weaponStatus, boost > 0 ? '攻速 ×2 · ' + boost + ' 秒' : weaponCount(run) > 0 ? '自动测量' : '拾取地上的卡尺')
    const dashDelay = Math.max(0, run.player.dashReadyAt - run.tick)
    text(dashText, dashDelay > 0 ? '冲刺恢复' : '冲刺就绪')
    meter(dashFill, 1 - dashDelay / 78)
    const activeIncident = run.phase === 'floor' ? run.incident : null
    incidentPanel.hidden = !activeIncident || !!lesson || run.choices.length > 0 || paused
    stage.classList.toggle('incident-active', !incidentPanel.hidden)
    if (activeIncident) {
      const warning = activeIncident.stage === 'warning'
      const profile = INCIDENTS[activeIncident.slot]
      text(incidentTitle, profile.title)
      text(incidentTime, Math.ceil(((warning ? activeIncident.opensAt : activeIncident.closesAt) - run.tick) / HZ) + ' 秒')
      text(incidentDetail, warning ? profile.detail : '黄色捷径立即处理 · 绿色复检圈需停留 1.6 秒')
      incidentPanel.dataset.stage = activeIncident.stage
    }
    const station = activeIncident?.stage === 'open' ? activeIncident.inspection : null
    const shortcut = run.phase === 'floor' ? nearestShortcut(run) : undefined
    const inspectionDistance = station ? Math.hypot(station.x - run.player.x, station.z - run.player.z) : Infinity
    const shortcutDistance = shortcut ? Math.hypot(shortcut.x - run.player.x, shortcut.z - run.player.z) : Infinity
    const hideControls = Boolean(run.choices.length) || paused
    inspectionCard.hidden = !station || inspectionDistance > 3.15 || inspectionDistance > shortcutDistance || hideControls
    if (station && !inspectionCard.hidden) {
      const fraction = station.held / INSPECTION_HOLD
      text(inspectionProgress, Math.floor(fraction * 100) + '%')
      text(inspectionHint, inspectionDistance <= INSPECTION_RADIUS
        ? '站稳，正在核验本批待检件'
        : '圈内停留 1.6 秒，隔离本批待检件')
      meter(inspectionFill, fraction)
    }
    shortcutCard.hidden = !shortcut || !inspectionCard.hidden || hideControls
    const ready = shortcut && nearestShortcut(run, 1.65) !== undefined
    if (shortcut && !shortcutCard.hidden) {
      const definition = SHORTCUTS[shortcut.kind]
      text(shortcutName, definition.name)
      if (shortcut.kind === 'pass') {
        let remaining = 0
        for (const enemy of run.enemies) if (enemy.active) remaining++
        text(shortcutBenefit, '立刻清场 · ' + remaining + ' 件零件')
      } else text(shortcutBenefit, definition.benefit)
      text(shortcutConsequence, definition.consequence + ' · ' + definition.trace)
      text(shortcutAction, ready ? '确认拾取' : '进入光圈后可拾取')
    }
    const tool = nearestTool(run)
    toolCard.hidden = !tool || Boolean(run.choices.length) || paused || !!shortcut || !inspectionCard.hidden || run.phase === 'ended'
    if (tool) text(toolName, UPGRADES[tool.kind].name)
    touchAccept.disabled = !ready
    touchDash.disabled = dashDelay > 0
  }

  function updateGear() {
    if (!run) return
    const tools = (['caliper', ...WEAPON_IDS] as const).filter(id => run!.ranks[id] > 0)
    weaponIcons.replaceChildren()
    for (const tool of tools) {
      const definition = UPGRADES[tool]
      const slot = document.createElement('span')
      slot.className = 'weapon-chip'
      slot.classList.toggle('calibrated', run.ranks[tool] >= 3)
      slot.title = definition.name + ' · Lv.' + run.ranks[tool]
      slot.setAttribute('aria-label', slot.title)
      const picture = document.createElement('canvas')
      picture.width = 36
      picture.height = 36
      picture.setAttribute('aria-hidden', 'true')
      view.icon(picture, definition.sprite)
      const rank = document.createElement('b')
      rank.textContent = 'Lv.' + run.ranks[tool]
      slot.append(picture, rank)
      weaponIcons.append(slot)
    }
    text(gearCount, '工具 ' + weaponCount(run) + ' / ' + WEAPON_SLOTS)
  }

  function showLessonStep() {
    if (!lesson) return
    const copy = LESSON_COPY[lesson.step]
    const touchDevice = matchMedia('(pointer: coarse)').matches
    text(lessonProgress, '新手训练 ' + copy.number + ' / 5')
    text(lessonTitle, copy.title)
    const reviewed = lesson.step === 'wave' && run?.inspections.length
    text(lessonDetail, reviewed
      ? '复检已隔离待检件。沿绿色箭头走进基础冲击波的安全缺口。'
      : touchDevice ? copy.touch : copy.desktop)
    const done = lesson.step === 'done'
    finishTraining.hidden = !done
    if (done) {
      sound.setMode('quiet')
      touch.hidden = true
      clearControls()
      finishTraining.focus({ preventScroll: true })
    }
  }

  function readTrainingPreference() {
    try { return localStorage.getItem('tolerance-survivor-training-v1') === 'seen' }
    catch { return false }
  }

  function markTrainingSeen() {
    trained = true
    try { localStorage.setItem('tolerance-survivor-training-v1', 'seen') }
    catch { /* The current session still remembers the preference. */ }
  }

  function showTitle() {
    run = null
    lesson = null
    trainingPanel.hidden = true
    skipTraining.hidden = true
    paused = false
    accumulator = 0
    clearControls()
    titleScreen.hidden = false
    hud.hidden = true
    touch.hidden = true
    pauseButton.hidden = true
    upgradeScreen.hidden = true
    pauseScreen.hidden = true
    endScreen.hidden = true
    stage.classList.remove('boss-active', 'incident-active')
    workstation.dataset.mode = 'title'
    sound.setMode('menu')
    startButton.focus({ preventScroll: true })
  }

  function enterRun(nextRun: Run) {
    run = nextRun
    paused = false
    accumulator = 0
    clearControls()
    titleScreen.hidden = true
    hud.hidden = false
    touch.hidden = false
    pauseButton.hidden = false
    pauseButton.setAttribute('aria-pressed', 'false')
    trainingPanel.hidden = !lesson
    skipTraining.hidden = !lesson
    upgradeScreen.hidden = true
    endScreen.hidden = true
    pauseScreen.hidden = true
    toast.hidden = true
    toastUntil = 0
    workstation.dataset.mode = lesson ? 'training' : 'floor'
    sound.unlock()
    sound.setMode('run')
    sound.play('start')
    updateGear()
    if (lesson) showLessonStep()
    else note('接管计量站', '先走进绿色光圈拾起游标卡尺。用实测量块升级工具。', 225)
    status()
  }

  function start(seed = Math.floor(Math.random() * 0x100000000)) {
    lesson = null
    enterRun(createRun(seed))
  }

  function beginLesson() {
    lesson = createLesson()
    enterRun(createPracticeRun())
  }

  function startFromTitle() {
    if (trained) start()
    else beginLesson()
  }

  function finishLesson() {
    if (!lesson) return
    markTrainingSeen()
    start()
  }

  function showUpgrades() {
    if (!run) return
    clearControls()
    accumulator = 0
    workstation.dataset.mode = 'upgrade'
    upgradeScreen.hidden = false
    touch.hidden = true
    text(upgradeLevel, '等级 ' + String(run.level).padStart(2, '0'))
    upgradeOptions.replaceChildren()
    for (let index = 0; index < run.choices.length; index++) {
      const id = run.choices[index]
      const definition = UPGRADES[id]
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'upgrade-choice'
      const image = document.createElement('canvas')
      image.width = 40
      image.height = 40
      image.setAttribute('aria-hidden', 'true')
      view.icon(image, definition.sprite as SpriteName)
      const key = document.createElement('kbd')
      key.textContent = String(index + 1)
      const name = document.createElement('strong')
      name.textContent = definition.name
      const details = document.createElement('span')
      details.textContent = definition.detail
      const rank = document.createElement('span')
      const equipment = id === 'caliper' || isWeapon(id)
      if (equipment) {
        rank.className = 'item-rank'
        rank.textContent = 'Lv.' + run.ranks[id] + ' → Lv.' + (run.ranks[id] + 1)
      } else {
        rank.textContent = '第 ' + (run.ranks[id] + 1) + ' 级'
      }
      button.append(image, key, name, rank, details)

      if (equipment) {
        const from = previewToolStats(run, id, run.ranks[id])
        const to = previewToolStats(run, id, run.ranks[id] + 1)
        const stats = document.createElement('span')
        stats.className = 'item-stats'
        for (const [label, value] of [
          ['伤害', from.damage + ' → ' + to.damage],
          ['间隔', from.interval.toFixed(2) + ' → ' + to.interval.toFixed(2) + ' 秒'],
          ['量程', from.reach.toFixed(1) + ' → ' + to.reach.toFixed(1) + ' 米'],
        ]) {
          const field = document.createElement('span')
          const caption = document.createElement('span')
          const reading = document.createElement('b')
          caption.textContent = label
          reading.textContent = value
          field.append(caption, reading)
          stats.append(field)
        }
        if (run.ranks[id] === 2) {
          details.textContent = CALIBRATIONS[id]
          button.classList.add('calibration-choice')
        }
        button.insertBefore(stats, details)
      }
      button.addEventListener('click', () => select(index))
      upgradeOptions.append(button)
    }
    ;(upgradeOptions.firstElementChild as HTMLElement | null)?.focus({ preventScroll: true })
  }

  function select(index: number) {
    if (!run || paused) return
    const selected = run.choices[index]
    if (!selected || !chooseUpgrade(run, index)) return
    sound.play('click')
    if (!lesson && (selected === 'caliper' || isWeapon(selected)) && run.ranks[selected] === 3) {
      note(UPGRADES[selected].name + ' · Lv.3 校准', CALIBRATIONS[selected], 162)
    }
    clearControls()
    upgradeScreen.hidden = true
    touch.hidden = false
    workstation.dataset.mode = lesson ? 'training' : run.phase
    updateGear()
    if (lesson) {
      equipInLesson(lesson, run)
      showLessonStep()
    }
    status()
  }

  function setPaused(value: boolean) {
    if (!run || run.phase === 'ended' || value === paused) return
    paused = value
    clearControls()
    accumulator = 0
    pauseScreen.hidden = !value
    upgradeScreen.hidden = value || run.choices.length === 0
    touch.hidden = value || Boolean(run.choices.length) || lesson?.step === 'done'
    pauseButton.setAttribute('aria-pressed', String(value))
    workstation.dataset.mode = value ? 'paused' : run.choices.length ? 'upgrade' : lesson ? 'training' : run.phase
    sound.setMode(value ? 'quiet' : run.phase === 'boss' ? 'boss' : 'run')
    if (value) resumeButton.focus({ preventScroll: true })
    else if (run.choices.length) (upgradeOptions.firstElementChild as HTMLElement | null)?.focus({ preventScroll: true })
    status()
  }

  function showResult() {
    if (!run || !run.outcome) return
    clearControls()
    accumulator = 0
    touch.hidden = true
    pauseButton.hidden = true
    upgradeScreen.hidden = true
    pauseScreen.hidden = true
    endScreen.hidden = false
    workstation.dataset.mode = 'ended'
    endDialog.dataset.outcome = run.outcome
    const title = run.outcome === 'qualified' ? '验收通过' : run.outcome === 'repair' ? '生产恢复，待整改' : '事故停线'
    const reason = run.outcome === 'qualified' ? '试验台已停止运转，本班质量记录完整。'
      : run.outcome === 'repair' ? '试验台已停止运转。捷径留下的故障仍需补做检验和整改。'
      : run.endCause === 'timeout' ? '应急处置时间用尽，试验台仍在运转。' : '值班员受伤退出，产线进入紧急停线。'
    text(endTitle, title)
    text(endReason, reason)
    text(endTime, clockText(run.tick))
    text(endKills, String(run.kills))
    text(endRisk, hazardValue(run) + ' / 3')
    endLog.replaceChildren()

    const rows = [
      ...run.accepted.map(record => ({
        tick: record.tick, action: SHORTCUTS[record.kind].name,
        reason: SHORTCUTS[record.kind].trace + ' · ' + SHORTCUTS[record.kind].consequence, safe: false,
      })),
      ...run.inspections.map(record => ({
        tick: record.tick, action: '合规复检',
        reason: INCIDENTS[record.slot].batch + ' · 隔离 ' + record.isolated + ' 件', safe: true,
      })),
    ].sort((a, b) => a.tick - b.tick)
    if (rows.length === 0) {
      const item = document.createElement('li')
      item.textContent = '本班质量隐患值为 0。'
      endLog.append(item)
    }
    for (const row of rows) {
      const item = document.createElement('li')
      item.dataset.safe = String(row.safe)
      const time = document.createElement('time')
      time.textContent = clockText(row.tick)
      const name = document.createElement('b')
      name.textContent = row.action
      const reason = document.createElement('span')
      reason.textContent = row.reason
      item.append(time, name, reason)
      endLog.append(item)
    }
    sound.setMode('quiet')
    sound.play(run.outcome === 'stopped' ? 'fail' : 'success')
    retryButton.focus({ preventScroll: true })
  }

  function advance(input: Input) {
    if (!run || paused || run.phase === 'ended' || run.choices.length || lesson?.step === 'done') return
    const killsBefore = run.kills
    const signal = advanceRun(run, input)
    if (signal & Signal.strike) sound.play('strike')
    if (signal & Signal.dash) sound.play('dash')
    if (signal & Signal.hurt) sound.play('hurt')
    if (signal & Signal.pick) sound.play('pick')
    if (signal & Signal.toolDrop) {
      const tool = run.tools[run.tools.length - 1]
      note(UPGRADES[tool.kind].name + '掉落', '绿色光圈内的工具，走过去就能解锁。', 116)
    }
    if (signal & Signal.toolPickup && run.lastToolPicked) {
      updateGear()
      if (!lesson) note(UPGRADES[run.lastToolPicked].name + ' · Lv.1', '已解锁。收集实测量块，可以继续升级。', 128)
      sound.play('level')
    }

    if (signal & Signal.incidentWarning) sound.play('wave')
    if (signal & Signal.offer) sound.play('hit')
    if (signal & Signal.inspection) {
      const record = run.inspections[run.inspections.length - 1]
      note('复检完成', '隔离 ' + record.isolated + ' 件' + (record.recovery > 0 ? ' · 生命 +' + record.recovery : ' · 合规留档'), 150)
      sound.play('level')
    }
    if (signal & Signal.incidentClosed && !lesson) note('处置窗口已结束', '继续走位处理场上零件。', 122)
    if (signal & Signal.shortcut) {
      const definition = SHORTCUTS[run.accepted[run.accepted.length - 1].kind]
      const reward = signal & Signal.clear ? '清场 ' + (run.kills - killsBefore) + ' 件' : definition.benefit
      note(definition.name + '已使用', reward + ' · 隐患 +1', 175, true)
      sound.play(signal & Signal.clear ? 'clear' : 'accept')
    }
    if (signal & Signal.boss) {
      workstation.dataset.mode = 'boss'
      note('失稳试验台启动', '冲击波有缺口。沿地面绿色指示移动。', 235, true)
      sound.setMode('boss')
      sound.play('boss')
    }
    if (signal & Signal.wave) sound.play('wave')
    if (signal & Signal.level) {
      sound.play('level')
      showUpgrades()
    }
    if (lesson) {
      const previousStep = lesson.step
      advanceLesson(lesson, run, signal)
      if (lesson.step !== previousStep) {
        if (lesson.step === 'wave') {
          toast.hidden = true
          sound.setMode('boss')
          sound.play('boss')
        }
        showLessonStep()
      }
    }
    if (signal & Signal.end) showResult()
  }

  function draw(milliseconds: number) {
    status()
    view.render(run, milliseconds, lesson?.marker)
  }

  function tickFrame(now: number) {
    const elapsed = lastTickTime ? Math.min(100, now - lastTickTime) : 0
    lastTickTime = now
    if (run && !paused && run.phase !== 'ended' && run.choices.length === 0 && lesson?.step !== 'done') {
      accumulator += elapsed
      const millisecondStep = 1000 / HZ
      while (accumulator >= millisecondStep) {
        frameInput.x = Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft')) + touchX
        frameInput.z = Number(held.has('KeyS') || held.has('ArrowDown')) - Number(held.has('KeyW') || held.has('ArrowUp')) + touchZ
        if (flickX !== 0 || flickZ !== 0) {
          frameInput.x = flickX
          frameInput.z = flickZ
          flickX = 0
          flickZ = 0
        }
        frameInput.dash = dashQueued
        frameInput.accept = acceptQueued
        dashQueued = false
        acceptQueued = false
        accumulator -= millisecondStep
        advance(frameInput)
      }
    } else {
      accumulator = 0
    }
    draw(now)
    frameRequest = requestAnimationFrame(tickFrame)
  }

  function startLoop() {
    if (!frameRequest) frameRequest = requestAnimationFrame(tickFrame)
  }

  startButton.addEventListener('click', startFromTitle)
  learnButton.addEventListener('click', beginLesson)
  skipTraining.addEventListener('click', finishLesson)
  finishTraining.addEventListener('click', finishLesson)
  retryButton.addEventListener('click', () => start())
  pauseButton.addEventListener('click', () => setPaused(!paused))
  resumeButton.addEventListener('click', () => setPaused(false))
  element('pause-home').addEventListener('click', showTitle)
  element('end-home').addEventListener('click', showTitle)
  soundButton.addEventListener('click', () => {
    soundEnabled = !soundEnabled
    sound.setEnabled(soundEnabled)
    if (soundEnabled) sound.unlock()
    soundButton.setAttribute('aria-pressed', String(soundEnabled))
    text(soundLabel, soundEnabled ? '声音开' : '声音关')
  })
  fullButton.addEventListener('click', () => {
    const operation = document.fullscreenElement ? document.exitFullscreen() : workstation.requestFullscreen?.()
    operation?.catch(() => {
      if (run && run.phase !== 'ended') note('全屏不可用', '可以继续在当前窗口值班。', 130)
    })
  })
  document.addEventListener('fullscreenchange', () => text(fullLabel, document.fullscreenElement ? '退出全屏' : '全屏'))

  window.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if (!run) {
      if (event.code === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault()
        startFromTitle()
      }
      return
    }
    if (run.phase === 'ended') return
    if (event.code === 'Escape' && !event.repeat) {
      event.preventDefault()
      setPaused(!paused)
      return
    }
    if (paused) return
    if (run.choices.length) {
      const option = codeToOption[event.code]
      if (option !== undefined && !event.repeat) {
        event.preventDefault()
        select(option)
      }
      return
    }
    if (movementCodes.has(event.code)) {
      event.preventDefault()
      held.add(event.code)
    } else if (event.code === 'Space') {
      event.preventDefault()
      if (!event.repeat) dashQueued = true
    } else if (event.code === 'KeyE') {
      event.preventDefault()
      if (!event.repeat) acceptQueued = true
    }
  })
  window.addEventListener('keyup', event => held.delete(event.code))
  window.addEventListener('blur', clearControls)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') setPaused(true)
  })

  function moveStick(event: PointerEvent) {
    const dx = event.clientX - stickOriginX
    const dz = event.clientY - stickOriginZ
    const scale = Math.min(1, stickRadius / Math.max(1, Math.hypot(dx, dz)))
    touchX = dx * scale / stickRadius
    touchZ = dz * scale / stickRadius
    const visual = dragAnywhere ? floatingStick : stick
    visual.style.transform = 'translate(' + dx * scale + 'px,' + dz * scale + 'px)'
  }

  stage.addEventListener('pointerdown', event => {
    if (joystickId !== -1 || !run || paused || run.phase === 'ended' ||
        run.choices.length || lesson?.step === 'done') return
    const element = event.target instanceof Element ? event.target : null
    const fixed = element !== null && joystick.contains(element)
    if (!fixed && (event.pointerType === 'mouse' || element?.closest('button,.dialog,.training-panel'))) return
    if (!fixed && !element?.closest('.game-view')) return
    event.preventDefault()
    stage.setPointerCapture(event.pointerId)
    joystickId = event.pointerId
    dragAnywhere = !fixed
    pointerSince = performance.now()
    const bounds = (fixed ? joystick : stage).getBoundingClientRect()
    stickOriginX = fixed ? bounds.left + bounds.width / 2 : event.clientX
    stickOriginZ = fixed ? bounds.top + bounds.height / 2 : event.clientY
    stickRadius = (fixed ? bounds.width : 86) * .35
    if (dragAnywhere) {
      floatingJoystick.style.left = (stickOriginX - bounds.left) + 'px'
      floatingJoystick.style.top = (stickOriginZ - bounds.top) + 'px'
      floatingJoystick.hidden = false
    }
    moveStick(event)
  })
  stage.addEventListener('pointermove', event => {
    if (joystickId === event.pointerId) moveStick(event)
  })
  function stopStick(event: PointerEvent) {
    if (joystickId !== event.pointerId) return
    if (event.type === 'pointerup' && dragAnywhere && performance.now() - pointerSince < 240) {
      const dx = event.clientX - stickOriginX
      const dz = event.clientY - stickOriginZ
      const distance = Math.hypot(dx, dz)
      if (distance > 38) {
        flickX = dx / distance
        flickZ = dz / distance
        dashQueued = true
      }
    }
    joystickId = -1
    touchX = 0
    touchZ = 0
    stick.style.transform = ''
    floatingStick.style.transform = ''
    floatingJoystick.hidden = true
  }
  stage.addEventListener('pointerup', stopStick)
  stage.addEventListener('pointercancel', stopStick)
  stage.addEventListener('lostpointercapture', stopStick)
  touchDash.addEventListener('pointerdown', event => {
    event.preventDefault()
    dashQueued = true
  })
  touchAccept.addEventListener('pointerdown', event => {
    event.preventDefault()
    acceptQueued = true
  })

  workstation.dataset.mode = 'title'
  draw(performance.now())
  return { startLoop, start, advance, draw, select, getRun: () => run }
}
