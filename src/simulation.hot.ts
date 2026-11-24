export const HZ = 60
export const BOSS_TICK = 210 * HZ
export const END_TICK = 300 * HZ
export const MAX_ENEMIES = 180
export const MAX_SHARDS = 480
export const MAX_BOLTS = 90
export const ARENA = { x: 14.2, z: 8.8 }
export const SHORTCUT_TICKS = [50 * HZ, 100 * HZ, 150 * HZ] as const
export const INSPECTION_HOLD = 96
export const INSPECTION_RADIUS = 1.36
export const INCIDENTS = [
  { title: '待检件夹击', batch: '首批装配件', detail: '两侧涌入一批待检件。复检圈位于两路之间。' },
  { title: '试验数据异常', batch: '试验数据批次', detail: '两侧出现异常数据，留意蓄力方向，沿中间通行。' },
  { title: '交付催验', batch: '末批待验件', detail: '末批零件与异常数据同时涌入。可在交付前复检这一批。' },
] as const

const incidentBatches: ReadonlyArray<readonly EnemyKind[]> = [
  [...Array<EnemyKind>(16).fill('blank'), 'bolt', 'bolt'],
  ['phantom', 'phantom', 'blank', 'blank', 'bolt', 'blank', 'phantom', 'phantom', 'blank', 'bolt',
   'blank', 'phantom', 'phantom', 'blank', 'bolt', 'blank', 'phantom', 'bolt', 'blank', 'blank'],
  ['bolt', 'bolt', 'phantom', 'blank', 'blank', 'phantom', 'blank', 'blank', 'blank', 'phantom',
   'bolt', 'blank', 'blank', 'blank', 'phantom', 'phantom', 'bolt', 'blank', 'blank', 'blank',
   'phantom', 'blank', 'bolt', 'bolt', 'blank', 'blank'],
]
export const BOSS_HP = 6800
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
  file: { name: '锉刀', detail: '锁定一件目标，连续锉削三次', sprite: 'file' },
  saw: { name: '手锯', detail: '横向拉锯，扫中前方一整排零件', sprite: 'saw' },
  tape: { name: '卷尺', detail: '甩出长尺，贯穿同一直线上的目标', sprite: 'tape' },
  mallet: { name: '橡皮锤', detail: '砸出近身冲击圈，震退周围零件', sprite: 'mallet' },
} as const

export const SHORTCUTS = {
  pass: {
    name: '免检通行证',
    benefit: '清除场内小怪，保留经验掉落',
    consequence: '事故战每轮多一道冲击波',
    trace: '免检零件未经核验进入装配',
  },
  beautifier: {
    name: '数据一键美化器',
    benefit: '测量速度翻倍，持续 12 秒',
    consequence: '事故冲击波缺口缩小 20°',
    trace: '美化记录掩盖了测量偏差',
  },
} as const

export type UpgradeId = keyof typeof UPGRADES

export const WEAPON_IDS = ['wrench', 'file', 'saw', 'tape', 'mallet'] as const
export type WeaponId = typeof WEAPON_IDS[number]
const weaponInfo: Record<WeaponId, { reach: number; delay: number; damage: number }> = {
  wrench: { reach: 3.95, delay: 112, damage: 39 },
  file: { reach: 5.15, delay: 100, damage: 38 },
  saw: { reach: 5.65, delay: 124, damage: 26 },
  tape: { reach: 9.20, delay: 114, damage: 24 },
  mallet: { reach: 2.95, delay: 144, damage: 31 },
}
export const WEAPON_SLOTS = 1 + WEAPON_IDS.length
export type ToolKind = 'caliper' | WeaponId
const TOOL_DROP_TICKS = [18, 45, 78, 116, 154].map(seconds => seconds * HZ)
export const MAX_WEAPON_RANK = 5

