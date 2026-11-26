import assert from 'node:assert/strict'
import test from 'node:test'
import { ARENA, PLAYER_CLEARANCE, STATIONS, isOpenFloor, type GroundPoint } from '../src/floor-plan.ts'
import {
  BOSS_TICK, DASH_BUFFER, DASH_COOLDOWN, END_TICK, HAZARD_BATCH, HZ, IDLE_INPUT, INSPECTION_HOLD, SHORTCUT_TICKS, SURGES, Signal, advanceRun, attackInterval,
  chooseUpgrade, createPracticeRun, createRun, hazardValue, isWeapon, nearestTool, placePracticeToolTarget, previewToolStats, surgeGroupAt, waveCount, waveCycleTicks, waveGapDegrees,
  type Run,
} from '../src/simulation.hot.ts'
import { pickTestUpgrade, testInput } from './play-policy.ts'

function emptyFloor(run: Run) {
  for (const enemy of run.enemies) enemy.active = false
  run.nextSpawn = Infinity
  run.nextSurge = SURGES.length
}

function pauseAttacks(run: Run) {
  run.nextAttacks.caliper = Infinity
  run.nextAttacks.wrench = Infinity
  run.nextAttacks.tape = Infinity
}

function getShortcut(run: Run, slot: number) {
  run.tick = SHORTCUT_TICKS[slot] - 1
  run.nextShortcut = slot
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.offer)
  const shortcut = run.shortcuts[run.shortcuts.length - 1]
  run.player.x = shortcut.x
  run.player.z = shortcut.z
  return shortcut
}

function play(seed: number, takeShortcuts: boolean) {
  const run = createRun(seed)
  let firstUpgrade = 0
  while (run.phase !== 'ended') {
    if (run.choices.length) {
      if (!firstUpgrade) firstUpgrade = run.tick
      assert.equal(chooseUpgrade(run, pickTestUpgrade(run)), true)
    } else {
      advanceRun(run, testInput(run, takeShortcuts))
    }
  }
  return {
    tick: run.tick,
    outcome: run.outcome,
    hp: run.player.hp,
    kills: run.kills,
    accepted: run.accepted,
    reviewed: run.inspections.map(record => record.slot),
    firstUpgrade,
    waveSets: run.boss.waveSets,
  }
}

test('the first upgrade pauses simulation until a valid selection', () => {
  const run = createRun(19)
  run.xp = run.xpGoal
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.level)
  assert.equal(run.choices.length, 3)
  assert.equal(new Set(run.choices).size, 3)
  const tick = run.tick
  advanceRun(run, { x: 1, z: 0, dash: true, accept: true })
  assert.equal(run.tick, tick)
  assert.equal(chooseUpgrade(run, 8), false)
  assert.equal(chooseUpgrade(run, 0), true)
  advanceRun(run, IDLE_INPUT)
  assert.equal(run.tick, tick + 1)
})

test('the pass clears all active enemies, retains XP and records a single hazard', () => {
  const run = createRun(19)
  pauseAttacks(run)
  run.nextSpawn = Infinity
  const shortcut = getShortcut(run, 0)
  const enemyCount = run.enemies.filter(enemy => enemy.active).length
  assert.equal(shortcut.kind, 'pass')
  assert.equal(run.kills, 0)
  const accept = { ...IDLE_INPUT, accept: true }
  assert.ok(advanceRun(run, accept) & Signal.clear)
  assert.equal(run.kills, enemyCount)
  assert.equal(run.enemies.some(enemy => enemy.active), false)
  assert.equal(run.shards.filter(shard => shard.active).length, enemyCount)
  assert.equal(hazardValue(run), 1)
  assert.equal(waveCount(run), 2)
  assert.equal(run.incident, null)
  assert.equal(run.inspections.length, 0)
  advanceRun(run, accept)
  assert.equal(run.accepted.length, 1)
  assert.equal(run.accepted[0].slot, 0)
})

test('beautification boost expires exactly after twelve seconds and narrows the later safe gap', () => {
  const run = createRun(19)
  emptyFloor(run)
  const shortcut = getShortcut(run, 1)
  emptyFloor(run)
  assert.equal(shortcut.kind, 'beautifier')
  run.ranks.caliper = 1
  run.tools[0].active = false
  const baseline = attackInterval(run)
  advanceRun(run, { ...IDLE_INPUT, accept: true })
  assert.equal(attackInterval(run), baseline / 2)
  const usedAt = run.tick
  for (let i = 0; i < 12 * HZ - 1; i++) advanceRun(run, IDLE_INPUT)
  assert.equal(attackInterval(run), baseline / 2)
  advanceRun(run, IDLE_INPUT)
  assert.equal(run.tick - usedAt, 12 * HZ)
  assert.equal(attackInterval(run), baseline)
  assert.equal(waveGapDegrees(run), 80)
  assert.equal(hazardValue(run), 1)
  assert.equal(run.accepted[0].slot, 1)
})

