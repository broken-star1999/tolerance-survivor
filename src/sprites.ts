export type SpriteName =
  | 'engineer' | 'engineer-step' | 'blank' | 'bolt' | 'phantom' | 'boss'
  | 'xp' | 'pass' | 'beautifier' | 'spark' | 'projectile'
  | 'caliper' | 'guard' | 'range' | 'boot' | 'magnet' | 'pulse'
  | 'wrench' | 'file' | 'saw' | 'tape' | 'mallet'

export interface SpriteFrame {
  x: number
  y: number
  width: number
  height: number
}

type Point = readonly [x: number, y: number]

interface PixelPainter {
  block(color: string, x: number, y: number, width: number, height: number): void
  patch(color: string, points: readonly Point[]): void
}

interface SpriteDesign {
  width: number
  height: number
  draw(painter: PixelPainter): void
}

const ink = '#101b25'
const slate = '#233844'
const steelShade = '#3c5361'
const steel = '#78929a'
const silver = '#adcbc6'
const white = '#e9f1cb'
const deepTeal = '#185659'
const teal = '#3a8d83'
const mint = '#81d6ac'
const gold = '#edb744'
const paleGold = '#fcdf82'
const amber = '#bc783b'
const rust = '#9d4b36'
const ember = '#ef7144'
const plum = '#542f51'
const magenta = '#bd587f'
const pink = '#f591a8'

function painterFor(context: CanvasRenderingContext2D): PixelPainter {
  return {
    block(color, x, y, width, height) {
      context.fillStyle = color
      context.fillRect(x, y, width, height)
    },
    patch(color, points) {
      const rows = points.map(([, y]) => y)
      const top = Math.min(...rows)
      const bottom = Math.max(...rows)
      context.fillStyle = color

      for (let y = top; y < bottom; y++) {
        const center = y + 0.5
        const cuts: number[] = []

        for (let index = 0; index < points.length; index++) {
          const [ax, ay] = points[index]
          const [bx, by] = points[(index + 1) % points.length]
          if ((ay > center) === (by > center)) continue
          cuts.push(ax + (center - ay) * (bx - ax) / (by - ay))
        }

        cuts.sort((left, right) => left - right)
        for (let index = 0; index + 1 < cuts.length; index += 2) {
          const x = Math.ceil(cuts[index] - 0.5)
          const right = Math.ceil(cuts[index + 1] - 0.5)
          if (right > x) context.fillRect(x, y, right - x, 1)
        }
      }
    },
  }
}

function octagon(x: number, y: number, width: number, height: number, clip: number): Point[] {
  return [
    [x + clip, y], [x + width - clip, y], [x + width, y + clip],
    [x + width, y + height - clip], [x + width - clip, y + height], [x + clip, y + height],
    [x, y + height - clip], [x, y + clip],
  ]
}

