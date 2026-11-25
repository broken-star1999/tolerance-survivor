import {
  BoxGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, Mesh,
  MeshBasicMaterial, MeshLambertMaterial, SphereGeometry, type BufferGeometry,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

type Position = readonly [number, number, number]
type Dimensions = readonly [number, number, number]

const iron = '#253341'
const rubber = '#18232e'
const alloy = '#94a9b1'
const teal = '#277076'
const suit = '#397f81'
const warm = '#b87343'
const yellow = '#edac3d'
const highlight = '#f7d681'
const reflective = '#b9ddbf'

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
  uniform.box([.102, 1.013, .239], [.115, .076, .024], alloy, .008)
  uniform.box([.102, 1.025, .254], [.062, .018, .012], '#e3e9cc')
  uniform.box([0, .989, -.246], [.236, .143, .035], '#225761', .019)
  uniform.box([0, .991, -.270], [.134, .027, .012], '#82a99b')
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
  shell.crown([0, .323, -.007], [.351, .265, .292], yellow)
  shell.box([0, .321, -.004], [.666, .071, .545], warm, .029)
  shell.box([0, .343, .132], [.713, .047, .352], highlight, .022)
  shell.box([0, .340, .257], [.670, .040, .200], yellow, .016)
  shell.box([0, .535, -.022], [.082, .084, .31], '#efc464', .035)
  shell.box([0, .385, .280], [.123, .072, .031], '#bd642e', .01)
  shell.box([0, .394, .298], [.085, .036, .018], '#fcdb8a', .007)
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
  tool.box([0, 0, 0], [.375, .051, .056], alloy, .006)
  tool.box([-.138, -.053, 0], [.069, .143, .056], '#c8d7d5', .008)
  tool.box([-.099, -.111, 0], [.092, .040, .056], alloy, .007)
  tool.box([.077, -.038, 0], [.062, .110, .052], alloy, .006)
  tool.box([.041, -.080, 0], [.089, .037, .052], '#c8d7d5', .005)
  tool.box([.068, .012, .016], [.104, .078, .063], teal, .012)
  for (const x of [-.058, -.017, .124, .157]) tool.box([x, .028, .032], [.011, .013, .016], iron)
  const caliper = tool.finish(surface)
  caliper.position.set(.018, -.394, .147)
  caliper.rotation.z = -.21
  rightArm.add(caliper)

  function pose(time: number, moving: boolean, dashing: boolean, measuring: number, equipped: boolean, hit: number) {
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
    caliper.visible = equipped
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
  feet.box([0, .457, .03], [3.11, .242, 1.58], '#587782', .069)
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
  caseParts.box([0, .983, -.07], [2.76, 2.02, 1.31], '#356068', .145)
  caseParts.box([0, 1.921, -.064], [2.52, .20, 1.22], '#63808b', .051)
  caseParts.box([0, -.037, .066], [2.56, .19, 1.39], '#20323b', .054)
  for (const x of [-1.24, 1.24]) {
    caseParts.box([x, .968, .554], [.276, 1.612, .23], '#427985', .051)
    caseParts.box([x, 1.055, .681], [.17, .879, .070], '#1e333d', .028)
    for (let slot = 0; slot < 5; slot++) {
      caseParts.box([x, .703 + slot * .143, .726], [.117, .045, .037], '#7b9798', .008)
    }
    caseParts.cylinder([x, 2.073, -.02], .130, .205, .187, 8, iron)
    caseParts.box([x, .329, .693], [.17, .087, .07], yellow, .013)
  }
  caseParts.cylinder([0, 1.074, .586], 1.043, 1.080, .290, 10, iron, true)
  caseParts.cylinder([0, 1.074, .746], .989, 1.010, .170, 10, alloy, true)
  caseParts.cylinder([0, 1.074, .845], .867, .894, .155, 10, '#46525a', true)
  caseParts.cylinder([0, 1.074, .934], .777, .795, .137, 10, '#1d3239', true)
  for (let index = 0; index < 10; index++) {
    const angle = index * Math.PI / 5
    caseParts.cylinder([.914 * Math.cos(angle), 1.074 + .914 * Math.sin(angle), .851], .054, .055, .104, 6, '#324c55', true)
  }
  caseParts.box([0, .117, .805], [.693, .114, .075], rubber, .02)
  caseParts.box([0, .119, .855], [.405, .037, .02], '#80b4ac', .006)
  housing.add(caseParts.finish(surface))

  const rotor = new Group()
  rotor.position.set(0, 1.074, 1.009)
  const wheel = parts()
  wheel.cylinder([0, 0, 0], .657, .696, .12, 8, '#9b553e', true)
  wheel.cylinder([0, 0, .068], .577, .603, .082, 8, '#542f2b', true)
  for (let index = 0; index < 8; index++) {
    const angle = index * Math.PI * .25
    wheel.cylinder([.560 * Math.cos(angle), .560 * Math.sin(angle), .109], .077, .093, .091, 6,
      index % 2 ? '#de8b53' : '#b36d48', true)
  }
  wheel.cylinder([0, 0, .14], .297, .315, .119, 8, '#22313b', true)
  rotor.add(wheel.finish(surface))
  housing.add(rotor)

  const signalMaterial = new MeshBasicMaterial({ vertexColors: true, color: '#f8b06a' })
  const lights = parts()
  lights.cylinder([0, 1.074, 1.226], .194, .235, .09, 8, '#ffe4bf', true)
  lights.cylinder([0, 1.074, 1.283], .081, .131, .040, 8, '#fff3d1', true)
  for (const x of [-1.24, 1.24]) {
    lights.cylinder([x, 2.224, -.020], .115, .133, .191, 8, '#ffac7b')
  }
  housing.add(lights.finish(signalMaterial))

  function pose(time: number, charging: boolean, hit: number) {
    rotor.rotation.z = time * 1.1 + (charging ? Math.sin(time * 20) * .30 : 0)
    housing.position.y = .97 + Math.sin(time * (charging ? 14 : 4.9)) * (charging ? .039 : .021)
    housing.rotation.y = -.19 + Math.sin(time * 1.12) * .075
    signalMaterial.color.set(charging ? '#ffe2a6' : '#e08d59')
    surface.emissive.setRGB(hit * .16, hit * .055, hit * .020)
  }
  return { group, pose }
}
