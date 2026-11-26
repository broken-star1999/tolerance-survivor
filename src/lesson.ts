import {
  Signal, beginPracticeWave, placePracticePass, placePracticeSamples, placePracticeToolTarget, waveCount,
  type Run,
} from './simulation.hot.ts'

export const LESSON_COPY = {
  walk: {
    number: 1, title: '拾起游标卡尺', line: '先拿量具。看地上的箭头，走进绿圈。',
    desktop: 'WASD 或方向键', touch: '按住场地拖动',
  },
  dash: {
    number: 2, title: '练习冲刺', line: '试一次冲刺。右下角进度条回满就能再用。',
    desktop: '空格', touch: '快划场地或点「冲刺」',
  },
  collect: {
    number: 3, title: '测量与升级', line: '卡尺会自动出手。收集掉落的实测量块，就能选卡升级。',
    desktop: '走近实测量块', touch: '走近实测量块',
  },
  equip: {
    number: 4, title: '试用新工具', line: '拿上扳手，靠近螺栓。解锁的工具会自动同时出手。',
    desktop: '走进扳手的绿圈', touch: '走进扳手的绿圈',
  },
  shortcut: {
    number: 5, title: '处置超差样件', line: '这批赶着装配。绿圈复检要留 1.6 秒，免检能救急，但会放进超差件。',
    desktop: '绿圈复检 · 黄圈按 E', touch: '绿圈复检 · 黄圈点「免检放行」',
  },
  wave: {
    number: 6, title: '从缺口躲开冲击波', line: '免检件进入装配。沿绿色箭头找缺口，躲过这一轮的两道波。',
    desktop: '沿地面绿箭头走', touch: '沿地面绿箭头走',
  },
  done: {
    number: 6, title: '训练完成', line: '正式值班要核验三批样件。复检、放行和待复核都会写进交班报告。',
    desktop: '', touch: '',
  },
} as const

export const LESSON_STEPS = LESSON_COPY.done.number

type LessonStep = keyof typeof LESSON_COPY
export type Lesson = { step: LessonStep; waitUntil: number; demonstrated: boolean; marker: { x: number; z: number } | null }

export function createLesson(): Lesson {
  return { step: 'walk', waitUntil: 0, demonstrated: false, marker: { x: -3.45, z: .6 } }
}

export function equipInLesson(lesson: Lesson, run: Run) {
  if (lesson.step !== 'collect') return
  placePracticeToolTarget(run)
  const tool = run.tools[run.tools.length - 1]
  lesson.marker = { x: tool.x, z: tool.z }
  lesson.step = 'equip'
}

export function advanceLesson(lesson: Lesson, run: Run, signal: number) {
  if (lesson.step === 'walk' && (signal & Signal.toolPickup) && run.ranks.caliper > 0) {
    lesson.step = 'dash'
    lesson.marker = null
  } else if (lesson.step === 'dash' && (signal & Signal.dash)) {
    placePracticeSamples(run)
    lesson.step = 'collect'
  } else if (lesson.step === 'equip') {
    if ((signal & Signal.toolPickup) && run.lastToolPicked === 'wrench') lesson.marker = null
    if (!lesson.demonstrated && run.effects.some(effect => effect.from === run.tick &&
        (effect.kind === 'wrench' || effect.kind === 'tape'))) {
      lesson.demonstrated = true
      lesson.waitUntil = run.tick + 42
    }
    if (lesson.demonstrated && run.tick >= lesson.waitUntil) {
      placePracticePass(run)
      lesson.marker = null
      lesson.step = 'shortcut'
    }
  } else if (lesson.step === 'shortcut') {
    if (signal & (Signal.shortcut | Signal.inspection)) {
      lesson.demonstrated = false
      lesson.waitUntil = run.tick + 92
    }
    if (!lesson.demonstrated && lesson.waitUntil > 0 && run.tick >= lesson.waitUntil) {
      beginPracticeWave(run)
      lesson.step = 'wave'
    }
  } else if (lesson.step === 'wave' && run.waves.filter(wave => wave.crossedSafely).length >= waveCount(run)) {
    lesson.step = 'done'
  }
}
