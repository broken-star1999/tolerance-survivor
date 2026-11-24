export type SpriteName =
  | 'engineer' | 'engineer-stride-a' | 'engineer-stride-b'
  | 'engineer-front' | 'engineer-front-a' | 'engineer-front-b'
  | 'engineer-back' | 'engineer-back-a' | 'engineer-back-b' | 'held-caliper'
  | 'blank' | 'bolt' | 'phantom' | 'boss' | 'boss-charged'
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
const darkGlass = '#162d3b'
const iceGlint = '#b0e2e5'

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

type EngineerView = 'front' | 'side' | 'back'
type Stride = -1 | 0 | 1

function drawEngineer({ block, patch }: PixelPainter, view: EngineerView, stride: Stride): void {
  const back = view === 'back'
  const side = view === 'side'
  const suitShadow = '#205057'
  const suit = '#327a74'
  const suitLight = '#64ab91'
  const helmetShadow = '#ab6231'
  const skinShadow = '#97583e'
  const skin = '#d9986a'
  const skinLight = '#efbc88'

  // Alternate two planted feet. The construction helmet stays steady as the arms swing.
  const left = 7 - stride * (side ? 2 : 1)
  const right = 17 + stride * (side ? 3 : 1)
  const leftY = stride < 0 ? 33 : 35
  const rightY = stride > 0 ? 33 : 35
  for (const [x, y, tone, shine] of [
    [left, leftY, suitShadow, steelShade],
    [right, rightY, suit, steel],
  ] as const) {
    block(ink, x + 1, 28, 8, y - 27)
    block(tone, x + 2, 29, 5, y - 29)
    block(shine, x + 5, y - 3, 2, 2)
    patch(ink, [[x + 1, y], [x + 8, y], [x + 10, y + 2], [x + 10, y + 5], [x, y + 5], [x, y + 2]])
    block(slate, x + 2, y + 1, 6, 3)
    block(shine, x + 5, y + 2, 4, 1)
    block('#0a151d', x + 1, y + 4, 8, 1)
  }

  patch(ink, [[9, 16], [22, 16], [26, 20], [31, 24], [31, 28], [27, 31], [23, 30], [22, 33], [9, 33], [7, 30], [3, 30], [1, 26], [3, 21], [6, 18]])
  patch(suitShadow, [[8, 18], [21, 18], [26, 21], [27, 26], [23, 29], [21, 32], [10, 32], [8, 28], [5, 28], [3, 25], [5, 21]])
  patch(suit, [[8, 19], [14, 18], [21, 19], [24, 21], [21, 27], [20, 30], [11, 30], [8, 27], [5, 25], [6, 21]])
  patch(suitLight, [[8, 19], [12, 19], [11, 22], [7, 23], [5, 24], [6, 21]])
  block(slate, 9, 29, 14, 2)
  block(amber, 11, 29, 10, 1)
  block(paleGold, side ? 17 : 14, 29, 3, 1)
  block(deepTeal, 10, 31, 12, 1)

  if (back) {
    block(suitShadow, 10, 20, 12, 8)
    block(slate, 11, 20, 10, 3)
    block(steel, 12, 20, 8, 1)
    block(paleGold, 8, 20, 2, 7)
    block(gold, 22, 20, 2, 7)
    block(mint, 10, 25, 12, 2)
    block(suitLight, 12, 26, 8, 1)
  } else {
    block(gold, 9, 20, 2, 7)
    block(paleGold, 9, 20, 1, 4)
    block(mint, 11, 25, side ? 7 : 12, 2)
    if (!side) block(paleGold, 22, 20, 2, 7)
    block(deepTeal, 14, 24, 2, 5)
    block('#daede0', 17, 21, 3, 2)
    block(steelShade, 18, 23, 2, 1)
  }

  const gloveY = side ? 23 + stride : 24 - stride
  patch(slate, [[23, 20], [26, 22], [29, gloveY], [30, gloveY + 3], [28, gloveY + 5], [24, gloveY + 4], [22, 24]])
  block(suitLight, 23, 21, 2, 3)
  block(amber, 26, gloveY + 1, 3, 3)
  block(paleGold, 27, gloveY + 1, 2, 1)
  block(slate, 3, 26 + stride, 3, 2)
  block(steel, 4, 26 + stride, 2, 1)

  patch(ink, [[6, 10], [24, 9], [27, 12], [26, 17], [23, 20], [11, 19], [7, 16]])
  if (back) {
    patch(slate, [[8, 11], [23, 11], [25, 14], [23, 18], [12, 18], [9, 16]])
    block(steelShade, 9, 13, 15, 2)
    block(skinShadow, 13, 17, 8, 2)
  } else {
    patch(skinShadow, [[9, 12], [23, 11], [25, 13], [25, 16], [22, 19], [12, 18], [9, 16]])
    patch(skin, [[11, 12], [23, 12], [25, 14], [23, 17], [18, 18], [12, 16]])
    block(skinLight, side ? 21 : 14, 16, side ? 4 : 5, 1)
    block(darkGlass, side ? 16 : 10, 12, side ? 10 : 15, 4)
    block(steel, side ? 18 : 11, 12, side ? 7 : 13, 1)
    block(silver, side ? 19 : 13, 13, side ? 3 : 2, 1)
    block(iceGlint, 22, 13, 2, 1)
    block(skinShadow, 18, 17, 3, 1)
  }

  patch(ink, [[5, 10], [5, 7], [7, 4], [11, 1], [20, 1], [24, 3], [27, 7], [28, 10], [32, 10], [33, 12], [31, 14], [4, 14], [1, 12], [2, 10]])
  patch(helmetShadow, [[6, 9], [7, 6], [11, 2], [20, 2], [25, 5], [27, 10], [31, 11], [31, 13], [4, 13], [3, 11]])
  patch(gold, [[7, 9], [8, 6], [12, 3], [19, 2], [24, 5], [25, 8], [29, 10], [30, 11], [4, 12], [4, 11]])
  patch(paleGold, [[8, 8], [10, 5], [14, 3], [18, 3], [17, 5], [13, 6], [11, 8]])
  block('#fff0ab', 12, 4, 5, 1)
  block('#f6cd64', 19, 4, 2, 5)
  block(amber, 22, 6, 3, 4)
  block(paleGold, 5, 10, 13, 2)
  block('#fff0ab', 6, 10, 6, 1)
  block(gold, 24, 11, 5, 1)
  if (back) {
    block(helmetShadow, 13, 8, 8, 3)
    block(paleGold, 14, 8, 6, 1)
  }
}