export const CALIBRATIONS = {
  caliper: '增加一处自动复测，额外命中一个邻近零件。',
  wrench: '扩大重击角度，可以打断冲撞中的螺栓。',
  file: '由三次锉削改为四次，总伤害还有额外加成。',
  saw: '加宽锯切范围，一次能扫到更宽的一排。',
  tape: '加宽卷尺命中线，覆盖挨得更开的零件。',
  mallet: '加大击退力度，把围上来的零件推得更远。',
} satisfies Record<ToolKind, string>

function toolDamage(run: Run, id: ToolKind, rank: number) {
  if (id === 'caliper') return 22 + 7 * run.ranks.power + 7 * (rank - 1)
  const base = weaponInfo[id].damage + (rank - 1) * 9 + run.ranks.power * 2
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
    : weaponInfo[id].delay - run.ranks.tempo * 5 - (rank - 1) * 6
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
export type ShortcutKind = keyof typeof SHORTCUTS
export type EnemyKind = 'blank' | 'bolt' | 'phantom'
export type EffectKind = 'slice' | 'hit' | 'dash' | 'pickup' | 'clear' | 'arrival' | 'toolPickup' | 'inspection' | WeaponId
export type Outcome = 'qualified' | 'repair' | 'stopped'
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
  mode: 0 | 1 | 2
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
  shards: Shard[]
  projectiles: Bolt[]
  shortcuts: Shortcut[]
  incident: Incident | null
  inspections: { slot: number; tick: number; isolated: number; recovery: number }[]
  tools: ToolDrop[]
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
  weaponReady: Record<WeaponId, number>
  nextSpawn: number
  nextShortcut: number
  enemyCursor: number
  shardCursor: number
  boltCursor: number
  effectCursor: number
  accepted: { kind: ShortcutKind; tick: number }[]
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
      dashX: 0, dashZ: -1, dashUntil: 0, dashReadyAt: 0,
      protectedUntil: 50, hurtAt: -999, moving: false,
    },
    enemies: Array.from({ length: MAX_ENEMIES }, emptyEnemy),
    shards: Array.from({ length: MAX_SHARDS }, () => ({ active: false, x: 0, z: 0, value: 0, phase: 0 })),
    projectiles: Array.from({ length: MAX_BOLTS }, () => ({ active: false, x: 0, z: 0, dx: 0, dz: 0 })),
    shortcuts: [], incident: null, inspections: [],
    tools: [{ active: true, kind: 'caliper', x: 1.55, z: 0.6 }], nextTool: 0, lastToolPicked: null,
    effects: Array.from({ length: 64 }, () => ({ kind: 'hit', x: 0, z: 0, toX: 0, toZ: 0, from: 0, until: 0 })),
    waves: Array.from({ length: 12 }, () => ({
      active: false, sequence: 0, warnAt: 0, pulseAt: 0, gap: 0, gapCenter: 0, radius: 0, crossed: false, crossedSafely: false,
    })),
    choices: [],
    ranks: { caliper: 0, power: 0, tempo: 0, reach: 0, sweep: 0, stride: 0, guard: 0, magnet: 0, wrench: 0, file: 0, saw: 0, tape: 0, mallet: 0 },
    kills: 0, level: 1, xp: 0, xpGoal: 14, boostUntil: 0,
    nextAttack: 32, nextSpawn: 85, nextShortcut: 0,
    weaponReady: { wrench: 0, file: 0, saw: 0, tape: 0, mallet: 0 },
    enemyCursor: 0, shardCursor: 0, boltCursor: 0, effectCursor: 0,
    accepted: [], passes: 0, beautifiers: 0,
    boss: { x: 0, z: -1.1, hp: BOSS_HP, active: false, flashUntil: 0, nextWave: 0, waveSets: 0, fileAt: 0, fileHits: 0, fileDamage: 0 },
  }

  for (let i = 0; i < 7; i++) {
    const angle = i * TAU / 7 + 0.14 * random(run)
    const distance = 3.25 + random(run) * 1.3
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

export function attackInterval(run: Run) {
  const normal = toolInterval(run, 'caliper', run.ranks.caliper)
  return run.tick < run.boostUntil ? Math.ceil(normal / 2) : normal
}

export function angleDistance(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

function spawnEnemy(run: Run, kind: EnemyKind, x: number, z: number, batch = -1) {
  const enemies = run.enemies
  for (let i = 0; i < enemies.length; i++) {
    const index = (run.enemyCursor + i) % enemies.length
    const enemy = enemies[index]
    if (enemy.active) continue
    const time = run.tick / BOSS_TICK
    enemy.active = true
    enemy.kind = kind
    enemy.batch = batch
    enemy.x = clamp(x, -ARENA.x + 0.4, ARENA.x - 0.4)
    enemy.z = clamp(z, -ARENA.z + 0.4, ARENA.z - 0.4)
    enemy.hp = kind === 'bolt' ? 46 + 16 * time : kind === 'phantom' ? 27 + 12 * time : 16 + 8 * time
    const speed = kind === 'bolt' ? 1.45 : kind === 'phantom' ? 1.66 : 2.05
    enemy.speed = speed + time * 0.46 + random(run) * 0.28 + (batch < 0 ? 0 : .27)
    enemy.radius = kind === 'bolt' ? 0.53 : 0.40
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
  let number = time < 26 ? 1 : time < 60 ? 2 : time < 106 ? 3 : time < 148 ? 4 : time < 178 ? 5 : 7
  if (time > 175 && random(run) > 0.58) number++
  for (let i = 0; i < number; i++) {
    const roll = random(run)
    const kind: EnemyKind = time > 87 && roll < 0.16
      ? 'phantom'
      : time > 43 && roll < (time > 87 ? 0.34 : 0.26) ? 'bolt' : 'blank'
    let x = 0
    let z = 0
    for (let tries = 0; tries < 4; tries++) {
      const angle = random(run) * TAU
      const spread = 5.3 + random(run) * (time < 35 ? 2 : 5.2)
      x = clamp(run.player.x + Math.cos(angle) * spread, -ARENA.x + 0.4, ARENA.x - 0.4)
      z = clamp(run.player.z + Math.sin(angle) * spread, -ARENA.z + 0.4, ARENA.z - 0.4)
      if (Math.hypot(x - run.player.x, z - run.player.z) > 3.9) break
    }
    spawnEnemy(run, kind, x, z)
  }
  run.nextSpawn = run.tick + Math.max(38, Math.round(108 - time * 0.32 + random(run) * 20))
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

function attack(run: Run) {
  if (!run.ranks.caliper || run.tick < run.nextAttack) return 0
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
    const followUps = run.ranks.sweep + (rank >= 3 ? 1 : 0)
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

  run.nextAttack = run.tick + attackInterval(run)
  return Signal.strike
}

function applyFiling(target: Filing, tick: number, damage: number, strokes: number) {
  target.fileDamage = damage / strokes
  target.fileHits = strokes
  target.fileAt = tick + 3
}

function damageBoss(run: Run, damage: number) {
  const boss = run.boss
  boss.hp = Math.max(0, boss.hp - damage)
  boss.flashUntil = run.tick + 7
  addEffect(run, 'hit', boss.x, boss.z, 0, 0, 12)
}

function inToolShape(id: WeaponId, x: number, z: number, dx: number, dz: number, reach: number, calibrated: boolean) {
  const distance = Math.hypot(x, z)
  if (id === 'mallet') return distance <= reach
  const forward = x * dx + z * dz
  if (forward < 0 || forward > reach) return false
  if (id === 'wrench') return distance <= reach && forward >= distance * (calibrated ? .30 : .52)
  const side = Math.abs(z * dx - x * dz)
  return side <= (id === 'saw' ? (calibrated ? 1.71 : 1.18) : (calibrated ? .82 : .52))
}

function attackWeapons(run: Run) {
  let signal = 0
  const player = run.player
  for (const id of WEAPON_IDS) {
    const rank = run.ranks[id]
    if (rank === 0 || run.tick < run.weaponReady[id]) continue
    const calibrated = rank >= 3
    const reach = toolReach(run, id, rank)
    const boss = run.boss
    const enemy = nearestEnemy(run, player.x, player.z, reach)
    const bossDistance = Math.hypot(boss.x - player.x, boss.z - player.z)
    const aimBoss = boss.active && bossDistance < reach + .45 &&
      (!enemy || bossDistance <= Math.hypot(enemy.x - player.x, enemy.z - player.z) + .4)
    if (!enemy && !aimBoss) continue
    const targetX = aimBoss ? boss.x : enemy!.x
    const targetZ = aimBoss ? boss.z : enemy!.z
    const dx = targetX - player.x
    const dz = targetZ - player.z
    const distance = Math.hypot(dx, dz)
    const dirX = distance > .01 ? dx / distance : player.facing
    const dirZ = distance > .01 ? dz / distance : 0
    const damage = toolDamage(run, id, rank)

    if (id === 'file') {
      applyFiling(aimBoss ? boss : enemy!, run.tick, damage, calibrated ? 4 : 3)
      addEffect(run, id, player.x, player.z, targetX, targetZ, 29)
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
          target.x = clamp(target.x + awayX / length * push, -ARENA.x + .3, ARENA.x - .3)
          target.z = clamp(target.z + awayZ / length * push, -ARENA.z + .3, ARENA.z - .3)
        }
      }
      if (boss.active && inToolShape(id, boss.x - player.x, boss.z - player.z, dirX, dirZ, reach + .45, calibrated)) {
        damageBoss(run, damage)
      }
      addEffect(run, id, player.x, player.z, player.x + dirX * reach, player.z + dirZ * reach, 28)
    }

    const delay = toolInterval(run, id, rank)
    run.weaponReady[id] = run.tick + (run.tick < run.boostUntil ? Math.ceil(delay / 2) : delay)
    signal |= Signal.strike
  }
  return signal
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
  if (input.dash && run.tick >= player.dashReadyAt) {
    const length = Math.hypot(player.dx, player.dz) || 1
    player.dashX = player.dx / length
    player.dashZ = player.dz / length
    player.dashUntil = run.tick + 13
    player.dashReadyAt = run.tick + 78
    player.protectedUntil = Math.max(run.tick + 16, player.protectedUntil)
    addEffect(run, 'dash', player.x, player.z, player.x + player.dashX * 2.2, player.z + player.dashZ * 2.2, 16)
    signaled = Signal.dash
  }
  const dashing = run.tick < player.dashUntil
  player.moving = dashing || Math.abs(moveX) + Math.abs(moveZ) > 0.01
  const speed = dashing ? 15.0 : 4.9 + run.ranks.stride * 0.49
  player.x = clamp(player.x + (dashing ? player.dashX : moveX) * speed / HZ, -ARENA.x, ARENA.x)
  player.z = clamp(player.z + (dashing ? player.dashZ : moveZ) * speed / HZ, -ARENA.z, ARENA.z)
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

function moveEnemies(run: Run) {
  let signal = 0
  const player = run.player
  for (const enemy of run.enemies) {
    if (!enemy.active) continue
    if (enemy.fileHits > 0 && run.tick >= enemy.fileAt) {
      enemy.fileHits--
      enemy.fileAt += 10
      damageEnemy(run, enemy, enemy.fileDamage)
      if (!enemy.active) continue
    }
    const dx = player.x - enemy.x
    const dz = player.z - enemy.z
    const distance = Math.hypot(dx, dz) || 0.001
    const unitX = dx / distance
    const unitZ = dz / distance
    if (Math.abs(dx) > 0.18 && enemy.mode === 0) enemy.facing = dx < 0 ? -1 : 1

    let vx = unitX * enemy.speed
    let vz = unitZ * enemy.speed

    if (enemy.kind === 'bolt') {
      if (enemy.mode === 0 && distance < 6.2 && run.tick >= enemy.actionAt) {
        enemy.mode = 1
        enemy.dx = unitX
        enemy.dz = unitZ
        enemy.until = run.tick + 51
      }

      if (enemy.mode === 1 && run.tick >= enemy.until) {
        enemy.mode = 2
        enemy.until = run.tick + 34
      } else if (enemy.mode === 2 && run.tick >= enemy.until) {
        enemy.mode = 0
        enemy.actionAt = run.tick + 145
      }

      if (enemy.mode === 1) {
        vx = 0
        vz = 0
      } else if (enemy.mode === 2) {
        vx = enemy.dx * 10.8
        vz = enemy.dz * 10.8
      }
    } else if (enemy.kind === 'phantom') {
      if (enemy.mode === 0 && run.tick >= enemy.actionAt && distance < 10.3) {
        enemy.mode = 1
        enemy.dx = unitX
        enemy.dz = unitZ
        enemy.until = run.tick + 32
      } else if (enemy.mode === 1 && run.tick >= enemy.until) {
        fireProjectile(run, enemy)
        enemy.mode = 0
        enemy.actionAt = run.tick + 143
      }

      if (enemy.mode === 1 || (distance > 5.25 && distance < 7.35)) {
        vx = 0
        vz = 0
      } else if (distance <= 5.25) {
        vx *= -0.81
        vz *= -0.81
      }
    }

    enemy.x = clamp(enemy.x + vx / HZ, -ARENA.x + 0.30, ARENA.x - 0.30)
    enemy.z = clamp(enemy.z + vz / HZ, -ARENA.z + 0.30, ARENA.z - 0.30)
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
    bolt.x += bolt.dx * 7.4 / HZ
    bolt.z += bolt.dz * 7.4 / HZ
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
  run.tools.push({ active: true, kind, x, z })
  run.nextTool++
}

function collectTools(run: Run) {
  const tool = nearestTool(run, .9)
  if (!tool) return 0
  tool.active = false
  run.ranks[tool.kind] = Math.max(1, run.ranks[tool.kind])
  if (tool.kind === 'caliper') {
    run.nextAttack = Math.min(run.nextAttack, run.tick + 18)
  } else {
    run.weaponReady[tool.kind] = run.tick + 17
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
    const flank = (4.55 + row * 1.16 + random(run) * .40) * side
    parts.push({
      kind: composition[i],
      x: clamp(x + dx * front + sideX * flank, -ARENA.x + .62, ARENA.x - .62),
      z: clamp(z + dz * front + sideZ * flank, -ARENA.z + .62, ARENA.z - .62),
    })
  }
  run.incident = {
    slot,
    stage: 'warning',
    opensAt: SHORTCUT_TICKS[slot],
    closesAt: SHORTCUT_TICKS[slot] + 14 * HZ,
    parts,
    shortcut: { active: false, kind, x: x + dx * .80, z: z + dz * .80 },
    inspection: { x: x + dx * 5.15, z: z + dz * 5.15, held: 0 },
  }
}

function openIncident(run: Run, incident: Incident) {
  incident.stage = 'open'
  incident.shortcut.active = true
  run.shortcuts.push(incident.shortcut)
  for (const part of incident.parts) {
    spawnEnemy(run, part.kind, part.x, part.z, incident.slot)
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
  player.hp = Math.min(player.maximumHp, previousHp + 12)
  run.inspections.push({ slot, tick: run.tick, isolated, recovery: player.hp - previousHp })
  addEffect(run, 'inspection', inspection.x, inspection.z, 0, 0, 54)
  closeIncident(run)
  return Signal.inspection
}

function acceptShortcut(run: Run) {
  const shortcut = nearestShortcut(run, 1.65)
  if (!shortcut) return 0
  shortcut.active = false
  if (run.incident?.shortcut === shortcut) closeIncident(run)
  run.accepted.push({ kind: shortcut.kind, tick: run.tick })
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
  run.nextAttack = Math.min(run.nextAttack, run.tick + attackInterval(run))
  for (const weapon of WEAPON_IDS) {
    const halfway = run.tick + Math.ceil(toolInterval(run, weapon, Math.max(1, run.ranks[weapon])) / 2)
    run.weaponReady[weapon] = Math.min(run.weaponReady[weapon], halfway)
  }
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
  const eligibleTool = run.level === 2 && ownedTools.includes('caliper')
    ? 'caliper' : ownedTools[Math.floor(random(run) * ownedTools.length)]
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
  if (isWeapon(choice)) run.weaponReady[choice] = run.tick
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
  run.phase = 'boss'
  for (const enemy of run.enemies) enemy.active = false
  for (const bolt of run.projectiles) bolt.active = false
  for (const shortcut of run.shortcuts) shortcut.active = false
  run.boss.active = true
  run.boss.nextWave = run.tick + 80
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
      spawnEnemy(run, 'blank', boss.x + Math.cos(angle) * 7.1, boss.z + Math.sin(angle) * 7.1)
    }
  }
}

function progressWaves(run: Run) {
  let signal = 0
  if (run.tick >= run.boss.nextWave) {
    scheduleWaves(run)
    signal |= Signal.wave
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
  run.phase = 'ended'
  run.endCause = cause
  run.boss.active = false
  run.choices.length = 0
  run.outcome = cause !== 'boss' ? 'stopped' : hazardValue(run) === 0 ? 'qualified' : 'repair'
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
    if (run.tick >= run.nextSpawn) spawnPatrol(run)
    signal |= advanceIncident(run)
    if (input.accept) signal |= acceptShortcut(run)
  }

  signal |= collectTools(run)
  signal |= attack(run)
  signal |= attackWeapons(run)
  signal |= moveEnemies(run)
  signal |= moveProjectiles(run)
  signal |= collectShards(run)
  if (run.phase === 'boss') {
    if (Math.hypot(run.player.x - run.boss.x, run.player.z - run.boss.z) < 1.35) signal |= hurt(run, 17)
    const boss = run.boss
    if (boss.fileHits > 0 && run.tick >= boss.fileAt) {
      boss.fileHits--
      boss.fileAt += 10
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
  const shortcut: Shortcut = { active: true, kind: 'pass', x, z: player.z }
  run.shortcuts.push(shortcut)
  run.incident = {
    slot: 0,
    stage: 'open',
    opensAt: run.tick,
    closesAt: Infinity,
    shortcut,
    parts: [],
    inspection: { x: player.x + direction * 4.85, z: player.z, held: 0 },
  }
  run.nextAttack = Infinity
  for (const weapon of WEAPON_IDS) run.weaponReady[weapon] = Infinity
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
  givePracticeToolsBack(run)
  introduceBoss(run)
  run.boss.hp = Infinity
  run.boss.nextWave = run.tick + 53
}

function givePracticeToolsBack(run: Run) {
  run.nextAttack = run.tick + 30
  for (const weapon of WEAPON_IDS) run.weaponReady[weapon] = run.tick + 50
}

export function placePracticeToolTarget(run: Run) {
  const { player } = run
  for (const enemy of run.enemies) enemy.active = false
  for (const shard of run.shards) shard.active = false
  run.xp = 0
  run.xpGoal = Infinity
  run.nextAttack = run.tick + 120
  const side = player.x > ARENA.x - 4.1 ? -1 : 1
  run.tools.push({ active: true, kind: 'wrench', x: player.x + side * 2.2, z: player.z })
  spawnEnemy(run, 'bolt', player.x + side * 4.75, player.z)
  const target = run.enemies[(run.enemyCursor - 1 + run.enemies.length) % run.enemies.length]
  target.hp = 200
  target.speed = .32
  target.actionAt = Infinity
}
