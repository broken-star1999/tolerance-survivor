import {
  BOSS_HP, BOSS_TICK, CALIBRATIONS, DASH_BUFFER, DASH_COOLDOWN, HZ, INCIDENTS, INSPECTION_HOLD, INSPECTION_RADIUS, SHORTCUTS,
  SHORTCUT_RADIUS, SHORTCUT_TICKS, SURGES, Signal, UPGRADES,
  TOOL_IDS, WEAPON_SLOTS, advanceRun, chooseUpgrade, previewToolStats,
  createPracticeRun, createRun, hazardValue, isWeapon, nearestShortcut, nearestTool, surgeGroupAt, waveCount, waveGapDegrees, weaponCount,
  type Input, type Run, type ToolKind,
} from './simulation.hot.ts'
import { createSound } from './sound.ts'
import { LESSON_COPY, LESSON_STEPS, advanceLesson, createLesson, equipInLesson, type Lesson } from './lesson.ts'
import { createGameView } from './view.ts'
import { ARENA, type GroundPoint } from './floor-plan.ts'
import type { SpriteName } from './sprites.ts'

const FLICK_DISTANCE = 52
const FLICK_WINDOW = 220

function element<T extends HTMLElement = HTMLElement>(id: string) {
  const found = document.getElementById(id)
  if (!found) throw new Error('Missing game element ' + id)
  return found as T
}

function text(target: HTMLElement, value: string) {
  if (target.textContent !== value) target.textContent = value
}

function show(target: HTMLElement, visible: boolean) {
  if (target.hidden === visible) target.hidden = !visible
}

function setData(target: HTMLElement, key: string, value: string) {
  if (target.dataset[key] !== value) target.dataset[key] = value
}