test('the three shortcuts alter width and cadence while every actual wave keeps a 0.9 second warning', () => {
  for (const passes of [0, 1, 2]) {
    for (const beautifiers of [0, 1, 2]) {
      if (passes + beautifiers > 3) continue
      const run = createRun(76)
      emptyFloor(run)
      pauseAttacks(run)
      run.passes = passes
      run.beautifiers = beautifiers
      run.tick = BOSS_TICK - 1
      assert.ok(advanceRun(run, IDLE_INPUT) & Signal.boss)
      const warningAt = run.boss.nextWave
      while (run.tick < warningAt) advanceRun(run, IDLE_INPUT)
      const waves = run.waves.filter(wave => wave.active)
      assert.equal(waves.length, 1 + passes)
      assert.equal(run.boss.nextWave - run.tick, (6 - 0.5 * (passes + beautifiers)) * HZ)
      assert.equal(waveCycleTicks(run), run.boss.nextWave - run.tick)
      for (const wave of waves) {
        assert.equal(wave.pulseAt - wave.warnAt, 54)
        assert.ok(Math.abs(wave.gap * 180 / Math.PI - (100 - 20 * beautifiers)) < 1e-9)
      }
    }
  }
})

test('clean and three-hazard runs can both win, including a deterministic input replay', () => {
  const seed = 0x41c603a1
  const clean = play(seed, false)
  const risky = play(seed, true)
  assert.equal(clean.outcome, 'qualified', JSON.stringify(clean))
  assert.equal(clean.accepted.length, 0)
  assert.deepEqual(clean.reviewed, [0, 1, 2])
  assert.equal(risky.outcome, 'repair', JSON.stringify(risky))
  assert.equal(risky.accepted.length, 3)
  assert.ok(risky.waveSets > 1)
  assert.ok(clean.firstUpgrade > 0 && clean.firstUpgrade <= 25 * HZ, JSON.stringify(clean))
  assert.deepEqual(play(seed, true), risky)
})

test('loss, timeout and a fresh run leave unambiguous results', () => {
  const fatal = createRun()
  emptyFloor(fatal)
  fatal.player.hp = 0
  assert.ok(advanceRun(fatal, IDLE_INPUT) & Signal.end)
  assert.equal(fatal.endCause, 'health')
  assert.equal(fatal.outcome, 'stopped')
  const clock = createRun()
  emptyFloor(clock)
  clock.tick = END_TICK - 1
  clock.passes = 2
  assert.ok(advanceRun(clock, IDLE_INPUT) & Signal.end)
  assert.equal(clock.endCause, 'timeout')
  const restart = createRun(clock.seed)
  assert.equal(hazardValue(restart), 0)
  assert.equal(restart.accepted.length, 0)
  assert.equal(restart.phase, 'floor')
})

test('tools unlock on contact at Lv.1 and only picked tools can appear in upgrade choices', () => {
  const run = createRun(46)
  pauseAttacks(run)
  emptyFloor(run)
  run.xp = run.xpGoal
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.level)
  assert.equal(run.ranks.caliper, 0)
  assert.ok(run.choices.every(id => id !== 'caliper' && !isWeapon(id)))
  assert.ok(chooseUpgrade(run, 0))
  const caliper = nearestTool(run)!
  run.player.x = caliper.x
  run.player.z = caliper.z
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.toolPickup)
  assert.equal(run.ranks.caliper, 1)
  assert.equal(hazardValue(run), 0)
  run.tools.push({ active: true, kind: 'wrench', x: run.player.x, z: run.player.z })
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.toolPickup)
  assert.equal(run.ranks.wrench, 1)
  run.xp = run.xpGoal
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.level)
  assert.ok(run.choices.includes('caliper') || run.choices.includes('wrench'))
  assert.ok(run.choices.every(id => id === 'caliper' || !isWeapon(id) || id === 'wrench'))
  const owned = run.choices.find(id => id === 'caliper' || id === 'wrench')!
  const slot = run.choices.indexOf(owned)
  assert.ok(chooseUpgrade(run, slot))
  assert.equal(run.ranks[owned], 2)
  assert.equal(run.tools.every(tool => !tool.active), true)
})

