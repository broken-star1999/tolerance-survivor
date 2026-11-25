export interface GroundPoint { x: number; z: number }

export const ARENA = { x: 14.2, z: 8.8 }
export const PLAYER_CLEARANCE = .31

// Equipment footprints are shared by the scene, placement, and the simulation.
export const STATIONS = [
  { kind: 'calibration', x: -7.58, z: -3.54, width: 3.38, depth: 1.68 },
  { kind: 'sampling', x: 7.31, z: -4.33, width: 3.61, depth: 1.54 },
  { kind: 'isolation', x: 6.61, z: 4.40, width: 2.67, depth: 1.84 },
] as const

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}

export function isOpenFloor(x: number, z: number, clearance = 0): boolean {
  return Math.abs(x) <= ARENA.x && Math.abs(z) <= ARENA.z &&
    !STATIONS.some(station => Math.abs(x - station.x) < station.width / 2 + clearance &&
      Math.abs(z - station.z) < station.depth / 2 + clearance)
}

export function nearestFreePoint(x: number, z: number, clearance: number): GroundPoint {
  x = clamp(x, -ARENA.x + clearance, ARENA.x - clearance)
  z = clamp(z, -ARENA.z + clearance, ARENA.z - clearance)
  if (isOpenFloor(x, z, clearance)) return { x, z }

  let point = { x: 0, z: .6 }
  let nearest = Infinity
  for (const station of STATIONS) {
    const w = station.width / 2 + clearance + .045
    const d = station.depth / 2 + clearance + .045
    for (const [px, pz] of [
      [station.x - w, z], [station.x + w, z], [x, station.z - d], [x, station.z + d],
    ]) {
      const distance = Math.abs(px - x) + Math.abs(pz - z)
      if (distance >= nearest || !isOpenFloor(px, pz, clearance)) continue
      point = { x: px, z: pz }
      nearest = distance
    }
  }
  return point
}

// Return the first contact along a straight move. A tangent or a move away from a face is clear.
export function stationContact(x: number, z: number, toX: number, toZ: number, clearance = 0): number {
  const dx = toX - x
  const dz = toZ - z
  let contact = 1
  for (const station of STATIONS) {
    const w = station.width / 2 + clearance
    const d = station.depth / 2 + clearance
    const sx = x - station.x
    const sz = z - station.z
    if (Math.abs(sx) >= w && Math.sign(sx) === Math.sign(sx + dx) && Math.abs(sx + dx) >= w) continue
    if (Math.abs(sz) >= d && Math.sign(sz) === Math.sign(sz + dz) && Math.abs(sz + dz) >= d) continue
    const enterX = dx === 0 ? -Infinity : ((dx > 0 ? -w : w) - sx) / dx
    const leaveX = dx === 0 ? Infinity : ((dx > 0 ? w : -w) - sx) / dx
    const enterZ = dz === 0 ? -Infinity : ((dz > 0 ? -d : d) - sz) / dz
    const leaveZ = dz === 0 ? Infinity : ((dz > 0 ? d : -d) - sz) / dz
    const enter = Math.max(0, enterX, enterZ)
    const leave = Math.min(1, leaveX, leaveZ)
    if (enter < leave) contact = Math.min(contact, enter)
  }
  return contact
}

export function moveOnFloor(body: GroundPoint, dx: number, dz: number, clearance: number): boolean {
  if (!dx && !dz) return false
  const x = body.x
  const z = body.z
  const toX = clamp(x + dx, -ARENA.x, ARENA.x)
  const toZ = clamp(z + dz, -ARENA.z, ARENA.z)
  if (stationContact(x, z, toX, toZ, clearance) === 1) {
    body.x = toX
    body.z = toZ
    return toX !== x + dx || toZ !== z + dz
  }

  // Resolve only the blocked part of the move so diagonals slide along a bench.
  const xTravel = stationContact(x, z, toX, z, clearance)
  body.x = x + (toX - x) * (xTravel === 1 ? 1 : Math.max(0, xTravel - .001))
  const zTravel = stationContact(body.x, z, body.x, toZ, clearance)
  body.z = z + (toZ - z) * (zTravel === 1 ? 1 : Math.max(0, zTravel - .001))
  return true
}
