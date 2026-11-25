import { createCrowd, detourTowardPlayer, indexCrowd, spacing, type Crowd } from './enemy-crowd.ts'
import { ARENA, PLAYER_CLEARANCE, isOpenFloor, moveOnFloor, nearestFreePoint, stationContact, type GroundPoint } from './floor-plan.ts'

export { ARENA } from './floor-plan.ts'

export const HZ = 60
export const BOSS_TICK = 210 * HZ
export const END_TICK = 300 * HZ
export const MAX_ENEMIES = 180
export const MAX_SHARDS = 480
export const MAX_BOLTS = 90
export const SHORTCUT_TICKS = [50 * HZ, 100 * HZ, 150 * HZ] as const
export const INSPECTION_HOLD = 96
export const INSPECTION_RADIUS = 1.36
export const DASH_COOLDOWN = 72
export const DASH_BUFFER = 8
const DASH_TICKS = 13
const DASH_SPEED = 15
const DASH_STEP = DASH_SPEED / HZ
const FILE_STROKE_GAP = 8
const SURGE_WARNING = 105
const PRESS_WARNING = 68
const PATROL_SPAWN_DISTANCE = 6.1
const FORMATION_DISTANCE = 5.45
const MARKED_SPAWN_DISTANCE = 3.8
const INCOMING_CLEARANCE = .68
export const SURGES = [
  { tick: 32 * HZ, title: '上料尖峰', detail: '整列超差件从一侧入场，沿空出来的一侧绕行。', first: 9, second: 4 },
  { tick: 122 * HZ, title: '复测积压', detail: '两批零件轮番压近，留意后到的远程干扰。', first: 12, second: 9 },
  { tick: 180 * HZ, title: '交班前满载', detail: '两侧分批进料，留一条通往试验台的退路。', first: 16, second: 12 },
] as const
export const INCIDENTS = [
  {
    title: '装配催料', batch: '首批装配件', detail: '装配工位在等料，待检件将从两侧入场。',
    measurement: { name: '衬套外径', nominal: 20, tolerance: .05, measured: 20.08, unit: 'mm' },
  },
  {
    title: '试验数据异常', batch: '试验数据批次', detail: '复核前发现载荷偏高，留意两侧数据屏的蓄力。',
    measurement: { name: '试验载荷', nominal: 4, tolerance: .10, measured: 4.24, unit: 'kN' },
  },
  {
    title: '交付催验', batch: '末批待验件', detail: '交班前要核对垫片厚度，末批样件将从两侧入场。',
    measurement: { name: '垫片厚度', nominal: 2, tolerance: .03, measured: 2.07, unit: 'mm' },
  },
] as const

const incidentBatches: ReadonlyArray<readonly EnemyKind[]> = [
  [...Array<EnemyKind>(16).fill('blank'), 'bolt', 'bolt'],
  ['phantom', 'phantom', 'blank', 'blank', 'bolt', 'blank', 'phantom', 'phantom', 'blank', 'bolt',
   'blank', 'phantom', 'phantom', 'blank', 'bolt', 'blank', 'phantom', 'bolt', 'blank', 'blank'],
  ['bolt', 'bolt', 'phantom', 'blank', 'blank', 'phantom', 'blank', 'blank', 'blank', 'phantom',
   'bolt', 'blank', 'blank', 'blank', 'phantom', 'phantom', 'bolt', 'blank', 'blank', 'blank',
   'phantom', 'blank', 'bolt', 'bolt', 'blank', 'blank'],
]
export const BOSS_HP = 4200
const TAU = Math.PI * 2

export const Signal = {
  strike: 1,
  hurt: 2,
  dash: 4,
  pick: 8,
  level: 16,
  shortcut: 32,
  clear: 64,
  boss: 128,
  wave: 256,
  end: 512,
  offer: 1024,
  toolDrop: 2048,
  toolPickup: 4096,
  incidentWarning: 8192,
  inspection: 16384,
  incidentClosed: 32768,
  surgeWarning: 65536,
  surgeArrival: 131072,
  pressWarning: 262144,
  pressImpact: 524288,
} as const

export const UPGRADES = {
  caliper: { name: '游标卡尺', detail: '校准卡尺，提升它的伤害、量程和测量速度', sprite: 'caliper' },
  power: { name: '硬化量爪', detail: '每次测量伤害 +7', sprite: 'caliper' },
  tempo: { name: '快速读数', detail: '缩短测量间隔', sprite: 'pulse' },
  reach: { name: '扩大量程', detail: '自动测量距离 +0.95 米', sprite: 'range' },
  sweep: { name: '多点测量', detail: '一次测量额外命中附近一件', sprite: 'caliper' },
  stride: { name: '防滑工靴', detail: '移动速度 +0.49 米/秒', sprite: 'boot' },
  guard: { name: '缓冲护具', detail: '生命上限 +10，恢复 28 点', sprite: 'guard' },
  magnet: { name: '磁吸托盘', detail: '经验吸取距离 +0.46 米', sprite: 'magnet' },
  wrench: { name: '扳手', detail: '重击前方近身扇区，打断螺栓蓄力', sprite: 'wrench' },
  file: { name: '锉刀', detail: '连续锉削三次，锉屑会擦到附近零件', sprite: 'file' },
  saw: { name: '手锯', detail: '横向拉锯，扫中前方一整排零件', sprite: 'saw' },
  tape: { name: '卷尺', detail: '甩出长尺，贯穿同一直线上的目标', sprite: 'tape' },
  mallet: { name: '橡皮锤', detail: '砸出近身冲击圈，震退周围零件', sprite: 'mallet' },
} as const

export const SHORTCUTS = {
  pass: {
    name: '免检通行证',
    action: '免检放行',
    benefit: '清除场内小怪，保留经验掉落',
    consequence: '事故战每轮多一道冲击波',
    trace: '免检零件未经核验进入装配',
  },
  beautifier: {
    name: '数据一键美化器',
    action: '改写记录',
    benefit: '测量速度翻倍，持续 12 秒',
    consequence: '事故冲击波缺口缩小 20°',
    trace: '美化记录掩盖了测量偏差',
  },
} as const

export type UpgradeId = keyof typeof UPGRADES

export const WEAPON_IDS = ['wrench', 'file', 'saw', 'tape', 'mallet'] as const
export type WeaponId = typeof WEAPON_IDS[number]
const weaponInfo: Record<WeaponId, { reach: number; delay: number; damage: number }> = {
  wrench: { reach: 4.66, delay: 55, damage: 55 },
  file: { reach: 5.55, delay: 65, damage: 68 },
  saw: { reach: 5.65, delay: 55, damage: 42 },
  tape: { reach: 9.20, delay: 50, damage: 39 },
  mallet: { reach: 3.50, delay: 69, damage: 54 },
}
export const TOOL_IDS = ['caliper', ...WEAPON_IDS] as const
export const WEAPON_SLOTS = TOOL_IDS.length
export type ToolKind = typeof TOOL_IDS[number]
const TOOL_DROP_TICKS = [18, 45, 78, 116, 154].map(seconds => seconds * HZ)
export const MAX_WEAPON_RANK = 5

export const CALIBRATIONS = {
  caliper: '增加一处自动复测，额外命中一个邻近零件。',
  wrench: '扩大重击角度，可以打断冲撞中的螺栓。',
  file: '三次锉削增至四次，锉屑波及更多邻近零件。',
  saw: '加宽锯切范围，一次能扫到更宽的一排。',
  tape: '加宽卷尺命中线，覆盖挨得更开的零件。',
  mallet: '加大击退力度，把围上来的零件推得更远。',
} satisfies Record<ToolKind, string>

