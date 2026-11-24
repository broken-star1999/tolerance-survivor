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

const FLOOR_WIDTH = 40
const FLOOR_DEPTH = 28
const FLOOR_SCALE = 18
const ARENA_X = 14.2
const ARENA_Z = 8.8
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
  '-': ['000', '000', '111', '000', '000'],
  '0': ['0110', '1001', '1001', '1001', '0110'],
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

  const slabs = ['#2e4449', '#30484d', '#31494e', '#354b4f', '#2f464b']
  ctx.fillStyle = '#23363b'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const tile = 36

  for (let y = 0; y < canvas.height; y += tile) {
    for (let x = 0; x < canvas.width; x += tile) {
      ctx.fillStyle = slabs[Math.floor(random() * slabs.length)]
      ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2)
      ctx.fillStyle = '#3f5356'
      ctx.fillRect(x + 2, y + 1, tile - 4, 1)
      ctx.fillStyle = '#293e44'
      ctx.fillRect(x + 2, y + tile - 3, tile - 4, 1)
      for (let i = 0; i < 6; i++) {
        const ox = x + 3 + Math.floor(random() * (tile - 9))
        const oy = y + 3 + Math.floor(random() * (tile - 7))
        ctx.fillStyle = i % 2 ? '#354b4f' : '#2b4146'
        ctx.fillRect(ox, oy, i === 0 ? 6 : 2, 1)
      }
      if (random() > 0.68) {
        ctx.fillStyle = '#43575a'
        ctx.fillRect(x + 4, y + 4, 2, 2)
        ctx.fillStyle = '#273b40'
        ctx.fillRect(x + 5, y + 5, 1, 1)
      }
    }
  }

  // Recessed equipment pads sit outside the walkable rectangle.
  rect(-19, -13.6, 38, 3.85, '#26383f')
  rect(-18.7, -13.35, 37.4, 0.12, '#3d555b')
  rect(-19, -9.58, 38, 0.24, '#17282f')
  rect(-18.5, 9.52, 37, 0.43, '#24383e')
  rect(-17.7, 9.56, 35.4, 0.15, '#50646a')

  for (const side of [-1, 1]) {
    const x = side === -1 ? -15.2 : 14.72
    rect(x - 0.16, -9.0, 0.82, 18.12, '#263940')
    rect(x, -9.0, 0.43, 18.12, '#1a2d35')
    for (let z = -8.9; z < 9.05; z += 0.43) {
      rect(x + 0.06, z, 0.30, 0.09, '#40575d')
    }
  }

  // A thin, worn caution border makes the playable footprint visible.
  for (const z of [-ARENA_Z - 0.30, ARENA_Z + 0.08]) {
    rect(-ARENA_X - 0.15, z, (ARENA_X + 0.15) * 2, 0.24, '#333c3a')
    for (let x = -ARENA_X; x < ARENA_X; x += 0.74) {
      rect(x, z + 0.03, 0.36, 0.15, '#a28456')
      rect(x + 0.36, z + 0.06, 0.11, 0.10, '#78664d')
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

  const bayColor = '#486165'
  for (const side of [-1, 1]) {
    for (const z of [-4.22, 1.96]) {
      const x = side * 3.37
      rect(x - (side === 1 ? 0.94 : 0), z, 0.98, 0.11, bayColor)
      rect(x, z - (z > 0 ? 0.81 : 0), 0.10, 0.88, bayColor)
    }
  }
  const size = 3
  let stencilX = worldX(10.58)
  const stencilZ = worldZ(5.86)
  ctx.fillStyle = '#72807a'
  for (const character of 'A-04') {
    const rows = stencil[character]
    rows.forEach((row, ri) => {
      for (let ci = 0; ci < row.length; ci++) {
        if (row[ci] === '1') ctx.fillRect(stencilX + ci * size, stencilZ + ri * size, size, size)
      }
    })
    stencilX += (rows[0].length + 2) * size
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
    const value = y > 0.75 ? 1.14 : y < -0.75 ? 0.64 : 0.82 + 0.12 * z - 0.08 * x
    colors[i * 3] = value
    colors[i * 3 + 1] = value
    colors[i * 3 + 2] = value
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
    box(x, foot + height, z, size + 0.10, foot, size * 0.84, paint.rim)
    for (const side of [-1, 1]) {
      box(x + side * size * 0.31, foot + height * 0.50, z + size * 0.40,
        size * 0.10, height * 0.83, 0.05, paint.frame)
    }
    box(x, foot + height * 0.57, z + size * 0.40, size * 0.24, height * 0.19, 0.05, paint.lightSteel)
  }

  // Rear steel structure, cable rail and feed conveyor.
  box(0, 0.20, -13.25, 36.5, 0.40, 0.42, paint.shadow)
  box(0, 1.25, -13.46, 36.4, 2.05, 0.36, paint.frame)
  box(0, 2.30, -13.27, 36.3, 0.17, 0.44, paint.steel)
  box(0, 2.04, -13.17, 34.9, 0.09, 0.11, paint.teal)
  for (const x of [-17.2, -12.0, -5.1, 1.6, 8.3, 14.9, 17.4]) {
    box(x, 1.54, -13.17, 0.28, 3.08, 0.60, paint.dark)
    box(x, 2.67, -12.86, 0.43, 0.25, 0.16, paint.yellow)
  }

  const feedZ = -11.11
  box(-7.35, 0.18, feedZ, 13.1, 0.36, 2.35, paint.dark)
  box(-7.35, 0.63, feedZ, 12.6, 0.76, 2.12, paint.shadow)
  box(-7.35, 1.02, feedZ, 12.5, 0.22, 1.66, paint.oil)
  for (let x = -13.35; x < -1.25; x += 0.49) {
    cylinder(x, 1.14, feedZ, 0.22, 1.60, paint.rim, 'z')
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
  box(7.79, 2.08, -11.27, 4.95, 1.12, 1.68, paint.wornTeal)
  box(7.79, 2.72, -11.27, 5.12, 0.22, 1.77, paint.steel)
  box(7.79, 2.13, -10.35, 4.62, 0.81, 0.18, paint.dark)
  cylinder(7.77, 2.14, -10.21, 1.98, 0.22, paint.lightSteel, 'z')
  cylinder(7.77, 2.14, -10.05, 1.63, 0.20, paint.shadow, 'z')
  cylinder(7.77, 2.14, -9.94, 1.27, 0.14, paint.yellow, 'z')
  cylinder(7.77, 2.14, -9.86, 0.94, 0.12, paint.oil, 'z')
  cylinder(7.77, 2.14, -9.79, 0.37, 0.12, paint.mint, 'z')
  for (const x of [5.9, 9.7]) {
    box(x, 2.21, -10.19, 0.28, 0.52, 0.13, paint.rim)
    box(x, 2.27, -10.11, 0.14, 0.19, 0.09, paint.amber)
  }

  for (const x of [2.58, 4.0, 11.52, 13.2]) {
    cylinder(x, 1.75, -11.45, 1.09, 1.85, paint.teal, 'y')
    cylinder(x, 0.89, -11.45, 1.22, 0.24, paint.frame, 'y')
    cylinder(x, 2.68, -11.45, 1.21, 0.30, paint.lightSteel, 'y')
    cylinder(x, 1.45, -11.45, 1.14, 0.16, paint.yellow, 'y')
    cylinder(x, 2.94, -11.45, 0.31, 0.39, paint.amber, 'y')
  }
  cylinder(8.3, 2.98, -11.92, 0.24, 11.3, paint.rim, 'x')
  cylinder(8.3, 3.22, -12.06, 0.15, 11.3, paint.teal, 'x')
  for (const x of [3.2, 5.05, 10.33, 12.87]) cylinder(x, 2.98, -11.92, 0.41, 0.16, paint.yellow, 'x')

  // Boundary rails and utility boxes use lower silhouettes near the camera.
  for (const x of [-15.91, 15.91]) {
    box(x, 0.20, -0.30, 0.42, 0.39, 16.98, paint.shadow)
    stripe(x, 0.43, -0.30, 16.40, 'z')
    for (const z of [-7.2, -3.45, 2.1, 6.48]) {
      box(x, 0.50, z, 0.36, 0.95, 0.43, paint.steel)
      box(x, 1.00, z, 0.50, 0.17, 0.49, paint.dark)
      box(x, 1.12, z, 0.30, 0.14, 0.30, z < 0 ? paint.mint : paint.amber)
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

  workshop.add(
    buildBatch(new BoxGeometry(1, 1, 1), boxes),
    buildBatch(new CylinderGeometry(0.5, 0.5, 1, 10), cylinders),
  )
  return workshop
}