test('all unlocked tools strike simultaneously on independent cooldowns', () => {
  const run = createRun(81)
  emptyFloor(run)
  run.ranks.caliper = 2
  run.ranks.wrench = 1
  run.ranks.tape = 1
  run.nextAttacks.caliper = 0
  run.nextAttacks.wrench = 0
  run.nextAttacks.tape = 0
  const part = run.enemies[0]
  Object.assign(part, { active: true, x: 2, z: .6, speed: 0, hp: 400 })
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.strike)
  assert.ok(run.effects.some(effect => effect.kind === 'slice' && effect.from === run.tick))
  assert.ok(run.effects.some(effect => effect.kind === 'wrench' && effect.from === run.tick))
  assert.ok(run.effects.some(effect => effect.kind === 'tape' && effect.from === run.tick))
  assert.equal(run.nextAttacks.caliper, run.tick + attackInterval(run, 'caliper'))
  assert.equal(run.nextAttacks.wrench, run.tick + attackInterval(run, 'wrench'))
  assert.equal(run.nextAttacks.tape, run.tick + attackInterval(run, 'tape'))
})

test('wrench cancels charging, and tape pierces targets along its line', () => {
  const run = createRun(81)
  emptyFloor(run)
  pauseAttacks(run)
  const bolt = run.enemies[0]
  Object.assign(bolt, { active: true, kind: 'bolt', x: 1.55, z: 0.6, speed: 0, mode: 1, until: 200, hp: 300 })
  run.ranks.wrench = 1
  run.nextAttacks.wrench = 0
  advanceRun(run, IDLE_INPUT)
  assert.equal(bolt.mode, 0)
  const afterWrench = bolt.hp

  const rear = run.enemies[1]
  Object.assign(rear, { active: true, kind: 'blank', x: 4.55, z: 0.6, speed: 0, hp: 100 })
  run.ranks.tape = 1
  run.nextAttacks.tape = 0
  advanceRun(run, IDLE_INPUT)
  const tapeDamage = previewToolStats(run, 'tape', 1).damage
  assert.equal(bolt.hp, afterWrench - tapeDamage)
  assert.equal(rear.hp, 100 - tapeDamage)
})

test('the training pass and training pickups are isolated from a new shift', () => {
  const practice = createPracticeRun()
  assert.equal(practice.training, true)
  assert.equal(practice.ranks.caliper, 0)
  practice.player.x = practice.tools[0].x
  practice.player.z = practice.tools[0].z
  advanceRun(practice, IDLE_INPUT)
  assert.equal(practice.ranks.caliper, 1)
  const run = createRun()
  assert.equal(run.training, false)
  assert.equal(run.ranks.caliper, 0)
  assert.equal(hazardValue(run), 0)
})

test('first batch is marked before the choice and supplies a real group for inspection', () => {
  const run = createRun(123)
  emptyFloor(run)
  run.player.protectedUntil = Infinity
  pauseAttacks(run)
  run.tick = SHORTCUT_TICKS[0] - 2 * HZ - 1
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.incidentWarning)
  assert.equal(run.incident?.stage, 'warning')
  assert.equal(run.shortcuts.length, 0)
  assert.equal(run.enemies.some(enemy => enemy.active), false)
  while (run.tick < SHORTCUT_TICKS[0]) advanceRun(run, IDLE_INPUT)
  assert.equal(run.incident?.stage, 'open')
  assert.equal(run.enemies.filter(enemy => enemy.active && enemy.batch === 0).length, 18)
  assert.ok(run.incident?.shortcut.active)
})

test('pausing to read a lesson leaves its wrench practice target available', () => {
  const run = createPracticeRun()
  run.ranks.caliper = 1
  run.tools[0].active = false
  placePracticeToolTarget(run)
  const bolt = run.enemies.find(enemy => enemy.active)!
  for (let i = 0; i < 12 * HZ; i++) advanceRun(run, IDLE_INPUT)
  assert.equal(bolt.active, true)
  const wrench = nearestTool(run, 10)!
  assert.equal(wrench.kind, 'wrench')
  run.player.x = wrench.x
  run.player.z = wrench.z
  advanceRun(run, IDLE_INPUT)
  assert.equal(run.ranks.wrench, 1)
  const x = bolt.x - run.player.x
  const z = bolt.z - run.player.z
  for (let i = 0; i < HZ; i++) advanceRun(run, { x, z, dash: false, accept: false })
  assert.ok(run.effects.some(effect => effect.kind === 'wrench'))
})