function toolDamage(run: Run, id: ToolKind, rank: number) {
  if (id === 'caliper') return 22 + 7 * run.ranks.power + 7 * (rank - 1)
  const base = weaponInfo[id].damage + (rank - 1) * 12 + run.ranks.power * 4
  return id === 'file' && rank >= 3 ? Math.round(base * 1.20) : base
}

function toolReach(run: Run, id: ToolKind, rank: number) {
  return id === 'caliper'
    ? 6.2 + 0.95 * run.ranks.reach + .33 * (rank - 1)
    : weaponInfo[id].reach + (rank - 1) * .31
}

function toolInterval(run: Run, id: ToolKind, rank: number) {
  return id === 'caliper'
    ? Math.max(14, 36 - 5 * run.ranks.tempo - 2 * (rank - 1))
    : Math.max(id === 'file' ? 56 : 26, weaponInfo[id].delay - run.ranks.tempo * 4 - (rank - 1) * 5)
}

export function previewToolStats(run: Run, id: ToolKind, rank: number) {
  return {
    damage: toolDamage(run, id, rank),
    reach: toolReach(run, id, rank),
    interval: toolInterval(run, id, rank) / HZ,
  }
}


export function isWeapon(id: UpgradeId): id is WeaponId {
  return Object.hasOwn(weaponInfo, id)
}

export function weaponCount(run: Run) {
  let count = run.ranks.caliper > 0 ? 1 : 0
  for (const id of WEAPON_IDS) if (run.ranks[id] > 0) count++
  return count
}

export function equipTool(run: Run, tool: ToolKind) {
  if (run.phase === 'ended' || run.choices.length || !run.ranks[tool] || tool === run.activeTool) return false
  run.activeTool = tool
  return true
}
export type ShortcutKind = keyof typeof SHORTCUTS
export type EnemyKind = 'blank' | 'bolt' | 'phantom'
export type EffectKind = 'slice' | 'hit' | 'impact' | 'dash' | 'pickup' | 'clear' | 'arrival' | 'toolPickup' | 'inspection' | WeaponId
export type Outcome = 'qualified' | 'pending' | 'repair' | 'stopped'
export type Input = { x: number; z: number; dash: boolean; accept: boolean }

const upgradeIds = Object.keys(UPGRADES) as UpgradeId[]
const MAX_RANK = 6

export const IDLE_INPUT: Input = { x: 0, z: 0, dash: false, accept: false }

interface Filing { fileAt: number; fileHits: number; fileDamage: number }

export interface Enemy extends Filing {
  batch: number
  active: boolean
  kind: EnemyKind
  x: number
  z: number
  hp: number
  speed: number
  radius: number
  facing: number
  mode: 0 | 1 | 2 | 3
  until: number
  actionAt: number
  dx: number
  dz: number
  flashUntil: number
}

interface Shard {
  active: boolean
  x: number
  z: number
  value: number
  phase: number
}

interface Bolt {
  active: boolean
  x: number
  z: number
  dx: number
  dz: number
}

export interface ToolDrop { active: boolean; kind: ToolKind; x: number; z: number }

export interface Shortcut {
  active: boolean
  kind: ShortcutKind
  x: number
  z: number
}

type IncomingPart = { kind: EnemyKind; x: number; z: number }

export interface Incident {
  slot: number
  stage: 'warning' | 'open'
  opensAt: number
  closesAt: number
  shortcut: Shortcut
  parts: IncomingPart[]
  inspection: { x: number; z: number; held: number }
}

export interface Surge {
  slot: number
  groups: readonly (readonly IncomingPart[])[]
  opensAt: number
  issued: number
}

export interface PressStroke {
  x: number
  z: number
  halfX: number
  halfZ: number
  warnAt: number
  strikesAt: number
}

export interface RunEffect {
  kind: EffectKind
  x: number
  z: number
  toX: number
  toZ: number
  from: number
  until: number
}

export interface Wave {
  active: boolean
  sequence: number
  warnAt: number
  pulseAt: number
  gap: number
  gapCenter: number
  radius: number
  crossed: boolean
  crossedSafely: boolean
}

export interface Player {
  x: number
  z: number
  hp: number
  maximumHp: number
  dx: number
  dz: number
  facing: number
  dashX: number
  dashZ: number
  dashUntil: number
  dashReadyAt: number
  dashBufferedUntil: number
  protectedUntil: number
  hurtAt: number
  moving: boolean
}

export interface Run {
  seed: number
  training: boolean
  randomState: number
  tick: number
  phase: 'floor' | 'boss' | 'ended'
  outcome: Outcome | null
  endCause: 'health' | 'timeout' | 'boss' | null
  player: Player
  enemies: Enemy[]
  crowd: Crowd
  shards: Shard[]
  projectiles: Bolt[]
  shortcuts: Shortcut[]
  incident: Incident | null
  surge: Surge | null
  nextSurge: number
  inspections: { slot: number; tick: number; isolated: number; recovery: number }[]
  tools: ToolDrop[]
  activeTool: ToolKind | null
  nextTool: number
  lastToolPicked: ToolKind | null
  effects: RunEffect[]
  waves: Wave[]
  choices: UpgradeId[]
  ranks: Record<UpgradeId, number>
  kills: number
  level: number
  xp: number
  xpGoal: number
  boostUntil: number
  nextAttack: number
  nextSpawn: number
  nextShortcut: number
  enemyCursor: number
  shardCursor: number
  boltCursor: number
  effectCursor: number
  accepted: { slot: number; kind: ShortcutKind; tick: number }[]
  passes: number
  beautifiers: number
  boss: Filing & {
    x: number
    z: number
    hp: number
    active: boolean
    flashUntil: number
    nextWave: number
    waveSets: number
    pressAfterSet: number
    press: PressStroke | null
  }
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value))
}

function random(run: Run) {
  let value = run.randomState
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  run.randomState = value >>> 0
  return run.randomState / 4294967296
}

function emptyEnemy(): Enemy {
  return {
    batch: -1, active: false, kind: 'blank', x: 0, z: 0, hp: 0, speed: 0, radius: 0,
    facing: 1, mode: 0, until: 0, actionAt: 0, dx: 0, dz: 0, flashUntil: 0,
    fileAt: 0, fileHits: 0, fileDamage: 0,
  }
}

export function createRun(seed = 0x41c603a1): Run {
  const run: Run = {
    seed: seed >>> 0, training: false, randomState: (seed >>> 0) || 1, tick: 0, phase: 'floor',
    outcome: null, endCause: null,
    player: {
      x: 0, z: 0.6, hp: 100, maximumHp: 100, dx: 0, dz: -1, facing: 1,
      dashX: 0, dashZ: -1, dashUntil: 0, dashReadyAt: 0, dashBufferedUntil: -1,
      protectedUntil: 50, hurtAt: -999, moving: false,
    },
    enemies: Array.from({ length: MAX_ENEMIES }, emptyEnemy),
    crowd: createCrowd(MAX_ENEMIES),
    shards: Array.from({ length: MAX_SHARDS }, () => ({ active: false, x: 0, z: 0, value: 0, phase: 0 })),
    projectiles: Array.from({ length: MAX_BOLTS }, () => ({ active: false, x: 0, z: 0, dx: 0, dz: 0 })),
    shortcuts: [], incident: null, surge: null, nextSurge: 0, inspections: [],
    tools: [{ active: true, kind: 'caliper', x: 1.55, z: 0.6 }], activeTool: null, nextTool: 0, lastToolPicked: null,
    effects: Array.from({ length: 64 }, () => ({ kind: 'hit', x: 0, z: 0, toX: 0, toZ: 0, from: 0, until: 0 })),
    waves: Array.from({ length: 12 }, () => ({
      active: false, sequence: 0, warnAt: 0, pulseAt: 0, gap: 0, gapCenter: 0, radius: 0, crossed: false, crossedSafely: false,
    })),
    choices: [],
    ranks: { caliper: 0, power: 0, tempo: 0, reach: 0, sweep: 0, stride: 0, guard: 0, magnet: 0, wrench: 0, file: 0, saw: 0, tape: 0, mallet: 0 },
    kills: 0, level: 1, xp: 0, xpGoal: 12, boostUntil: 0,
    nextAttack: 32, nextSpawn: 85, nextShortcut: 0,
    enemyCursor: 0, shardCursor: 0, boltCursor: 0, effectCursor: 0,
    accepted: [], passes: 0, beautifiers: 0,
    boss: { x: 0, z: -1.1, hp: BOSS_HP, active: false, flashUntil: 0, nextWave: 0, waveSets: 0,
      fileAt: 0, fileHits: 0, fileDamage: 0, pressAfterSet: 0, press: null },
  }

  for (let i = 0; i < 7; i++) {
    const angle = (i + 1) * TAU / 8 + 0.14 * random(run)
    const distance = 5.40 + random(run) * .85
    spawnEnemy(run, 'blank', Math.cos(angle) * distance, run.player.z + Math.sin(angle) * distance)
  }
  return run
}

