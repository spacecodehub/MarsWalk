import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/* ---------- procedural noise ---------- */
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
const smooth = (t) => t * t * (3 - 2 * t)
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const a = hash(xi, yi), b = hash(xi + 1, yi)
  const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  const u = smooth(xf), v = smooth(yf)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
function fbm(x, y, octaves = 5) {
  let sum = 0, amp = 0.5, freq = 1
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * freq, y * freq)
    freq *= 2
    amp *= 0.5
  }
  return sum
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/* ---------- builders ---------- */
function makePlanetTexture() {
  const w = 512, h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(w, h)
  const dark = new THREE.Color('#4a2418')
  const mid = new THREE.Color('#c1592e')
  const light = new THREE.Color('#e8a66f')
  const tmp = new THREE.Color()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h
      const n = fbm(u * 9, v * 5, 6)
      const streak = fbm(u * 3 + n, v * 14, 4)
      const t = clamp(n * 0.7 + streak * 0.5 - 0.1, 0, 1)
      if (t < 0.5) tmp.copy(dark).lerp(mid, t * 2)
      else tmp.copy(mid).lerp(light, (t - 0.5) * 2)
      const pole = smooth(clamp((Math.abs(v - 0.5) - 0.4) / 0.1, 0, 1))
      tmp.lerp(new THREE.Color('#f3e9e0'), pole * 0.85)
      const i = (y * w + x) * 4
      img.data[i] = tmp.r * 255
      img.data[i + 1] = tmp.g * 255
      img.data[i + 2] = tmp.b * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
const valleyAt = (z) => Math.sin(z * 0.022) * 20

function terrainHeight(x, z) {
  const mask = smooth(clamp(Math.abs(x - valleyAt(z)) / 42, 0, 1))
  const raw = (fbm(x * 0.013 + 3, z * 0.013, 6) - 0.32) * 75
  const dunes = Math.sin(x * 0.09 + z * 0.05) * 0.8
  return raw * (0.12 + 0.88 * mask) + dunes
}
function makeTerrain() {
  const size = 420, seg = 190
  const geo = new THREE.PlaneGeometry(size, size, seg, seg)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const low = new THREE.Color('#6b2a17')
  const mid = new THREE.Color('#b5502a')
  const high = new THREE.Color('#d98d5a')
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i) - 150 // push the field away from the camera
    const y = terrainHeight(x, z)
    pos.setXYZ(i, x, y, z)
    const t = clamp((y + 4) / 34, 0, 1)
    if (t < 0.5) c.copy(low).lerp(mid, t * 2)
    else c.copy(mid).lerp(high, (t - 0.5) * 2)
    c.multiplyScalar(0.88 + hash(x * 0.5, z * 0.5) * 0.2)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  })
  return new THREE.Mesh(geo, mat)
}

function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying float vY;
      void main() {
        vY = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying float vY;
      void main() {
        float t = smoothstep(-0.02, 0.5, vY);
        vec3 horizon = vec3(0.85, 0.40, 0.22);
        vec3 zenith = vec3(0.015, 0.02, 0.055);
        gl_FragColor = vec4(mix(horizon, zenith, t), 1.0);
      }`,
  })
  return new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), mat)
}

function makeStars(count = 900) {
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const r = 900
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 0.95 + 0.05) // upper hemisphere only
    arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    arr[i * 3 + 1] = r * Math.cos(phi)
    arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xffffff, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.85, fog: false, depthWrite: false,
  })
  return new THREE.Points(geo, mat)
}

function makeDust(count = 700) {
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 160
    arr[i * 3 + 1] = Math.random() * 40
    arr[i * 3 + 2] = -Math.random() * 160 + 20
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xe8b48a, size: 2, sizeAttenuation: false,
    transparent: true, opacity: 0.45, depthWrite: false,
  })
  return new THREE.Points(geo, mat)
}

function makePlanet() {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 48),
    new THREE.MeshStandardMaterial({ map: makePlanetTexture(), roughness: 1, fog: false }),
  )
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 48, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vN;
        void main() {
          vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vN;
        void main() {
          float i = pow(0.72 - dot(vN, vec3(0.0, 0.0, 1.0)), 3.0);
          gl_FragColor = vec4(1.0, 0.55, 0.32, 1.0) * clamp(i, 0.0, 1.0);
        }`,
    }),
  )
  group.add(body, glow)
  group.userData.body = body
  return group
}
/* ---------- rover ---------- */
const ROVER_SCALE = 3