test('inspection requires staying put, isolates only its batch and closes the shortcut', () => {
  const run = createRun(33)
  pauseAttacks(run)
  run.nextSpawn = Infinity
  run.player.protectedUntil = Infinity
  run.player.hp = 72
  const shortcut = getShortcut(run, 0)
  const station = run.incident!.inspection
  run.player.x = station.x
  run.player.z = station.z
  for (let i = 0; i < INSPECTION_HOLD - 4; i++) advanceRun(run, IDLE_INPUT)
  assert.equal(station.held, INSPECTION_HOLD - 4)
  run.player.x = station.x + 1.6
  advanceRun(run, IDLE_INPUT)
  assert.equal(station.held, INSPECTION_HOLD - 6)
  for (let i = 0; i < Math.ceil(INSPECTION_HOLD / 2); i++) advanceRun(run, IDLE_INPUT)
  assert.equal(station.held, 0)
  run.player.x = station.x
  for (let i = 0; i < INSPECTION_HOLD - 1; i++) advanceRun(run, IDLE_INPUT)
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.inspection)
  assert.equal(run.inspections[0].isolated, 18)
  assert.equal(run.inspections[0].recovery, 26)
  assert.ok(run.enemies.some(enemy => enemy.active && enemy.batch < 0))
  assert.equal(shortcut.active, false)
  assert.equal(run.incident, null)
  assert.equal(hazardValue(run), 0)
})

test('an unused incident expires without logging a decision or removing its parts', () => {
  const run = createRun(95)
  emptyFloor(run)
  pauseAttacks(run)
  run.player.protectedUntil = Infinity
  const shortcut = getShortcut(run, 0)
  run.tick = run.incident!.closesAt - 1
  assert.ok(advanceRun(run, { ...IDLE_INPUT, accept: true }) & Signal.incidentClosed)
  assert.equal(shortcut.active, false)
  assert.equal(run.incident, null)
  assert.equal(run.inspections.length, 0)
  assert.equal(hazardValue(run), 0)
  assert.ok(run.enemies.some(enemy => enemy.active && enemy.batch === 0))
})

test('a missed inspection prevents release even after the test rig is stopped with zero hazards', () => {
  const run = createRun(95)
  emptyFloor(run)
  pauseAttacks(run)
  run.player.protectedUntil = Infinity
  getShortcut(run, 0)
  run.tick = run.incident!.closesAt - 1
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.incidentClosed)
  for (const slot of [1, 2]) {
    getShortcut(run, slot)
    const { x, z } = run.incident!.inspection
    run.player.x = x
    run.player.z = z
    for (let i = 0; i < INSPECTION_HOLD - 1; i++) advanceRun(run, IDLE_INPUT)
    assert.ok(advanceRun(run, IDLE_INPUT) & Signal.inspection)
  }
  run.tick = BOSS_TICK - 1
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.boss)
  run.boss.hp = 0
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.end)
  assert.equal(hazardValue(run), 0)
  assert.deepEqual(run.inspections.map(record => record.slot), [1, 2])
  assert.equal(run.outcome, 'pending')
})

test('calibrated tape widens its piercing hit line and delivers previewed damage', () => {
  const lv1 = createRun(81)
  emptyFloor(lv1)
  pauseAttacks(lv1)
  const lv1Lead = lv1.enemies[0]
  const lv1Side = lv1.enemies[1]
  Object.assign(lv1Lead, { active: true, x: 2, z: 0.6, speed: 0, hp: 200 })
  Object.assign(lv1Side, { active: true, x: 4, z: 0.6 + 0.68, speed: 0, hp: 200 })
  lv1.ranks.tape = 1
  lv1.nextAttacks.tape = 0
  advanceRun(lv1, IDLE_INPUT)
  assert.equal(lv1Side.hp, 200)

  const lv3 = createRun(81)
  emptyFloor(lv3)
  pauseAttacks(lv3)
  const lv3Lead = lv3.enemies[0]
  const lv3Side = lv3.enemies[1]
  Object.assign(lv3Lead, { active: true, x: 2, z: 0.6, speed: 0, hp: 200 })
  Object.assign(lv3Side, { active: true, x: 4, z: 0.6 + 0.68, speed: 0, hp: 200 })
  lv3.ranks.tape = 3
  lv3.nextAttacks.tape = 0
  const expected = previewToolStats(lv3, 'tape', 3).damage
  assert.ok(expected > previewToolStats(lv3, 'tape', 2).damage)
  advanceRun(lv3, IDLE_INPUT)
  assert.equal(lv3Lead.hp, 200 - expected)
  assert.equal(lv3Side.hp, 200 - expected)
})