export function hazardValue(run: Run) {
  return run.passes + run.beautifiers
}

export function waveCount(run: Run) {
  return 1 + run.passes
}

export function waveCycleTicks(run: Run) {
  return (6 - 0.5 * hazardValue(run)) * HZ
}

export function waveGapDegrees(run: Run) {
  return Math.max(60, 100 - 20 * run.beautifiers)
}

export function attackInterval(run: Run, tool = run.activeTool ?? 'caliper') {
  const normal = toolInterval(run, tool, run.ranks[tool])
  return run.tick < run.boostUntil ? Math.ceil(normal / 2) : normal
}

export function angleDistance(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

function spawnEnemy(run: Run, kind: EnemyKind, x: number, z: number, batch = -1, minimumDistance = 0) {
  const radius = kind === 'bolt' ? .53 : .40
  const origin = nearestFreePoint(x, z, radius)
  if (minimumDistance > 0 && Math.hypot(origin.x - run.player.x, origin.z - run.player.z) < minimumDistance) return
  const enemies = run.enemies
  for (let i = 0; i < enemies.length; i++) {
    const index = (run.enemyCursor + i) % enemies.length
    const enemy = enemies[index]
    if (enemy.active) continue
    const time = run.tick / BOSS_TICK
    enemy.active = true
    enemy.kind = kind
    enemy.batch = batch
    enemy.radius = radius
    enemy.x = origin.x
    enemy.z = origin.z
    enemy.hp = kind === 'bolt' ? 46 + 16 * time : kind === 'phantom' ? 27 + 12 * time : 16 + 8 * time
    const speed = kind === 'bolt' ? 1.45 : kind === 'phantom' ? 1.66 : 2.05
    enemy.speed = speed + time * 0.46 + random(run) * 0.28 + (batch < 0 ? 0 : .27)
    enemy.facing = 1
    enemy.mode = 0
    enemy.until = 0
    enemy.actionAt = run.tick + 68 + Math.floor(random(run) * 80)
    enemy.dx = 0
    enemy.dz = 0
    enemy.flashUntil = 0
    enemy.fileAt = 0
    enemy.fileHits = 0
    enemy.fileDamage = 0
    run.enemyCursor = (index + 1) % enemies.length
    return
  }
}

function spawnPatrol(run: Run) {
  const time = run.tick / HZ
  const number = time < 25 ? 1 : time < 60 ? 2 : time < 112 ? 3 : time < 172 ? 4 : 5
  for (let i = 0; i < number; i++) {
    const roll = random(run)
    const kind: EnemyKind = time > 87 && roll < 0.16
      ? 'phantom'
      : time > 43 && roll < (time > 87 ? 0.34 : 0.26) ? 'bolt' : 'blank'
    const heading = random(run) * TAU
    const spread = PATROL_SPAWN_DISTANCE + random(run) * (time < 35 ? 2 : 4.6)
    const point = patrolPoint(run.player, heading, spread)
    spawnEnemy(run, kind, point.x, point.z)
  }
  run.nextSpawn = run.tick + Math.max(47, Math.round(104 - time * 0.29 + random(run) * 18))
}

function patrolPoint(player: GroundPoint, heading: number, spread: number) {
  // Near a corner, the shorter ring lets the wave keep its count without closing in on the player.
  for (const distance of [spread, PATROL_SPAWN_DISTANCE]) {
    for (let turn = 0; turn < 8; turn++) {
      const angle = heading + turn * TAU / 8
      const x = player.x + Math.cos(angle) * distance
      const z = player.z + Math.sin(angle) * distance
      if (isOpenFloor(x, z, INCOMING_CLEARANCE)) return { x, z }
    }
  }
  const farX = ARENA.x - INCOMING_CLEARANCE
  const z = clamp(player.z, -ARENA.z + INCOMING_CLEARANCE, ARENA.z - INCOMING_CLEARANCE)
  return { x: player.x < 0 ? farX : -farX, z }
}

const SURGE_GAP = 53

export function surgeGroupAt(surge: Surge, group: number): number {
  return surge.opensAt + group * SURGE_GAP
}

function formationPoint(player: GroundPoint, x: number, z: number, placed: readonly GroundPoint[]) {
  const origin = nearestFreePoint(x, z, INCOMING_CLEARANCE)
  const available = (px: number, pz: number) =>
    Math.hypot(px - player.x, pz - player.z) >= FORMATION_DISTANCE &&
    placed.every(part => Math.hypot(px - part.x, pz - part.z) >= .82)
  if (available(origin.x, origin.z)) return origin

  // Preserve the formation locally when a bench or wall takes up its planned point.
  const heading = Math.atan2(origin.z - player.z, origin.x - player.x)
  for (let radius = 1.1; radius <= 6.61; radius += 1.1) {
    for (let turn = 0; turn < 12; turn++) {
      const bearing = heading + turn * TAU / 12
      const px = origin.x + Math.cos(bearing) * radius
      const pz = origin.z + Math.sin(bearing) * radius
      if (isOpenFloor(px, pz, INCOMING_CLEARANCE) && available(px, pz)) return { x: px, z: pz }
    }
  }
  return null
}

function prepareSurge(run: Run, slot: number): Surge {
  const profile = SURGES[slot]
  const { player } = run
  const seededSide = ((run.seed >>> slot) & 1) === 1 ? 1 : -1
  const leadSide = Math.abs(player.x) > 5.1 ? -Math.sign(player.x) : seededSide
  const groups = [profile.first, profile.second].map((count, group) => {
    const preferred = group === 0 || slot === 0 ? leadSide : -leadSide
    const room = ARENA.x - INCOMING_CLEARANCE - preferred * player.x
    const side = room >= FORMATION_DISTANCE ? preferred : -preferred
    const centerZ = clamp(player.z, -3.5, 3.5)
    const parts: IncomingPart[] = []
    for (let index = 0; index < count; index++) {
      const row = Math.floor(index / 8)
      const width = Math.min(8, count - row * 8)
      const line = (index % 8 - (width - 1) * .5) * 1.12
      const z = centerZ + line + (group ? .74 * side : 0)
      const x = player.x + side * (6.5 + .97 * row + group * .92)
      const kind = slot > 0 && group === 1 && index % 3 === 0 ? 'phantom'
        : slot > 0 && index % (slot === 2 ? 3 : 5) === 0 ? 'bolt' : 'blank'
      const point = formationPoint(player, x, z, parts)
      if (point) parts.push({ kind, ...point })
    }
    return parts
  })
  return { slot, groups, opensAt: profile.tick, issued: 0 }
}

function advanceSurges(run: Run) {
  if (run.training) return 0
  let signal = 0
  if (!run.surge && run.nextSurge < SURGES.length && run.tick >= SURGES[run.nextSurge].tick - SURGE_WARNING) {
    run.surge = prepareSurge(run, run.nextSurge++)
    signal |= Signal.surgeWarning
  }
  const surge = run.surge
  if (!surge) return signal
  while (surge.issued < surge.groups.length && run.tick >= surgeGroupAt(surge, surge.issued)) {
    for (const part of surge.groups[surge.issued]) spawnEnemy(run, part.kind, part.x, part.z, -1, MARKED_SPAWN_DISTANCE)
    surge.issued++
    signal |= Signal.surgeArrival
  }
  if (run.tick >= surgeGroupAt(surge, surge.groups.length - 1) + 102) {
    run.surge = null
    run.nextSpawn = Math.max(run.nextSpawn, run.tick + 92)
  }
  return signal
}

function addEffect(run: Run, kind: EffectKind, x: number, z: number, toX: number, toZ: number, duration: number) {
  const effect = run.effects[run.effectCursor]
  run.effectCursor = (run.effectCursor + 1) % run.effects.length
  effect.kind = kind
  effect.x = x
  effect.z = z
  effect.toX = toX
  effect.toZ = toZ
  effect.from = run.tick
  effect.until = run.tick + duration
}

function addShard(run: Run, x: number, z: number, value: number) {
  const shards = run.shards
  for (let i = 0; i < shards.length; i++) {
    const index = (run.shardCursor + i) % shards.length
    const shard = shards[index]
    if (shard.active) continue
    shard.active = true
    shard.x = x
    shard.z = z
    shard.value = value
    shard.phase = random(run) * TAU
    run.shardCursor = (index + 1) % shards.length
    return
  }
  run.xp += value
}

function defeatEnemy(run: Run, enemy: Enemy) {
  enemy.active = false
  run.kills++
  const value = enemy.kind === 'bolt' ? 3 : enemy.kind === 'phantom' ? 2 : 1
  addShard(run, enemy.x, enemy.z, value)
}

function nearestEnemy(run: Run, x: number, z: number, initialDistance: number): Enemy | undefined {
  let nearest: Enemy | undefined
  let best = initialDistance * initialDistance
  for (const enemy of run.enemies) {
    if (!enemy.active) continue
    const dx = enemy.x - x
    const dz = enemy.z - z
    const distance = dx * dx + dz * dz
    if (distance < best) {
      best = distance
      nearest = enemy
    }
  }
  return nearest
}

function damageEnemy(run: Run, enemy: Enemy, damage: number) {
  enemy.hp -= damage
  enemy.flashUntil = run.tick + 7
  if (enemy.hp <= 0) defeatEnemy(run, enemy)
  addEffect(run, 'hit', enemy.x, enemy.z, 0, 0, 12)
}

function attackWithCaliper(run: Run) {
  const player = run.player
  const rank = run.ranks.caliper
  const reach = toolReach(run, 'caliper', rank)
  const damage = toolDamage(run, 'caliper', rank)
  const enemy = nearestEnemy(run, player.x, player.z, reach)
  const boss = run.boss
  const bossDistance = Math.hypot(player.x - boss.x, player.z - boss.z)
  if (boss.active && bossDistance < reach + 0.8 &&
      (!enemy || bossDistance <= Math.hypot(player.x - enemy.x, player.z - enemy.z) + 0.35)) {
    damageBoss(run, damage)
    addEffect(run, 'slice', player.x, player.z, boss.x, boss.z, 12)
  } else if (enemy) {
    addEffect(run, 'slice', player.x, player.z, enemy.x, enemy.z, 12)
    damageEnemy(run, enemy, damage)
    const followUps = run.ranks.sweep + (rank >= 2 ? 1 : 0) + (rank >= 3 ? 1 : 0)
    if (followUps > 0) {
      let hit = 0
      const area = 3.4 + 0.28 * run.ranks.sweep
      for (const extra of run.enemies) {
        if (hit >= followUps) break
        if (!extra.active || extra === enemy) continue
        if (Math.hypot(extra.x - enemy.x, extra.z - enemy.z) > area) continue
        damageEnemy(run, extra, damage * 0.76)
        hit++
      }
    }
  } else {
    return 0
  }

  return Signal.strike
}

function damageBoss(run: Run, damage: number) {
  const boss = run.boss
  boss.hp = Math.max(0, boss.hp - damage)
  boss.flashUntil = run.tick + 7
  addEffect(run, 'hit', boss.x, boss.z, 0, 0, 12)
}

function startFiling(run: Run, target: Enemy | Run['boss'], damage: number, strokes: number) {
  const initial = damage * .57
  if ('batch' in target) {
    damageEnemy(run, target, initial)
    if (!target.active) return
  } else {
    damageBoss(run, initial)
    if (target.hp <= 0) return
  }
  target.fileDamage = (damage - initial) / (strokes - 1)
  target.fileHits = strokes - 1
  target.fileAt = run.tick + 3
}

function inToolShape(id: WeaponId, x: number, z: number, dx: number, dz: number, reach: number, calibrated: boolean) {
  const distance = Math.hypot(x, z)
  if (id === 'mallet') return distance <= reach
  const forward = x * dx + z * dz
  if (forward < 0 || forward > reach) return false
  if (id === 'wrench') return distance <= reach && forward >= distance * (calibrated ? .12 : .40)
  const side = Math.abs(z * dx - x * dz)
  return side <= (id === 'saw' ? (calibrated ? 1.71 : 1.18) : (calibrated ? .82 : .52))
}

function attackWithWeapon(run: Run, id: WeaponId) {
  const player = run.player
  const rank = run.ranks[id]
  const calibrated = rank >= 3
  const reach = toolReach(run, id, rank)
  const boss = run.boss
  const enemy = nearestEnemy(run, player.x, player.z, reach)
  const bossDistance = Math.hypot(boss.x - player.x, boss.z - player.z)
  const aimBoss = boss.active && bossDistance < reach + .45 &&
    (!enemy || bossDistance <= Math.hypot(enemy.x - player.x, enemy.z - player.z) + .4)
  const aim = aimBoss ? boss : enemy
  if (!aim) return 0
  const dx = aim.x - player.x
  const dz = aim.z - player.z
  const distance = Math.hypot(dx, dz)
  const dirX = distance > .01 ? dx / distance : player.facing
  const dirZ = distance > .01 ? dz / distance : 0
  const damage = toolDamage(run, id, rank)

  if (id === 'file') {
    const strokes = calibrated ? 4 : 3
    startFiling(run, aim, damage, strokes)
    const spread = calibrated ? 4.1 : 3.05
    let grazed = 0
    for (const adjacent of run.enemies) {
      if (!adjacent.active || adjacent === aim || Math.hypot(adjacent.x - aim.x, adjacent.z - aim.z) > spread) continue
      startFiling(run, adjacent, damage * .70, strokes)
      if (++grazed >= (calibrated ? 5 : 3)) break
    }
    addEffect(run, id, player.x, player.z, aim.x, aim.z, 29)
  } else {
    for (const target of run.enemies) {
      if (!target.active ||
          !inToolShape(id, target.x - player.x, target.z - player.z, dirX, dirZ, reach, calibrated)) continue
      damageEnemy(run, target, damage)
      if (!target.active) continue
      if (id === 'wrench' && target.kind === 'bolt' && (target.mode === 1 || (calibrated && target.mode === 2))) {
        target.mode = 0
        target.actionAt = run.tick + 77
      } else if (id === 'mallet') {
        const awayX = target.x - player.x
        const awayZ = target.z - player.z
        const length = Math.hypot(awayX, awayZ) || 1
        const push = calibrated ? 1.65 : 1.05
        moveOnFloor(target, awayX / length * push, awayZ / length * push, target.radius)
      }
    }
    if (boss.active && inToolShape(id, boss.x - player.x, boss.z - player.z, dirX, dirZ, reach + .45, calibrated)) {
      damageBoss(run, damage)
    }
    addEffect(run, id, player.x, player.z, player.x + dirX * reach, player.z + dirZ * reach, 28)
  }
  return Signal.strike
}

function attack(run: Run) {
  const tool = run.activeTool
  if (!tool || run.tick < run.nextAttack) return 0
  const signal = tool === 'caliper' ? attackWithCaliper(run) : attackWithWeapon(run, tool)
  if (signal) run.nextAttack = run.tick + attackInterval(run, tool)
  return signal
}

function startDash(run: Run) {
  const { player, tick } = run
  const limitX = ARENA.x - PLAYER_CLEARANCE
  const limitZ = ARENA.z - PLAYER_CLEARANCE
  // At a wall, the outward part of a diagonal input cannot contribute to the dash.
  const outwardX = Math.abs(player.x) >= limitX && player.x * player.dx > 0
  const outwardZ = Math.abs(player.z) >= limitZ && player.z * player.dz > 0
  const x = outwardX ? 0 : player.dx
  const z = outwardZ ? 0 : player.dz
  const length = Math.hypot(x, z)
  if (length < .01) return 0

  const dx = x / length
  const dz = z / length
  const edgeX = dx === 0 ? Infinity : (Math.sign(dx) * limitX - player.x) / dx
  const edgeZ = dz === 0 ? Infinity : (Math.sign(dz) * limitZ - player.z) / dz
  const reach = Math.min(DASH_STEP * DASH_TICKS, edgeX, edgeZ)
  if (reach < DASH_STEP) return 0
  const contact = stationContact(player.x, player.z, player.x + dx * reach, player.z + dz * reach, PLAYER_CLEARANCE)
  const travel = reach * contact
  if (travel < DASH_STEP) return 0

  player.dashX = dx
  player.dashZ = dz
  player.dashUntil = tick + DASH_TICKS
  player.dashReadyAt = tick + DASH_COOLDOWN
  player.protectedUntil = Math.max(tick + 16, player.protectedUntil)
  addEffect(run, 'dash', player.x, player.z, player.x + dx * travel, player.z + dz * travel, 16)
  return Signal.dash
}

function movePlayer(run: Run, input: Input) {
  const player = run.player
  const magnitude = Math.hypot(input.x, input.z)
  const moveX = Number.isFinite(magnitude) ? input.x / Math.max(1, magnitude) : 0
  const moveZ = Number.isFinite(magnitude) ? input.z / Math.max(1, magnitude) : 0
  let signaled = 0
  if (Math.abs(moveX) + Math.abs(moveZ) > 0.01) {
    player.dx = moveX
    player.dz = moveZ
    if (Math.abs(moveX) > 0.12) player.facing = moveX < 0 ? -1 : 1
  }
  if (input.dash && player.dashReadyAt - run.tick <= DASH_BUFFER) player.dashBufferedUntil = run.tick + DASH_BUFFER
  if (run.tick <= player.dashBufferedUntil && run.tick >= player.dashReadyAt) {
    player.dashBufferedUntil = -1
    signaled = startDash(run)
  }
  const dashing = run.tick < player.dashUntil
  const walkSpeed = 4.9 + run.ranks.stride * 0.49
  const speed = dashing ? DASH_SPEED : walkSpeed
  const beforeX = player.x
  const beforeZ = player.z
  const blocked = moveOnFloor(player, (dashing ? player.dashX : moveX) * speed / HZ,
    (dashing ? player.dashZ : moveZ) * speed / HZ, PLAYER_CLEARANCE)
  player.moving = Math.abs(player.x - beforeX) + Math.abs(player.z - beforeZ) > .003
  if (dashing && blocked) {
    player.dashUntil = run.tick
    addEffect(run, 'impact', player.x, player.z, 0, 0, 13)
    if (!player.moving) {
      moveOnFloor(player, moveX * walkSpeed / HZ, moveZ * walkSpeed / HZ, PLAYER_CLEARANCE)
      player.moving = Math.abs(player.x - beforeX) + Math.abs(player.z - beforeZ) > .003
    }
  }
  return signaled
}

function hurt(run: Run, damage: number) {
  const player = run.player
  if (run.tick < player.protectedUntil || player.hp <= 0) return 0
  player.hp = Math.max(0, player.hp - damage)
  player.hurtAt = run.tick
  player.protectedUntil = run.tick + 54
  addEffect(run, 'hit', player.x, player.z, 0, 0, 16)
  return Signal.hurt
}

function fireProjectile(run: Run, enemy: Enemy) {
  const projectiles = run.projectiles
  for (let i = 0; i < projectiles.length; i++) {
    const index = (run.boltCursor + i) % projectiles.length
    const bolt = projectiles[index]
    if (bolt.active) continue
    bolt.active = true
    bolt.x = enemy.x
    bolt.z = enemy.z
    bolt.dx = enemy.dx
    bolt.dz = enemy.dz
    run.boltCursor = (index + 1) % projectiles.length
    return
  }
}

function aimAtPlayer(run: Run, enemy: Enemy, lead: number) {
  const { player } = run
  const x = player.x + (player.moving ? player.dx * lead : 0)
  const z = player.z + (player.moving ? player.dz * lead : 0)
  const predicted = isOpenFloor(x, z, .12) && stationContact(enemy.x, enemy.z, x, z, .10) === 1
  const dx = (predicted ? x : player.x) - enemy.x
  const dz = (predicted ? z : player.z) - enemy.z
  const length = Math.hypot(dx, dz) || 1
  enemy.dx = dx / length
  enemy.dz = dz / length
  if (Math.abs(dx) > .11) enemy.facing = Math.sign(dx)
}

function moveEnemies(run: Run) {
  let signal = 0
  const player = run.player
  const apart = { x: 0, z: 0 }
  indexCrowd(run.crowd, run.enemies)
  for (let index = 0; index < run.enemies.length; index++) {
    const enemy = run.enemies[index]
    if (!enemy.active) continue
    if (enemy.fileHits > 0 && run.tick >= enemy.fileAt) {
      enemy.fileHits--
      enemy.fileAt += FILE_STROKE_GAP
      damageEnemy(run, enemy, enemy.fileDamage)
      if (!enemy.active) continue
    }
    const dx = player.x - enemy.x
    const dz = player.z - enemy.z
    const distance = Math.max(.001, Math.hypot(dx, dz))
    const unitX = dx / distance
    const unitZ = dz / distance
    const side = index % 2 === 0 ? -1 : 1
    const clearShot = enemy.kind !== 'blank' && stationContact(enemy.x, enemy.z, player.x, player.z, .10) === 1
    let goalX = player.x
    let goalZ = player.z
    if (!run.training && enemy.kind === 'blank' && index % 3 !== 0 && distance > 2.45 && distance < 10.8) {
      const offset = Math.min(2.15, (distance - 2.45) * .42) * side
      const flankX = player.x - unitZ * offset + (player.moving ? player.dx * .72 : 0)
      const flankZ = player.z + unitX * offset + (player.moving ? player.dz * .72 : 0)
      if (isOpenFloor(flankX, flankZ, enemy.radius)) {
        goalX = flankX
        goalZ = flankZ
      }
    }

    if (enemy.kind === 'bolt') {
      if (enemy.mode === 0 && distance < 6.4 && clearShot && run.tick >= enemy.actionAt) {
        enemy.mode = 1
        aimAtPlayer(run, enemy, 1.12)
        enemy.until = run.tick + 51
      } else if (enemy.mode === 1 && run.tick >= enemy.until) {
        enemy.mode = 2
        enemy.until = run.tick + 34
      } else if (enemy.mode === 2 && run.tick >= enemy.until) {
        enemy.mode = 3
        enemy.until = run.tick + 26
      } else if (enemy.mode === 3 && run.tick >= enemy.until) {
        enemy.mode = 0
        enemy.actionAt = run.tick + 118
      }
    } else if (enemy.kind === 'phantom') {
      if (enemy.mode === 0 && run.tick >= enemy.actionAt && distance < 9.6 && clearShot) {
        enemy.mode = 1
        aimAtPlayer(run, enemy, 1.27)
        enemy.until = run.tick + 35
      } else if (enemy.mode === 1 && run.tick >= enemy.until) {
        fireProjectile(run, enemy)
        enemy.mode = 3
        enemy.until = run.tick + 20
      } else if (enemy.mode === 3 && run.tick >= enemy.until) {
        enemy.mode = 0
        enemy.actionAt = run.tick + 122
      }
    }

    if (enemy.mode === 2) {
      const collided = moveOnFloor(enemy, enemy.dx * 10.8 / HZ, enemy.dz * 10.8 / HZ, enemy.radius)
      if (collided) {
        enemy.mode = 3
        enemy.until = run.tick + 43
        addEffect(run, 'impact', enemy.x, enemy.z, 0, 0, 21)
      }
    } else if (enemy.mode === 0) {
      const skirting = enemy.kind === 'phantom' && distance < 7.7 && clearShot
      if (skirting) {
        const radial = clamp((distance - 6.0) * .52, -.86, .50)
        const lateral = .72 * side
        goalX = enemy.x + unitX * radial - unitZ * lateral
        goalZ = enemy.z + unitZ * radial + unitX * lateral
        if (!isOpenFloor(goalX, goalZ, enemy.radius)) {
          goalX += unitZ * lateral * 2
          goalZ -= unitX * lateral * 2
        }
      } else if (stationContact(enemy.x, enemy.z, goalX, goalZ, enemy.radius) < 1) {
        const next = detourTowardPlayer(run.crowd, enemy, player)
        goalX = next.x
        goalZ = next.z
      }
      const steerX = goalX - enemy.x
      const steerZ = goalZ - enemy.z
      const length = Math.max(.12, Math.hypot(steerX, steerZ))
      const speed = enemy.speed / HZ
      spacing(run.crowd, run.enemies, index, apart)
      const weight = run.training ? .28 : .77
      const stepX = steerX / length * speed + apart.x / HZ * weight
      const stepZ = steerZ / length * speed + apart.z / HZ * weight
      moveOnFloor(enemy, stepX, stepZ, enemy.radius)
      if (Math.abs(steerX) > .16) enemy.facing = Math.sign(steerX)
    }
    if (Math.hypot(player.x - enemy.x, player.z - enemy.z) < enemy.radius + 0.27) {
      signal |= hurt(run, enemy.kind === 'bolt' ? 15 : enemy.kind === 'phantom' ? 8 : 7)
    }
  }
  return signal
}

function moveProjectiles(run: Run) {
  let signal = 0
  for (const bolt of run.projectiles) {
    if (!bolt.active) continue
    const toX = bolt.x + bolt.dx * 7.4 / HZ
    const toZ = bolt.z + bolt.dz * 7.4 / HZ
    if (stationContact(bolt.x, bolt.z, toX, toZ, .08) < 1) {
      bolt.active = false
      addEffect(run, 'impact', bolt.x, bolt.z, 0, 0, 12)
      continue
    }
    bolt.x = toX
    bolt.z = toZ
    if (Math.abs(bolt.x) > ARENA.x + 0.7 || Math.abs(bolt.z) > ARENA.z + 0.7) {
      bolt.active = false
    } else if (Math.hypot(run.player.x - bolt.x, run.player.z - bolt.z) < 0.42) {
      bolt.active = false
      signal |= hurt(run, 11)
    }
  }
  return signal
}

function collectShards(run: Run) {
  const player = run.player
  const radius = 1.45 + run.ranks.magnet * 0.46
  let signal = 0
  for (const shard of run.shards) {
    if (!shard.active) continue
    const dx = player.x - shard.x
    const dz = player.z - shard.z
    const distance = Math.hypot(dx, dz)
    if (distance > radius) continue
    if (distance <= 0.3) {
      shard.active = false
      run.xp += shard.value
      signal |= Signal.pick
    } else {
      const rate = Math.min(1, 0.18 / distance)
      shard.x += dx * rate
      shard.z += dz * rate
    }
  }
  return signal
}

export function nearestTool(run: Run, limit = 2.6) {
  let nearest: ToolDrop | undefined
  let distance = limit
  for (const tool of run.tools) {
    if (!tool.active) continue
    const difference = Math.hypot(tool.x - run.player.x, tool.z - run.player.z)
    if (difference < distance) {
      nearest = tool
      distance = difference
    }
  }
  return nearest
}

function dropTool(run: Run) {
  const { player } = run
  const sequence = (run.nextTool + run.seed % WEAPON_IDS.length) % WEAPON_IDS.length
  const kind = WEAPON_IDS[sequence]
  const angle = random(run) * TAU
  const dx = Math.cos(angle) * 4.1
  const dz = Math.sin(angle) * 4.1
  const x = Math.abs(player.x + dx) < ARENA.x - 1 ? player.x + dx : player.x - dx
  const z = Math.abs(player.z + dz) < ARENA.z - 1 ? player.z + dz : player.z - dz
  run.tools.push({ active: true, kind, ...nearestFreePoint(x, z, .72) })
  run.nextTool++
}

function collectTools(run: Run) {
  const tool = nearestTool(run, .9)
  if (!tool) return 0
  tool.active = false
  run.ranks[tool.kind] = Math.max(1, run.ranks[tool.kind])
  if (!run.activeTool && (!run.training || tool.kind === 'caliper')) {
    equipTool(run, tool.kind)
    run.nextAttack = Math.min(run.nextAttack, run.tick + 18)
  }
  run.lastToolPicked = tool.kind
  addEffect(run, 'toolPickup', tool.x, tool.z, 0, 0, 33)
  return Signal.toolPickup
}

export function nearestShortcut(run: Run, limit = 2.25) {
  let nearest: Shortcut | undefined
  let smallest = limit
  for (const shortcut of run.shortcuts) {
    if (!shortcut.active) continue
    const distance = Math.hypot(shortcut.x - run.player.x, shortcut.z - run.player.z)
    if (distance < smallest) {
      nearest = shortcut
      smallest = distance
    }
  }
  return nearest
}

function prepareIncident(run: Run, slot: number) {
  const kind: ShortcutKind = slot === 0 ? 'pass' : slot === 1 ? 'beautifier' : random(run) < .5 ? 'pass' : 'beautifier'
  const player = run.player
  const x = clamp(player.x, -8.9, 8.9)
  const z = clamp(player.z, -4.15, 4.15)
  const dx = Math.abs(x) > 1.75 || Math.abs(z) <= 1.5 ? (x > 0 ? -1 : 1) : 0
  const dz = dx === 0 ? (z > 0 ? -1 : 1) : 0
  const sideX = -dz
  const sideZ = dx
  const composition = incidentBatches[slot]
  const parts: IncomingPart[] = []
  for (let i = 0; i < composition.length; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const row = Math.floor(i / 14)
    const front = (Math.floor(i / 2) % 7 - 3) * 1.10
    const flank = (5.65 + row * 1.16 + random(run) * .40) * side
    const point = formationPoint(player, x + dx * front + sideX * flank, z + dz * front + sideZ * flank, parts)
    if (point) parts.push({ kind: composition[i], ...point })
  }
  const offer = nearestFreePoint(x + dx * .80, z + dz * .80, .66)
  const review = nearestFreePoint(x + dx * 5.15, z + dz * 5.15, INSPECTION_RADIUS + .08)
  run.incident = {
    slot,
    stage: 'warning',
    opensAt: SHORTCUT_TICKS[slot],
    closesAt: SHORTCUT_TICKS[slot] + 14 * HZ,
    parts,
    shortcut: { active: false, kind, ...offer },
    inspection: { ...review, held: 0 },
  }
}

function openIncident(run: Run, incident: Incident) {
  incident.stage = 'open'
  incident.shortcut.active = true
  run.shortcuts.push(incident.shortcut)
  for (const part of incident.parts) {
    spawnEnemy(run, part.kind, part.x, part.z, incident.slot, MARKED_SPAWN_DISTANCE)
  }
  run.nextShortcut++
}

function closeIncident(run: Run) {
  if (!run.incident) return
  run.incident.shortcut.active = false
  run.incident = null
}

function advanceIncident(run: Run) {
  if (run.incident?.stage === 'open' && run.tick >= run.incident.closesAt) {
    closeIncident(run)
    return Signal.incidentClosed
  }
  if (run.training || run.nextShortcut >= SHORTCUT_TICKS.length) return 0
  const slot = run.nextShortcut
  const opensAt = SHORTCUT_TICKS[slot]
  let signal = 0
  if (!run.incident && run.tick >= opensAt - 2 * HZ) {
    prepareIncident(run, slot)
    signal |= Signal.incidentWarning
  }
  const incident = run.incident
  if (incident?.stage === 'warning' && run.tick >= opensAt) {
    openIncident(run, incident)
    signal |= Signal.offer
  }
  return signal
}

function progressInspection(run: Run) {
  const incident = run.incident
  if (!incident || incident.stage !== 'open') return 0
  const { inspection, slot } = incident
  const player = run.player
  const inZone = Math.hypot(player.x - inspection.x, player.z - inspection.z) <= INSPECTION_RADIUS
  if (!inZone || run.tick < player.dashUntil) {
    inspection.held = 0
    return 0
  }
  inspection.held++
  if (inspection.held < INSPECTION_HOLD) return 0

  let isolated = 0
  for (const enemy of run.enemies) {
    if (!enemy.active || enemy.batch !== slot) continue
    defeatEnemy(run, enemy)
    isolated++
  }
  const previousHp = player.hp
  player.hp = Math.min(player.maximumHp, previousHp + 18)
  run.inspections.push({ slot, tick: run.tick, isolated, recovery: player.hp - previousHp })
  addEffect(run, 'inspection', inspection.x, inspection.z, 0, 0, 54)
  closeIncident(run)
  return Signal.inspection
}

function acceptShortcut(run: Run) {
  const incident = run.incident
  const shortcut = nearestShortcut(run, 1.65)
  if (!shortcut || !incident || incident.shortcut !== shortcut) return 0
  closeIncident(run)
  run.accepted.push({ slot: incident.slot, kind: shortcut.kind, tick: run.tick })
  addEffect(run, 'pickup', shortcut.x, shortcut.z, 0, 0, 42)
  if (shortcut.kind === 'pass') {
    run.passes++
    for (const enemy of run.enemies) {
      if (enemy.active) defeatEnemy(run, enemy)
    }
    addEffect(run, 'clear', run.player.x, run.player.z, 0, 0, 44)
    return Signal.shortcut | Signal.clear
  }
  run.beautifiers++
  run.boostUntil = run.tick + 12 * HZ
  return Signal.shortcut
}

function proposeUpgrades(run: Run) {
  if (run.xp < run.xpGoal) return 0
  const available = upgradeIds.filter(id => {
    if (id === 'caliper' || isWeapon(id)) return run.ranks[id] > 0 && run.ranks[id] < MAX_WEAPON_RANK
    return run.ranks[id] < MAX_RANK
  })
  if (available.length === 0) return 0

  run.xp -= run.xpGoal
  run.level++
  run.xpGoal = 14 + (run.level - 1) * 6
  const ownedTools = available.filter(id => id === 'caliper' || isWeapon(id))
  const eligibleTool = run.activeTool && ownedTools.includes(run.activeTool)
    ? run.activeTool : ownedTools[Math.floor(random(run) * ownedTools.length)]
  if (eligibleTool) {
    run.choices.push(eligibleTool)
    available.splice(available.indexOf(eligibleTool), 1)
  }
  while (available.length > 0 && run.choices.length < 3) {
    const index = Math.floor(random(run) * available.length)
    run.choices.push(available[index])
    available.splice(index, 1)
  }
  return Signal.level
}

export function chooseUpgrade(run: Run, index: number) {
  const choice = run.choices[index]
  if (!choice || run.phase === 'ended') return false
  run.ranks[choice]++
  run.choices.length = 0
  if (choice === 'guard') {
    run.player.maximumHp += 10
    run.player.hp = Math.min(run.player.maximumHp, run.player.hp + 28)
  } else {
    run.player.hp = Math.min(run.player.maximumHp, run.player.hp + 3)
  }
  return true
}

function introduceBoss(run: Run) {
  closeIncident(run)
  run.surge = null
  run.phase = 'boss'
  const player = run.player
  const retained = run.training ? [] : run.enemies.filter(enemy => enemy.active)
    .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))
    .slice(0, 6)
  for (const enemy of run.enemies) {
    if (enemy.active && !retained.includes(enemy)) enemy.active = false
  }
  for (const bolt of run.projectiles) bolt.active = false
  for (const shortcut of run.shortcuts) shortcut.active = false
  run.boss.active = true
  run.boss.nextWave = run.tick + 100
  run.player.protectedUntil = Math.max(run.player.protectedUntil, run.tick + 90)
  addEffect(run, 'arrival', run.boss.x, run.boss.z, 0, 0, 70)
}