function drawEngineer({ block, patch }: PixelPainter, stepping: boolean): void {
  // The work boots change silhouette without moving the helmet or tool.
  if (stepping) {
    patch(ink, [[6, 23], [14, 23], [14, 27], [9, 30], [3, 30], [3, 27]])
    block(deepTeal, 6, 25, 6, 2)
    block(steelShade, 4, 28, 5, 1)
    patch(ink, [[13, 23], [17, 23], [19, 27], [22, 28], [22, 31], [15, 31], [13, 27]])
    block(teal, 15, 25, 3, 3)
    block(steel, 17, 29, 4, 1)
  } else {
    patch(ink, [[6, 23], [17, 23], [18, 27], [21, 28], [21, 31], [13, 31], [13, 28], [11, 28], [11, 31], [4, 31], [4, 28], [6, 27]])
    block(deepTeal, 7, 25, 3, 3)
    block(teal, 14, 25, 3, 3)
    block(steelShade, 5, 29, 5, 1)
    block(steel, 15, 29, 5, 1)
  }

  patch(ink, [[8, 13], [15, 13], [18, 16], [19, 22], [16, 26], [6, 25], [3, 22], [3, 18], [5, 15]])
  patch(deepTeal, [[8, 15], [14, 15], [17, 17], [17, 22], [15, 25], [7, 24], [5, 22], [5, 18]])
  patch(teal, [[8, 15], [12, 16], [13, 20], [11, 24], [7, 23], [6, 19]])
  block(mint, 6, 17, 3, 2)
  block(amber, 9, 21, 7, 2)
  block(paleGold, 11, 21, 3, 1)
  block(slate, 10, 23, 5, 2)
  block(silver, 8, 19, 2, 1)

  patch(ink, [[7, 8], [18, 8], [20, 11], [20, 15], [16, 17], [9, 16], [7, 13]])
  patch('#a96854', [[9, 10], [17, 10], [19, 13], [17, 15], [11, 15], [9, 13]])
  patch('#eab285', [[11, 10], [18, 10], [19, 13], [16, 14], [12, 13]])
  block('#f4ce9b', 16, 12, 3, 1)
  block(ink, 16, 11, 2, 1)

  patch(ink, [[4, 8], [4, 5], [7, 2], [14, 1], [18, 3], [20, 7], [24, 8], [24, 11], [4, 11], [2, 10], [2, 9]])
  patch(gold, [[5, 8], [6, 5], [8, 3], [14, 2], [17, 4], [19, 8], [22, 8], [23, 9], [4, 10], [3, 9]])
  block(paleGold, 8, 4, 6, 2)
  block(white, 9, 4, 3, 1)
  block(amber, 13, 7, 6, 2)
  block(gold, 5, 8, 8, 2)
  block(paleGold, 6, 8, 5, 1)
  block(amber, 19, 9, 4, 1)

  patch(ink, [[15, 16], [18, 16], [20, 18], [21, 19], [24, 19], [25, 21], [23, 24], [16, 25], [13, 22]])
  patch(teal, [[15, 17], [17, 17], [19, 19], [18, 22], [15, 23], [14, 21]])
  block('#eab285', 18, 19, 4, 3)
  block(steelShade, 19, 21, 5, 2)
  block(silver, 20, 18, 5, 1)
  block(silver, 23, 16, 2, 3)
  block(silver, 23, 21, 2, 2)
  block(paleGold, 20, 19, 2, 1)
  block(white, 23, 18, 2, 1)
}

function drawBlank({ block, patch }: PixelPainter): void {
  patch(ink, [[7, 4], [18, 3], [22, 4], [24, 8], [27, 11], [26, 16], [21, 20], [8, 21], [2, 17], [1, 12], [3, 8]])
  patch(steelShade, [[4, 10], [8, 7], [19, 6], [24, 8], [26, 12], [25, 15], [21, 18], [9, 19], [4, 16], [2, 13]])
  patch(steel, [[7, 5], [18, 4], [21, 5], [21, 7], [24, 8], [25, 11], [20, 15], [8, 16], [3, 13], [3, 10]])
  patch(silver, [[8, 6], [17, 5], [19, 6], [17, 8], [9, 8], [6, 10], [4, 10]])
  patch(slate, [[9, 9], [16, 8], [20, 10], [17, 13], [10, 14], [7, 12]])
  patch(ink, [[11, 9], [16, 9], [18, 10], [17, 12], [11, 13], [9, 12]])
  patch(silver, [[9, 14], [17, 13], [21, 11], [23, 12], [20, 15], [10, 16]])
  patch(ember, [[19, 4], [21, 5], [21, 7], [24, 8], [23, 10], [20, 8], [18, 6]])
  block(white, 8, 6, 4, 1)
  block(gold, 5, 14, 3, 1)
  block(slate, 11, 17, 6, 2)
  block(steel, 20, 16, 2, 1)
  block(deepTeal, 8, 19, 9, 1)
}

