import {
  BoxGeometry, CanvasTexture, CircleGeometry, Color, DirectionalLight, DoubleSide, HemisphereLight,
  DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, InstancedMesh, LinearSRGBColorSpace,
  Mesh, MeshBasicMaterial, NearestFilter, Object3D, OrthographicCamera, PlaneGeometry,
  RingGeometry, Scene, ShaderMaterial, SRGBColorSpace, WebGLRenderer, WebGLRenderTarget,
} from 'three'
import { ARENA, DASH_COOLDOWN, HZ, INSPECTION_HOLD, INSPECTION_RADIUS, SHORTCUT_RADIUS, type Run, type RunEffect, type Wave } from './simulation.hot.ts'
import { stationContact } from './floor-plan.ts'
import { createInspector, createTestRig } from './models.ts'
import { createSpriteAtlas, type SpriteName } from './sprites.ts'
import { createWorkshop } from './workshop.ts'

const MAX_SPRITES = 880
const TAU = Math.PI * 2
const MINT = new Color('#96f4cc')
const GOLD = new Color('#ffbb63')
const LILAC = new Color('#f593db')
const RUST = new Color('#ff8a63')
const ICE = new Color('#67bed3')
const DARK = new Color('#071619')
const HUD_INK = new Color('#111b27')
const CALIBRATION_PAINT = new Color('#bc986f')

const EMPTY_FLAGS = { depthWrite: false, transparent: true }
type Atlas = ReturnType<typeof createSpriteAtlas>

const spriteVertex = /* glsl */ [
  'attribute vec3 location;',
  'attribute vec2 dimensions;',
  'attribute vec4 frame;',
  'attribute vec2 style;',
  'varying vec2 atlasUv;',
  'varying float flash;',
  'void main() {',
  '  vec2 coords = vec2(style.x < 0.0 ? 1.0 - uv.x : uv.x, uv.y);',
  '  atlasUv = frame.xy + coords * frame.zw;',
  '  flash = style.y;',
  '  vec4 point = modelViewMatrix * vec4(location, 1.0);',
  '  point.xy += vec2(position.x, position.y + .5) * dimensions;',
  '  gl_Position = projectionMatrix * point;',
  '}',
].join('\n')

const spriteFragment = /* glsl */ [
  'uniform sampler2D textureAtlas;',
  'varying vec2 atlasUv;',
  'varying float flash;',
  'void main() {',
  '  vec4 paint = texture2D(textureAtlas, atlasUv);',
  '  if(paint.a < .55) discard;',
  '  float highlight = max(paint.r, max(paint.g, paint.b));',
  '  vec3 hit = mix(paint.rgb * vec3(1.12, 1., .87), vec3(1., .73, .46), .12 + .24 * highlight);',
  '  gl_FragColor = vec4(mix(paint.rgb, hit, flash), 1.);',
  '  #include <colorspace_fragment>',
  '}',
].join('\n')

const waveVertex = /* glsl */ [
  'varying vec2 ground;',
  'void main() {',
  '  ground = vec2(position.x, -position.y);',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);',
  '}',
].join('\n')

const waveFragment = /* glsl */ [
  'varying vec2 ground;',
  'uniform float angle;',
  'uniform float halfGap;',
  'uniform float radius;',
  'uniform float phase;',
  'uniform float lifetime;',
  'void main() {',
  '  float r = length(ground);',
  '  float a = atan(ground.y, ground.x);',
  '  float d = abs(atan(sin(a-angle),cos(a-angle)));',
  '  bool safe = d < halfGap;',
  '  vec3 red = vec3(.95,.18,.058);',
  '  vec3 green = vec3(.16,.78,.52);',
  '  float alpha = 0.0;',
  '  vec3 color = safe ? green : red;',
  '  if (phase < .5) {',
  '    if (r < .8 || r > 13.0) discard;',
  '    float stripes = step(.69,fract((ground.x + ground.y)*1.90));',
  '    float ruler = step(.91,fract(r/2.6));',
  '    float boundary = 1.0 - smoothstep(.012,.033,abs(d-halfGap));',
  '    alpha = (safe ? .055 : .065 + stripes*.090) + ruler*.091 + boundary*.54;',
  '    alpha *= (.62 + .38*lifetime) * (1.0-smoothstep(11.7,13.0,r));',
  '    if (boundary > .53) color = green;',
  '  } else {',
  '    if (safe) discard;',
  '    float edge = r-radius;',
  '    float crest = 1.0-smoothstep(.10,.52,abs(edge));',
  '    float tail = smoothstep(-1.08,-.22,edge)*(1.0-step(-.16,edge));',
  '    alpha = max(crest*.89,tail*.39);',
  '    color = mix(red, vec3(1.0,.79,.48), 1.0-smoothstep(.018,.23,abs(edge)));',
  '  }',
  '  if(alpha<.01) discard;',
  '  gl_FragColor = vec4(color,alpha);',
  '  #include <colorspace_fragment>',
  '}',
].join('\n')

const pixelPostVertex = /* glsl */ [
  'varying vec2 screenUv;',
  'void main() {',
  '  screenUv = uv;',
  '  gl_Position = vec4(position.xy,0.,1.);',
  '}',
].join('\n')