function drawBlank({ block, patch }: PixelPainter): void {
  const body = [[2, 13], [6, 7], [15, 3], [29, 3], [35, 6], [39, 12], [39, 17], [35, 23], [26, 27], [11, 28], [3, 24], [1, 19]] as const
  patch(ink, body)
  patch(slate, [[3, 15], [7, 10], [15, 6], [29, 6], [34, 8], [37, 13], [37, 17], [33, 22], [26, 26], [12, 26], [5, 23], [3, 19]])
  patch(steelShade, [[3, 14], [8, 9], [17, 5], [30, 5], [37, 11], [37, 17], [31, 23], [15, 25], [6, 22], [3, 18]])
  patch(steel, [[4, 13], [9, 8], [16, 5], [29, 4], [34, 6], [37, 12], [33, 17], [25, 21], [11, 22], [5, 18]])
  patch(silver, [[6, 13], [10, 9], [18, 6], [27, 6], [30, 7], [26, 9], [17, 9], [10, 12], [8, 15]])
  patch(slate, [[13, 13], [18, 9], [27, 9], [31, 12], [30, 16], [22, 19], [15, 18], [11, 16]])
  patch(ink, [[13, 14], [18, 11], [26, 10], [29, 12], [27, 15], [21, 17], [15, 17]])
  patch('#bdd4ce', [[10, 16], [15, 19], [23, 19], [31, 15], [33, 16], [28, 20], [24, 22], [14, 22], [9, 19]])
  patch(rust, [[29, 4], [34, 6], [36, 9], [32, 11], [29, 9], [28, 6]])
  patch(ember, [[29, 4], [33, 6], [34, 8], [31, 8]])
  block(paleGold, 30, 5, 2, 1)
  block(white, 13, 8, 4, 1)
  block(steel, 11, 23, 5, 1)
  block(steel, 23, 23, 3, 1)
  block(silver, 31, 18, 2, 1)
  block('#c77955', 7, 20, 3, 1)
  block(slate, 10, 10, 1, 1)
  block(slate, 33, 15, 1, 1)
}

