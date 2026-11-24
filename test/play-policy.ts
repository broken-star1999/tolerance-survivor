import { ARENA, HZ, angleDistance, isWeapon, nearestShortcut, nearestTool, type Input, type Run } from '../src/simulation.hot.ts'

const TAU = Math.PI * 2
const inputVectors = Array.from({ length: 20 }, (_, index) => ({
  x: Math.cos(index * TAU / 20), z: Math.sin(index * TAU / 20),
}))

export function pickTestUpgrade(run: Run) {
  let score = -Infinity
  let selected = 0
  for (let i = 0; i < run.choices.length; i++) {
    const option = run.choices[i]
    const preference = option === 'guard' && run.player.hp < 76 ? 24
      : option === 'caliper' ? 18
        : isWeapon(option) && (option === 'tape' || option === 'saw') ? 16
      : option === 'sweep' && run.ranks.sweep < 3 ? 14
        : option === 'power' ? 11
          : option === 'tempo' ? 10
            : option === 'reach' ? 8 : option === 'magnet' ? 7 : option === 'stride' ? 6 : 5
    if (preference > score) {
      score = preference
      selected = i
    }
  }
  return selected
}

function bossMovement(run: Run): Input {
  const p = run.player
  const dx = p.x - run.boss.x
  const dz = p.z - run.boss.z
  const distance = Math.hypot(dx, dz)
  const angle = Math.atan2(dz, dx)
  let targetAngle = angle + 0.51
  let earliest = 145
  for (const wave of run.waves) {
    if (!wave.active || wave.crossed || run.tick + 12 < wave.warnAt) continue
    const untilHit = wave.pulseAt - run.tick + (distance - 0.42) * HZ / 9.7
    if (untilHit < -4 || untilHit >= earliest) continue
    earliest = untilHit
    targetAngle = wave.gapCenter
  }
  const radius = 3.85
  const moveX = run.boss.x + Math.cos(targetAngle) * radius - p.x
  const moveZ = run.boss.z + Math.sin(targetAngle) * radius - p.z
  const dash = earliest < 17 && angleDistance(angle, targetAngle) > 0.65 && distance > 2.3
  return { x: moveX * 1.6, z: moveZ * 1.6, dash, accept: false }
}

export function testInput(run: Run, takeShortcuts: boolean): Input {
  if (run.phase === 'boss') return bossMovement(run)
  const p = run.player
  const time = run.tick / HZ
  const tool = nearestTool(run, 40)
  const shortcut = takeShortcuts && run.ranks.caliper > 0 ? nearestShortcut(run, 40) : undefined
  const review = !takeShortcuts && run.incident?.stage === 'open' ? run.incident.inspection : undefined
  let goalX = Math.cos(time * 0.34) * 6.8
  let goalZ = Math.sin(time * 0.34) * 4.8
  let distanceToGoal = 9
  for (const shard of run.shards) {
    if (!shard.active) continue
    const distance = Math.hypot(shard.x - p.x, shard.z - p.z)
    if (distance >= distanceToGoal) continue
    goalX = shard.x
    goalZ = shard.z
    distanceToGoal = distance
  }
  const objective = shortcut ?? review ?? tool
  if (objective) {
    goalX = objective.x
    goalZ = objective.z
  }

  let best = -Infinity
  let vector = inputVectors[0]
  let nearest = Infinity
  for (const enemy of run.enemies) {
    if (!enemy.active) continue
    nearest = Math.min(nearest, Math.hypot(enemy.x - p.x, enemy.z - p.z))
  }
  const atObjective = Math.hypot(goalX - p.x, goalZ - p.z)
  if ((review && atObjective <= .8 && nearest > .72) || (atObjective < .38 && nearest > 3)) {
    return { x: 0, z: 0, dash: false, accept: Boolean(shortcut && nearestShortcut(run, 1.58)) }
  }
  for (const option of inputVectors) {
    const x = p.x + option.x * 1.18
    const z = p.z + option.z * 1.18
    if (Math.abs(x) > ARENA.x || Math.abs(z) > ARENA.z) continue
    let danger = 0
    let closest = 4.3
    for (const enemy of run.enemies) {
      if (!enemy.active) continue
      const distance = Math.hypot(enemy.x - x, enemy.z - z)
      closest = Math.min(closest, distance)
      if (distance < 2.6) danger += (2.6 - distance) * 0.84
      if (enemy.mode === 1 || enemy.mode === 2) {
        const forward = (x - enemy.x) * enemy.dx + (z - enemy.z) * enemy.dz
        const side = Math.abs((z - enemy.z) * enemy.dx - (x - enemy.x) * enemy.dz)
        if (forward > 0.15 && forward < 5.1 && side < 0.86) danger += 2.4
      }
    }
    for (const shot of run.projectiles) {
      if (!shot.active) continue
      const distance = Math.hypot(shot.x + shot.dx * .7 - x, shot.z + shot.dz * .7 - z)
      if (distance < 1.1) danger += 3 * (1.1 - distance)
    }
    const toward = (Math.hypot(goalX - p.x, goalZ - p.z) - Math.hypot(goalX - x, goalZ - z)) * (objective ? 3.15 : 1.95)
    const score = toward + 0.74 * closest - danger
    if (score > best) {
      best = score
      vector = option
    }
  }

  return {
    x: vector.x,
    z: vector.z,
    dash: nearest < 1.18 && Math.abs(p.x + vector.x * 3.1) < ARENA.x && Math.abs(p.z + vector.z * 3.1) < ARENA.z,
    accept: Boolean(shortcut && nearestShortcut(run, 1.58)),
  }
}