function scheduleWaves(run: Run) {
  const boss = run.boss
  const direction = boss.waveSets % 2 === 0 ? 1 : -1
  const aimedAt = Math.atan2(run.player.z - boss.z, run.player.x - boss.x) + direction * (0.52 + random(run) * 0.41)
  const count = waveCount(run)
  const gap = waveGapDegrees(run) * Math.PI / 180
  let issued = 0
  boss.waveSets++
  for (const wave of run.waves) {
    if (issued >= count) break
    if (wave.active) continue
    wave.active = true
    wave.sequence = issued
    wave.warnAt = run.tick + issued * 49
    wave.pulseAt = wave.warnAt + 54
    wave.gap = gap
    wave.gapCenter = aimedAt + direction * issued * 0.34
    wave.radius = 0
    wave.crossed = false
    wave.crossedSafely = false
    issued++
  }
  boss.nextWave = run.tick + waveCycleTicks(run)
  if (boss.waveSets % 3 === 0) {
    for (let i = 0; i < 4; i++) {
      const angle = i * TAU / 4 + random(run) * 0.8
      spawnEnemy(run, 'blank', boss.x + Math.cos(angle) * 7.1, boss.z + Math.sin(angle) * 7.1, -1, PATROL_SPAWN_DISTANCE)
    }
  }
}