function drawBolt({ block, patch }: PixelPainter): void {
  patch(ink, [[6, 6], [13, 2], [25, 2], [32, 7], [34, 13], [29, 19], [24, 22], [23, 27], [24, 29], [21, 34], [19, 39], [15, 43], [9, 43], [4, 40], [3, 34], [6, 28], [7, 22], [9, 18], [4, 16], [2, 12]])
  patch('#733d31', [[11, 15], [25, 17], [24, 22], [20, 31], [18, 38], [14, 42], [8, 41], [5, 38], [6, 33], [9, 26]])
  patch(rust, [[11, 18], [22, 19], [21, 25], [17, 33], [15, 39], [11, 41], [7, 38], [8, 31]])
  for (let ridge = 0; ridge < 4; ridge++) {
    const x = 10 - ridge
    const y = 24 + ridge * 4
    patch('#483032', [[x, y], [x + 12, y - 3], [x + 13, y - 1], [x, y + 3]])
    patch('#ca824a', [[x - 1, y], [x + 11, y - 3], [x + 13, y - 2], [x + 8, y + 1], [x, y + 2]])
    block(gold, x + 4, y - 1, 3, 1)
  }
  patch(rust, [[7, 7], [14, 3], [25, 3], [31, 8], [32, 13], [28, 17], [21, 20], [10, 18], [5, 15], [4, 12]])
  patch(amber, [[7, 8], [15, 4], [25, 4], [30, 8], [30, 12], [24, 16], [14, 16], [6, 13]])
  patch(gold, [[8, 8], [15, 5], [24, 5], [27, 7], [21, 9], [14, 8], [8, 12], [6, 11]])
  patch('#543735', [[13, 9], [19, 6], [25, 8], [27, 11], [23, 13], [16, 14], [11, 12]])
  patch(ink, [[14, 9], [20, 7], [24, 8], [24, 10], [20, 12], [14, 12]])
  block(ember, 22, 15, 5, 1)
  block(ember, 8, 13, 3, 1)
  block(paleGold, 15, 5, 5, 1)
  block(paleGold, 8, 9, 3, 1)
  block('#d39651', 18, 19, 3, 1)
}

function drawPhantom({ block, patch }: PixelPainter): void {
  patch(ink, [[4, 6], [9, 2], [26, 2], [30, 5], [33, 12], [32, 27], [28, 32], [7, 32], [2, 28], [1, 19], [2, 10]])
  patch(plum, [[5, 7], [9, 4], [26, 3], [30, 7], [32, 14], [30, 27], [27, 30], [8, 30], [4, 27], [3, 20]])
  patch('#8b446c', [[6, 7], [10, 4], [25, 4], [29, 7], [29, 9], [7, 9], [5, 23], [4, 20]])
  patch(darkGlass, [[8, 8], [25, 7], [28, 11], [28, 23], [25, 27], [9, 26], [6, 23], [6, 12]])
  block('#40304e', 7, 15, 20, 1)
  block('#40304e', 7, 20, 20, 1)
  block('#40304e', 12, 10, 1, 13)
  block('#40304e', 19, 10, 1, 13)
  patch(magenta, [[7, 22], [11, 18], [15, 19], [19, 12], [22, 14], [26, 10], [28, 11], [23, 18], [20, 16], [16, 23], [12, 21], [9, 24]])
  patch(pink, [[8, 21], [11, 18], [15, 20], [19, 13], [22, 15], [26, 10], [27, 11], [22, 17], [20, 15], [16, 22], [11, 20], [9, 23]])
  block('#ffd2df', 25, 11, 2, 1)
  block(pink, 10, 5, 7, 1)
  block('#c980ae', 24, 29, 4, 1)
  block(magenta, 3, 12, 2, 1)
  block(pink, 29, 15, 4, 1)
  block(mint, 10, 28, 4, 1)
  block(steelShade, 16, 28, 3, 1)
  block(magenta, 2, 30, 5, 2)
  block(plum, 8, 34, 6, 2)
  block(pink, 12, 34, 2, 1)
  block('#986498', 22, 33, 5, 1)
  block(magenta, 20, 37, 3, 1)
}