function drawBolt({ block, patch }: PixelPainter): void {
  patch(ink, [[6, 5], [15, 2], [21, 5], [24, 10], [21, 15], [18, 16], [17, 19], [18, 21], [15, 24], [16, 26], [12, 30], [8, 30], [5, 26], [6, 20], [8, 15], [4, 13], [2, 9]])
  patch(rust, [[10, 13], [18, 13], [16, 19], [16, 22], [14, 24], [14, 27], [11, 29], [7, 27], [7, 22]])
  patch('#b97144', [[9, 17], [15, 16], [16, 18], [9, 21], [8, 20]])
  patch('#bd7445', [[7, 23], [15, 21], [16, 23], [8, 25]])
  patch(amber, [[8, 27], [14, 25], [14, 27], [10, 29]])
  patch('#b2653a', [[6, 6], [15, 3], [20, 6], [22, 10], [20, 13], [15, 15], [6, 12], [4, 9]])
  patch(gold, [[7, 7], [14, 4], [19, 6], [17, 9], [8, 11], [5, 9]])
  patch(rust, [[8, 11], [17, 9], [21, 10], [19, 13], [15, 14], [8, 12]])
  patch('#594039', [[9, 7], [14, 5], [17, 7], [15, 9], [10, 10], [7, 9]])
  block(ember, 6, 12, 3, 1)
  block(paleGold, 16, 6, 3, 1)
  block(ink, 11, 18, 3, 1)
  block(ember, 13, 15, 2, 1)
  block(slate, 9, 25, 2, 1)
}

function drawPhantom({ block, patch }: PixelPainter): void {
  patch(ink, [[6, 2], [18, 2], [22, 6], [23, 20], [20, 24], [5, 24], [1, 20], [2, 7]])
  patch(plum, [[6, 4], [18, 3], [21, 7], [22, 19], [19, 22], [6, 22], [3, 19], [4, 8]])
  patch(slate, [[7, 6], [18, 5], [20, 8], [20, 18], [18, 20], [6, 19], [5, 17], [5, 9]])
  block(magenta, 6, 5, 11, 1)
  block(pink, 7, 5, 4, 1)
  block(magenta, 3, 8, 2, 7)
  block(magenta, 19, 17, 3, 2)
  block(pink, 20, 17, 1, 1)
  block(steelShade, 7, 9, 2, 8)
  block(steelShade, 8, 17, 10, 1)
  patch(pink, [[8, 15], [11, 12], [13, 13], [16, 9], [19, 9], [16, 12], [14, 16], [11, 14], [9, 17]])
  block(white, 16, 9, 2, 1)
  block(mint, 9, 19, 3, 1)
  block(ink, 3, 22, 4, 2)
  block(magenta, 1, 21, 4, 2)
  block(pink, 19, 23, 4, 1)
  block(plum, 7, 25, 4, 2)
  block(magenta, 8, 25, 2, 1)
  block(plum, 15, 27, 3, 1)
  block(pink, 22, 10, 2, 1)
}