test('a workstation stops a dash and lets a diagonal move slide along its face', () => {
  const run = createRun(19)
  emptyFloor(run)
  const bench = STATIONS[0]
  const edge = bench.x - bench.width / 2 - PLAYER_CLEARANCE
  run.player.x = edge - .42
  run.player.z = bench.z
  advanceRun(run, { x: 1, z: 0, dash: true, accept: false })
  for (let tick = 0; tick < 15; tick++) advanceRun(run, IDLE_INPUT)
  assert.ok(run.player.x <= edge && run.player.x > edge - .02)
  assert.equal(run.player.z, bench.z)
  for (let tick = 0; tick < 16; tick++) advanceRun(run, { x: 1, z: 1, dash: false, accept: false })
  assert.ok(run.player.z > bench.z + .8)
  assert.ok(isOpenFloor(run.player.x, run.player.z, PLAYER_CLEARANCE))
})

test('at every map edge and corner, an outward dash leaves the inward dash ready', () => {
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const run = createRun(19)
    emptyFloor(run)
    run.player.x = x * (ARENA.x - PLAYER_CLEARANCE)
    run.player.z = z * (ARENA.z - PLAYER_CLEARANCE)
    const before = { x: run.player.x, z: run.player.z }
    assert.equal(advanceRun(run, { x, z, dash: true, accept: false }) & Signal.dash, 0)
    assert.equal(run.player.dashReadyAt, 0)
    assert.ok(isOpenFloor(run.player.x, run.player.z, PLAYER_CLEARANCE))
    assert.ok(Math.hypot(run.player.x - before.x, run.player.z - before.z) < 1e-9)
    assert.ok(advanceRun(run, { x: -x, z: -z, dash: true, accept: false }) & Signal.dash)
    assert.ok(Math.hypot(run.player.x - before.x, run.player.z - before.z) > .24)
  }
})

test('diagonal contact with an outer wall hands control back before the next move', () => {
  const run = createRun(19)
  emptyFloor(run)
  const edge = ARENA.x - PLAYER_CLEARANCE
  run.player.x = edge - .39
  run.player.z = 0
  const diagonal = { x: 1, z: 1, dash: false, accept: false }
  assert.ok(advanceRun(run, { ...diagonal, dash: true }) & Signal.dash)
  advanceRun(run, diagonal)
  advanceRun(run, diagonal)
  assert.equal(run.player.x, edge)
  assert.equal(run.player.dashUntil, run.tick)
  const zAtWall = run.player.z
  advanceRun(run, diagonal)
  assert.ok(run.player.z > zAtWall)
  advanceRun(run, { ...IDLE_INPUT, x: -1 })
  assert.ok(run.player.x < edge - .075)
})

test('separated chasers route around a bench from a blocked approach', () => {
  const run = createRun(74)
  const bench = STATIONS[1]
  emptyFloor(run)
  run.player.x = bench.x
  run.player.z = bench.z + 2.1
  run.player.protectedUntil = Infinity
  const enemies = run.enemies.slice(0, 3)
  for (const enemy of enemies) {
    Object.assign(enemy, { active: true, kind: 'blank', x: bench.x, z: bench.z - 1.85, radius: .4, speed: 2.3, hp: 40 })
  }
  for (let tick = 0; tick < 35; tick++) advanceRun(run, IDLE_INPUT)
  assert.ok(Math.hypot(enemies[2].x - enemies[0].x, enemies[2].z - enemies[0].z) > .27)
  for (let tick = 0; tick < 345; tick++) {
    advanceRun(run, IDLE_INPUT)
    assert.ok(enemies.every(enemy => isOpenFloor(enemy.x, enemy.z, enemy.radius)))
  }
  assert.ok(enemies.every(enemy => enemy.z > bench.z + bench.depth / 2))
  assert.ok(enemies.some(enemy => Math.hypot(enemy.x - run.player.x, enemy.z - run.player.z) < 1.15))
})