export function inPress(stroke: PressStroke, x: number, z: number, margin = 0): boolean {
  return Math.abs(x - stroke.x) < stroke.halfX + margin && Math.abs(z - stroke.z) < stroke.halfZ + margin
}

function callPress(run: Run) {
  const { boss, player } = run
  const alongX = boss.waveSets % 4 === 2
  const halfX = alongX ? 2.65 : 1.43
  const halfZ = alongX ? 1.43 : 2.65
  boss.press = {
    x: clamp(player.x + (player.moving ? player.dx * .85 : 0), -ARENA.x + halfX, ARENA.x - halfX),
    z: clamp(player.z + (player.moving ? player.dz * .85 : 0), -ARENA.z + halfZ, ARENA.z - halfZ),
    halfX, halfZ, warnAt: run.tick, strikesAt: run.tick + PRESS_WARNING,
  }
  boss.pressAfterSet = boss.waveSets
  boss.nextWave = run.tick + 146
}

function progressWaves(run: Run) {
  let signal = 0
  const { boss, player } = run
  if (run.tick >= boss.nextWave) {
    if (!run.training && boss.waveSets > 0 && boss.waveSets % 2 === 0 && boss.pressAfterSet !== boss.waveSets) {
      callPress(run)
      signal |= Signal.pressWarning
    } else {
      scheduleWaves(run)
      signal |= Signal.wave
    }
  }
  const press = boss.press
  if (press) {
    if (run.tick === press.strikesAt) {
      if (inPress(press, player.x, player.z, .18)) signal |= hurt(run, 26)
      signal |= Signal.pressImpact
    }
    if (run.tick >= press.strikesAt + 28) boss.press = null
  }
  const x = run.player.x - run.boss.x
  const z = run.player.z - run.boss.z
  const distance = Math.hypot(x, z)
  const angle = Math.atan2(z, x)

  for (const wave of run.waves) {
    if (!wave.active || run.tick < wave.pulseAt) continue
    wave.radius = 0.42 + (run.tick - wave.pulseAt) * 9.7 / HZ
    if (!wave.crossed && Math.abs(wave.radius - distance) <= 0.48) {
      wave.crossed = true
      wave.crossedSafely = angleDistance(angle, wave.gapCenter) <= wave.gap / 2
      if (!wave.crossedSafely) signal |= hurt(run, 24)
    }
    if (wave.radius >= 19.6) wave.active = false
  }
  return signal
}