function drawBoss({ block, patch }: PixelPainter, charging: boolean): void {
  const signal = charging ? '#ff9861' : '#dd744d'
  const hot = charging ? '#ffde98' : '#f8ad61'
  patch(ink, [[6, 41], [17, 36], [25, 43], [39, 43], [47, 36], [58, 41], [64, 51], [63, 59], [46, 62], [39, 58], [25, 58], [19, 62], [1, 60], [0, 53]])
  for (const x of [2, 44]) {
    patch(slate, [[x + 5, 44], [x + 13, 40], [x + 17, 45], [x + 18, 55], [x + 14, 59], [x + 1, 58], [x, 54]])
    patch(deepTeal, [[x + 5, 45], [x + 13, 42], [x + 16, 45], [x + 15, 53], [x + 4, 55], [x + 2, 52]])
    block(teal, x + 5, 48, 8, 3)
    block(steel, x + 3, 54, 11, 2)
    block(silver, x + 5, 54, 6, 1)
    block(amber, x + 3, 57, 11, 1)
    block(ink, x + 7, 56, 2, 3)
  }
  patch(ink, [[4, 16], [10, 12], [17, 6], [48, 6], [54, 11], [61, 15], [63, 43], [59, 50], [48, 55], [17, 55], [6, 50], [1, 43]])
  patch(slate, [[6, 17], [13, 12], [18, 8], [47, 8], [53, 13], [59, 16], [61, 42], [57, 48], [47, 53], [18, 53], [8, 48], [3, 42]])
  patch(steelShade, [[6, 18], [16, 11], [20, 9], [46, 9], [57, 16], [52, 19], [14, 19]])
  block(steel, 18, 10, 27, 2)
  block(silver, 21, 10, 16, 1)
  block(deepTeal, 6, 23, 11, 21)
  block(deepTeal, 48, 23, 10, 20)
  block(teal, 7, 24, 3, 17)
  block(teal, 54, 25, 3, 13)
  for (let vent = 0; vent < 4; vent++) {
    block(slate, 8, 26 + vent * 4, 7, 2)
    block(steelShade, 50, 26 + vent * 4, 5, 2)
  }
  for (const x of [10, 50]) {
    block(ink, x - 2, 3, 8, 11)
    block(rust, x - 1, 2, 6, 8)
    block(signal, x, 3, 4, 6)
    block(hot, x, 4, 2, 2)
    block(steelShade, x - 1, 10, 6, 2)
    block(gold, x, 43, 3, 2)
    block(amber, x - 2, 46, 3, 2)
  }

  patch(ink, octagon(12, 12, 41, 41, 10))
  patch(steelShade, octagon(14, 13, 37, 37, 9))
  patch(steel, octagon(15, 14, 34, 34, 8))
  patch(silver, [[23, 14], [41, 14], [47, 19], [44, 21], [40, 17], [24, 17], [19, 23], [16, 23]])
  patch(slate, [[48, 23], [49, 39], [40, 48], [24, 48], [18, 43], [22, 42], [27, 45], [40, 44], [45, 39], [45, 24]])
  for (const [x, y] of [[22, 18], [41, 19], [16, 28], [46, 32], [22, 42], [40, 43]]) {
    block(slate, x, y, 3, 3)
    block(x < 32 ? silver : steel, x, y, 2, 1)
  }
  patch(ink, octagon(19, 19, 27, 26, 6))
  patch('#683b37', octagon(21, 21, 23, 22, 6))
  patch(rust, [[26, 22], [37, 22], [43, 27], [43, 36], [37, 41], [28, 41], [23, 37], [22, 28]])
  patch(signal, [[26, 23], [37, 23], [42, 27], [41, 32], [38, 30], [37, 27], [29, 27], [25, 32], [23, 30]])
  patch(hot, [[28, 24], [35, 24], [39, 26], [39, 28], [34, 27], [29, 27], [27, 29], [25, 28]])
  patch('#b55e40', [[42, 31], [41, 37], [36, 41], [28, 40], [25, 36], [28, 36], [33, 38], [37, 37], [39, 33]])
  patch(ink, octagon(26, 26, 14, 12, 4))
  patch(signal, octagon(29, 28, 8, 8, 2))
  block(hot, 31, 30, 4, 4)
  block(white, 31, 30, 2, 2)
  block(ink, 23, 50, 18, 4)
  block(charging ? signal : deepTeal, 25, 51, 14, 2)
  block(charging ? hot : mint, 26, 51, 7, 1)
}

