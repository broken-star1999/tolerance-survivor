import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BOSS_TICK, END_TICK, HZ, IDLE_INPUT, SHORTCUT_TICKS, Signal, advanceRun, attackInterval,
  chooseUpgrade, createPracticeRun, createRun, hazardValue, isWeapon, nearestTool, waveCount, waveCycleTicks, waveGapDegrees,
  type Run,
} from '../src/simulation.hot.ts'
import { pickTestUpgrade, testInput } from './play-policy.ts'

function emptyFloor(run: Run) {
  for (const enemy of run.enemies) enemy.active = false
  run.nextSpawn = Infinity
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
  run.nextAttack = Infinity
  run.nextSpawn = Infinity
  const enemyCount = run.enemies.filter(enemy => enemy.active).length
  const shortcut = getShortcut(run, 0)
  assert.equal(shortcut.kind, 'pass')
  assert.equal(run.kills, 0)
  const accept = { ...IDLE_INPUT, accept: true }
  assert.ok(advanceRun(run, accept) & Signal.clear)
  assert.equal(run.kills, enemyCount)
  assert.equal(run.enemies.some(enemy => enemy.active), false)
  assert.equal(run.shards.filter(shard => shard.active).length + run.xp, enemyCount)
  assert.equal(hazardValue(run), 1)
  assert.equal(waveCount(run), 2)
  advanceRun(run, accept)
  assert.equal(run.accepted.length, 1)
})

test('beautification boost expires exactly after twelve seconds and narrows the later safe gap', () => {
  const run = createRun(19)
  emptyFloor(run)
  const shortcut = getShortcut(run, 1)
  assert.equal(shortcut.kind, 'beautifier')
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
})

test('the three shortcuts alter width and cadence while every actual wave keeps a 0.9 second warning', () => {
  for (const passes of [0, 1, 2]) {
    for (const beautifiers of [0, 1, 2]) {
      if (passes + beautifiers > 3) continue
      const run = createRun(76)
      emptyFloor(run)
      run.nextAttack = Infinity
      run.passes = passes
      run.beautifiers = beautifiers
      run.tick = BOSS_TICK - 1
      assert.ok(advanceRun(run, IDLE_INPUT) & Signal.boss)
      for (let i = 0; i < 80; i++) advanceRun(run, IDLE_INPUT)
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
  run.nextAttack = Infinity
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

test('wrench cancels charging, and a file delivers its damage in three discrete strokes', () => {
  const run = createRun(81)
  emptyFloor(run)
  run.nextAttack = Infinity
  const bolt = run.enemies[0]
  Object.assign(bolt, { active: true, kind: 'bolt', x: 1.55, z: 0.6, speed: .1, mode: 1, until: 200, hp: 250 })
  run.ranks.wrench = 1
  advanceRun(run, IDLE_INPUT)
  assert.equal(bolt.mode, 0)
  const afterWrench = bolt.hp
  run.ranks.wrench = 0
  run.ranks.file = 1
  advanceRun(run, IDLE_INPUT)
  assert.equal(bolt.fileHits, 3)
  assert.equal(bolt.hp, afterWrench)
  for (let i = 0; i < 25; i++) advanceRun(run, IDLE_INPUT)
  assert.equal(bolt.fileHits, 0)
  assert.ok(Math.abs(bolt.hp - (afterWrench - 38)) < .0001)
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