function endRun(run: Run, cause: 'health' | 'timeout' | 'boss') {
  closeIncident(run)
  run.surge = null
  run.phase = 'ended'
  run.endCause = cause
  run.boss.active = false
  run.boss.press = null
  run.choices.length = 0
  if (cause !== 'boss') run.outcome = 'stopped'
  else if (hazardValue(run) > 0) run.outcome = 'repair'
  else run.outcome = run.inspections.length === INCIDENTS.length ? 'qualified' : 'pending'
  return Signal.end
}

export function advanceRun(run: Run, input: Input) {
  if (run.phase === 'ended' || run.choices.length > 0) return 0
  run.tick++
  let signal = movePlayer(run, input)

  if (!run.training && run.phase === 'floor' && run.tick >= BOSS_TICK) {
    introduceBoss(run)
    signal |= Signal.boss
  }

  if (run.phase === 'floor') {
    if (!run.training && run.nextTool < TOOL_DROP_TICKS.length && run.tick >= TOOL_DROP_TICKS[run.nextTool]) {
      dropTool(run)
      signal |= Signal.toolDrop
    }
    signal |= advanceSurges(run)
    if (!run.surge && run.tick >= run.nextSpawn) spawnPatrol(run)
    signal |= advanceIncident(run)
    if (input.accept) signal |= acceptShortcut(run)
  }

  signal |= collectTools(run)
  signal |= attack(run)
  signal |= moveEnemies(run)
  signal |= moveProjectiles(run)
  signal |= collectShards(run)
  if (run.phase === 'boss') {
    if (Math.hypot(run.player.x - run.boss.x, run.player.z - run.boss.z) < 1.35) signal |= hurt(run, 17)
    const boss = run.boss
    if (boss.fileHits > 0 && run.tick >= boss.fileAt) {
      boss.fileHits--
      boss.fileAt += FILE_STROKE_GAP
      damageBoss(run, boss.fileDamage)
    }
    signal |= progressWaves(run)
  }

  if (run.player.hp <= 0) return signal | endRun(run, 'health')
  if (run.phase === 'floor') signal |= progressInspection(run)
  if (run.phase === 'boss' && run.boss.hp <= 0) return signal | endRun(run, 'boss')
  if (!run.training && run.tick >= END_TICK) return signal | endRun(run, 'timeout')

  return signal | proposeUpgrades(run)
}