function drawCaliper({ block, patch }: PixelPainter): void {
  patch(ink, [[1, 10], [4, 10], [4, 5], [6, 2], [11, 2], [13, 5], [9, 7], [9, 10], [17, 10], [17, 7], [20, 4], [25, 4], [25, 7], [23, 9], [23, 10], [31, 10], [32, 12], [32, 19], [30, 21], [22, 21], [22, 24], [26, 26], [26, 30], [21, 30], [17, 27], [16, 21], [9, 21], [9, 25], [13, 27], [13, 31], [7, 31], [4, 27], [4, 21], [1, 20]])
  patch(steel, [[5, 10], [5, 6], [7, 3], [11, 3], [11, 5], [8, 6], [8, 11], [17, 11], [18, 8], [21, 5], [23, 5], [23, 6], [21, 9], [21, 11], [30, 11], [31, 13], [31, 18], [29, 20], [21, 20], [21, 25], [25, 27], [25, 29], [22, 29], [18, 26], [17, 20], [8, 20], [8, 26], [12, 28], [12, 30], [8, 30], [5, 26], [5, 20], [2, 19], [2, 12]])
  block(silver, 3, 12, 27, 6)
  block(white, 3, 12, 27, 1)
  block(silver, 6, 20, 2, 6)
  block(silver, 18, 20, 2, 5)
  block(silver, 6, 5, 2, 5)
  block(white, 7, 3, 3, 1)
  for (let x = 9; x <= 29; x += 2) block(steelShade, x, 14, 1, x % 4 === 1 ? 3 : 2)
  block(deepTeal, 15, 11, 8, 10)
  block(teal, 16, 12, 6, 7)
  block(mint, 16, 12, 6, 2)
  block('#ddf6cc', 17, 12, 3, 1)
  block(slate, 18, 16, 3, 2)
  block(gold, 2, 14, 5, 4)
  block(paleGold, 3, 14, 3, 1)
}

function drawWrench({ block, patch }: PixelPainter): void {
  patch(ink, [[1, 25], [3, 21], [16, 10], [15, 7], [17, 3], [22, 0], [28, 1], [23, 6], [24, 9], [28, 9], [32, 5], [33, 10], [30, 15], [26, 17], [21, 16], [11, 28], [9, 32], [4, 33], [1, 30]])
  patch(steelShade, [[2, 26], [4, 22], [17, 11], [16, 7], [18, 4], [22, 1], [26, 2], [22, 6], [23, 10], [28, 11], [31, 8], [32, 10], [29, 14], [26, 16], [21, 15], [10, 27], [8, 31], [5, 32], [2, 29]])
  patch(silver, [[4, 24], [18, 11], [17, 7], [20, 4], [23, 2], [24, 2], [21, 6], [22, 11], [28, 12], [31, 10], [29, 13], [26, 15], [21, 14], [8, 28], [5, 31], [3, 29]])
  patch(white, [[5, 23], [18, 11], [19, 12], [7, 24]])
  patch(steel, [[9, 23], [19, 14], [21, 14], [12, 23], [9, 25]])
  block(ink, 5, 26, 3, 3)
  block(steelShade, 5, 29, 3, 1)
  block(paleGold, 21, 12, 3, 1)
  block(white, 20, 4, 2, 1)
}

function drawFile({ block, patch }: PixelPainter): void {
  patch(ink, [[26, 1], [31, 2], [33, 5], [31, 10], [17, 22], [14, 23], [13, 27], [7, 33], [3, 32], [1, 28], [3, 24], [9, 20], [12, 16], [22, 5]])
  patch(steelShade, [[26, 2], [31, 3], [32, 5], [29, 10], [16, 21], [13, 22], [10, 20], [13, 16], [23, 6]])
  patch(steel, [[25, 4], [29, 3], [31, 5], [28, 10], [15, 21], [12, 19], [15, 15]])
  patch(silver, [[14, 17], [25, 5], [29, 4], [28, 5], [17, 17], [14, 20], [13, 19]])
  for (let row = 0; row < 7; row++) {
    block(slate, 15 + row * 2, 18 - row * 2, 3, 1)
    block(silver, 16 + row * 2, 19 - row * 2, 2, 1)
    block(steelShade, 16 + row * 2, 17 - row * 2, 1, 1)
  }
  patch(deepTeal, [[10, 20], [13, 23], [12, 27], [7, 32], [4, 31], [2, 28], [4, 25]])
  patch(teal, [[9, 21], [11, 23], [9, 27], [5, 31], [3, 28], [5, 25]])
  block(mint, 5, 26, 2, 1)
  block(mint, 7, 24, 2, 1)
  block(amber, 11, 21, 3, 2)
  block(paleGold, 12, 21, 2, 1)
}