function drawBoss({ block, patch }: PixelPainter): void {
  patch(ink, [[5, 31], [13, 28], [19, 34], [29, 34], [35, 28], [43, 31], [47, 39], [46, 46], [31, 47], [26, 43], [20, 43], [16, 47], [2, 46], [1, 42]])
  patch(steelShade, [[7, 33], [13, 31], [16, 35], [16, 41], [12, 45], [4, 44], [3, 41]])
  patch(slate, [[35, 31], [41, 33], [45, 39], [44, 44], [33, 45], [30, 40], [31, 35]])
  patch(deepTeal, [[7, 35], [13, 33], [13, 39], [10, 44], [5, 43]])
  patch(deepTeal, [[36, 33], [41, 35], [43, 40], [42, 43], [35, 44], [33, 39]])
  block(silver, 5, 40, 5, 1)
  block(steel, 38, 40, 5, 1)
  block(gold, 7, 43, 5, 1)
  block(amber, 36, 43, 5, 1)

  patch(ink, [[9, 10], [13, 6], [35, 6], [39, 10], [45, 13], [46, 33], [42, 39], [31, 41], [16, 41], [5, 38], [2, 33], [3, 14]])
  patch(slate, [[10, 11], [15, 8], [33, 8], [38, 11], [43, 15], [44, 32], [41, 37], [31, 40], [16, 40], [7, 37], [4, 32], [5, 15]])
  patch(steelShade, [[13, 9], [33, 8], [40, 12], [35, 15], [14, 15], [8, 13]])
  block(steel, 15, 9, 15, 1)
  block(deepTeal, 6, 17, 7, 15)
  block(deepTeal, 35, 17, 7, 15)
  block(teal, 7, 19, 3, 10)
  block(teal, 38, 18, 3, 10)
  block(mint, 7, 21, 1, 5)
  block(amber, 39, 20, 1, 6)
  for (let mark = 0; mark < 3; mark++) {
    block(gold, 6 + mark * 2, 32 + mark, 2, 2)
    block(amber, 37 + mark * 2, 34 - mark, 2, 2)
  }

  block(ink, 8, 5, 6, 8)
  block(rust, 9, 3, 4, 7)
  block(ember, 10, 4, 2, 4)
  block(paleGold, 10, 5, 1, 2)
  block(ink, 34, 5, 7, 8)
  block(rust, 35, 2, 5, 8)
  block(ember, 36, 3, 3, 5)
  block(paleGold, 37, 4, 1, 2)
  block(deepTeal, 18, 5, 12, 2)
  block(mint, 21, 5, 6, 1)

  patch(ink, octagon(9, 10, 30, 29, 7))
  patch(steel, octagon(11, 11, 26, 26, 6))
  patch(silver, [[16, 12], [30, 12], [34, 16], [32, 17], [28, 15], [17, 15], [13, 19], [12, 17]])
  patch(steelShade, [[36, 18], [36, 29], [31, 36], [18, 36], [14, 33], [17, 32], [30, 33], [33, 29], [33, 20]])
  patch(ink, octagon(14, 14, 20, 20, 5))
  patch(rust, octagon(16, 16, 16, 16, 4))
  patch(ember, [[20, 17], [28, 17], [31, 21], [28, 23], [25, 20], [21, 21], [18, 24], [17, 22]])
  patch(gold, [[25, 19], [29, 22], [29, 26], [26, 29], [22, 28], [20, 26], [22, 24], [25, 25], [26, 23]])
  patch(ink, octagon(21, 21, 6, 6, 2))
  block(paleGold, 23, 22, 2, 3)
  block(white, 23, 22, 1, 1)
  block(ember, 31, 15, 2, 2)
  block(ember, 16, 31, 2, 2)
  block(mint, 23, 37, 3, 1)
  block(paleGold, 12, 22, 1, 2)
  block(gold, 35, 25, 1, 2)
}

function drawCaliper({ block, patch }: PixelPainter): void {
  patch(ink, [[2, 8], [6, 5], [7, 2], [15, 2], [15, 5], [11, 6], [11, 9], [20, 9], [22, 12], [20, 15], [12, 15], [12, 18], [17, 18], [17, 21], [9, 21], [6, 18], [6, 15], [2, 14]])
  patch(steelShade, [[4, 9], [8, 6], [8, 3], [14, 3], [14, 4], [10, 6], [10, 10], [20, 10], [21, 12], [19, 14], [11, 14], [11, 19], [16, 19], [16, 20], [9, 20], [7, 17], [7, 14], [4, 13]])
  block(silver, 8, 4, 4, 1)
  block(silver, 8, 5, 2, 5)
  block(silver, 8, 14, 2, 4)
  block(mint, 7, 10, 11, 3)
  block(white, 7, 10, 11, 1)
  block(slate, 6, 10, 1, 3)
  block(slate, 11, 11, 1, 2)
  block(slate, 14, 11, 1, 2)
  block(slate, 17, 11, 1, 2)
  block(gold, 3, 10, 3, 3)
  block(paleGold, 3, 10, 2, 1)
}