export function createPracticeRun() {
  const run = createRun(84231)
  run.training = true
  run.tools[0].x = -3.45
  run.nextSpawn = Infinity
  run.nextShortcut = SHORTCUT_TICKS.length
  run.player.protectedUntil = Infinity
  for (const enemy of run.enemies) enemy.active = false
  return run
}

export function placePracticeSamples(run: Run) {
  const player = run.player
  const direction = player.x > ARENA.x - 3.9 ? -1 : 1
  run.xpGoal = 2
  for (let i = 0; i < 4; i++) {
    spawnEnemy(run, 'blank', player.x + direction * (2.75 + i * .45), player.z - 1.26 + .84 * i)
    run.enemies[(run.enemyCursor - 1 + run.enemies.length) % run.enemies.length].speed = .68
  }
}

export function placePracticePass(run: Run) {
  const { player } = run
  const direction = player.x > ARENA.x - 6.15 ? -1 : 1
  const x = player.x + direction * 1.9
  const shortcut: Shortcut = { active: true, kind: 'pass', ...nearestFreePoint(x, player.z, .65) }
  run.shortcuts.push(shortcut)
  run.incident = {
    slot: 0,
    stage: 'open',
    opensAt: run.tick,
    closesAt: Infinity,
    shortcut,
    parts: [],
    inspection: { ...nearestFreePoint(player.x + direction * 4.85, player.z, INSPECTION_RADIUS + .08), held: 0 },
  }
  run.nextAttack = Infinity
  run.xp = 0
  run.xpGoal = Infinity
  for (const shard of run.shards) shard.active = false
  for (const enemy of run.enemies) enemy.active = false
  for (let i = 0; i < 10; i++) {
    const angle = i * TAU / 10
    spawnEnemy(run, 'blank', x + Math.cos(angle) * (3.7 + i * .12), player.z + Math.sin(angle) * 4.0, 0)
    run.enemies[(run.enemyCursor - 1 + run.enemies.length) % run.enemies.length].speed = .46
  }
}

export function beginPracticeWave(run: Run) {
  run.player.x = 4.4
  run.player.z = .2
  run.player.dashUntil = run.tick
  run.player.dashReadyAt = run.tick
  run.nextAttack = run.tick + 30
  introduceBoss(run)
  run.boss.hp = Infinity
  run.boss.nextWave = run.tick + 53
}

export function placePracticeToolTarget(run: Run) {
  const { player } = run
  for (const enemy of run.enemies) enemy.active = false
  for (const shard of run.shards) shard.active = false
  run.xp = 0
  run.xpGoal = Infinity
  run.activeTool = null
  run.nextAttack = run.tick + 17
  const side = player.x > ARENA.x - 4.1 ? -1 : 1
  run.tools.push({ active: true, kind: 'wrench', ...nearestFreePoint(player.x + side * 2.2, player.z, .72) })
  spawnEnemy(run, 'bolt', player.x + side * 4.75, player.z)
  const target = run.enemies[(run.enemyCursor - 1 + run.enemies.length) % run.enemies.length]
  target.hp = 200
  target.speed = .32
  target.actionAt = Infinity
}