const pixelPostFragment = /* glsl */ [
  'uniform sampler2D picture;',
  'varying vec2 screenUv;',
  'void main() {',
  '  vec3 p = texture2D(picture, screenUv).rgb;',
  '  float vignette = length((screenUv - vec2(.55,.53))*vec2(1.02,.86));',
  '  p *= 1.08 - .19*smoothstep(.24,.69,vignette);',
  '  p += vec3(.008,.004,.010);',
  '  gl_FragColor = vec4(p,1.);',
  '  #include <colorspace_fragment>',
  '}',
].join('\n')

const pressFragment = /* glsl */ [
  'varying vec2 ground;',
  'uniform float elapsed;',
  'uniform float hit;',
  'void main() {',
  '  vec2 box = abs(ground) * 2.;',
  '  float edge = max(box.x, box.y);',
  '  float trace = step(.887,edge) * (1.-step(.933,edge));',
  '  float stripe = step(.64,fract((ground.x-ground.y)*12.));',
  '  float scale = step(.949,edge) * step(.36,fract((ground.x+ground.y)*12.0));',
  '  float alpha = .17 + stripe*(.10+elapsed*.10) + trace*.62 + scale*.53;',
  '  vec3 tone = mix(vec3(.27,.057,.041),vec3(1.,.36,.10),trace+scale*.58);',
  '  if(edge > .932 && edge < .946) { tone = vec3(.03,.014,.011); alpha = .91; }',
  '  if (hit > .5) {',
  '    float band = 1.0-smoothstep(.022,.11,abs(edge-elapsed));',
  '    tone = mix(vec3(.55,.12,.05),vec3(1.,.68,.29),band);',
  '    alpha = max(.24*(1.-elapsed),band*.90);',
  '  }',
  '  gl_FragColor = vec4(tone,alpha);',
  '  #include <colorspace_fragment>',
  '}',
].join('\n')

class SpriteBatch {
  readonly mesh: Mesh
  private readonly geometry: InstancedBufferGeometry
  private readonly locations = new Float32Array(MAX_SPRITES * 3)
  private readonly dimensions = new Float32Array(MAX_SPRITES * 2)
  private readonly frames = new Float32Array(MAX_SPRITES * 4)
  private readonly styles = new Float32Array(MAX_SPRITES * 2)
  private count = 0
  private readonly atlas: Atlas

  constructor(atlas: Atlas) {
    this.atlas = atlas
    const texture = new CanvasTexture(atlas.canvas)
    texture.colorSpace = SRGBColorSpace
    texture.minFilter = NearestFilter
    texture.magFilter = NearestFilter
    texture.generateMipmaps = false
    const plane = new PlaneGeometry(1, 1)
    this.geometry = new InstancedBufferGeometry()
    this.geometry.index = plane.index
    this.geometry.setAttribute('position', plane.attributes.position)
    this.geometry.setAttribute('uv', plane.attributes.uv)
    this.geometry.setAttribute('location', new InstancedBufferAttribute(this.locations, 3).setUsage(DynamicDrawUsage))
    this.geometry.setAttribute('dimensions', new InstancedBufferAttribute(this.dimensions, 2).setUsage(DynamicDrawUsage))
    this.geometry.setAttribute('frame', new InstancedBufferAttribute(this.frames, 4).setUsage(DynamicDrawUsage))
    this.geometry.setAttribute('style', new InstancedBufferAttribute(this.styles, 2).setUsage(DynamicDrawUsage))
    this.geometry.instanceCount = 0
    const material = new ShaderMaterial({
      uniforms: { textureAtlas: { value: texture } },
      vertexShader: spriteVertex,
      fragmentShader: spriteFragment,
    })
    this.mesh = new Mesh(this.geometry, material)
    this.mesh.frustumCulled = false
  }

  clear() { this.count = 0 }

  add(name: SpriteName, x: number, z: number, width: number, height: number, y = .05, facing = 1, flash = 0) {
    if (this.count >= MAX_SPRITES) return
    const index = this.count++
    const frame = this.atlas.frames[name]
    const sheet = this.atlas.canvas
    this.locations[index * 3] = x
    this.locations[index * 3 + 1] = y
    this.locations[index * 3 + 2] = z
    this.dimensions[index * 2] = width
    this.dimensions[index * 2 + 1] = height
    this.frames[index * 4] = frame.x / sheet.width
    this.frames[index * 4 + 1] = 1 - (frame.y + frame.height) / sheet.height
    this.frames[index * 4 + 2] = frame.width / sheet.width
    this.frames[index * 4 + 3] = frame.height / sheet.height
    this.styles[index * 2] = facing
    this.styles[index * 2 + 1] = flash
  }

  flush() {
    this.geometry.instanceCount = this.count
    for (const field of ['location', 'dimensions', 'frame', 'style']) {
      this.geometry.attributes[field].needsUpdate = true
    }
  }
}

function makeFloorBatch(geometry: BoxGeometry | CircleGeometry | RingGeometry, maximum: number, opacity: number) {
  const material = new MeshBasicMaterial({ color: 0xffffff, opacity, ...EMPTY_FLAGS, side: DoubleSide })
  const mesh = new InstancedMesh(geometry, material, maximum)
  mesh.instanceMatrix.setUsage(DynamicDrawUsage)
  mesh.frustumCulled = false
  mesh.count = 0
  return mesh
}