const designs: Record<SpriteName, SpriteDesign> = {
  engineer: { width: 27, height: 32, draw: (painter) => drawEngineer(painter, false) },
  'engineer-step': { width: 27, height: 32, draw: (painter) => drawEngineer(painter, true) },
  blank: { width: 29, height: 23, draw: drawBlank },
  bolt: { width: 26, height: 32, draw: drawBolt },
  phantom: { width: 25, height: 30, draw: drawPhantom },
  boss: { width: 48, height: 48, draw: drawBoss },
  xp: {
    width: 11,
    height: 13,
    draw({ block, patch }) {
      patch(ink, [[5, 1], [10, 5], [7, 11], [4, 12], [1, 7], [2, 4]])
      patch(teal, [[5, 2], [9, 5], [6, 10], [4, 11], [2, 7], [3, 4]])
      patch(mint, [[5, 2], [8, 5], [5, 8], [3, 6]])
      block(white, 5, 4, 1, 2)
    },
  },
  pass: {
    width: 25,
    height: 23,
    draw({ block, patch }) {
      patch(ink, [[3, 4], [10, 2], [21, 3], [23, 6], [23, 17], [21, 21], [4, 21], [1, 18], [1, 7]])
      patch(amber, [[4, 5], [10, 3], [20, 4], [22, 7], [22, 17], [20, 20], [5, 20], [3, 18], [3, 7]])
      block(gold, 4, 7, 17, 10)
      block(paleGold, 5, 7, 15, 2)
      block(ink, 11, 4, 4, 2)
      block(rust, 5, 17, 15, 2)
      patch(deepTeal, [[7, 12], [9, 10], [11, 12], [16, 8], [18, 10], [11, 16]])
      block(white, 16, 10, 1, 1)
    },
  },
  beautifier: {
    width: 25,
    height: 23,
    draw({ block, patch }) {
      patch(ink, [[4, 2], [20, 2], [23, 5], [23, 17], [20, 21], [4, 21], [1, 17], [1, 5]])
      patch(plum, [[5, 3], [20, 3], [22, 5], [22, 16], [19, 20], [5, 20], [2, 16], [2, 6]])
      block(slate, 4, 6, 17, 10)
      block(magenta, 5, 4, 13, 1)
      block(magenta, 6, 7, 1, 6)
      block(magenta, 7, 13, 12, 1)
      patch(pink, [[8, 12], [12, 8], [14, 9], [18, 6], [19, 7], [14, 12], [12, 11], [9, 13]])
      block(gold, 14, 17, 6, 2)
      block(paleGold, 15, 17, 3, 1)
      block(white, 19, 6, 1, 2)
      block(white, 18, 7, 3, 1)
      block(mint, 5, 17, 3, 1)
    },
  },
  spark: {
    width: 15,
    height: 15,
    draw({ block, patch }) {
      patch(teal, [[7, 1], [9, 5], [13, 7], [9, 9], [7, 14], [5, 9], [1, 7], [5, 5]])
      patch(mint, [[7, 3], [8, 6], [11, 7], [8, 8], [7, 11], [6, 8], [3, 7], [6, 6]])
      block(white, 6, 6, 3, 3)
    },
  },
  projectile: {
    width: 13,
    height: 13,
    draw({ block, patch }) {
      patch(plum, [[5, 1], [9, 1], [12, 5], [11, 9], [7, 12], [3, 11], [1, 8], [2, 4]])
      patch(ember, [[5, 2], [9, 2], [11, 5], [9, 9], [6, 11], [3, 9], [2, 6]])
      patch(gold, [[6, 3], [9, 4], [9, 7], [6, 9], [4, 7], [4, 5]])
      block(white, 6, 4, 2, 2)
    },
  },
  caliper: { width: 23, height: 23, draw: drawCaliper },
  guard: {
    width: 23,
    height: 23,
    draw({ block, patch }) {
      patch(ink, [[11, 1], [21, 5], [20, 15], [17, 19], [11, 22], [6, 19], [3, 15], [2, 5]])
      patch(deepTeal, [[11, 3], [19, 6], [18, 15], [15, 18], [11, 20], [6, 17], [5, 14], [4, 6]])
      patch(teal, [[11, 4], [17, 7], [16, 14], [11, 19], [7, 16], [6, 13], [5, 7]])
      patch(gold, [[11, 5], [16, 7], [14, 9], [10, 7], [7, 9], [6, 8]])
      block(paleGold, 10, 9, 3, 7)
      block(paleGold, 8, 11, 7, 3)
      block(white, 10, 11, 2, 2)
    },
  },
  range: {
    width: 23,
    height: 23,
    draw({ block, patch }) {
      patch(ink, octagon(2, 2, 19, 19, 3))
      block(deepTeal, 4, 4, 15, 15)
      block(teal, 4, 4, 5, 2)
      block(teal, 15, 17, 4, 2)
      block(silver, 6, 6, 2, 11)
      block(silver, 15, 6, 2, 11)
      block(mint, 7, 6, 3, 2)
      block(mint, 13, 15, 3, 2)
      patch(paleGold, [[7, 11], [10, 8], [10, 10], [13, 10], [13, 8], [16, 11], [13, 14], [13, 12], [10, 12], [10, 14]])
      block(white, 10, 10, 3, 1)
    },
  },
  boot: {
    width: 23,
    height: 23,
    draw({ block, patch }) {
      patch(ink, [[5, 2], [13, 2], [15, 10], [19, 12], [22, 16], [21, 20], [3, 20], [1, 17], [2, 12], [4, 9]])
      patch(deepTeal, [[6, 4], [12, 4], [14, 11], [18, 13], [20, 16], [19, 18], [4, 18], [3, 16], [4, 12]])
      patch(teal, [[6, 5], [11, 5], [12, 12], [9, 15], [4, 16], [5, 11]])
      block(steel, 5, 6, 7, 2)
      block(mint, 6, 6, 5, 1)
      block(paleGold, 10, 10, 4, 1)
      block(paleGold, 11, 12, 4, 1)
      block(gold, 16, 15, 4, 2)
      block(silver, 4, 18, 16, 1)
    },
  },
  magnet: {
    width: 23,
    height: 23,
    draw({ block, patch }) {
      patch(ink, [[2, 3], [9, 3], [9, 12], [11, 14], [13, 12], [13, 3], [21, 3], [21, 13], [18, 18], [13, 21], [8, 21], [3, 18], [1, 14]])
      patch(rust, [[3, 5], [7, 5], [7, 13], [10, 16], [13, 16], [15, 13], [15, 5], [19, 5], [19, 13], [17, 17], [13, 19], [9, 19], [4, 17], [3, 14]])
      block(ember, 3, 8, 4, 6)
      block(gold, 15, 8, 4, 6)
      block(silver, 3, 5, 4, 3)
      block(silver, 15, 5, 4, 3)
      block(white, 3, 5, 3, 1)
      block(white, 15, 5, 3, 1)
      block(paleGold, 9, 17, 4, 1)
    },
  },
  pulse: {
    width: 23,
    height: 23,
    draw({ block, patch }) {
      patch(ink, octagon(1, 1, 21, 21, 6))
      patch(deepTeal, octagon(3, 3, 17, 17, 5))
      patch(teal, [[7, 4], [14, 4], [17, 7], [15, 8], [13, 6], [8, 6], [5, 9], [4, 8]])
      patch(paleGold, [[10, 5], [15, 5], [12, 10], [16, 10], [8, 18], [10, 12], [7, 12]])
      block(white, 10, 6, 2, 3)
      block(mint, 4, 14, 3, 1)
      block(mint, 16, 7, 3, 1)
    },
  },
  wrench: {
    width: 25,
    height: 25,
    draw({ block, patch }) {
      patch(ink, [[1, 21], [3, 17], [12, 9], [11, 7], [12, 4], [16, 1], [20, 1], [16, 5], [17, 8], [20, 8], [23, 4], [24, 8], [22, 12], [18, 14], [15, 13], [7, 23], [4, 24]])
      patch(steelShade, [[2, 21], [4, 18], [13, 10], [12, 7], [13, 5], [16, 2], [18, 2], [15, 5], [16, 9], [20, 10], [23, 7], [22, 11], [18, 13], [15, 12], [7, 22], [4, 23]])
      patch(silver, [[3, 20], [5, 18], [14, 10], [13, 7], [14, 5], [17, 3], [15, 6], [16, 10], [21, 11], [18, 12], [15, 11], [6, 22], [4, 22]])
      patch(white, [[5, 18], [13, 11], [14, 11], [14, 12], [6, 19]])
      block(steelShade, 4, 20, 2, 2)
      block(mint, 7, 17, 2, 1)
      block(paleGold, 15, 10, 2, 1)
    },
  },
  file: {
    width: 25,
    height: 25,
    draw({ block, patch }) {
      patch(ink, [[19, 1], [23, 2], [24, 5], [22, 8], [12, 16], [9, 17], [9, 20], [5, 24], [2, 24], [1, 21], [3, 18], [7, 15], [8, 13], [17, 3]])
      patch(steelShade, [[19, 2], [22, 3], [23, 5], [21, 7], [11, 16], [9, 16], [8, 14], [17, 4]])
      patch(steel, [[19, 3], [21, 3], [22, 5], [20, 7], [10, 15], [9, 14], [17, 5]])
      patch(silver, [[10, 13], [18, 4], [21, 3], [21, 4], [12, 13]])
      for (let row = 0; row < 6; row++) {
        block(slate, 11 + row * 2, 13 - row * 2, 2, 1)
        block(silver, 12 + row * 2, 14 - row * 2, 2, 1)
      }
      patch(rust, [[7, 16], [9, 18], [7, 21], [4, 23], [2, 22], [3, 20]])
      patch(amber, [[7, 17], [8, 18], [5, 21], [3, 22], [3, 21]])
      block(paleGold, 7, 16, 2, 1)
    },
  },
  saw: {
    width: 26,
    height: 23,
    draw({ block, patch }) {
      patch(ink, [[1, 9], [4, 6], [8, 7], [11, 9], [23, 3], [25, 4], [25, 8], [22, 10], [22, 12], [19, 12], [18, 15], [16, 14], [15, 17], [13, 16], [12, 18], [10, 18], [8, 21], [3, 21], [1, 18]])
      patch(steelShade, [[8, 11], [24, 4], [24, 8], [21, 9], [21, 11], [19, 11], [17, 14], [16, 13], [14, 16], [13, 15], [11, 17], [9, 17]])
      patch(silver, [[9, 11], [23, 5], [24, 6], [23, 8], [10, 15]])
      patch(white, [[10, 11], [22, 6], [22, 7], [11, 12]])
      patch(steel, [[12, 14], [19, 10], [20, 10], [17, 12], [15, 14], [13, 15]])
      patch(rust, [[2, 10], [4, 8], [7, 8], [10, 11], [10, 16], [8, 19], [4, 20], [2, 18]])
      patch(amber, [[3, 10], [5, 9], [8, 10], [9, 12], [8, 17], [6, 18], [4, 18], [3, 16]])
      patch(ink, [[5, 11], [8, 12], [7, 16], [5, 17], [4, 15]])
      block(paleGold, 4, 9, 3, 1)
      block(gold, 3, 16, 1, 2)
    },
  },
  tape: {
    width: 25,
    height: 24,
    draw({ block, patch }) {
      patch(ink, [[5, 3], [13, 3], [16, 5], [18, 9], [18, 14], [22, 14], [24, 16], [24, 20], [20, 21], [15, 20], [3, 20], [1, 17], [1, 9], [2, 6]])
      patch(amber, [[5, 4], [13, 4], [16, 7], [17, 11], [17, 16], [15, 19], [4, 19], [2, 17], [2, 10], [3, 7]])
      patch(gold, [[5, 5], [12, 5], [15, 7], [16, 10], [15, 16], [11, 17], [4, 16], [3, 12], [4, 8]])
      block(paleGold, 6, 6, 7, 2)
      block(white, 7, 6, 3, 1)
      block(slate, 5, 10, 7, 5)
      block(teal, 6, 11, 5, 3)
      block(mint, 7, 11, 3, 1)
      block(steelShade, 4, 17, 10, 2)
      patch(paleGold, [[13, 15], [21, 15], [23, 16], [23, 19], [20, 20], [14, 18]])
      block(gold, 15, 17, 7, 1)
      block(steelShade, 17, 15, 1, 2)
      block(steelShade, 20, 15, 1, 2)
      block(steel, 22, 17, 2, 3)
    },
  },
  mallet: {
    width: 25,
    height: 25,
    draw({ block, patch }) {
      patch(ink, [[9, 10], [15, 12], [13, 17], [12, 23], [10, 24], [6, 24], [5, 21], [6, 18]])
      patch(amber, [[10, 11], [14, 13], [12, 18], [11, 22], [9, 23], [7, 22], [7, 19]])
      patch(paleGold, [[10, 12], [12, 13], [10, 17], [9, 21], [8, 21], [8, 19]])
      block(rust, 7, 21, 4, 2)
      patch(ink, [[1, 6], [5, 3], [11, 2], [20, 4], [24, 7], [24, 12], [21, 15], [13, 14], [5, 13], [1, 11]])
      patch(slate, [[2, 7], [6, 4], [12, 3], [20, 5], [23, 7], [23, 11], [20, 14], [13, 13], [6, 12], [2, 10]])
      patch(steelShade, [[5, 5], [11, 4], [19, 6], [21, 7], [15, 8], [7, 7]])
      block(steel, 7, 5, 5, 1)
      patch(deepTeal, [[12, 5], [16, 6], [17, 12], [13, 12], [11, 10]])
      block(teal, 12, 6, 4, 2)
      block(mint, 13, 6, 2, 1)
      block(steel, 21, 8, 2, 4)
      block(silver, 21, 8, 1, 2)
      block(steelShade, 3, 8, 2, 3)
    },
  },
}

export function createSpriteAtlas(): {
  canvas: HTMLCanvasElement
  frames: Record<SpriteName, SpriteFrame>
} {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas is unavailable for the sprite atlas')

  const gutter = 2
  const painter = painterFor(context)
  const frames = {} as Record<SpriteName, SpriteFrame>
  let x = gutter
  let y = gutter
  let rowHeight = 0

  for (const name of Object.keys(designs) as SpriteName[]) {
    const { width, height, draw } = designs[name]
    if (x + width + gutter > canvas.width) {
      x = gutter
      y += rowHeight + gutter * 2
      rowHeight = 0
    }
    if (y + height + gutter > canvas.height) throw new Error('Sprite atlas is full')

    frames[name] = { x, y, width, height }
    context.save()
    context.translate(x, y)
    draw(painter)
    context.restore()
    x += width + gutter * 2
    rowHeight = Math.max(rowHeight, height)
  }

  return { canvas, frames }
}
