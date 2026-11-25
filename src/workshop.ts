import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'
import type { BufferGeometry } from 'three'
import { ARENA, STATIONS } from './floor-plan.ts'

const FLOOR_WIDTH = 40
const FLOOR_DEPTH = 28
const FLOOR_SCALE = 24
const ARENA_X = ARENA.x
const ARENA_Z = ARENA.z
const quarterTurn = Math.PI / 2

const paint = {
  dark: '#151f27',
  frame: '#323f4c',
  steel: '#596c74',
  rim: '#76868a',
  lightSteel: '#a6b3a7',
  shadow: '#223139',
  teal: '#38676a',
  wornTeal: '#547577',
  yellow: '#c19756',
  amber: '#f1b86d',
  hot: '#f68854',
  mint: '#91e6bb',
  oil: '#16272d',
  copper: '#9a6245',
  brass: '#a38a64',
  lamp: '#e8c69a',
  rubber: '#293035',
} as const

interface Part {
  x: number
  y: number
  z: number
  width: number
  height: number
  depth: number
  color: string
  pitch: number
  roll: number
}

const stencil: Record<string, readonly string[]> = {
  A: ['0110', '1001', '1111', '1001', '1001'],
  B: ['1110', '1001', '1110', '1001', '1110'],
  C: ['0111', '1000', '1000', '1000', '0111'],
  Q: ['0110', '1001', '1001', '1011', '0111'],
  '-': ['000', '000', '111', '000', '000'],
  '0': ['0110', '1001', '1001', '1001', '0110'],
  '1': ['0100', '1100', '0100', '0100', '1110'],
  '2': ['1110', '0001', '0110', '1000', '1111'],
  '3': ['1110', '0001', '0110', '0001', '1110'],
  '4': ['1010', '1010', '1111', '0010', '0010'],
}

function makeFloorTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = FLOOR_WIDTH * FLOOR_SCALE
  canvas.height = FLOOR_DEPTH * FLOOR_SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Workshop floor requires a 2D drawing context.')

  const worldX = (x: number) => Math.round((x + FLOOR_WIDTH / 2) * FLOOR_SCALE)
  const worldZ = (z: number) => Math.round((z + FLOOR_DEPTH / 2) * FLOOR_SCALE)
  const rect = (x: number, z: number, width: number, depth: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(worldX(x), worldZ(z), Math.round(width * FLOOR_SCALE), Math.round(depth * FLOOR_SCALE))
  }

  let seed = 84613
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
    return seed / 4294967296
  }

  const slabs = ['#293c45', '#2b3f48', '#2d424c', '#30434b', '#2c4148', '#2c4148']
  ctx.fillStyle = '#1e2e37'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const tile = FLOOR_SCALE * 2

  for (let y = 0; y < canvas.height; y += tile) {
    for (let x = 0; x < canvas.width; x += tile) {
      ctx.fillStyle = slabs[Math.floor(random() * slabs.length)]
      ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2)
      ctx.fillStyle = '#3b4c53'
      ctx.fillRect(x + 2, y + 1, tile - 4, 1)
      ctx.fillRect(x + 1, y + 3, 1, tile - 6)
      ctx.fillStyle = '#243740'
      ctx.fillRect(x + 2, y + tile - 3, tile - 4, 1)
      for (let i = 0; i < 9; i++) {
        const ox = x + 4 + Math.floor(random() * (tile - 13))
        const oy = y + 4 + Math.floor(random() * (tile - 8))
        ctx.fillStyle = i % 2 ? '#344751' : '#283b43'
        ctx.fillRect(ox, oy, i === 0 ? 7 : i === 1 ? 4 : 2, 1)
      }
      if (random() > 0.73) {
        ctx.fillStyle = '#22323a'
        ctx.fillRect(x + 5, y + 5, 4, 3)
        ctx.fillStyle = '#526061'
        ctx.fillRect(x + 6, y + 5, 2, 1)
      }
      if (random() > 0.86) {
        ctx.fillStyle = '#5a534b'
        const edge = x + tile - 11
        ctx.fillRect(edge, y + 4, 7, 1)
        ctx.fillRect(edge + 2, y + 5, 3, 1)
      }
    }
  }

  // Recessed equipment pads sit outside the walkable rectangle.
  rect(-19, -13.6, 38, 3.85, '#23333c')
  rect(-18.7, -13.35, 37.4, 0.12, '#39515b')
  rect(-19, -9.58, 38, 0.24, '#16252f')
  rect(-18.5, 9.52, 37, 0.43, '#22353f')
  rect(-17.7, 9.56, 35.4, 0.15, '#495d66')

  // Wide, low-contrast pools from the inspection lamps. The center stays quieter than the perimeter.
  for (const [x, z, radius, squash, tint] of [
    [-9.0, -9.2, 7.4, .53, 'rgba(221,155,85,.18)'],
    [7.2, -9.3, 8.7, .60, 'rgba(245,190,125,.21)'],
    [-12.8, 3.4, 6.4, 1.08, 'rgba(102,164,203,.12)'],
    [11.6, 5.0, 6.7, .91, 'rgba(114,174,177,.13)'],
  ] as const) {
    ctx.save()
    ctx.translate(worldX(x), worldZ(z))
    ctx.scale(1, squash)
    const reach = radius * FLOOR_SCALE
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, reach)
    glow.addColorStop(0, tint)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(-reach, -reach, reach * 2, reach * 2)
    ctx.restore()
  }
  rect(-14.0, -10.32, 12.5, .69, '#16242f')
  rect(1.86, -10.01, 10.91, .47, '#192832')
  rect(-14.55, -9.45, 13.42, .055, '#5a5346')
  rect(1.75, -9.42, 11.07, .06, '#605849')

  for (const side of [-1, 1]) {
    const x = side === -1 ? -15.2 : 14.72
    rect(x - 0.17, -9.0, .82, 18.12, '#263740')
    rect(x, -9.0, .45, 18.12, '#162630')
    rect(x + .44, -9.0, .06, 18.12, '#4d5b5e')
    for (let z = -8.9; z < 9.05; z += .35) {
      rect(x + .04, z, .37, .08, '#3c505b')
    }
    for (const z of [-8.2, -3.2, 1.9, 6.9]) {
      rect(x - .07, z, .59, .18, '#536169')
      rect(x + .04, z + .04, .31, .05, '#73837f')
    }
  }

  // A thin, worn caution border makes the playable footprint visible.
  for (const z of [-ARENA_Z - 0.30, ARENA_Z + 0.08]) {
    rect(-ARENA_X - 0.15, z, (ARENA_X + 0.15) * 2, 0.24, '#333c3a')
    for (let x = -ARENA_X; x < ARENA_X; x += 0.74) {
      rect(x, z + 0.03, 0.36, 0.15, '#a28456')
      rect(x + 0.36, z + 0.06, 0.11, 0.10, '#78664d')
      rect(x + 0.04, z + 0.03, 0.17, 0.04, '#b39969')
    }
  }
  for (const x of [-ARENA_X - 0.20, ARENA_X + 0.08]) {
    rect(x, -ARENA_Z, 0.13, ARENA_Z * 2, '#6a6950')
    for (let z = -ARENA_Z + 0.3; z < ARENA_Z; z += 1.09) {
      rect(x, z, 0.13, 0.26, '#92774e')
    }
  }

  // Long, subdued aisle dashes and an inset calibration bay.
  for (const x of [-9.35, 9.35]) {
    for (let z = -7.7; z < 7.8; z += 1.75) rect(x, z, 0.07, 0.91, '#526a6c')
  }
  for (const z of [-7.03, 6.82]) {
    for (let x = -7.8; x < 8.0; x += 1.55) rect(x, z, 0.91, 0.08, '#495e61')
  }
  for (const x of [-11.75, 10.82]) {
    for (const z of [-6.18, 4.52]) {
      rect(x, z, 1.04, .39, '#263844')
      rect(x + .05, z, .95, .055, '#57666b')
      for (let slat = 1; slat < 8; slat++) rect(x + slat * .12, z + .08, .044, .23, '#41535d')
    }
  }

  const bayColor = '#486165'
  for (const side of [-1, 1]) {
    for (const z of [-4.22, 1.96]) {
      const x = side * 3.37
      rect(x - (side === 1 ? 0.94 : 0), z, 0.98, 0.11, bayColor)
      rect(x, z - (z > 0 ? 0.81 : 0), 0.10, 0.88, bayColor)
    }
  }
  const label = (value: string, x: number, z: number, size: number, color: string) => {
    let left = worldX(x)
    const top = worldZ(z)
    ctx.fillStyle = color
    for (const character of value) {
      const rows = stencil[character]
      rows.forEach((row, ri) => {
        for (let ci = 0; ci < row.length; ci++) {
          if (row[ci] === '1') ctx.fillRect(left + ci * size, top + ri * size, size, size)
        }
      })
      left += (rows[0].length + 2) * size
    }
  }
  label('A-04', 10.58, 5.86, 3, '#687a7d')
  rect(10.87, 6.11, .29, .045, '#334a52')
  rect(11.77, 6.40, .37, .045, '#43585d')
  rect(12.59, 6.23, .26, .045, '#334a52')

  for (const station of STATIONS) {
    const x = station.x - station.width / 2
    const z = station.z - station.depth / 2
    const w = station.width
    const d = station.depth
    const bay = station.kind === 'isolation' ? '#766449' : station.kind === 'sampling' ? '#536972' : '#567675'
    rect(x - .42, z - .39, w + .84, d + 1.18, '#2b3a43')
    rect(x - .39, z - .38, w + .78, .075, bay)
    rect(x - .39, z - .38, .075, d + 1.12, bay)
    rect(x + w + .31, z - .38, .075, d + 1.12, bay)
    rect(x - .38, z + d + .65, w + .76, .07, bay)
    rect(x + .21, z + .21, w + .21, d + .12, '#24323a')
    rect(x + .13, z + .09, w + .18, d + .12, '#1c2b33')
    for (let offset = .08; offset < w - .13; offset += .36) {
      rect(x + offset, z + d + .26, .17, .10, bay)
      rect(x + offset + .035, z + d + .22, .15, .065, bay)
    }
    label(station.kind === 'calibration' ? 'B-01' : station.kind === 'sampling' ? 'C-02' : 'Q-03',
      station.x - .53, z + d + .44, 1, '#889291')
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  return texture
}

