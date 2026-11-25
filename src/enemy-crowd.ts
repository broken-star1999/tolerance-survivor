import { ARENA, isOpenFloor, stationContact, type GroundPoint } from './floor-plan.ts'

interface Walker extends GroundPoint { active: boolean; radius: number }

const NAV_CLEARANCE = .55
const NAV_COLS = 39
const NAV_ROWS = 25
const NAV_DX = ARENA.x * 2 / NAV_COLS
const NAV_DZ = ARENA.z * 2 / NAV_ROWS
const UNREACHED = 65535
const BUCKET = 1.36
const BUCKET_COLS = Math.ceil(ARENA.x * 2 / BUCKET) + 1
const BUCKET_ROWS = Math.ceil(ARENA.z * 2 / BUCKET) + 1

const nodes = Array.from({ length: NAV_COLS * NAV_ROWS }, (_, index) => ({
  x: (index % NAV_COLS + .5) * NAV_DX - ARENA.x,
  z: (Math.floor(index / NAV_COLS) + .5) * NAV_DZ - ARENA.z,
}))
const clearNodes = nodes.map(node => isOpenFloor(node.x, node.z, NAV_CLEARANCE))
const links = nodes.map((node, index) => {
  const neighbors: number[] = []
  if (!clearNodes[index]) return neighbors
  const column = index % NAV_COLS
  const row = Math.floor(index / NAV_COLS)
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dz) || column + dx < 0 || column + dx >= NAV_COLS ||
          row + dz < 0 || row + dz >= NAV_ROWS) continue
      const next = index + dx + dz * NAV_COLS
      if (clearNodes[next] && stationContact(node.x, node.z, nodes[next].x, nodes[next].z, NAV_CLEARANCE) === 1) {
        neighbors.push(next)
      }
    }
  }
  return neighbors
})

function nearbyNode(x: number, z: number, clearance: number): number {
  const column = Math.max(0, Math.min(NAV_COLS - 1, Math.floor((x + ARENA.x) / NAV_DX)))
  const row = Math.max(0, Math.min(NAV_ROWS - 1, Math.floor((z + ARENA.z) / NAV_DZ)))
  const direct = row * NAV_COLS + column
  if (clearNodes[direct] && stationContact(x, z, nodes[direct].x, nodes[direct].z, clearance) === 1) return direct
  let best = -1
  let distance = Infinity
  for (let nz = Math.max(0, row - 2); nz <= Math.min(NAV_ROWS - 1, row + 2); nz++) {
    for (let nx = Math.max(0, column - 2); nx <= Math.min(NAV_COLS - 1, column + 2); nx++) {
      const index = nz * NAV_COLS + nx
      if (!clearNodes[index]) continue
      const squared = (nodes[index].x - x) ** 2 + (nodes[index].z - z) ** 2
      if (squared >= distance || stationContact(x, z, nodes[index].x, nodes[index].z, clearance) < 1) continue
      best = index
      distance = squared
    }
  }
  return best
}

export function createCrowd(maximum: number) {
  return {
    goal: -1,
    distances: new Uint16Array(nodes.length).fill(UNREACHED),
    queue: new Uint16Array(nodes.length),
    heads: new Int16Array(BUCKET_COLS * BUCKET_ROWS).fill(-1),
    next: new Int16Array(maximum),
  }
}
export type Crowd = ReturnType<typeof createCrowd>

export function indexCrowd(crowd: Crowd, walkers: readonly Walker[]) {
  crowd.heads.fill(-1)
  for (let index = walkers.length - 1; index >= 0; index--) {
    const walker = walkers[index]
    if (!walker.active) continue
    const column = Math.floor((walker.x + ARENA.x) / BUCKET)
    const row = Math.floor((walker.z + ARENA.z) / BUCKET)
    const slot = row * BUCKET_COLS + column
    crowd.next[index] = crowd.heads[slot]
    crowd.heads[slot] = index
  }
}

export function detourTowardPlayer(crowd: Crowd, walker: Walker, player: GroundPoint): GroundPoint {
  const goal = nearbyNode(player.x, player.z, .10)
  if (goal < 0) return player
  if (crowd.goal !== goal) {
    // All blocked enemies share one reverse breadth-first search for the current player cell.
    crowd.goal = goal
    crowd.distances.fill(UNREACHED)
    crowd.distances[goal] = 0
    crowd.queue[0] = goal
    let tail = 1
    for (let head = 0; head < tail; head++) {
      const node = crowd.queue[head]
      for (const neighbor of links[node]) {
        if (crowd.distances[neighbor] !== UNREACHED) continue
        crowd.distances[neighbor] = crowd.distances[node] + 1
        crowd.queue[tail++] = neighbor
      }
    }
  }

  const nearer = nearbyNode(walker.x, walker.z, walker.radius)
  if (nearer < 0) return player
  let target = nearer
  let best = Infinity
  for (const next of links[nearer]) {
    if (crowd.distances[next] >= crowd.distances[nearer]) continue
    const node = nodes[next]
    if (stationContact(walker.x, walker.z, node.x, node.z, walker.radius) < 1) continue
    const score = crowd.distances[next] + Math.hypot(player.x - node.x, player.z - node.z) * .013
    if (score < best) {
      target = next
      best = score
    }
  }
  return nodes[target]
}

export function spacing(crowd: Crowd, walkers: readonly Walker[], index: number, result: GroundPoint) {
  const walker = walkers[index]
  const column = Math.floor((walker.x + ARENA.x) / BUCKET)
  const row = Math.floor((walker.z + ARENA.z) / BUCKET)
  result.x = 0
  result.z = 0
  let count = 0
  for (let nz = Math.max(0, row - 1); nz <= Math.min(BUCKET_ROWS - 1, row + 1); nz++) {
    for (let nx = Math.max(0, column - 1); nx <= Math.min(BUCKET_COLS - 1, column + 1); nx++) {
      for (let other = crowd.heads[nz * BUCKET_COLS + nx]; other >= 0; other = crowd.next[other]) {
        if (other === index || !walkers[other].active) continue
        const neighbor = walkers[other]
        const dx = walker.x - neighbor.x
        const dz = walker.z - neighbor.z
        const clearance = walker.radius + neighbor.radius + .19
        const squared = dx * dx + dz * dz
        if (squared >= clearance * clearance) continue
        const distance = Math.sqrt(squared)
        const strength = (clearance - distance) * 2.35
        result.x += distance > .01 ? dx * strength / distance : (other < index ? .72 : -.72)
        result.z += distance > .01 ? dz * strength / distance : 0
        count++
      }
    }
  }
  const scale = 1 / Math.max(1, Math.sqrt(count))
  result.x *= scale
  result.z *= scale
}