function makeRover() {
  const root = new THREE.Group()
  const model = new THREE.Group()
  const white = new THREE.MeshStandardMaterial({ color: '#d9d4cb', roughness: 0.7, metalness: 0.2 })
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.9 })
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a24a', roughness: 0.5, metalness: 0.6 })
  const lens = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.2, metalness: 0.8 })

  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    model.add(m)
    return m
  }

  add(new THREE.BoxGeometry(1.6, 0.5, 2.4), white, 0, 0.95, 0)      // body
  add(new THREE.BoxGeometry(1.2, 0.15, 1.4), gold, 0, 1.28, -0.2)   // top deck
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 12), dark, 0, 1.0, -1.45).rotation.x = Math.PI / 2 // rear power unit
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), dark, 0.4, 1.8, 0.6) // mast
  add(new THREE.BoxGeometry(0.5, 0.25, 0.25), white, 0.4, 2.3, 0.6)        // camera head
  add(new THREE.BoxGeometry(0.12, 0.12, 0.05), lens, 0.25, 2.3, 0.74)      // left lens
  add(new THREE.BoxGeometry(0.12, 0.12, 0.05), lens, 0.55, 2.3, 0.74)      // right lens
  add(new THREE.CylinderGeometry(0.4, 0.1, 0.12, 16), white, -0.4, 1.5, -0.5).rotation.z = 0.5 // antenna dish
  add(new THREE.BoxGeometry(0.15, 0.15, 0.9), dark, 0, 0.8, 1.45)          // front arm
  add(new THREE.BoxGeometry(0.08, 0.08, 2.2), dark, -0.95, 0.6, 0)         // left strut
  add(new THREE.BoxGeometry(0.08, 0.08, 2.2), dark, 0.95, 0.6, 0)          // right strut

  const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 16)
  tireGeo.rotateZ(Math.PI / 2)
  const spokeGeo = new THREE.BoxGeometry(0.34, 0.08, 0.56)
  const wheels = []
  for (const sx of [-1.05, 1.05]) {
    for (const z of [-1, 0, 1]) {
      const w = new THREE.Group()
      w.add(new THREE.Mesh(tireGeo, dark))
      const s1 = new THREE.Mesh(spokeGeo, white)
      const s2 = new THREE.Mesh(spokeGeo, white)
      s2.rotation.x = Math.PI / 2
      w.add(s1, s2)
      w.position.set(sx, 0.36, z)
      model.add(w)
      wheels.push(w)
    }
  }

  model.scale.setScalar(ROVER_SCALE)
  root.add(model)
  root.userData = { wheels, lastT: 0, px: null, pz: null, pitch: 0, roll: 0 }
  return root
}

// a gentle loop through the valley; tweak the numbers to change the route
const roverPath = (a) => {
  const z = -32 + Math.cos(a) * 18
  return { x: valleyAt(z) + Math.sin(a) * 10, z }
}