function drawSaw({ block, patch }: PixelPainter): void {
  patch(ink, [[1, 15], [4, 11], [8, 10], [13, 13], [32, 3], [35, 4], [35, 8], [33, 12], [31, 12], [30, 15], [28, 14], [26, 18], [24, 17], [22, 20], [20, 19], [18, 23], [15, 22], [14, 27], [10, 31], [4, 31], [1, 27]])
  patch(steelShade, [[11, 15], [33, 4], [34, 5], [34, 8], [32, 11], [30, 11], [29, 14], [27, 13], [25, 17], [23, 16], [21, 19], [19, 18], [17, 22], [14, 21]])
  patch(silver, [[12, 15], [33, 5], [33, 8], [29, 11], [23, 14], [18, 18], [13, 20]])
  patch(white, [[13, 15], [32, 6], [32, 7], [14, 16]])
  patch(steel, [[15, 19], [29, 11], [29, 12], [24, 15], [19, 19], [16, 20]])
  patch(rust, [[2, 16], [5, 12], [9, 12], [13, 15], [14, 22], [12, 27], [9, 30], [5, 30], [2, 26]])
  patch(amber, [[3, 17], [6, 13], [9, 13], [12, 16], [12, 22], [10, 27], [7, 29], [5, 27], [3, 24]])
  patch(gold, [[5, 15], [8, 14], [11, 16], [10, 17], [7, 16], [5, 19], [4, 23], [3, 21]])
  patch(ink, [[6, 18], [9, 17], [11, 19], [10, 24], [8, 27], [6, 26], [5, 23]])
  block(steel, 12, 18, 2, 2)
  block(white, 12, 18, 1, 1)
  block(paleGold, 6, 14, 2, 1)
}

function drawTape({ block, patch }: PixelPainter): void {
  patch(ink, [[5, 3], [16, 3], [21, 6], [24, 12], [24, 17], [29, 17], [33, 19], [34, 23], [33, 28], [28, 29], [22, 26], [16, 28], [5, 28], [1, 24], [0, 16], [1, 9]])
  patch(amber, [[5, 4], [16, 4], [20, 7], [23, 12], [23, 20], [21, 24], [16, 27], [6, 27], [2, 24], [1, 16], [2, 10]])
  patch(gold, [[5, 6], [15, 5], [19, 7], [21, 12], [21, 18], [18, 22], [13, 24], [6, 24], [3, 21], [2, 15], [3, 10]])
  patch(paleGold, [[5, 7], [14, 6], [17, 7], [15, 9], [7, 10], [4, 13], [3, 12]])
  patch(slate, octagon(5, 11, 13, 11, 3))
  patch(teal, octagon(6, 12, 11, 8, 2))
  block(mint, 8, 12, 6, 1)
  block(deepTeal, 8, 15, 7, 3)
  block(white, 9, 15, 3, 1)
  block(silver, 13, 16, 2, 1)
  block(steelShade, 5, 24, 12, 2)
  patch(paleGold, [[19, 18], [29, 18], [32, 20], [32, 25], [28, 27], [20, 23], [17, 21]])
  patch(gold, [[18, 21], [25, 22], [32, 23], [32, 25], [28, 27], [20, 23]])
  for (let x = 21; x < 32; x += 2) block(steelShade, x, x < 27 ? 19 : 20, 1, x % 4 === 1 ? 3 : 2)
  block(steel, 31, 22, 2, 5)
  block(silver, 31, 24, 1, 2)
}