test('a blocked charge recovers and a projectile is intercepted by the same station', () => {
  const run = createRun(74)
  emptyFloor(run)
  const bench = STATIONS[0]
  const edge = bench.x - bench.width / 2
  run.player.x = bench.x + 2.75
  run.player.z = bench.z
  const enemy = run.enemies[0]
  Object.assign(enemy, {
    active: true, kind: 'bolt', x: edge - .76, z: bench.z, radius: .53, speed: 1.6,
    hp: 44, mode: 2, dx: 1, dz: 0, until: 34,
  })
  const shot = run.projectiles[0]
  Object.assign(shot, { active: true, x: edge - .24, z: bench.z + .2, dx: 1, dz: 0 })
  for (let tick = 0; tick < 8; tick++) advanceRun(run, IDLE_INPUT)
  assert.equal(enemy.mode, 3)
  assert.ok(enemy.x <= edge - enemy.radius)
  assert.equal(shot.active, false)
  assert.equal(run.player.hp, 100)
  assert.equal(run.effects.filter(effect => effect.kind === 'impact' && effect.until > run.tick).length, 2)
})

test('a press near dash recovery executes once at readiness and uses the current direction', () => {
  const run = createRun(18)
  emptyFloor(run)
  run.player.dashReadyAt = DASH_BUFFER + 4
  assert.equal(advanceRun(run, { ...IDLE_INPUT, x: 1, dash: true }) & Signal.dash, 0)
  assert.equal(run.player.dashBufferedUntil, -1)
  while (run.tick < 3) advanceRun(run, IDLE_INPUT)
  assert.equal(advanceRun(run, { ...IDLE_INPUT, x: 1, dash: true }) & Signal.dash, 0)
  assert.ok(run.player.dashBufferedUntil >= run.player.dashReadyAt)
  while (run.tick < DASH_BUFFER + 3) advanceRun(run, IDLE_INPUT)
  assert.ok(advanceRun(run, { ...IDLE_INPUT, z: 1 }) & Signal.dash)
  assert.equal(run.player.dashX, 0)
  assert.equal(run.player.dashZ, 1)
  assert.equal(run.player.dashReadyAt - run.tick, DASH_COOLDOWN)
  assert.equal(run.player.dashBufferedUntil, -1)
  assert.equal(advanceRun(run, IDLE_INPUT) & Signal.dash, 0)
})

test('a surge telegraphs two separate groups and leaves a brief opening afterward', () => {
  const run = createRun(464)
  emptyFloor(run)
  run.nextSurge = 0
  run.tick = SURGES[0].tick - 106
  run.nextSpawn = SURGES[0].tick
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.surgeWarning)
  const surge = run.surge!
  assert.equal(run.enemies.filter(enemy => enemy.active).length, 0)
  while (run.tick < surge.opensAt - 1) advanceRun(run, IDLE_INPUT)
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.surgeArrival)
  assert.equal(run.enemies.filter(enemy => enemy.active).length, SURGES[0].first)
  const second = surgeGroupAt(surge, 1)
  while (run.tick < second - 1) advanceRun(run, IDLE_INPUT)
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.surgeArrival)
  assert.equal(run.enemies.filter(enemy => enemy.active).length, SURGES[0].first + SURGES[0].second)
  while (run.surge) advanceRun(run, IDLE_INPUT)
  assert.ok(run.nextSpawn > run.tick + HZ)
})

function isNearArenaWall(point: GroundPoint) {
  return Math.min(ARENA.x - Math.abs(point.x), ARENA.z - Math.abs(point.z)) <= 2.2
}

test('patrols enter far away from the perimeter around the entire workshop', () => {
  for (const x of [-1, 0, 1]) {
    for (const z of [-1, 0, 1]) {
      for (const seed of [32, 44, 91, 123, 464]) {
        const run = createRun(seed)
        emptyFloor(run)
        run.player.x = x * (ARENA.x - PLAYER_CLEARANCE)
        run.player.z = z * (ARENA.z - PLAYER_CLEARANCE)
        run.nextShortcut = SHORTCUT_TICKS.length
        run.tick = 171 * HZ - 1
        run.nextSpawn = run.tick + 1
        advanceRun(run, IDLE_INPUT)
        const patrol = run.enemies.filter(enemy => enemy.active)
        assert.equal(patrol.length, 4)
        assert.ok(patrol.every(enemy => Math.hypot(enemy.x - run.player.x, enemy.z - run.player.z) >= 11.4))
        assert.ok(patrol.every(enemy => isNearArenaWall(enemy) && isOpenFloor(enemy.x, enemy.z, enemy.radius)))
      }
    }
  }
})