function makeWaveMesh(geometry: PlaneGeometry) {
  const material = new ShaderMaterial({
    vertexShader: waveVertex,
    fragmentShader: waveFragment,
    side: DoubleSide,
    ...EMPTY_FLAGS,
    uniforms: {
      angle: { value: 0 }, halfGap: { value: 0 }, radius: { value: 0 },
      phase: { value: 0 }, lifetime: { value: 0 },
    },
  })
  const mesh = new Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  mesh.visible = false
  mesh.renderOrder = 7
  return mesh
}

export function createGameView(host: HTMLElement) {
  const renderer = new WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setPixelRatio(1)
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.append(renderer.domElement)

  const world = new Scene()
  world.background = new Color('#24232f')
  world.add(createWorkshop())
  world.add(new HemisphereLight('#dee7f4', '#776376', 1.82))
  const overhead = new DirectionalLight('#ffe6c2', 2.14)
  overhead.position.set(-7, 12, -4)
  world.add(overhead)
  const rimLight = new DirectionalLight('#bce8e8', .76)
  rimLight.position.set(6, 4, 7)
  world.add(rimLight)
  const inspector = createInspector()
  const testRig = createTestRig()
  world.add(inspector.group, testRig.group)
  const camera = new OrthographicCamera(-18, 18, 10, -10, .1, 100)

  const atlas = createSpriteAtlas()
  const sprites = new SpriteBatch(atlas)
  world.add(sprites.mesh)
  const shadows = makeFloorBatch(new CircleGeometry(1, 17), 200, .62)
  const lightShadows = makeFloorBatch(new CircleGeometry(1, 12), 8, .36)
  const markings = makeFloorBatch(new RingGeometry(.89, 1, 42), 64, .75)
  const strips = makeFloorBatch(new BoxGeometry(1, .022, 1), 350, .82)
  shadows.renderOrder = 1
  lightShadows.renderOrder = 2
  markings.renderOrder = 4
  strips.renderOrder = 6
  const floorBatches = [shadows, lightShadows, markings, strips]
  world.add(...floorBatches)
  const dummy = new Object3D()

  const waveGeometry = new PlaneGeometry(40, 40)
  const wavers = Array.from({ length: 12 }, () => makeWaveMesh(waveGeometry))
  world.add(...wavers)
  const pressMarker = new Mesh(new PlaneGeometry(1, 1), new ShaderMaterial({
    vertexShader: waveVertex, fragmentShader: pressFragment, ...EMPTY_FLAGS,
    uniforms: { elapsed: { value: 0 }, hit: { value: 0 } },
  }))
  pressMarker.rotation.x = -Math.PI / 2
  pressMarker.renderOrder = 9
  pressMarker.visible = false
  world.add(pressMarker)

  const target = new WebGLRenderTarget(1, 1, {
    minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: true, stencilBuffer: false,
    colorSpace: LinearSRGBColorSpace,
  })
  const display = new Scene()
  const flatCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 2)
  const film = new ShaderMaterial({
    vertexShader: pixelPostVertex,
    fragmentShader: pixelPostFragment,
    depthTest: false,
    depthWrite: false,
    uniforms: { picture: { value: target.texture } },
  })
  const screen = new Mesh(new PlaneGeometry(2, 2), film)
  screen.frustumCulled = false
  display.add(screen)

  let aspect = 1.72
  let viewWidth = 36
  let viewHeight = 20
  let cameraX = 0
  let cameraZ = 0
  let lastFrame = 0
  let renderedRun: Run | null = null

  function resize() {
    const bounds = host.getBoundingClientRect()
    if (bounds.width < 2 || bounds.height < 2) return
    aspect = bounds.width / bounds.height
    viewHeight = Math.max(17.6, Math.min(25, 32 / aspect))
    viewWidth = viewHeight * aspect
    camera.left = -viewWidth / 2
    camera.right = viewWidth / 2
    camera.top = viewHeight / 2
    camera.bottom = -viewHeight / 2
    camera.updateProjectionMatrix()
    const scale = Math.min(1 / 1.57, 960 / bounds.width, 680 / bounds.height)
    const width = Math.max(1, Math.round(bounds.width * scale))
    const height = Math.max(1, Math.round(bounds.height * scale))
    renderer.setSize(width, height, false)
    target.setSize(width, height)
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  function shadow(x: number, z: number, rx: number, rz: number) {
    const i = shadows.count
    if (i >= shadows.instanceMatrix.count) return
    dummy.position.set(x + .15, .022, z + .05)
    dummy.rotation.set(-Math.PI / 2, 0, 0)
    dummy.scale.set(rx, rz, 1)
    dummy.updateMatrix()
    shadows.setMatrixAt(i, dummy.matrix)
    shadows.setColorAt(i, DARK)
    shadows.count++
  }

  function castShadow(x: number, z: number, width: number, length: number) {
    const index = lightShadows.count++
    dummy.position.set(x + length * .34, .020, z + length * .25)
    dummy.rotation.set(-Math.PI / 2, 0, -.49)
    dummy.scale.set(length, width, 1)
    dummy.updateMatrix()
    lightShadows.setMatrixAt(index, dummy.matrix)
    lightShadows.setColorAt(index, DARK)
  }

  function marker(x: number, z: number, radius: number, color: Color, height = .045) {
    const i = markings.count
    if (i >= markings.instanceMatrix.count) return
    dummy.position.set(x, height, z)
    dummy.rotation.set(-Math.PI / 2, 0, 0)
    dummy.scale.setScalar(radius)
    dummy.updateMatrix()
    markings.setMatrixAt(i, dummy.matrix)
    markings.setColorAt(i, color)
    markings.count++
  }

  function line(x: number, z: number, endX: number, endZ: number, width: number, color: Color, height = .08) {
    const i = strips.count
    if (i >= strips.instanceMatrix.count) return
    const dx = endX - x
    const dz = endZ - z
    dummy.position.set((x + endX) / 2, height, (z + endZ) / 2)
    dummy.rotation.set(0, -Math.atan2(dz, dx), 0)
    dummy.scale.set(Math.hypot(dx, dz), 1, width)
    dummy.updateMatrix()
    strips.setMatrixAt(i, dummy.matrix)
    strips.setColorAt(i, color)
    strips.count++
  }

  function drawDashMark(x: number, z: number, direction: number, scale: number, color = MINT) {
    const dx = Math.cos(direction) * scale
    const dz = Math.sin(direction) * scale
    line(x - dx * .65 - dz * .35, z - dz * .65 + dx * .35, x + dx * .15, z + dz * .15, .07, color, .13)
    line(x - dx * .65 + dz * .35, z - dz * .65 - dx * .35, x + dx * .15, z + dz * .15, .07, color, .13)
  }

  function drawWave(wave: Wave, run: Run, index: number) {
    const shape = wavers[index]
    if (!wave.active || run.tick < wave.warnAt) return
    const forecast = run.tick < wave.pulseAt
    const uniforms = shape.material.uniforms
    shape.visible = true
    shape.position.set(run.boss.x, .067 + index * .001, run.boss.z)
    uniforms.angle.value = wave.gapCenter
    uniforms.halfGap.value = wave.gap / 2
    uniforms.radius.value = wave.radius
    uniforms.phase.value = forecast ? 0 : 1
    uniforms.lifetime.value = Math.min(1, (run.tick - wave.warnAt) / 54)
    if (forecast) {
      const x = Math.cos(wave.gapCenter)
      const z = Math.sin(wave.gapCenter)
      drawDashMark(run.boss.x + x * 3.6, run.boss.z + z * 3.6, wave.gapCenter, .85)
      drawDashMark(run.boss.x + x * 6.4, run.boss.z + z * 6.4, wave.gapCenter, 1.05)
    }
  }

  function drawToolEffect(effect: RunEffect, progress: number, run: Run) {
    const dx = effect.toX - effect.x
    const dz = effect.toZ - effect.z
    const reach = Math.hypot(dx, dz)
    const heading = Math.atan2(dz, dx)
    if (effect.kind === 'file') {
      if (Math.floor(progress * 7) % 2 === 0) {
        line(effect.x + dx * .29, effect.z + dz * .29, effect.toX, effect.toZ, .095, ICE, .145)
        sprites.add('spark', effect.toX, effect.toZ, .48, .43, .42, 1, .42)
      }
    } else if (effect.kind === 'tape') {
      const length = Math.max(.20, 1 - Math.abs(progress - .32) / .68)
      const endX = effect.x + dx * length
      const endZ = effect.z + dz * length
      line(effect.x, effect.z, endX, endZ, .17, GOLD, .12)
      const steps = Math.floor(reach * length / .45)
      const width = run.ranks.tape >= 3 ? .29 : .15
      const sideX = -Math.sin(heading) * width
      const sideZ = Math.cos(heading) * width
      for (let i = 1; i <= steps; i++) {
        const fraction = i * .45 / Math.max(.01, reach)
        const x = effect.x + dx * fraction
        const z = effect.z + dz * fraction
        line(x, z, x + sideX, z + sideZ, .045, RUST, .135)
      }
    } else if (effect.kind === 'mallet') {
      marker(effect.x, effect.z, .6 + progress * reach, GOLD, .071)
      marker(effect.x, effect.z, .34 + progress * reach * (run.ranks.mallet >= 3 ? .92 : .75), RUST, .073)
    } else if (effect.kind === 'wrench') {
      const radius = .46 + reach * (.34 + .38 * progress)
      for (let i = 0; i < 7; i++) {
        const spread = run.ranks.wrench >= 3 ? 1.26 : .91
        const a = heading - spread + i * (spread * 2 / 7)
        const b = a + spread * .28
        line(effect.x + Math.cos(a) * radius, effect.z + Math.sin(a) * radius, effect.x + Math.cos(b) * radius, effect.z + Math.sin(b) * radius, .21 * (1 - progress) + .035, GOLD, .11)
      }
    } else if (effect.kind === 'saw') {
      const sideX = -Math.sin(heading)
      const sideZ = Math.cos(heading)
      for (let i = 0; i < 8; i++) {
        const along = .13 + i * .1
        const spread = run.ranks.saw >= 3 ? .7 : .46
        const side = (i % 2 ? spread : -spread) + Math.sin(progress * 10) * .23
        line(effect.x + dx * along + sideX * side, effect.z + dz * along + sideZ * side, effect.x + dx * (along + .12) - sideX * side, effect.z + dz * (along + .12) - sideZ * side, .073, i % 2 ? ICE : MINT, .13)
      }
    }
  }

  function drawIncident(run: Run) {
    const incident = run.incident
    if (!incident || run.phase !== 'floor') return
    const { inspection, shortcut } = incident
    const sweep = .5 + .5 * Math.sin(run.tick * .13)
    if (incident.stage === 'warning') {
      for (let i = 0; i < incident.parts.length; i++) {
        const part = incident.parts[i]
        const tone = part.kind === 'phantom' ? LILAC : RUST
        marker(part.x, part.z, .52 + sweep * .23, tone)
        line(part.x - .21, part.z - .21, part.x + .21, part.z + .21, .055, tone)
        line(part.x - .21, part.z + .21, part.x + .21, part.z - .21, .055, tone)
      }
      return
    }

    const vx = inspection.x - shortcut.x
    const vz = inspection.z - shortcut.z
    const angle = Math.atan2(vz, vx)
    for (let index = 1; index <= 2; index++) {
      const step = index * .25
      drawDashMark(shortcut.x + vx * step, shortcut.z + vz * step, angle, .56)
    }
    marker(inspection.x, inspection.z, INSPECTION_RADIUS, MINT, .05)
    marker(inspection.x, inspection.z, INSPECTION_RADIUS + .14 + .08 * sweep, ICE, .052)
    line(inspection.x - .27, inspection.z, inspection.x + .27, inspection.z, .079, MINT, .071)
    line(inspection.x, inspection.z - .27, inspection.x, inspection.z + .27, .079, MINT, .071)
    const lit = Math.floor(20 * inspection.held / INSPECTION_HOLD)
    for (let index = 0; index < lit; index++) {
      const a = index * TAU / 20 - Math.PI / 2
      const b = a + .27
      const radius = INSPECTION_RADIUS + .06
      line(inspection.x + Math.cos(a) * radius, inspection.z + Math.sin(a) * radius,
        inspection.x + Math.cos(b) * radius, inspection.z + Math.sin(b) * radius, .13, MINT, .079)
    }
  }

  function drawFloor(run: Run) {
    const time = run.tick / HZ
    drawIncident(run)
    const surge = run.surge
    if (surge) {
      for (let i = surge.issued; i < surge.groups.length; i++) {
        for (const part of surge.groups[i]) {
          const tone = part.kind === 'phantom' ? LILAC : i > surge.issued ? RUST : GOLD
          marker(part.x, part.z, .43 + .07 * Math.sin(time * 9), tone, .07)
          drawDashMark(part.x, part.z, Math.atan2(-part.z * .24, run.player.x - part.x), .47, tone)
        }
      }
    }
    for (const shard of run.shards) {
      if (!shard.active) continue
      const pulse = .5 + .5 * Math.sin(time * 6 + shard.phase)
      const size = shard.value > 1 ? .37 : .28
      sprites.add('xp', shard.x, shard.z, size * .8, size, .08 + pulse * .12, 1, pulse * .18)
    }
    for (const tool of run.tools) {
      if (!tool.active) continue
      const float = .5 + .5 * Math.sin(time * 4.2)
      marker(tool.x, tool.z, .88 + float * .11, MINT)
      marker(tool.x, tool.z, .34, ICE)
      shadow(tool.x, tool.z, .39, .24)
      sprites.add(tool.kind, tool.x, tool.z, 1.09, 1.04, .19 + .15 * float)
      if (float > .66) sprites.add('spark', tool.x + .35, tool.z + .09, .21, .19, .99 + .13 * float)
    }
    for (const shortcut of run.shortcuts) {
      if (!shortcut.active) continue
      const pulse = .5 + .5 * Math.sin(time * 4)
      const color = shortcut.kind === 'pass' ? GOLD : LILAC
      marker(shortcut.x, shortcut.z, SHORTCUT_RADIUS, color)
      marker(shortcut.x, shortcut.z, .46, color)
      shadow(shortcut.x, shortcut.z, .57, .31)
      sprites.add(shortcut.kind, shortcut.x, shortcut.z, 1.02, 1.05, .25 + pulse * .27)
    }
    for (const enemy of run.enemies) {
      if (!enemy.active) continue
      const charging = enemy.mode === 1
      const recovering = enemy.mode === 3
      const bob = .04 + (recovering ? .021 : .087) *
        Math.sin(time * (charging ? 29 : enemy.kind === 'blank' ? 13 : 9) + enemy.x * 2 + enemy.z)
      const flash = enemy.flashUntil > run.tick ? .74 : 0
      const width = enemy.kind === 'bolt' ? 1.08 : enemy.kind === 'phantom' ? 1.02 : .99
      const height = enemy.kind === 'bolt' ? 1.44 : enemy.kind === 'phantom' ? 1.24 : .79
      shadow(enemy.x, enemy.z, width * .48, width * .31)
      sprites.add(enemy.kind, enemy.x, enemy.z, width * (recovering ? 1.05 : 1), height * (recovering ? .91 : 1),
        Math.max(.025, bob), enemy.facing, Math.max(flash, charging ? .27 : 0))
      if (charging) {
        const bolt = enemy.kind === 'bolt'
        const tone = bolt ? RUST : LILAC
        const maximum = bolt ? 6.12 : 9.4
        const travel = maximum * stationContact(enemy.x, enemy.z, enemy.x + enemy.dx * maximum,
          enemy.z + enemy.dz * maximum, bolt ? enemy.radius : .08)
        marker(enemy.x, enemy.z, enemy.radius + .14, tone, .057)
        for (let a = .59; a < travel - .12; a += bolt ? .74 : 1.06) {
          const b = Math.min(travel, a + (bolt ? .38 : .31))
          line(enemy.x + enemy.dx * a, enemy.z + enemy.dz * a, enemy.x + enemy.dx * b,
            enemy.z + enemy.dz * b, bolt ? .19 : .076, tone)
        }
        if (bolt && travel > .82) {
          const x = enemy.x + enemy.dx * travel
          const z = enemy.z + enemy.dz * travel
          for (const side of [-1, 1]) {
            line(x - enemy.dx * .36 - enemy.dz * side * .21, z - enemy.dz * .36 + enemy.dx * side * .21,
              x, z, .073, tone)
          }
        }
      }
    }
    for (const projectile of run.projectiles) {
      if (!projectile.active) continue
      sprites.add('projectile', projectile.x, projectile.z, .43, .43, .17)
      line(projectile.x - projectile.dx * .48, projectile.z - projectile.dz * .48, projectile.x, projectile.z, .12, LILAC, .16)
    }

    const { player } = run
    const dashing = run.tick < player.dashUntil && player.moving
    const strokeKind = run.activeTool === 'caliper' ? 'slice' : run.activeTool
    const stroke = run.effects.find(effect => effect.kind === strokeKind && run.tick - effect.from < 12 && effect.until > run.tick)
    const dx = dashing ? player.dashX : !player.moving && stroke ? stroke.toX - player.x : player.dx
    const dz = dashing ? player.dashZ : !player.moving && stroke ? stroke.toZ - player.z : player.dz
    const desired = Math.atan2(dx, dz)
    const turn = desired - inspector.group.rotation.y
    inspector.group.rotation.y = renderedRun === run
      ? inspector.group.rotation.y + Math.atan2(Math.sin(turn), Math.cos(turn)) * .36
      : desired
    inspector.group.position.set(player.x, 0, player.z)
    inspector.group.scale.setScalar(1.18)
    const flash = Math.max(0, 1 - (run.tick - player.hurtAt) / 15)
    inspector.pose(time, player.moving, dashing, stroke ? 1 - (run.tick - stroke.from) / 12 : 0, run.activeTool, flash)
    shadow(player.x - .06, player.z - .024, .46, .27)
    castShadow(player.x, player.z, .37, dashing ? .97 : .75)
    marker(player.x, player.z, .50, run.tick < run.boostUntil ? GOLD : MINT)
    const hp = player.hp / player.maximumHp
    line(player.x - .57, player.z + .71, player.x + .57, player.z + .71, .135, HUD_INK, .10)
    if (hp > 0) line(player.x - .52, player.z + .71, player.x - .52 + 1.04 * hp,
      player.z + .71, .081, hp < .27 ? RUST : MINT, .12)
    if (run.tick < player.dashReadyAt) {
      const charge = 1 - (player.dashReadyAt - run.tick) / DASH_COOLDOWN
      if (charge > .01) line(player.x - .50, player.z + .88, player.x - .50 + charge,
        player.z + .88, .060, ICE, .10)
    }
    if (run.boss.active) {
      const { boss } = run
      const press = boss.press
      const warning = !!press && run.tick < press.strikesAt
      const charging = warning ||
        run.waves.some(wave => wave.active && run.tick >= wave.warnAt && run.tick < wave.pulseAt)
      let ramTravel = 0
      if (press) {
        const toImpact = press.strikesAt - run.tick
        ramTravel = warning
          ? Math.max(0, 1 - toImpact / 9) ** 2
          : 1 - Math.min(1, -toImpact / 23)
      }
      testRig.group.position.set(boss.x, 0, boss.z)
      testRig.pose(time, charging, Math.max(0, (boss.flashUntil - run.tick) / 7), ramTravel)
      shadow(boss.x - .12, boss.z - .045, 1.78, 1.09)
      castShadow(boss.x, boss.z, .99, 1.90)
      marker(boss.x, boss.z, 1.93, RUST)
      for (let i = 0; i < run.waves.length; i++) drawWave(run.waves[i], run, i)
      if (press) {
        pressMarker.visible = true
        pressMarker.position.set(press.x, .092, press.z)
        pressMarker.scale.set(press.halfX * 2, press.halfZ * 2, 1)
        pressMarker.material.uniforms.hit.value = warning ? 0 : 1
        pressMarker.material.uniforms.elapsed.value = warning
          ? (run.tick - press.warnAt) / (press.strikesAt - press.warnAt)
          : (run.tick - press.strikesAt) / 28
      }
    }

    for (const effect of run.effects) {
      if (effect.until <= run.tick) continue
      const progress = (run.tick - effect.from) / (effect.until - effect.from)
      if (effect.kind === 'slice') {
        const dx = effect.toX - effect.x
        const dz = effect.toZ - effect.z
        const at = Math.min(.96, .47 + progress * .64)
        const withBoost = run.tick < run.boostUntil
        line(effect.x + dx * .09, effect.z + dz * .09, effect.x + dx * at, effect.z + dz * at, .14 * (1 - progress) + .045, withBoost ? GOLD : MINT, .12)
        line(effect.x + dx * .22 - dz * .024, effect.z + dz * .22 + dx * .024, effect.x + dx * at - dz * .021, effect.z + dz * at + dx * .021, .06 * (1 - progress) + .025, withBoost ? RUST : ICE, .11)
        if (progress < .48) sprites.add('spark', effect.toX, effect.toZ, .37, .39, .57, 1, .35)
      } else if (effect.kind === 'hit' || effect.kind === 'impact') {
        const impact = effect.kind === 'impact'
        if (impact) marker(effect.x, effect.z, .23 + .53 * progress, GOLD, .057)
        for (let i = 0; i < 4; i++) {
          const angle = (effect.from * .31 + i * 1.57) % TAU
          const distance = .17 + progress * .64
          sprites.add(impact ? 'projectile' : 'spark', effect.x + Math.cos(angle) * distance, effect.z + Math.sin(angle) * distance,
            .24 * (1.25 - progress), .22 * (1.25 - progress), .30 + progress * .43)
        }
      } else if (effect.kind === 'dash') {
        const dx = effect.toX - effect.x
        const dz = effect.toZ - effect.z
        const width = .20 * (1 - progress) + .025
        line(effect.x, effect.z, effect.toX, effect.toZ, width, ICE, .05)
        for (const side of [-1, 1]) {
          const spread = side * (.05 + progress * .06)
          line(effect.x + dx * .12 - dz * spread, effect.z + dz * .12 + dx * spread,
            effect.toX - dz * spread, effect.toZ + dx * spread, .065 * (1 - progress), MINT, .054)
        }
        for (let i = 0; i < 3; i++) {
          const at = .27 + i * .26 - progress * .21
          const side = (i % 2 ? .14 : -.14) * (1 + progress)
          const size = .16 * (1 - progress)
          sprites.add('spark', effect.x + dx * at - dz * side, effect.z + dz * at + dx * side, size, size, .13 + .18 * progress)
        }
      } else if (effect.kind === 'clear') {
        marker(effect.x, effect.z, .9 + progress * 13, GOLD, .055)
        marker(effect.x, effect.z, .4 + progress * 9.8, MINT, .056)
        for (let i = 0; i < 12; i++) {
          const angle = i * TAU / 12
          const radius = .8 + progress * 12.9
          const trail = Math.max(.1, radius - 1.28)
          const dx = Math.cos(angle)
          const dz = Math.sin(angle)
          line(effect.x + dx * trail, effect.z + dz * trail,
            effect.x + dx * radius, effect.z + dz * radius, .12 - .055 * progress, GOLD, .078)
        }
      } else if (effect.kind === 'inspection') {
        marker(effect.x, effect.z, .6 + progress * 5.6, MINT, .058)
        marker(effect.x, effect.z, .34 + progress * 3.25, ICE, .06)
      } else if (effect.kind === 'toolPickup') {
        marker(effect.x, effect.z, .46 + progress * 2.1, MINT, .054)
      } else if (effect.kind === 'pickup' || effect.kind === 'arrival') {
        marker(effect.x, effect.z, .5 + progress * (effect.kind === 'arrival' ? 5.8 : 2.3), effect.kind === 'arrival' ? RUST : GOLD, .055)
      } else {
        drawToolEffect(effect, progress, run)
      }
    }
  }

  function drawTitle(time: number) {
    const portrait = aspect < 1
    const x = portrait ? 1.66 : 6.9
    const z = portrait ? -2.74 : -.34
    const bob = .06 * Math.sin(time * 2)
    inspector.group.scale.setScalar(portrait ? 2.84 : 3.03)
    inspector.group.position.set(x, 0, z)
    inspector.group.rotation.y = .36 + Math.sin(time * .85) * .18
    inspector.pose(time, false, false, (.5 + .5 * Math.sin(time * 3.5)) ** 6 * .64, 'caliper', 0)
    shadow(x, z, 1.32, .74)
    castShadow(x, z, .86, 1.76)
    marker(x, z, 1.44 + bob, MINT)
    for (let tick = 0; tick < 24; tick++) {
      const angle = TAU * tick / 24
      const dx = Math.cos(angle)
      const dz = Math.sin(angle)
      const end = tick % 6 === 0 ? 1.84 : 1.73
      line(x + dx * 1.60, z + dz * 1.60, x + dx * end, z + dz * end, .044, CALIBRATION_PAINT, .055)
    }
    marker(x + 3.4, z - 3.2, .74, GOLD)
    sprites.add('pass', x + 3.4, z - 3.2, .87, .9, .26 + Math.sin(time * 2.7) * .13)
    const layout: { name: SpriteName; x: number; z: number; w: number; h: number }[] = [
      { name: 'blank', x: -3.9, z: -.8, w: 1.61, h: 1.21 },
      { name: 'blank', x: 4.8, z: 2.7, w: 1.39, h: 1.05 },
      { name: 'bolt', x: 3.1, z: 2.3, w: 1.50, h: 1.91 },
      { name: 'phantom', x: -.8, z: -4.2, w: 1.48, h: 1.75 },
    ]
    for (const prop of layout) {
      shadow(x + prop.x, z + prop.z, prop.w * .45, prop.w * .25)
      sprites.add(prop.name, x + prop.x, z + prop.z, prop.w, prop.h, .1 + .055 * Math.sin(time * 2 + prop.x), prop.x > 0 ? -1 : 1)
    }
    const aimX = x + 4.8
    const aimZ = z + 2.7
    const blink = Math.pow(.5 + Math.sin(time * 4.1) * .5, 8)
    if (blink > .19) {
      line(x + .64, z + .29, aimX, aimZ, .09 + blink * .08, MINT, .105)
      sprites.add('spark', aimX, aimZ, .51, .57, .45, 1, .6)
    }
    for (let i = 0; i < 5; i++) {
      const angle = i * 1.3
      sprites.add('xp', x + Math.cos(angle) * 2, z + Math.sin(angle) * 2, .29, .34, .08 + .13 * (.5 + .5 * Math.sin(time * 2 + i)))
    }
  }

  function icon(destination: HTMLCanvasElement, name: SpriteName) {
    const context = destination.getContext('2d')
    if (!context) return
    const frame = atlas.frames[name]
    const scale = Math.min(destination.width / frame.width, destination.height / frame.height)
    const width = Math.max(1, Math.floor(frame.width * scale))
    const height = Math.max(1, Math.floor(frame.height * scale))
    context.clearRect(0, 0, destination.width, destination.height)
    context.imageSmoothingEnabled = false
    context.drawImage(atlas.canvas, frame.x, frame.y, frame.width, frame.height, Math.round((destination.width - width) / 2), Math.round((destination.height - height) / 2), width, height)
  }

  function render(run: Run | null, milliseconds: number, trainingTarget?: { x: number; z: number } | null) {
    const frameTime = milliseconds > lastFrame ? Math.min(58, milliseconds - lastFrame) : 1000 / HZ
    const cameraStep = 1 - .85 ** (frameTime * HZ / 1000)
    lastFrame = milliseconds
    sprites.clear()
    shadows.count = 0
    lightShadows.count = 0
    markings.count = 0
    strips.count = 0
    testRig.group.visible = run?.boss.active ?? false
    pressMarker.visible = false
    for (const wave of wavers) wave.visible = false
    if (run) {
      drawFloor(run)
      if (trainingTarget) {
        marker(trainingTarget.x, trainingTarget.z, .84 + Math.sin(run.tick / 10) * .08, MINT, .08)
        marker(trainingTarget.x, trainingTarget.z, .46, MINT, .08)
        const { x, z } = run.player
        const distance = Math.hypot(trainingTarget.x - x, trainingTarget.z - z)
        if (distance > 1.3) {
          const dx = (trainingTarget.x - x) / distance
          const dz = (trainingTarget.z - z) / distance
          for (let step = .86; step < distance - .62; step += .56) {
            const tipX = x + dx * step
            const tipZ = z + dz * step
            for (const side of [-1, 1]) {
              line(tipX - dx * .26 - dz * .17 * side, tipZ - dz * .26 + dx * .17 * side,
                tipX, tipZ, .077, MINT, .079)
            }
          }
        }
      }
      let targetX = aspect < 1.19 ? run.player.x * .71 : run.player.x * .20
      const targetZ = aspect < .9 ? run.player.z * .54 : run.player.z * .17
      if (aspect < 1.19 && run.incident?.stage === 'open') {
        const { shortcut, inspection } = run.incident
        const left = Math.min(run.player.x, shortcut.x, inspection.x) - 1.52
        const right = Math.max(run.player.x, shortcut.x, inspection.x) + 1.52
        if (right - left <= viewWidth) {
          targetX = Math.max(right - viewWidth / 2, Math.min(left + viewWidth / 2, targetX))
        }
      }
      cameraX += (targetX - cameraX) * cameraStep
      cameraZ += (targetZ - cameraZ) * cameraStep
    } else {
      const portrait = aspect < 1
      cameraX = portrait ? 1.5 : -2.3
      cameraZ = portrait ? -.25 : -2.61
      drawTitle(milliseconds / 1000)
    }
    renderedRun = run

    const margin = aspect >= 1.19 ? 3.05 : Math.max(0, ARENA.x - viewWidth * .29)
    cameraX = Math.max(-margin, Math.min(margin, cameraX))
    camera.position.set(cameraX, run ? 28 : 23, cameraZ + (run ? 24 : 26))
    camera.lookAt(cameraX, 0, cameraZ)
    sprites.flush()
    for (const batch of floorBatches) {
      if (!batch.count) continue
      batch.instanceMatrix.needsUpdate = true
      if (batch.instanceColor) batch.instanceColor.needsUpdate = true
    }

    renderer.setRenderTarget(target)
    renderer.render(world, camera)
    renderer.setRenderTarget(null)
    renderer.render(display, flatCamera)
  }

  function offscreenSide(x: number) {
    const offset = x - cameraX
    const limit = viewWidth / 2 - .48
    return offset < -limit ? 'left' : offset > limit ? 'right' : null
  }

  return { render, icon, offscreenSide, canvas: renderer.domElement }
}