function drawMallet({ block, patch }: PixelPainter): void {
  patch(ink, [[14, 13], [22, 15], [20, 23], [17, 31], [15, 34], [9, 34], [6, 32], [7, 27], [10, 22]])
  patch(rust, [[15, 14], [21, 16], [19, 22], [16, 31], [14, 33], [10, 33], [8, 31], [9, 27], [12, 22]])
  patch(amber, [[15, 16], [20, 17], [17, 24], [14, 32], [10, 32], [9, 30], [12, 24]])
  patch(paleGold, [[15, 18], [17, 18], [14, 25], [12, 30], [10, 30], [12, 25]])
  block(rust, 10, 29, 5, 1)
  block(rust, 9, 31, 5, 1)
  patch(ink, [[1, 9], [6, 5], [14, 2], [27, 4], [34, 8], [35, 15], [31, 21], [22, 22], [12, 18], [5, 18], [1, 15]])
  patch(slate, [[2, 10], [7, 6], [14, 3], [27, 5], [33, 9], [34, 14], [30, 20], [23, 21], [13, 17], [6, 17], [2, 14]])
  patch(steelShade, [[5, 9], [14, 4], [26, 6], [31, 9], [23, 11], [14, 8], [7, 12]])
  block(steel, 12, 6, 7, 1)
  block(silver, 12, 6, 3, 1)
  patch(deepTeal, [[15, 8], [24, 10], [25, 16], [22, 19], [15, 16], [13, 12]])
  patch(teal, [[16, 9], [23, 11], [23, 14], [15, 13], [14, 11]])
  block(mint, 16, 10, 4, 1)
  block(steel, 30, 10, 3, 6)
  block(silver, 30, 11, 1, 4)
  block(steelShade, 5, 12, 2, 3)
}

const designs: Record<SpriteName, SpriteDesign> = {
  engineer: { width: 35, height: 42, draw: (painter) => drawEngineer(painter, 'side', 0) },
  'engineer-stride-a': { width: 35, height: 42, draw: (painter) => drawEngineer(painter, 'side', 1) },
  'engineer-stride-b': { width: 35, height: 42, draw: (painter) => drawEngineer(painter, 'side', -1) },
  'engineer-front': { width: 35, height: 42, draw: (painter) => drawEngineer(painter, 'front', 0) },
  'engineer-front-a': { width: 35, height: 42, draw: (painter) => drawEngineer(painter, 'front', 1) },
  'engineer-front-b': { width: 35, height: 42, draw: (painter) => drawEngineer(painter, 'front', -1) },
  'engineer-back': { width: 35, height: 42, draw: (painter) => drawEngineer(painter, 'back', 0) },
  'engineer-back-a': { width: 35, height: 42, draw: (painter) => drawEngineer(painter, 'back', 1) },
  'engineer-back-b': { width: 35, height: 42, draw: (painter) => drawEngineer(painter, 'back', -1) },
  'held-caliper': {
    width: 17,
    height: 15,
    draw({ block, patch }) {
      patch(ink, [[3, 2], [9, 2], [9, 5], [7, 5], [7, 6], [15, 6], [16, 8], [15, 11], [8, 11], [8, 12], [12, 12], [12, 15], [5, 15], [3, 12], [3, 11], [1, 11], [0, 8], [2, 6]])
      block(silver, 4, 3, 4, 1)
      block(silver, 4, 4, 2, 5)
      block(silver, 5, 9, 2, 4)
      block(steel, 7, 12, 4, 2)
      block(iceGlint, 2, 7, 13, 3)
      block(white, 5, 7, 9, 1)
      block(teal, 8, 8, 2, 2)
      block(steelShade, 12, 8, 1, 2)
      block(steelShade, 14, 8, 1, 1)
    },
  },
  blank: { width: 41, height: 30, draw: drawBlank },
  bolt: { width: 36, height: 45, draw: drawBolt },
  phantom: { width: 35, height: 40, draw: drawPhantom },
  boss: { width: 65, height: 64, draw: (painter) => drawBoss(painter, false) },
  'boss-charged': { width: 65, height: 64, draw: (painter) => drawBoss(painter, true) },
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
  caliper: { width: 33, height: 32, draw: drawCaliper },
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
  wrench: { width: 34, height: 34, draw: drawWrench },
  file: { width: 34, height: 34, draw: drawFile },
  saw: { width: 36, height: 34, draw: drawSaw },
  tape: { width: 35, height: 33, draw: drawTape },
  mallet: { width: 36, height: 35, draw: drawMallet },
}

export function createSpriteAtlas(): {
  canvas: HTMLCanvasElement
  frames: Record<SpriteName, SpriteFrame>
} {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
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