function shadeFaces(geometry: BufferGeometry) {
  const normals = geometry.getAttribute('normal')
  const colors = new Float32Array(normals.count * 3)
  for (let i = 0; i < normals.count; i++) {
    const x = normals.getX(i)
    const y = normals.getY(i)
    const z = normals.getZ(i)
    const value = y > .75 ? 1.18 : y < -.75 ? .59 : .78 + .13 * z - .10 * x
    colors[i * 3] = value + .025 * Math.max(0, y)
    colors[i * 3 + 1] = value
    colors[i * 3 + 2] = value + .045 * Math.max(0, -x)
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geometry
}

function buildBatch(geometry: BufferGeometry, parts: Part[]) {
  const material = new MeshBasicMaterial({ vertexColors: true })
  const batch = new InstancedMesh(shadeFaces(geometry), material, parts.length)
  const transform = new Object3D()
  const color = new Color()
  parts.forEach((part, index) => {
    transform.position.set(part.x, part.y, part.z)
    transform.rotation.set(part.pitch, 0, part.roll)
    transform.scale.set(part.width, part.height, part.depth)
    transform.updateMatrix()
    batch.setMatrixAt(index, transform.matrix)
    batch.setColorAt(index, color.set(part.color))
  })
  batch.instanceMatrix.needsUpdate = true
  if (batch.instanceColor) batch.instanceColor.needsUpdate = true
  batch.computeBoundingSphere()
  return batch
}

export function createWorkshop(): Group {
  const workshop = new Group()
  workshop.name = 'Fabrication workshop'
  const floor = new Mesh(
    new PlaneGeometry(FLOOR_WIDTH, FLOOR_DEPTH),
    new MeshBasicMaterial({ map: makeFloorTexture() }),
  )
  floor.rotation.x = -quarterTurn
  workshop.add(floor)

  const boxes: Part[] = []
  const cylinders: Part[] = []
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string) => {
    boxes.push({ x, y, z, width: w, height: h, depth: d, color, pitch: 0, roll: 0 })
  }
  const cylinder = (
    x: number, y: number, z: number, diameter: number, length: number,
    color: string, axis: 'x' | 'y' | 'z',
  ) => {
    cylinders.push({
      x, y, z, width: diameter, height: length, depth: diameter, color,
      pitch: axis === 'z' ? quarterTurn : 0,
      roll: axis === 'x' ? quarterTurn : 0,
    })
  }

  const stripe = (x: number, y: number, z: number, length: number, axis: 'x' | 'z') => {
    if (axis === 'x') box(x, y, z, length, 0.08, 0.25, paint.dark)
    else box(x, y, z, 0.25, 0.08, length, paint.dark)
    for (let offset = -length / 2 + 0.20; offset < length / 2 - 0.12; offset += 0.59) {
      box(x + (axis === 'x' ? offset : 0), y + 0.05, z + (axis === 'z' ? offset : 0),
        axis === 'x' ? 0.28 : 0.23, 0.035, axis === 'z' ? 0.28 : 0.23, paint.yellow)
    }
  }

  const crate = (x: number, z: number, size: number, body: string) => {
    const foot = size * 0.12
    const height = size * 0.64
    box(x, foot / 2, z, size + 0.12, foot, size * 0.82, paint.dark)
    box(x, foot + height / 2, z, size, height, size * 0.78, body)
    box(x, foot + height, z, size + 0.10, foot, size * 0.84, paint.shadow)
    box(x, foot + height + .055, z, size * .87, .045, size * .69, body)
    for (const side of [-1, 1]) {
      box(x + side * size * 0.31, foot + height * 0.50, z + size * 0.40,
        size * 0.10, height * 0.83, 0.05, paint.frame)
      box(x + side * size * .32, foot + height + .087, z, size * .09, .042, size * .65, paint.rim)
      box(x + side * size * .31, foot + height * .64, z + size * .43, .05, .065, .026, paint.steel)
    }
    box(x, foot + height * 0.57, z + size * 0.40, size * 0.24, height * 0.19, 0.05, paint.lightSteel)
    box(x, foot + height * .37, z + size * .43, size * .18, .045, .033, paint.oil)
  }

  // Rear steel structure, cable rail and feed conveyor.
  box(0, 0.20, -13.25, 36.5, 0.40, 0.42, paint.shadow)
  box(0, 1.25, -13.46, 36.4, 2.05, 0.36, paint.frame)
  box(0, 2.30, -13.27, 36.3, 0.17, 0.44, paint.steel)
  box(0, 2.04, -13.17, 34.9, 0.09, 0.11, paint.teal)
  for (const x of [-15.5, -9.0, -2.1, 5.0, 11.3, 16.1]) {
    box(x, 1.21, -13.22, 2.28, 1.18, .10, paint.dark)
    box(x, 1.27, -13.14, 2.04, .93, .10, paint.shadow)
    box(x, 1.71, -13.07, 1.86, .065, .10, paint.steel)
    for (let slot = -2; slot <= 2; slot++) box(x + slot * .28, 1.27, -13.06, .12, .40, .06, paint.oil)
  }
  for (const x of [-17.2, -12.0, -5.1, 1.6, 8.3, 14.9, 17.4]) {
    box(x, 1.54, -13.17, 0.28, 3.08, 0.60, paint.dark)
    box(x, 1.55, -12.85, .13, 2.65, .07, paint.rim)
    box(x, 2.92, -13.13, .38, .20, .62, paint.frame)
    box(x, 2.67, -12.86, 0.43, 0.25, 0.16, paint.yellow)
  }
  cylinder(0, 2.48, -13.03, .20, 35.7, paint.copper, 'x')
  cylinder(0, 2.29, -12.77, .13, 35.5, paint.steel, 'x')
  for (const x of [-13.4, -10.4, -5.1, -1.8, 4.4, 8.3, 12.6, 16.2]) {
    cylinder(x, 2.48, -13.03, .30, .15, paint.brass, 'x')
  }

  const feedZ = -11.11
  box(-7.35, 0.18, feedZ, 13.1, 0.36, 2.35, paint.dark)
  box(-7.35, 0.63, feedZ, 12.6, 0.76, 2.12, paint.shadow)
  box(-7.35, 1.02, feedZ, 12.5, 0.22, 1.66, paint.oil)
  for (let x = -13.35; x < -1.25; x += 0.49) {
    cylinder(x, 1.14, feedZ, 0.22, 1.60, paint.rim, 'z')
    cylinder(x, 1.14, feedZ - .64, .26, .085, paint.shadow, 'z')
    cylinder(x, 1.14, feedZ + .66, .26, .085, paint.frame, 'z')
  }
  for (const side of [-1, 1]) {
    box(-7.35, 1.18, feedZ + side * 0.95, 12.75, 0.23, 0.20, paint.steel)
    box(-7.35, 1.34, feedZ + side * 0.95, 12.75, 0.09, 0.12, paint.lightSteel)
  }
  stripe(-7.35, 1.41, feedZ + 0.99, 12.45, 'x')
  for (const x of [-12.65, -8.1, -3.0]) {
    box(x, 0.42, feedZ + 1.05, 0.39, 0.49, 0.22, paint.steel)
    box(x, 0.11, feedZ + 1.11, 0.58, 0.16, 0.45, paint.dark)
  }
  for (const x of [-11.8, -5.6, -2.8]) {
    cylinder(x, 1.34, feedZ + .14, .69, .21, paint.steel, 'y')
    cylinder(x, 1.46, feedZ + .14, .40, .048, paint.rubber, 'y')
    box(x + .24, 1.475, feedZ + .09, .18, .06, .12, paint.copper)
  }
  for (const x of [-10.4, -6.3, -2.9]) {
    box(x, .67, feedZ + 1.06, 1.04, .30, .09, paint.frame)
    box(x, .73, feedZ + 1.12, .84, .065, .063, paint.steel)
  }

  box(-15.0, 0.61, -11.0, 2.20, 1.22, 2.54, paint.teal)
  box(-15.0, 1.33, -11.0, 2.40, 0.24, 2.54, paint.steel)
  box(-15.0, 1.5, -10.33, 1.32, 0.14, 0.47, paint.dark)
  for (const [x, color] of [[-15.42, paint.mint], [-15.0, paint.amber], [-14.58, paint.hot]] as const) {
    box(x, 1.62, -10.33, 0.20, 0.15, 0.22, color)
  }

  // Pressure bench with paired accumulator cylinders and a calibration port.
  box(6.8, 0.17, -11.13, 10.85, 0.34, 3.46, paint.dark)
  box(6.8, 0.55, -11.13, 10.36, 0.49, 2.92, paint.shadow)
  box(7.0, 1.08, -11.12, 9.97, 0.61, 2.69, paint.steel)
  box(7.0, 1.44, -11.10, 10.01, 0.20, 2.79, paint.lightSteel)
  stripe(7.0, 1.57, -9.72, 9.65, 'x')
  for (const x of [3.18, 5.15, 7.12, 9.11, 11.09]) {
    box(x, 1.00, -9.76, 1.49, .38, .10, paint.shadow)
    box(x, 1.12, -9.70, 1.34, .052, .042, paint.rim)
    box(x, .93, -9.71, .29, .08, .09, paint.dark)
    box(x - .56, .95, -9.69, .075, .065, .04, paint.brass)
  }
  box(7.79, 2.08, -11.27, 4.95, 1.12, 1.68, paint.wornTeal)
  box(7.79, 2.72, -11.27, 5.12, 0.22, 1.77, paint.steel)
  box(7.79, 2.86, -11.30, 3.55, .10, 1.25, paint.shadow)
  box(7.79, 2.92, -10.90, 2.96, .06, .12, paint.brass)
  box(7.79, 2.13, -10.35, 4.62, 0.81, 0.18, paint.dark)
  box(7.79, 2.13, -10.26, 4.22, .61, .07, paint.oil)
  cylinder(7.77, 2.14, -10.21, 1.98, 0.22, paint.lightSteel, 'z')
  cylinder(7.77, 2.14, -10.05, 1.63, 0.20, paint.shadow, 'z')
  cylinder(7.77, 2.14, -9.94, 1.33, 0.14, paint.brass, 'z')
  cylinder(7.77, 2.14, -9.85, 1.04, 0.12, paint.oil, 'z')
  cylinder(7.77, 2.14, -9.76, .68, .14, paint.teal, 'z')
  cylinder(7.77, 2.14, -9.68, .36, .12, paint.mint, 'z')
  for (let index = 0; index < 6; index++) {
    const angle = index * Math.PI / 3
    cylinder(7.77 + Math.cos(angle) * .86, 2.14 + Math.sin(angle) * .86,
      -10.06, .13, .16, paint.frame, 'z')
  }
  for (const x of [5.9, 9.7]) {
    box(x, 2.21, -10.19, 0.28, 0.52, 0.13, paint.rim)
    box(x, 2.27, -10.11, 0.14, 0.19, 0.09, paint.amber)
  }

  for (const x of [2.58, 4.0, 11.52, 13.2]) {
    cylinder(x, 1.75, -11.45, 1.09, 1.85, paint.teal, 'y')
    cylinder(x, 0.89, -11.45, 1.22, 0.24, paint.frame, 'y')
    cylinder(x, 2.68, -11.45, 1.21, 0.30, paint.lightSteel, 'y')
    cylinder(x, 1.45, -11.45, 1.14, 0.16, paint.yellow, 'y')
    cylinder(x, 2.29, -11.45, 1.14, .09, paint.steel, 'y')
    cylinder(x, 2.94, -11.45, 0.31, 0.39, paint.amber, 'y')
    box(x, 1.99, -10.91, .31, .31, .045, paint.shadow)
    box(x, 2.03, -10.87, .21, .085, .042, paint.rim)
  }
  cylinder(8.3, 2.98, -11.92, 0.24, 11.3, paint.rim, 'x')
  cylinder(8.3, 3.22, -12.06, 0.15, 11.3, paint.teal, 'x')
  for (const x of [3.2, 5.05, 10.33, 12.87]) cylinder(x, 2.98, -11.92, 0.41, 0.16, paint.yellow, 'x')

  // The same hanging fixtures cast the amber pools baked into the floor.
  for (const x of [-9.0, 7.2]) {
    box(x, 3.07, -12.75, .16, 1.89, .22, paint.shadow)
    box(x, 3.92, -11.85, .17, .17, 1.89, paint.steel)
    box(x, 3.91, -11.04, 2.28, .26, .70, paint.dark)
    box(x, 3.90, -11.06, 2.17, .12, .63, paint.brass)
    box(x, 3.83, -10.73, 1.93, .13, .050, paint.lamp)
    box(x, 3.77, -11.06, 1.92, .08, .45, paint.lamp)
    for (const side of [-1, 1]) {
      box(x + side * .98, 3.94, -10.70, .095, .23, .075, paint.copper)
    }
  }

  // Boundary rails and utility boxes use lower silhouettes near the camera.
  for (const x of [-15.91, 15.91]) {
    box(x, 0.20, -0.30, 0.42, 0.39, 16.98, paint.shadow)
    stripe(x, 0.43, -0.30, 16.40, 'z')
    for (const z of [-7.2, -3.45, 2.1, 6.48]) {
      box(x, 0.50, z, 0.36, 0.95, 0.43, paint.steel)
      box(x, 1.00, z, 0.50, 0.17, 0.49, paint.dark)
      box(x, 1.12, z, 0.30, 0.14, 0.30, z < 0 ? paint.mint : paint.amber)
      box(x, .59, z + .24, .21, .29, .064, paint.oil)
      box(x - .038, .63, z + .28, .073, .065, .042, paint.rim)
      box(x + .051, .63, z + .28, .035, .065, .042, paint.brass)
    }
  }
  crate(-17.14, -5.88, 1.58, paint.teal)
  crate(-17.02, -3.86, 1.30, paint.steel)
  crate(17.12, -5.48, 1.69, paint.teal)
  crate(17.03, 0.12, 1.33, paint.wornTeal)
  crate(-12.7, 10.05, 0.87, paint.teal)
  crate(12.9, 10.17, 0.75, paint.steel)
  box(0, 0.085, 9.77, 26.9, 0.17, 0.26, paint.shadow)
  box(0, 0.19, 9.77, 26.9, 0.055, 0.12, paint.steel)

  // Separate working islands. Their outlines match the footprints used by the simulation.
  for (const { kind, x, z, width: w, depth: d } of STATIONS) {
    box(x, .091, z, w, .18, d, paint.dark)
    box(x, .208, z, w - .16, .092, d - .18, paint.rim)
    for (const end of [-1, 1]) {
      const leg = x + end * (w / 2 - .25)
      box(leg, .46, z, .265, .52, d - .31, paint.frame)
      box(leg, .44, z + d * .37, .116, .29, .069, paint.steel)
      box(leg, .271, z + d * .40, .306, .053, .075, paint.brass)
    }
    if (kind === 'calibration') {
      box(x, .692, z, w - .26, .211, d - .20, paint.teal)
      box(x, .847, z, w - .08, .13, d - .079, paint.lightSteel)
      box(x, .927, z - .035, w - .27, .044, d - .30, paint.steel)
      box(x, .886, z + d * .44, w - .22, .157, .10, paint.shadow)
      for (const dx of [-.73, .15, 1.03]) {
        box(x + dx, .695, z + d * .44, .65, .218, .082, paint.shadow)
        box(x + dx, .723, z + d * .48, .216, .047, .05, paint.rim)
      }
      // Reference block, two jaws, traverse screw and its handwheel.
      box(x - .47, .957, z - .16, 1.41, .066, .63, paint.rubber)
      box(x - .50, 1.029, z - .16, 1.17, .10, .51, paint.rim)
      for (const dx of [-.86, -.13]) {
        box(x + dx, 1.123, z - .16, .167, .212, .49, paint.shadow)
        box(x + dx, 1.227, z - .151, .194, .061, .45, paint.lightSteel)
      }
      cylinder(x - .51, 1.049, z + .119, .121, 1.56, paint.rim, 'x')
      cylinder(x + .29, 1.049, z + .119, .273, .14, paint.copper, 'x')
      box(x - .49, 1.105, z - .17, .326, .146, .316, paint.brass)
      box(x + .98, .996, z + .101, .48, .10, .33, paint.dark)
      box(x + .98, 1.045, z + .101, .332, .041, .22, '#698e82')
      box(x + 1.11, 1.071, z + .101, .05, .015, .15, paint.lamp)
    } else if (kind === 'sampling') {
      box(x, .687, z, w - .13, .184, d - .12, paint.shadow)
      box(x, .801, z, w - .30, .10, d * .72, paint.oil)
      for (let offset = -w / 2 + .29; offset < w / 2 - .23; offset += .27) {
        cylinder(x + offset, .882, z, .152, d * .72, paint.steel, 'z')
        cylinder(x + offset, .882, z + d * .30, .172, .052, paint.frame, 'z')
      }
      box(x, .935, z - d * .43, w - .12, .134, .154, paint.rim)
      box(x, .923, z + d * .43, w - .12, .13, .160, paint.steel)
      stripe(x, .997, z + d * .423, w - .22, 'x')
      for (const dx of [-.61, .43]) {
        cylinder(x + dx, 1.008, z - .039, .43, .128, paint.rim, 'y')
        cylinder(x + dx, 1.076, z - .039, .233, .038, paint.oil, 'y')
        box(x + dx + .153, 1.077, z - .091, .062, .038, .13, paint.copper)
      }
      box(x - w * .38, .587, z + d * .48, .36, .155, .064, paint.rubber)
      box(x - w * .39, .608, z + d * .51, .098, .05, .04, paint.lamp)
    } else {
      box(x, .653, z, w - .17, .091, d - .14, paint.brass)
      for (const dx of [-w * .40, w * .40]) {
        for (const dz of [-d * .40, d * .40]) {
          box(x + dx, .772, z + dz, .141, 1.14, .151, paint.frame)
          box(x + dx, 1.31, z + dz, .175, .128, .19, paint.copper)
        }
      }
      box(x, 1.18, z - d * .39, w * .84, .129, .126, paint.brass)
      for (const dz of [-d * .4, d * .4]) {
        box(x, .73, z + dz, w * .87, .091, .121, paint.yellow)
      }
      crate(x - .48, z - .023, .84, '#4f6869')
      crate(x + .43, z - .037, .88, '#626460')
      box(x - .48, .634, z - .023, .64, .217, .53, '#496062')
      box(x + .43, .654, z - .037, .70, .25, .52, '#5a5650')
      box(x - .48, .766, z - .023, .74, .059, .61, paint.steel)
      box(x + .43, .796, z - .037, .77, .059, .58, paint.brass)
      box(x - .48, .661, z + .253, .168, .065, .036, paint.lightSteel)
      box(x + .43, .685, z + .234, .168, .065, .036, paint.lightSteel)
    }
  }

  workshop.add(
    buildBatch(new BoxGeometry(1, 1, 1), boxes),
    buildBatch(new CylinderGeometry(0.5, 0.5, 1, 10), cylinders),
  )
  return workshop
}
