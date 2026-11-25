import {
  Signal, beginPracticeWave, placePracticePass, placePracticeSamples, placePracticeToolTarget,
  type Run,
} from './simulation.hot.ts'

export const LESSON_COPY = {
  walk: { number: 1, title: '拾起游标卡尺', desktop: '用 WASD 或方向键移动，走进绿色光圈，拾起 Lv.1 卡尺。', touch: '按住场地拖动，走进绿色光圈拾起 Lv.1 卡尺。' },
  dash: { number: 2, title: '练习冲刺', desktop: '按空格冲刺。工位需要绕行。右下角进度条填满后可再次冲刺。', touch: '快速划动场地或点「冲刺」。工位需要绕行。进度条填满后可再次冲刺。' },
  collect: { number: 3, title: '测量与升级', desktop: '卡尺会自动打向附近样件。走近蓝色量块，量块集齐后选一张升级卡，强化已经捡到的卡尺。', touch: '卡尺会自动打向附近样件。走近蓝色量块，量块集齐后选一张升级卡，强化已经捡到的卡尺。' },
  equip: { number: 3, title: '试用新工具', desktop: '拾起绿色光圈里的扳手，看看它怎样重击样件。工具在拾取后从 Lv.1 开始，最高 Lv.5。', touch: '拾起绿色光圈里的扳手，看看它怎样重击样件。工具在拾取后从 Lv.1 开始，最高 Lv.5。' },
  shortcut: { number: 4, title: '看看免检的代价', desktop: '黄色光圈按 E 免检，立即清场并增加隐患。也可在绿色复检圈停留 1.6 秒。', touch: '黄色光圈点「拾取」免检，立即清场并增加隐患。也可在绿色复检圈停留 1.6 秒。' },
  wave: { number: 5, title: '从缺口躲开冲击波', desktop: '免检件进入装配后失效，试验台会多放一道冲击波。沿绿色箭头进入缺口。', touch: '免检件进入装配后失效，试验台会多放一道冲击波。沿绿色箭头进入缺口。' },
  done: { number: 5, title: '训练完成', desktop: '正式值班从 0 点隐患开始。拾取前先看收益和后果，也可以绕开捷径。', touch: '正式值班从 0 点隐患开始。拾取前先看收益和后果，也可以绕开捷径。' },
} as const

type LessonStep = keyof typeof LESSON_COPY
export type Lesson = { step: LessonStep; waitUntil: number; demonstrated: boolean; marker: { x: number; z: number } | null }

export function createLesson(): Lesson {
  return { step: 'walk', waitUntil: 0, demonstrated: false, marker: { x: -3.45, z: .6 } }
}

export function equipInLesson(lesson: Lesson, run: Run) {
  if (lesson.step !== 'collect') return
  placePracticeToolTarget(run)
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
    if (!lesson.demonstrated && run.effects.some(effect => effect.from === run.tick &&
        (effect.kind === 'wrench' || effect.kind === 'file' || effect.kind === 'saw' || effect.kind === 'tape' || effect.kind === 'mallet'))) {
      lesson.demonstrated = true
      lesson.waitUntil = run.tick + 42
    }
    if (lesson.demonstrated && run.tick >= lesson.waitUntil) {
      placePracticePass(run)
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
  } else if (lesson.step === 'wave' && run.waves.some(wave => wave.active && wave.crossedSafely)) {
    lesson.step = 'done'
  }
}
