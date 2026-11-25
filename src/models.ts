import {
  BoxGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, Mesh,
  MeshBasicMaterial, MeshLambertMaterial, SphereGeometry, type BufferGeometry,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { ToolKind } from './simulation.hot.ts'

type Position = readonly [number, number, number]
type Dimensions = readonly [number, number, number]

const iron = '#253341'
const rubber = '#18232e'
const alloy = '#94a9b1'
const teal = '#236261'
const suit = '#2f8c83'
const warm = '#bb6746'
const yellow = '#e18a4b'
const highlight = '#f3d087'
const reflective = '#e2d6a8'
const enamel = '#faf1d8'

// Parts attached to the same joint are merged into a single, vertex-coloured mesh.
function parts() {
  const pieces: BufferGeometry[] = []
  const add = (shape: BufferGeometry, [x, y, z]: Position, color: string) => {
    const geometry = shape.index ? shape.toNonIndexed() : shape
    if (geometry !== shape) shape.dispose()
    geometry.deleteAttribute('uv')
    geometry.translate(x, y, z)
    const tone = new Color(color)
    const palette = new Float32Array(geometry.getAttribute('position').count * 3)
    for (let i = 0; i < palette.length; i += 3) tone.toArray(palette, i)
    geometry.setAttribute('color', new Float32BufferAttribute(palette, 3))
    pieces.push(geometry)
  }
  return {
    box(at: Position, [w, h, d]: Dimensions, color: string, bevel = 0) {
      add(bevel ? new RoundedBoxGeometry(w, h, d, 1, bevel) : new BoxGeometry(w, h, d), at, color)
    },
    cylinder(at: Position, top: number, bottom: number, height: number, segments: number, color: string, forward = false) {
      const geometry = new CylinderGeometry(top, bottom, height, segments)
      if (forward) geometry.rotateX(Math.PI / 2)
      add(geometry, at, color)
    },
    crown(at: Position, [x, y, z]: Dimensions, color: string) {
      add(new SphereGeometry(1, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(x, y, z), at, color)
    },
    finish(material: MeshLambertMaterial | MeshBasicMaterial) {
      const geometry = mergeGeometries(pieces)
      if (!geometry) throw new Error('Unable to merge articulated model parts')
      for (const piece of pieces) piece.dispose()
      return new Mesh(geometry, material)
    },
  }
}

export function createInspector() {
  const group = new Group()
  group.name = 'Articulated inspector'
  const center = new Group()
  group.add(center)
  const surface = new MeshLambertMaterial({ vertexColors: true, flatShading: true })

  const uniform = parts()
  uniform.box([0, .89, 0], [.68, .57, .45], suit, .07)
  uniform.box([0, .67, .01], [.63, .17, .44], iron, .036)
  uniform.box([0, .67, .24], [.56, .067, .033], warm, .012)
  uniform.box([0, .67, .263], [.106, .069, .027], highlight, .01)
  uniform.box([0, 1.154, 0], [.34, .08, .31], teal, .018)

  for (const x of [-.233, .233]) {
    uniform.box([x, .969, .230], [.078, .326, .033], yellow, .012)
    uniform.box([x, 1.176, -.012], [.078, .028, .36], highlight, .009)
    uniform.box([x, .953, -.233], [.082, .354, .031], yellow, .01)
  }
  uniform.box([0, .819, .238], [.56, .058, .03], reflective, .005)
  uniform.box([0, .838, -.238], [.55, .054, .03], reflective, .007)
  uniform.box([-.105, .975, .245], [.123, .116, .046], '#285962', .014)
  uniform.box([.109, 1.013, .239], [.131, .094, .03], enamel, .012)
  uniform.box([.109, 1.020, .258], [.084, .025, .012], '#4b655b')
  uniform.box([0, .985, -.246], [.29, .196, .064], '#154956', .025)
  uniform.box([0, 1.002, -.287], [.211, .086, .028], enamel, .01)
  for (const x of [-.066, -.022, .022, .066]) {
    uniform.box([x, .996, -.306], [.015, .043, .014], '#576d68')
  }
  uniform.box([0, 1.213, 0], [.225, .12, .21], '#aa6648', .023)
  center.add(uniform.finish(surface))

  const head = new Group()
  head.position.set(0, 1.258, .008)
  const shell = parts()
  shell.box([0, .142, .037], [.54, .373, .435], '#d19165', .073)
  shell.box([0, .175, -.142], [.52, .327, .15], '#392d30', .05)
  shell.box([0, .081, .16], [.40, .112, .19], '#dca476', .033)
  for (const x of [-.262, .262]) {
    shell.box([x, .116, .044], [.081, .129, .109], '#c07d57', .027)
    shell.box([x, .211, .058], [.066, .065, .34], iron, .011)
  }
  shell.box([0, .207, .259], [.502, .140, .061], rubber, .023)
  for (const x of [-.121, .121]) {
    shell.box([x, .208, .293], [.190, .098, .045], '#315d70', .018)
    shell.box([x - .025, .239, .318], [.089, .022, .013], '#a5d3d6', .004)
  }
  shell.box([0, .12, .263], [.093, .088, .088], '#e0a977', .022)
  shell.box([.028, .054, .239], [.107, .023, .027], '#894d40', .008)
  shell.crown([0, .327, -.007], [.367, .269, .306], '#edcd94')
  shell.box([0, .323, -.004], [.698, .071, .565], warm, .029)
  shell.box([0, .351, .132], [.742, .042, .37], enamel, .022)
  shell.box([0, .344, .268], [.697, .041, .20], highlight, .016)
  shell.box([0, .532, -.016], [.091, .093, .339], '#dd8356', .035)
  shell.box([0, .417, .284], [.141, .093, .043], '#b96c4e', .017)
  shell.box([0, .428, .312], [.086, .043, .018], enamel, .009)
  head.add(shell.finish(surface))
  center.add(head)

  function arm(side: -1 | 1) {
    const joint = new Group()
    joint.position.set(side * .411, 1.037, 0)
    const sleeve = parts()
    sleeve.box([0, -.092, 0], [.208, .233, .219], side < 0 ? teal : suit, .04)
    sleeve.box([0, -.267, .026], [.163, .193, .185], '#28616a', .034)
    sleeve.box([0, -.302, .047], [.171, .058, .182], reflective, .009)
    sleeve.box([0, -.393, .062], [.169, .149, .19], warm, .032)
    sleeve.box([0, -.418, .097], [.133, .082, .145], yellow, .021)
    joint.add(sleeve.finish(surface))
    center.add(joint)
    return joint
  }

  function leg(side: -1 | 1) {
    const joint = new Group()
    joint.position.set(side * .169, .601, -.002)
    const boot = parts()
    boot.box([0, -.145, 0], [.237, .282, .262], side < 0 ? '#294f5d' : '#365d6b', .03)
    boot.box([0, -.344, .004], [.210, .217, .234], '#2d4b59', .03)
    boot.box([0, -.303, .128], [.177, .120, .041], iron, .025)
    boot.box([0, -.461, .068], [.235, .185, .358], rubber, .032)
    boot.box([0, -.527, .080], [.242, .049, .360], '#40515c', .01)
    boot.box([0, -.446, .206], [.194, .061, .087], '#526674', .019)
    joint.add(boot.finish(surface))
    center.add(joint)
    return joint
  }

  const leftArm = arm(-1)
  const rightArm = arm(1)
  const leftLeg = leg(-1)
  const rightLeg = leg(1)
  const tool = parts()
  tool.box([0, 0, 0], [.42, .058, .056], alloy, .006)
  tool.box([-.138, -.053, 0], [.069, .143, .056], '#c8d7d5', .008)
  tool.box([-.099, -.111, 0], [.092, .040, .056], alloy, .007)
  tool.box([.077, -.038, 0], [.062, .110, .052], alloy, .006)
  tool.box([.041, -.080, 0], [.089, .037, .052], '#c8d7d5', .005)
  tool.box([.068, .012, .016], [.104, .078, .063], teal, .012)
  for (const x of [-.058, -.017, .124, .157]) tool.box([x, .028, .032], [.011, .013, .016], iron)
  const caliper = tool.finish(surface)
  caliper.scale.setScalar(1.17)

  const wrench = parts()
  wrench.box([.045, 0, 0], [.43, .072, .072], alloy, .016)
  wrench.box([-.178, 0, 0], [.15, .148, .076], alloy, .018)
  for (const side of [-1, 1]) {
    wrench.box([-.232, .066 * side, 0], [.135, .059, .069], '#bbcfcf', .013)
  }
  wrench.box([.196, .018, .035], [.10, .035, .026], '#667f8a', .008)

  const file = parts()
  file.box([-.16, 0, 0], [.235, .120, .11], teal, .032)
  file.box([-.043, 0, 0], [.06, .092, .09], warm, .015)
  file.box([.167, 0, 0], [.366, .097, .052], '#83989e', .009)
  for (const x of [.042, .094, .146, .198, .250, .302]) {
    file.box([x, .034, .03], [.014, .049, .014], '#c1cbc1')
  }

  const saw = parts()
  saw.box([.105, .031, 0], [.415, .143, .043], alloy, .006)
  for (const x of [-.061, .005, .071, .137, .203, .269]) {
    saw.box([x, -.055, 0], [.036, .047, .036], '#d8ded0', .004)
  }
  saw.box([-.213, 0, 0], [.164, .176, .085], warm, .032)
  saw.box([-.215, .013, .05], [.084, .083, .028], rubber, .015)

  const tape = parts()
  tape.box([0, .019, 0], [.253, .220, .142], warm, .041)
  tape.box([-.022, .041, .01], [.215, .187, .142], yellow, .036)
  tape.box([-.047, .041, .091], [.121, .092, .026], teal, .014)
  tape.box([.186, -.040, .018], [.166, .044, .048], highlight, .006)
  tape.box([.260, -.053, .020], [.025, .066, .054], alloy, .006)

  const mallet = parts()
  mallet.box([.053, 0, 0], [.49, .075, .070], warm, .015)
  mallet.box([.232, .04, 0], [.165, .257, .147], '#38525b', .027)
  for (const side of [-1, 1]) {
    mallet.box([.232, .04 + .122 * side, 0], [.174, .058, .151], rubber, .013)
  }

  const tools: [ToolKind, Mesh][] = [
    ['caliper', caliper], ['wrench', wrench.finish(surface)], ['file', file.finish(surface)],
    ['saw', saw.finish(surface)], ['tape', tape.finish(surface)], ['mallet', mallet.finish(surface)],
  ]
  for (const [, mesh] of tools) {
    mesh.position.set(.018, -.394, .147)
    mesh.rotation.z = -.21
    rightArm.add(mesh)
  }

  function pose(time: number, moving: boolean, dashing: boolean, measuring: number, equipped: ToolKind | null, hit: number) {
    const walk = moving ? Math.sin(time * 11.8) : 0
    const swing = walk * (dashing ? .77 : .46)
    leftLeg.rotation.x = swing - (dashing ? .21 : 0)
    rightLeg.rotation.x = -swing - (dashing ? .21 : 0)
    leftArm.rotation.x = -.11 - swing * .73
    rightArm.rotation.x = -.26 + swing * .44 - measuring * .85
    rightArm.rotation.z = .10 + measuring * .15
    center.rotation.x = dashing ? .27 : moving ? .08 : 0
    center.rotation.z = walk * .035
    center.position.y = moving ? .041 * Math.abs(walk) + (dashing ? .042 : 0) : .011 * (1 + Math.sin(time * 3))
    head.rotation.x = -.65 * center.rotation.x
    for (const [kind, mesh] of tools) mesh.visible = kind === equipped
    surface.emissive.setRGB(hit * .21, hit * .067, hit * .024)
  }

  return { group, pose }
}

export function createTestRig() {
  const group = new Group()
  group.name = 'Pressure test rig'
  group.scale.setScalar(1.09)
  const surface = new MeshLambertMaterial({ vertexColors: true, flatShading: true })

  const feet = parts()
  feet.box([0, .211, 0], [3.42, .36, 1.87], '#263b45', .12)
  feet.box([0, .457, .03], [3.11, .242, 1.58], '#758286', .069)
  for (const side of [-1, 1]) {
    const x = side * 1.25
    feet.box([x, .203, .425], [.59, .35, 1.71], rubber, .097)
    feet.box([x, .351, .498], [.49, .20, 1.55], '#415966', .052)
    feet.box([x, .389, 1.19], [.46, .084, .162], warm, .023)
    for (const z of [-.47, .05, .58, 1.03]) {
      feet.box([x, .392, z], [.47, .048, .077], alloy, .011)
    }
    feet.cylinder([x, .67, -.32], .284, .345, .344, 9, '#43646c')
    feet.cylinder([x, .89, -.32], .196, .207, .361, 9, alloy)
  }
  group.add(feet.finish(surface))

  const housing = new Group()
  housing.position.y = .97
  housing.rotation.y = -.19
  group.add(housing)
  const caseParts = parts()
  caseParts.box([0, .983, -.26], [2.70, 1.94, .94], '#3c3f4b', .13)
  caseParts.box([0, 1.95, -.06], [2.66, .28, 1.38], '#bd6448', .078)
  caseParts.box([0, 2.11, -.09], [2.52, .12, 1.23], '#d27751', .041)
  caseParts.box([0, .22, .19], [2.57, .24, 1.43], '#d0ad7a', .054)
  caseParts.box([0, -.037, .066], [2.63, .21, 1.46], '#42343b', .054)
  for (let slot = -4; slot <= 4; slot++) {
    caseParts.box([slot * .255, .229, .918], [.106, .121, .039], slot % 2 ? '#634c44' : '#efbf72', .008)
  }
  for (const x of [-1.24, 1.24]) {
    caseParts.box([x, 1.11, .22], [.364, 1.62, .73], '#b98158', .052)
    caseParts.box([x, 1.14, .61], [.233, 1.43, .10], '#e0b47c', .028)
    caseParts.box([x, 1.09, .672], [.131, 1.16, .045], '#665248', .012)
    for (const y of [.665, 1.07, 1.475]) {
      caseParts.box([x, y, .703], [.099, .041, .046], '#f8d797', .008)
    }
    caseParts.cylinder([x, 2.20, -.02], .130, .205, .187, 8, iron)
  }
  caseParts.cylinder([0, .97, .30], .875, .914, .30, 10, iron, true)
  caseParts.cylinder([0, .97, .45], .829, .88, .16, 10, '#95928e', true)
  caseParts.cylinder([0, .97, .55], .711, .746, .143, 10, '#5c5a62', true)
  caseParts.cylinder([0, .97, .64], .643, .673, .133, 10, '#2c2634', true)
  for (let index = 0; index < 10; index++) {
    const angle = index * Math.PI / 5
    caseParts.cylinder([.786 * Math.cos(angle), .97 + .786 * Math.sin(angle), .567], .048, .052, .081, 6, '#393946', true)
  }
  housing.add(caseParts.finish(surface))

  const rotor = new Group()
  rotor.position.set(0, .97, .704)
  const wheel = parts()
  wheel.cylinder([0, 0, 0], .576, .612, .112, 8, '#9b553e', true)
  wheel.cylinder([0, 0, .068], .508, .531, .082, 8, '#592d36', true)
  for (let index = 0; index < 8; index++) {
    const angle = index * Math.PI * .25
    wheel.cylinder([.472 * Math.cos(angle), .472 * Math.sin(angle), .109], .071, .083, .076, 6,
      index % 2 ? '#de8b53' : '#b36d48', true)
  }
  wheel.cylinder([0, 0, .14], .297, .315, .119, 8, '#22313b', true)
  rotor.add(wheel.finish(surface))
  housing.add(rotor)

  const ram = new Group()
  const ramParts = parts()
  ramParts.cylinder([0, .03, .76], .13, .163, .93, 8, '#adaca5')
  ramParts.box([0, .254, .76], [.38, .30, .45], '#985840', .037)
  ramParts.box([0, -.295, .78], [.78, .17, .54], '#ae614b', .040)
  ramParts.box([0, -.39, .78], [.94, .10, .64], '#dfb17e', .034)
  ram.add(ramParts.finish(surface))
  housing.add(ram)

  const signalMaterial = new MeshBasicMaterial({ vertexColors: true, color: '#f8b06a' })
  const lights = parts()
  lights.cylinder([0, .97, .925], .177, .215, .081, 8, '#ffe4bf', true)
  lights.cylinder([0, .97, .98], .076, .114, .039, 8, '#fff3d1', true)
  for (const x of [-1.24, 1.24]) {
    lights.cylinder([x, 2.346, -.020], .115, .133, .191, 8, '#ffc58d')
  }
  housing.add(lights.finish(signalMaterial))

  function pose(time: number, charging: boolean, hit: number, ramTravel: number) {
    rotor.rotation.z = time * 1.1 + (charging ? Math.sin(time * 20) * .30 : 0)
    housing.position.y = .97 + Math.sin(time * (charging ? 14 : 4.9)) * (charging ? .039 : .021)
    housing.rotation.y = -.19 + Math.sin(time * 1.12) * .075
    ram.position.y = 1.92 - ramTravel * .66
    signalMaterial.color.set(charging ? '#ffe2a6' : '#e08d59')
    surface.emissive.setRGB(hit * .16, hit * .055, hit * .020)
  }
  return { group, pose }
}