test('opening enemies and boss reinforcements also start at distant entrances', () => {
  const run = createRun(19)
  const opening = run.enemies.filter(enemy => enemy.active)
  assert.equal(opening.length, 7)
  assert.ok(opening.every(enemy => isNearArenaWall(enemy) && Math.hypot(enemy.x, enemy.z - run.player.z) >= 12))

  emptyFloor(run)
  run.tick = BOSS_TICK - 1
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.boss)
  run.player.x = ARENA.x - PLAYER_CLEARANCE
  run.player.z = ARENA.z - PLAYER_CLEARANCE
  run.boss.waveSets = 2
  run.boss.pressAfterSet = 2
  run.boss.nextWave = run.tick + 1
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.wave)
  const reinforcements = run.enemies.filter(enemy => enemy.active)
  assert.equal(reinforcements.length, 4)
  assert.ok(reinforcements.every(enemy => isNearArenaWall(enemy) && Math.hypot(enemy.x - run.player.x, enemy.z - run.player.z) >= 11.5))
})

test('a warned formation moves its close markers and keeps its full count', () => {
  for (const useSurge of [true, false]) {
    const run = createRun(464)
    emptyFloor(run)
    run.nextSurge = useSurge ? 2 : SURGES.length
    run.nextShortcut = useSurge ? SHORTCUT_TICKS.length : 0
    run.player.x = ARENA.x - PLAYER_CLEARANCE
    run.player.z = -ARENA.z + PLAYER_CLEARANCE
    run.tick = useSurge ? SURGES[2].tick - 106 : SHORTCUT_TICKS[0] - 2 * HZ - 1
    advanceRun(run, IDLE_INPUT)
    const incoming = useSurge ? run.surge!.groups[0] : run.incident!.parts
    assert.ok(incoming.every(part => isNearArenaWall(part) && Math.hypot(part.x - run.player.x, part.z - run.player.z) >= 11.5))
    run.player.x = incoming[0].x
    run.player.z = incoming[0].z
    const opensAt = useSurge ? run.surge!.opensAt : run.incident!.opensAt
    run.tick = opensAt - 2
    advanceRun(run, IDLE_INPUT)
    assert.equal(run.enemies.some(enemy => enemy.active), false)
    assert.ok(incoming.every(part => isNearArenaWall(part) && Math.hypot(part.x - run.player.x, part.z - run.player.z) >= 9.5))
    assert.ok(incoming.every((part, index) => incoming.slice(0, index).every(other =>
      Math.hypot(part.x - other.x, part.z - other.z) >= .95)))
    advanceRun(run, IDLE_INPUT)
    const spawned = run.enemies.filter(enemy => enemy.active)
    assert.equal(spawned.length, incoming.length)
    assert.ok(spawned.every(enemy => isNearArenaWall(enemy) && Math.hypot(enemy.x - run.player.x, enemy.z - run.player.z) >= 9.4))
  }
})

test('the pressure head locks its ground zone and deals damage only at the indicated strike', () => {
  for (const stepAway of [false, true]) {
    const run = createRun(94)
    emptyFloor(run)
    run.tick = BOSS_TICK - 1
    advanceRun(run, IDLE_INPUT)
    run.boss.waveSets = 2
    run.boss.nextWave = run.tick + 1
    run.player.protectedUntil = 0
    assert.ok(advanceRun(run, IDLE_INPUT) & Signal.pressWarning)
    assert.equal(run.boss.presses.length, 2)
    const press = run.boss.press!
    assert.equal(press.x, run.player.x)
    if (stepAway) run.player.z += press.halfZ + .6
    while (run.tick < press.strikesAt - 1) advanceRun(run, IDLE_INPUT)
    assert.equal(run.player.hp, 100)
    assert.ok(advanceRun(run, IDLE_INPUT) & Signal.pressImpact)
    assert.equal(run.player.hp, stepAway ? 100 : 64)
    for (let i = 0; i < 28; i++) advanceRun(run, IDLE_INPUT)
    assert.equal(run.boss.press, null)
    assert.equal(run.boss.presses.length, 0)
  }
})