function updateRover(rover, t) {
  const u = rover.userData
  const a = t * 0.13 // driving speed
  const p = roverPath(a)
  const n = roverPath(a + 0.02)
  const yaw = Math.atan2(n.x - p.x, n.z - p.z)
  const fx = Math.sin(yaw), fz = Math.cos(yaw)
  const rx = Math.cos(yaw), rz = -Math.sin(yaw)
  const L = 1.6 * ROVER_SCALE, W = 1.0 * ROVER_SCALE

  const hF = terrainHeight(p.x + fx * L, p.z + fz * L)
  const hB = terrainHeight(p.x - fx * L, p.z - fz * L)
  const hR = terrainHeight(p.x + rx * W, p.z + rz * W)
  const hL = terrainHeight(p.x - rx * W, p.z - rz * W)

  u.pitch += (Math.atan2(hF - hB, 2 * L) - u.pitch) * 0.1
  u.roll += (Math.atan2(hR - hL, 2 * W) - u.roll) * 0.1

  rover.position.set(p.x, (hF + hB + hR + hL) / 4 + 0.1, p.z)
  rover.rotation.set(-u.pitch, yaw, u.roll, 'YXZ')

  if (u.px !== null) {
    const dist = Math.hypot(p.x - u.px, p.z - u.pz)
    const spin = dist / (0.36 * ROVER_SCALE)
    u.wheels.forEach((w) => { w.rotation.x += spin })
  }
  u.px = p.x
  u.pz = p.z
}
/* ---------- component ---------- */
export default function MarsScene({
  height = '65vh', background = false, interactive = false, onPlanetClick, children,
}) {
  const wrapRef = useRef(null)
  const interactiveRef = useRef(interactive)
  const clickRef = useRef(onPlanetClick)
  interactiveRef.current = interactive
  clickRef.current = onPlanetClick

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return undefined
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0xc2603a, 0.0035)

    const camera = new THREE.PerspectiveCamera(58, 1, 0.5, 2500)
    camera.position.set(0, 7, 40)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    wrap.prepend(renderer.domElement)
    Object.assign(renderer.domElement.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block',
    })

    const sky = makeSky()
    const stars = makeStars()
    const terrain = makeTerrain()
    const dust = makeDust()
    const rover = makeRover()
    updateRover(rover, 0)

    const planet = makePlanet()
    planet.scale.setScalar(110)
    planet.position.set(-92, 82, -265)

    const sun = new THREE.DirectionalLight(0xffb27a, 2.4)
    sun.position.set(90, 28, 30)
    const fill = new THREE.HemisphereLight(0x3a4a7a, 0x7a3b22, 0.7)

    scene.add(sky, stars, terrain, dust, planet, sun, fill, rover)

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let hovering = false
    let hoverScale = 1
    let zooming = false
    let zoomP = 0
    const hitPlanet = (e) => {
      const r = wrap.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      return raycaster.intersectObject(planet.userData.body).length > 0
    }
    const onMove = (e) => {
      const r = wrap.getBoundingClientRect()
      mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * 2
      mouse.ty = ((e.clientY - r.top) / r.height - 0.5) * 2
      if (interactiveRef.current && !zooming) {
        hovering = hitPlanet(e)
        wrap.style.cursor = hovering ? 'pointer' : 'default'
      } else {
        hovering = false
        wrap.style.cursor = 'default'
      }
    }
    const onClick = (e) => {
      if (!interactiveRef.current || zooming || !hitPlanet(e)) return
      if (reduceMotion) { clickRef.current?.(); return }
      zooming = true
      setTimeout(() => { clickRef.current?.(); zooming = false }, 900)
    }
    wrap.addEventListener('click', onClick)
    const moveTarget = background ? window : wrap
    moveTarget.addEventListener('pointermove', onMove)

    const resize = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
      if (reduceMotion) renderer.render(scene, camera)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()

    const clock = new THREE.Clock()
    let raf = 0
    let visible = true

    const frame = () => {
      const t = clock.getElapsedTime()
      mouse.x += (mouse.tx - mouse.x) * 0.04
      mouse.y += (mouse.ty - mouse.y) * 0.04

      zoomP += ((zooming ? 1 : 0) - zoomP) * 0.05
      const ease = zoomP * zoomP * (3 - 2 * zoomP)
      camera.position.x = Math.sin(t * 0.08) * 7 + mouse.x * 6
      camera.position.y = 7 + Math.sin(t * 0.13) * 0.7 - mouse.y * 2
      camera.position.z = 40 - 22 * ease
      camera.fov = 58 - 24 * ease
      camera.updateProjectionMatrix()
      camera.lookAt(
        mouse.x * 4 + (planet.position.x - mouse.x * 4) * ease,
        12 + (planet.position.y - 12) * ease,
        -120 + (planet.position.z + 120) * ease,
      )
      hoverScale += ((hovering && !zooming ? 1.04 : 1) - hoverScale) * 0.1
      planet.scale.setScalar(110 * hoverScale)

      planet.userData.body.rotation.y += 0.0006

      const p = dust.geometry.attributes.position
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i) + 0.05
        let z = p.getZ(i) + 0.03
        if (x > 80) x = -80
        if (z > 20) z = -140
        p.setXYZ(i, x, p.getY(i), z)
      }
      p.needsUpdate = true
       updateRover(rover, t)

      renderer.render(scene, camera)
      if (visible) raf = requestAnimationFrame(frame)
    }

    // pause rendering while the hero is scrolled out of view
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      cancelAnimationFrame(raf)
      if (visible && !reduceMotion) raf = requestAnimationFrame(frame)
    })
    io.observe(wrap)

    if (reduceMotion) renderer.render(scene, camera)
    else raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      moveTarget.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('click', onClick)
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) {
          if (o.material.map) o.material.map.dispose()
          o.material.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [background])

  return (
    <section
      ref={wrapRef}
      className="mars-keep"
      style={
        background
          ? {
              position: 'fixed', inset: 0, width: '100%', height: '100%',
              zIndex: interactive ? 1 : -1, pointerEvents: interactive ? 'auto' : 'none',
              background: '#05060d',
            }
          : {
              position: 'relative', width: '100%', height, minHeight: 320,
              overflow: 'hidden', background: '#05060d',
            }
      }
    >
      {/* fades the scene into the dark app background below */}
      {!background && <div
        aria-hidden="true"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '35%',
          background: 'linear-gradient(to bottom, transparent, var(--mars-bg, #0d130f))',
          pointerEvents: 'none',
        }}
      />}
      {children && (!background || interactive) && (
        <div style={{ position: 'absolute', left: '5%', bottom: '12%', maxWidth: 560, color: '#f6e7da', pointerEvents: 'none' }}>
          {children}
        </div>
      )}
    </section>
  )
}