function setDisabled(target: HTMLButtonElement, value: boolean) {
  if (target.disabled !== value) target.disabled = value
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

const batchReadings = INCIDENTS.map(({ measurement }) => {
  const { name, nominal, tolerance, measured, unit } = measurement
  const spec = nominal.toFixed(2) + ' ± ' + tolerance.toFixed(2) + ' ' + unit
  const actual = measured.toFixed(2) + ' ' + unit
  const excess = (Math.abs(measured - nominal) - tolerance).toFixed(2)
  return {
    name, spec, actual, nominal: nominal.toFixed(2) + ' ' + unit,
    summary: name + ' · 要求 ' + spec + '\n实测 ' + actual + ' · 超差 ' + excess + ' ' + unit,
  }
})

function entranceGuide(parts: readonly GroundPoint[]) {
  const sides = new Set<string>()
  for (const { x, z } of parts) {
    if (ARENA.x - Math.abs(x) < ARENA.z - Math.abs(z)) sides.add(x < 0 ? '左侧' : '右侧')
    else sides.add(z < 0 ? '上方' : '下方')
  }
  return ['左侧', '右侧', '上方', '下方'].filter(side => sides.has(side)).join('、') + '进场'
}

export function createApplication() {
  const workstation = element('workstation')
  const stage = element('stage')
  const titleScreen = element('title-screen')
  const startButton = element<HTMLButtonElement>('start-button')
  const learnButton = element<HTMLButtonElement>('learn-button')
  const introButton = element<HTMLButtonElement>('intro-button')
  const introScreen = element('intro-screen')
  const introClose = element<HTMLButtonElement>('intro-close')
  const skipTraining = element<HTMLButtonElement>('skip-training')
  const finishTraining = element<HTMLButtonElement>('finish-training')
  const trainingPanel = element('training-panel')
  const lessonProgress = element('training-progress')
  const lessonTitle = element('training-title')
  const lessonDetail = element('training-detail')
  const lessonReading = element('training-reading')
  const lessonAction = element('training-action')
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
  const bossName = element('boss-name')
  const bossFill = element('boss-fill')
  const waveInfo = element('wave-info')
  const incidentPanel = element('incident-panel')
  const incidentTitle = element('incident-title')
  const incidentTime = element('incident-time')
  const incidentDirection = element('incident-direction')
  const incidentDetail = element('incident-detail')
  const incidentReading = element('incident-reading')
  const objectiveMarker = element('objective-marker')
  const objectiveLabel = element('objective-label')
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
  const reviewCount = element('review-count')
  const reviewValue = element('review-value')
  const dashText = element('dash-text')
  const dashFill = element('dash-fill')
  const upgradeScreen = element('upgrade-screen')
  const upgradeLevel = element('upgrade-level')
  const upgradeHint = element('upgrade-hint')
  const upgradeOptions = element('upgrade-options')
  const pauseScreen = element('pause-screen')
  const resumeButton = element<HTMLButtonElement>('resume-button')
  const endScreen = element('end-screen')
  const endDialog = endScreen.querySelector<HTMLDivElement>('.end-dialog')!
  const endStamp = element('end-stamp')
  const endTitle = element('end-title')
  const endReason = element('end-reason')
  const endTime = element('end-time')
  const endKills = element('end-kills')
  const endRisk = element('end-risk')
  const endReviews = element('end-reviews')
  const endImpact = element('end-impact')
  const endLog = element('end-log')
  const endMotto = element('end-motto')
  const retryButton = element<HTMLButtonElement>('retry-button')
  const touch = element('touch-controls')
  const joystick = element('joystick')
  const stick = element('joystick-stick')
  const floatingJoystick = element('floating-joystick')
  const floatingStick = element('floating-stick')
  const touchAccept = element<HTMLButtonElement>('touch-accept')
  const touchDash = element<HTMLButtonElement>('touch-dash')
  const touchDashFill = element('touch-dash-fill')
  const touchDevice = matchMedia('(pointer: coarse)')
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
  let needsFrame = true
  let lastArrivals: readonly GroundPoint[] | undefined
  let hazardNoted = false

  const held = new Set<string>()
  const frameInput: Input = { x: 0, z: 0, dash: false, accept: false }
  const movementCodes = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])
  const codeToSlot: Record<string, number> = Object.fromEntries(TOOL_IDS.flatMap((_, index) => [
    ['Digit' + (index + 1), index], ['Numpad' + (index + 1), index],
  ]))

  function resetStick() {
    const pointer = joystickId
    joystickId = -1
    if (pointer !== -1 && stage.hasPointerCapture(pointer)) stage.releasePointerCapture(pointer)
    touchX = 0
    touchZ = 0
    stick.style.transform = ''
    floatingStick.style.transform = ''
    floatingJoystick.hidden = true
  }

  function clearControls(keepMovement = false) {
    if (!keepMovement) {
      held.clear()
      resetStick()
    }
    dashQueued = false
    acceptQueued = false
    flickX = 0
    flickZ = 0
    if (run) run.player.dashBufferedUntil = -1
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
    hud.classList.toggle('low-health', run.player.hp <= run.player.maximumHp * .27)
    stage.classList.toggle('hurt', run.tick - run.player.hurtAt < 14)
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
    stage.classList.toggle('boss-enraged', isBoss && run.boss.enraged)
    show(bossMeter, isBoss)
    if (isBoss) {
      const press = run.boss.press
      const pct = Math.ceil(run.boss.hp / BOSS_HP * 100)
      bossMeter.classList.toggle('press-active', !!press)
      bossMeter.classList.toggle('enraged', run.boss.enraged)
      text(bossName, (run.boss.enraged ? '失稳试验台 · 过载 ' : '失稳试验台 · ') + pct + '%')
      text(waveInfo, press ? run.tick < press.strikesAt ? run.boss.presses.length + ' 处压头落区 · 离开标线' : '压头回升' :
        waveCount(run) + ' 道波 · 缺口 ' + waveGapDegrees(run) + '°')
      meter(bossFill, run.boss.hp / BOSS_HP)
    }
    if (run.tick >= toastUntil) show(toast, false)
    const hazard = hazardValue(run)
    text(riskValue, hazard + ' / ' + INCIDENTS.length)
    riskPanel.classList.toggle('risk-raised', hazard > 0)
    for (let i = 0; i < riskSegments.length; i++) riskSegments[i].classList.toggle('filled', i < hazard)
    show(reviewCount, !lesson)
    text(reviewValue, run.inspections.length + ' / ' + INCIDENTS.length)
    const boost = Math.ceil(Math.max(0, run.boostUntil - run.tick) / HZ)
    text(weaponStatus, boost > 0 ? '攻速 ×2 · ' + boost + ' 秒'
      : weaponCount(run) > 0 ? '已解锁工具自动出手' : '拾取地上的卡尺')
    const dashDelay = Math.max(0, run.player.dashReadyAt - run.tick)
    text(dashText, dashDelay === 0 ? '冲刺就绪' :
      run.player.dashBufferedUntil >= run.tick ? '冲刺已预备' : '冲刺恢复')
    const dashCharge = 1 - dashDelay / DASH_COOLDOWN
    meter(dashFill, dashCharge)
    if (touchDevice.matches) {
      meter(touchDashFill, dashCharge)
      touchDash.classList.toggle('dash-ready', dashDelay === 0)
    }
    const activeIncident = run.phase === 'floor' ? run.incident : null
    const surge = run.phase === 'floor' ? run.surge : null
    const incidentOpen = (Boolean(activeIncident) || Boolean(surge)) && !lesson && run.choices.length === 0 && !paused
    show(incidentPanel, incidentOpen)
    stage.classList.toggle('incident-active', incidentOpen)
    show(incidentReading, Boolean(activeIncident))
    const arrivals = activeIncident
      ? activeIncident.stage === 'warning' ? activeIncident.parts : undefined
      : surge?.groups[surge.issued]
    show(incidentDirection, incidentOpen && Boolean(arrivals?.length))
    if (arrivals?.length && !incidentDirection.hidden && arrivals !== lastArrivals) {
      lastArrivals = arrivals
      text(incidentDirection, entranceGuide(arrivals))
    }
    if (activeIncident) {
      const warning = activeIncident.stage === 'warning'
      const profile = INCIDENTS[activeIncident.slot]
      text(incidentTitle, profile.title)
      text(incidentTime, Math.ceil(((warning ? activeIncident.opensAt : activeIncident.closesAt) - run.tick) / HZ) + ' 秒')
      text(incidentReading, batchReadings[activeIncident.slot].summary)
      text(incidentDetail, warning ? profile.detail
        : '绿圈复检 1.6 秒 · ' + (activeIncident.shortcut.kind === 'pass' ? '黄圈免检' : '紫圈改写'))
      setData(incidentPanel, 'stage', activeIncident.stage)
    } else if (surge) {
      const profile = SURGES[surge.slot]
      const next = surgeGroupAt(surge, surge.issued)
      text(incidentTitle, profile.title)
      text(incidentTime, surge.issued === surge.groups.length ? '入场中' : Math.ceil((next - run.tick) / HZ) + ' 秒')
      text(incidentDetail, profile.detail)
      setData(incidentPanel, 'stage', 'surge')
    }
    const station = activeIncident?.stage === 'open' ? activeIncident.inspection : null
    const shortcut = run.phase === 'floor' ? nearestShortcut(run) : undefined
    const inspectionDistance = station ? Math.hypot(station.x - run.player.x, station.z - run.player.z) : Infinity
    const shortcutDistance = shortcut ? Math.hypot(shortcut.x - run.player.x, shortcut.z - run.player.z) : Infinity
    const hideControls = Boolean(run.choices.length) || paused
    const showInspection = Boolean(station) && inspectionDistance <= 3.15 && inspectionDistance <= shortcutDistance && !hideControls
    show(inspectionCard, showInspection)
    if (station && showInspection) {
      const fraction = station.held / INSPECTION_HOLD
      text(inspectionProgress, Math.floor(fraction * 100) + '%')
      text(inspectionHint, inspectionDistance <= INSPECTION_RADIUS
        ? '正在核对原始读数，留在圈内'
        : '留在圈内 1.6 秒，核验并隔离本批')
      meter(inspectionFill, fraction)
    }
    const showShortcut = Boolean(shortcut) && !showInspection && !hideControls
    show(shortcutCard, showShortcut)
    const ready = shortcut && shortcutDistance < SHORTCUT_RADIUS
    if (shortcut && showShortcut) {
      const definition = SHORTCUTS[shortcut.kind]
      setData(shortcutCard, 'kind', shortcut.kind)
      text(shortcutName, definition.name)
      if (shortcut.kind === 'pass') {
        let remaining = 0
        for (const enemy of run.enemies) if (enemy.active) remaining++
        text(shortcutBenefit, '收益 · 清场 ' + remaining + ' 件零件')
      } else text(shortcutBenefit, '收益 · ' + definition.benefit)
      const reading = activeIncident ? batchReadings[activeIncident.slot] : null
      const consequence = shortcut.kind === 'beautifier' && reading
        ? '原值 ' + reading.actual + ' → 改记 ' + reading.nominal
        : definition.trace
      text(shortcutConsequence, '代价 · ' + consequence + ' · ' + definition.consequence)
      text(shortcutAction, ready
        ? touchDevice.matches ? '点「' + definition.action + '」确认' : '确认' + definition.action
        : '进入提示圈后可操作')
    }
    const tool = nearestTool(run)
    show(toolCard, Boolean(tool) && run.choices.length === 0 && !paused && !shortcut && !showInspection && run.phase !== 'ended')
    if (tool) text(toolName, UPGRADES[tool.kind].name)
    show(touchAccept, Boolean(ready))
    setDisabled(touchAccept, !ready)
    if (ready) {
      text(touchAccept, SHORTCUTS[shortcut.kind].action)
      setData(touchAccept, 'kind', shortcut.kind)
    }
    setDisabled(touchDash, dashDelay > DASH_BUFFER)
  }

  function updateGear() {
    if (!run) return
    weaponIcons.replaceChildren()
    for (const tool of TOOL_IDS) {
      if (!run.ranks[tool]) continue
      const definition = UPGRADES[tool]
      const slot = document.createElement('div')
      slot.className = 'weapon-chip'
      slot.dataset.tool = tool
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
    text(lessonProgress, '训练 ' + copy.number + ' / ' + LESSON_STEPS)
    text(lessonTitle, copy.title)
    const reviewed = Boolean(run?.inspections.length)
    const practiceDecision = lesson.step === 'shortcut'
    const resolved = practiceDecision && !run?.incident
    lessonReading.hidden = !practiceDecision || resolved
    if (!lessonReading.hidden) text(lessonReading, batchReadings[0].summary)
    let line: string = copy.line
    if (resolved) line = reviewed
      ? '原始读数已经留档，超差件也隔离了。接下来练习避开冲击波。'
      : '这批超差件已经免检放行。接下来看看它怎样影响冲击波。'
    if (lesson.step === 'wave' && reviewed) {
      line = '超差件已隔离。这轮只有基础冲击波，沿绿色箭头找缺口。'
    }
    const pickedWrench = lesson.step === 'equip' && Boolean(run?.ranks.wrench)
    if (pickedWrench) line = '扳手已解锁，靠近螺栓即可自动重击。'
    text(lessonDetail, line)
    const action = pickedWrench ? '靠近螺栓'
      : touchDevice.matches ? copy.touch : copy.desktop
    lessonAction.hidden = !action || resolved
    text(lessonAction, action)
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

  function readIntroPreference() {
    try { return localStorage.getItem('tolerance-survivor-intro-v1') === 'seen' }
    catch { return false }
  }

  function markIntroSeen() {
    try { localStorage.setItem('tolerance-survivor-intro-v1', 'seen') }
    catch { /* The current session still remembers the preference. */ }
  }

  function openIntro() {
    introScreen.hidden = false
    introClose.focus({ preventScroll: true })
  }

  function closeIntro() {
    markIntroSeen()
    introScreen.hidden = true
    startButton.focus({ preventScroll: true })
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
    stage.classList.remove('boss-active', 'boss-enraged', 'incident-active')
    workstation.dataset.mode = 'title'
    sound.setMode('menu')
    needsFrame = true
    startButton.focus({ preventScroll: true })
  }

  function enterRun(nextRun: Run) {
    run = nextRun
    lastArrivals = undefined
    hazardNoted = false
    needsFrame = true
    paused = false
    accumulator = 0
    clearControls()
    titleScreen.hidden = true
    introScreen.hidden = true
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
    else note('接管计量站', '先拾取游标卡尺。三批样件送检时，留意场边的测量单。', 225)
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
    clearControls(true)
    accumulator = 0
    needsFrame = true
    workstation.dataset.mode = 'upgrade'
    upgradeScreen.hidden = false
    touch.hidden = true
    floatingJoystick.hidden = true
    text(upgradeLevel, '等级 ' + String(run.level).padStart(2, '0'))
    text(upgradeHint, lesson
      ? touchDevice.matches ? '点一张卡片，确认后继续训练。' : '按 1 至 3 或点击卡片，确认后继续训练。'
      : '选定校准方案后继续值班。')
    upgradeOptions.replaceChildren()
    for (let index = 0; index < run.choices.length; index++) {
      const id = run.choices[index]
      const definition = UPGRADES[id]
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'upgrade-choice'
      const image = document.createElement('canvas')
      image.width = 48
      image.height = 48
      image.setAttribute('aria-hidden', 'true')
      view.icon(image, definition.sprite as SpriteName)
      const key = document.createElement('kbd')
      key.textContent = String(index + 1)
      const name = document.createElement('strong')
      name.textContent = definition.name
      const details = document.createElement('span')
      details.className = 'item-description'
      details.textContent = definition.detail
      const rank = document.createElement('span')
      rank.className = 'item-rank'
      const equipment = id === 'caliper' || isWeapon(id)
      if (equipment) {
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
          ['间隔 · 秒', from.interval.toFixed(2) + ' → ' + to.interval.toFixed(2)],
          ['量程 · 米', from.reach.toFixed(1) + ' → ' + to.reach.toFixed(1)],
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
    clearControls(true)
    upgradeScreen.hidden = true
    touch.hidden = false
    floatingJoystick.hidden = joystickId === -1 || !dragAnywhere
    workstation.dataset.mode = lesson ? 'training' : run.phase
    needsFrame = true
    updateGear()
    if (lesson) {
      equipInLesson(lesson, run)
      updateGear()
      showLessonStep()
    }
    status()
  }

  function setPaused(value: boolean) {
    if (!run || run.phase === 'ended' || value === paused) return
    paused = value
    needsFrame = true
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
    needsFrame = true
    touch.hidden = true
    pauseButton.hidden = true
    upgradeScreen.hidden = true
    pauseScreen.hidden = true
    endScreen.hidden = false
    workstation.dataset.mode = 'ended'
    endDialog.dataset.outcome = run.outcome
    const stampCopy = { qualified: '合格', pending: '待复核', repair: '整改', stopped: '停线' } as const
    const mottoCopy = {
      qualified: '读数如实，分寸在心。图纸有公差，做人无公差。',
      pending: '设备停了，记录还缺。每一批都要有据可查。',
      repair: '捷径省下的几秒，换来整批返工。眼前的方便，终要有人买单。',
      stopped: '先保安全，再谈交付。下一班，记录依然要如实。',
    } as const
    text(endStamp, stampCopy[run.outcome])
    endStamp.dataset.outcome = run.outcome
    text(endMotto, mottoCopy[run.outcome])
    const outcomeCopy = {
      qualified: ['验收通过', '原始读数完整留档，超差批次已隔离，试验台通过本班处置。'],
      pending: ['设备已停，待复核', '还有批次缺少复检记录，暂缓交付，交由下一班核验。'],
      repair: ['交付暂缓，待整改', '试验台已停。免检放行或改写记录涉及的批次，须追回复核后才能交付。'],
      stopped: ['事故停线', run.endCause === 'timeout'
        ? '应急时间用尽，试验台仍在运转。暂停交付，保留本班记录。'
        : '值班员受伤退出，车间紧急停线。暂停交付，保留本班记录。'],
    }
    const [title, description] = outcomeCopy[run.outcome]
    text(endTitle, title)
    text(endReason, description)
    text(endTime, clockText(run.tick))
    text(endKills, String(run.kills))
    text(endRisk, hazardValue(run) + ' / ' + INCIDENTS.length)
    text(endReviews, run.inspections.length + ' / ' + INCIDENTS.length)
    endImpact.hidden = run.tick < BOSS_TICK
    text(endImpact, '事故冲击波 ' + waveCount(run) + ' 道/轮 · 安全缺口 ' + waveGapDegrees(run) + '°' +
      (hazardValue(run) > 0 ? ' · 隐患造成伤害 ' + Math.round(run.hazardDamage) + ' 点' : ' · 零隐患，冲击波保持基础强度'))
    endLog.replaceChildren()

    if (!run.nextShortcut) {
      const item = document.createElement('li')
      item.textContent = '首批样件尚未送检。'
      endLog.append(item)
    }
    for (let slot = 0; slot < run.nextShortcut; slot++) {
      const review = run.inspections.find(entry => entry.slot === slot)
      const shortcut = run.accepted.find(entry => entry.slot === slot)
      const reading = batchReadings[slot]
      const item = document.createElement('li')
      item.dataset.status = review ? 'reviewed' : shortcut ? 'shortcut' : 'pending'
      const header = document.createElement('div')
      header.className = 'report-row'
      const time = document.createElement('time')
      time.textContent = clockText(review?.tick ?? shortcut?.tick ?? SHORTCUT_TICKS[slot])
      time.title = review || shortcut ? '处置时间' : '送检时间'
      const name = document.createElement('b')
      name.textContent = INCIDENTS[slot].batch
      const decision = document.createElement('strong')
      decision.textContent = review ? '复检隔离' : shortcut ? SHORTCUTS[shortcut.kind].action : '待复核'
      header.append(time, name, decision)
      const source = document.createElement('p')
      source.className = 'report-reading'
      source.textContent = reading.name + ' · 原值 ' + reading.actual + ' · 要求 ' + reading.spec
      const consequence = document.createElement('p')
      if (review) {
        consequence.textContent = '原值已留档，' + (review.isolated > 0 ? '隔离剩余 ' + review.isolated + ' 件。' : '本批已无剩余待检件。')
      } else if (shortcut) {
        const definition = SHORTCUTS[shortcut.kind]
        const detail = shortcut.kind === 'beautifier' ? '上报 ' + reading.nominal + '，掩盖实际读数' : definition.trace
        consequence.textContent = detail + '。' + definition.consequence + '。'
      } else {
        consequence.textContent = '本批复检记录待补，交付挂起。'
      }
      item.append(header, source, consequence)
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
      if (!lesson) note(UPGRADES[run.lastToolPicked].name + ' · Lv.1', '已加入自动出手。收集实测量块可以升级。', 145)
      sound.play('level')
    }

    if (signal & Signal.incidentWarning) sound.play('wave')
    if (signal & Signal.offer) sound.play('hit')
    if (signal & Signal.surgeWarning) sound.play('wave')
    if (signal & Signal.surgeArrival) sound.play('hit')
    if (signal & Signal.inspection) {
      const record = run.inspections[run.inspections.length - 1]
      const recovery = record.recovery > 0 ? ' · 生命 +' + record.recovery : ''
      note('复检完成', '原始读数已留档 · 隔离 ' + record.isolated + ' 件' + recovery, 165)
      sound.play('level')
    }
    if (signal & Signal.incidentClosed && !lesson) note('批次待复核', '本批未完成复检，暂缓交付。', 134)
    if (signal & Signal.shortcut) {
      const definition = SHORTCUTS[run.accepted[run.accepted.length - 1].kind]
      const reward = signal & Signal.clear ? '清场 ' + (run.kills - killsBefore) + ' 件' : definition.benefit
      note(definition.action + '已记入本班', reward + ' · 隐患 +1', 175, true)
      sound.play(signal & Signal.clear ? 'clear' : 'accept')
    }
    if (signal & Signal.boss) {
      workstation.dataset.mode = 'boss'
      note('失稳试验台启动', '沿绿色缺口避开冲击波。', 144, true)
      sound.setMode('boss')
      sound.play('boss')
    }
    if (signal & Signal.wave) sound.play('wave')
    if ((signal & Signal.hazardReturn) && !hazardNoted) {
      hazardNoted = true
      note('隐患件回流', '免检或改写的批次回到产线，带着偏差冲向你。', 160, true)
    }
    if (signal & Signal.pressWarning) sound.play('wave')
    if (signal & Signal.pressImpact) sound.play('boss')
    if (signal & Signal.bossEnrage) {
      note('试验台过载', '冲击波提速，压头与脉冲弹幕全面加强！', 165, true)
      sound.play('boss')
    }
    if (signal & Signal.level) {
      sound.play('level')
      showUpgrades()
    }
    if (lesson) {
      const previousStep = lesson.step
      advanceLesson(lesson, run, signal)
      const changed = lesson.step !== previousStep
      if (previousStep === 'equip' && changed) updateGear()
      if (changed && lesson.step === 'wave') {
        toast.hidden = true
        sound.setMode('boss')
        sound.play('boss')
      }
      if (changed || (signal & (Signal.toolPickup | Signal.inspection | Signal.shortcut))) {
        showLessonStep()
      }
    }
    if (signal & Signal.end) showResult()
  }

  function guideToObjective() {
    if (!run || lesson || paused || run.choices.length || run.phase === 'ended') {
      objectiveMarker.hidden = true
      return
    }
    const station = run.incident?.stage === 'open' ? run.incident.inspection : undefined
    const tool = !station && run.phase === 'floor' ? nearestTool(run, Infinity) : undefined
    const rig = run.phase === 'boss' && run.boss.waveSets === 0 ? run.boss : undefined
    const target = station ?? tool ?? rig
    const side = target && view.offscreenSide(target.x)
    objectiveMarker.hidden = !side
    if (!side) return
    if (objectiveMarker.dataset.side !== side) objectiveMarker.dataset.side = side
    text(objectiveLabel, station ? '复检点' : tool ? UPGRADES[tool.kind].name : '试验台')
  }

  function draw(milliseconds: number) {
    status()
    view.render(run, milliseconds, lesson?.marker)
    guideToObjective()
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
    const frozen = Boolean(run) && (paused || run!.choices.length > 0 || run!.phase === 'ended')
    if (!frozen || needsFrame) {
      draw(now)
      needsFrame = false
    }
    frameRequest = requestAnimationFrame(tickFrame)
  }

  function startLoop() {
    if (!frameRequest) frameRequest = requestAnimationFrame(tickFrame)
  }

  startButton.addEventListener('click', startFromTitle)
  learnButton.addEventListener('click', beginLesson)
  introButton.addEventListener('click', openIntro)
  introClose.addEventListener('click', closeIntro)
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
  document.addEventListener('fullscreenchange', () => {
    needsFrame = true
    text(fullLabel, document.fullscreenElement ? '退出全屏' : '全屏')
  })
  window.addEventListener('resize', () => { needsFrame = true })

  window.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    sound.unlock()
    if (!run) {
      if (!introScreen.hidden) {
        if ((event.code === 'Escape' || event.code === 'Enter') && !event.repeat) {
          event.preventDefault()
          closeIntro()
        }
        return
      }
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
    if (movementCodes.has(event.code)) {
      event.preventDefault()
      held.add(event.code)
      return
    }
    const option = codeToSlot[event.code]
    if (run.choices.length) {
      if (option !== undefined && !event.repeat) {
        event.preventDefault()
        select(option)
      }
      return
    }
    if (event.code === 'Space') {
      if (event.target instanceof HTMLButtonElement && event.target.matches('.weapon-chip:focus-visible, #touch-accept:focus-visible')) return
      event.preventDefault()
      if (!event.repeat) dashQueued = true
    } else if (event.code === 'KeyE') {
      event.preventDefault()
      if (!event.repeat) acceptQueued = true
    }
  })
  window.addEventListener('keyup', event => held.delete(event.code))
  window.addEventListener('blur', () => clearControls())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') setPaused(true)
  })

  function moveStick(event: PointerEvent) {
    const dx = event.clientX - stickOriginX
    const dz = event.clientY - stickOriginZ
    const distance = Math.hypot(dx, dz)
    const scale = Math.min(1, stickRadius / Math.max(1, distance))
    const strength = Math.max(0, Math.min(1, (distance - 4) / (stickRadius - 4)))
    touchX = dx / Math.max(1, distance) * strength
    touchZ = dz / Math.max(1, distance) * strength
    const visual = dragAnywhere ? floatingStick : stick
    visual.style.transform = 'translate(' + dx * scale + 'px,' + dz * scale + 'px)'
  }

  stage.addEventListener('pointerdown', () => sound.unlock(), { passive: true })
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
    pointerSince = event.timeStamp
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
    if (event.type === 'pointerup' && dragAnywhere && !run?.choices.length && event.timeStamp - pointerSince < FLICK_WINDOW) {
      const dx = event.clientX - stickOriginX
      const dz = event.clientY - stickOriginZ
      const distance = Math.hypot(dx, dz)
      if (distance >= FLICK_DISTANCE) {
        flickX = dx / distance
        flickZ = dz / distance
        dashQueued = true
      }
    }
    resetStick()
  }
  stage.addEventListener('pointerup', stopStick)
  stage.addEventListener('pointercancel', stopStick)
  stage.addEventListener('lostpointercapture', stopStick)
  touchDash.addEventListener('pointerdown', event => {
    event.preventDefault()
    dashQueued = true
  })
  touchDash.addEventListener('click', event => {
    if (event.detail === 0) dashQueued = true
  })
  touchAccept.addEventListener('click', () => { acceptQueued = true })

  workstation.dataset.mode = 'title'
  draw(performance.now())
  if (!readIntroPreference()) openIntro()
  return { startLoop, start, advance, draw, select, getRun: () => run }
}