test('hazard damage counts only hits caused by an extra or narrowed wave', () => {
  const placeAt = (run: Run, angle: number) => {
    for (const r of [3, 3.5, 4, 4.5, 5, 5.5, 6]) {
      const x = run.boss.x + Math.cos(angle) * r
      const z = run.boss.z + Math.sin(angle) * r
      if (Math.abs(x) <= ARENA.x - PLAYER_CLEARANCE && Math.abs(z) <= ARENA.z - PLAYER_CLEARANCE &&
          isOpenFloor(x, z, PLAYER_CLEARANCE)) {
        run.player.x = x
        run.player.z = z
        return
      }
    }
    throw new Error('Could not place player on open floor')
  }

  const extra = createRun(76)
  emptyFloor(extra)
  pauseAttacks(extra)
  extra.passes = 1
  extra.tick = BOSS_TICK - 1
  assert.ok(advanceRun(extra, IDLE_INPUT) & Signal.boss)
  const extraWarningAt = extra.boss.nextWave
  while (extra.tick < extraWarningAt) advanceRun(extra, IDLE_INPUT)
  for (const enemy of extra.enemies) enemy.active = false
  for (const bolt of extra.projectiles) bolt.active = false
  const [w0, w1] = extra.waves.filter(wave => wave.active)
  const sign = Math.sign(Math.atan2(Math.sin(w1.gapCenter - w0.gapCenter), Math.cos(w1.gapCenter - w0.gapCenter))) || 1
  placeAt(extra, w0.gapCenter - sign * 0.7)
  while (!w0.crossed || !w1.crossed) advanceRun(extra, IDLE_INPUT)
  assert.equal(w0.crossedSafely, true)
  assert.equal(w1.crossedSafely, false)
  assert.equal(extra.hazardDamage, 24)

  const base = createRun(76)
  emptyFloor(base)
  pauseAttacks(base)
  base.passes = 0
  base.tick = BOSS_TICK - 1
  assert.ok(advanceRun(base, IDLE_INPUT) & Signal.boss)
  const baseWarningAt = base.boss.nextWave
  while (base.tick < baseWarningAt) advanceRun(base, IDLE_INPUT)
  for (const bolt of base.projectiles) bolt.active = false
  const [bw0] = base.waves.filter(wave => wave.active)
  placeAt(base, bw0.gapCenter + Math.PI)
  while (!bw0.crossed) advanceRun(base, IDLE_INPUT)
  assert.equal(bw0.crossedSafely, false)
  assert.equal(base.hazardDamage, 0)
})

test('shortcut hazards send returned parts into the boss phase and their hits count as hazard damage', () => {
  const run = createRun(76)
  emptyFloor(run)
  pauseAttacks(run)
  run.passes = 2
  run.tick = BOSS_TICK - 1
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.boss)
  const warningAt = run.boss.nextWave
  let lastSignal = 0
  while (run.tick < warningAt) lastSignal = advanceRun(run, IDLE_INPUT)
  assert.ok(lastSignal & Signal.hazardReturn)
  const returned = run.enemies.filter(enemy => enemy.active && enemy.batch === HAZARD_BATCH)
  assert.equal(returned.length, 4)
  assert.ok(returned.every(enemy => enemy.kind === 'bolt'))

  if (isOpenFloor(6, 3, PLAYER_CLEARANCE)) {
    run.player.x = 6
    run.player.z = 3
  } else {
    run.player.x = -6
    run.player.z = 3
  }
  returned[0].x = run.player.x
  returned[0].z = run.player.z
  run.player.protectedUntil = 0
  const before = run.hazardDamage
  advanceRun(run, IDLE_INPUT)
  assert.equal(run.hazardDamage - before, 15)
})

test('boss overdrive strengthens press strikes and fires radial projectile volleys', () => {
  const run = createRun(94)
  emptyFloor(run)
  pauseAttacks(run)
  run.tick = BOSS_TICK - 1
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.boss)
  const warningAt = run.boss.nextWave
  while (run.tick < warningAt) advanceRun(run, IDLE_INPUT)
  assert.equal(run.projectiles.filter(bolt => bolt.active).length, 6)
  for (const bolt of run.projectiles) bolt.active = false

  run.boss.hp = Math.floor(run.boss.hp * 0.5) + 5
  run.ranks.caliper = 1
  run.nextAttacks.caliper = 0
  run.player.x = run.boss.x + 2.5
  run.player.z = run.boss.z
  const sig = advanceRun(run, IDLE_INPUT)
  assert.ok(sig & Signal.bossEnrage)
  assert.equal(run.boss.enraged, true)
  assert.ok(run.boss.press)
  assert.equal(run.boss.presses.length, 3)
  assert.equal(run.boss.press!.strikesAt - run.tick, 56)

  for (const wave of run.waves) wave.active = false
  run.boss.press = null
  run.boss.presses.length = 0
  run.boss.nextWave = run.tick + 1
  run.boss.pressAfterSet = run.boss.waveSets
  assert.ok(advanceRun(run, IDLE_INPUT) & Signal.wave)
  assert.equal(run.projectiles.filter(bolt => bolt.active).length, 10)
})
