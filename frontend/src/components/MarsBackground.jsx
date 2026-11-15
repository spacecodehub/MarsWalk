import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RotateCcw, Eye, Sparkles } from 'lucide-react';

// Mars Physical Constants & Real Exploration Coordinates
const MARS_AXIAL_TILT_RAD = (-25.19 * Math.PI) / 180; // 25.19° obliquity
const JEZERO_LAT_DEG = 18.38; // 18.38° N
const JEZERO_LON_DEG = 77.58; // 77.58° E (Delta landing site)
const MARS_RADIUS = 3.25;

export default function MarsBackground({
  subtle = false,
  sceneUrl = null,
  onResetReady = null,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [webglFailed, setWebglFailed] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [activeFeature, setActiveFeature] = useState('Jezero Crater');

  // Interactive 3D Control Refs
  const controlsRef = useRef({
    targetRotY: -1.2, // Initial longitude facing Jezero Delta
    targetRotX: 0.12,
    currentRotY: -1.2,
    currentRotX: 0.12,
    targetZoom: 8.5,
    currentZoom: 8.5,
    isDragging: false,
    prevPointerX: 0,
    prevPointerY: 0,
    pauseUntil: 0,
    resetView: null,
  });

  // Reset View Handler
  const handleResetView = useCallback(() => {
    const c = controlsRef.current;
    c.targetRotY = -1.2;
    c.targetRotX = 0.12;
    c.targetZoom = 8.5;
    c.pauseUntil = Date.now() + 1500;
  }, []);

  // Expose reset to window custom event for Dashboard.jsx
  useEffect(() => {
    const onWindowReset = () => handleResetView();
    window.addEventListener('mars:reset-view', onWindowReset);
    if (onResetReady) onResetReady(handleResetView);
    return () => {
      window.removeEventListener('mars:reset-view', onWindowReset);
    };
  }, [handleResetView, onResetReady]);

  // Three.js Photorealistic Mars Setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container || sceneUrl) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Verify WebGL availability
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.className =
        'block w-full h-full cursor-grab active:cursor-grabbing select-none pointer-events-auto';
      container.appendChild(renderer.domElement);
      canvasRef.current = renderer.domElement;
    } catch (err) {
      console.warn('WebGL initialization failed, falling back to static render:', err);
      setWebglFailed(true);
      setLoading(false);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, controlsRef.current.currentZoom);

    // Deep Space Starfield
    const starCount = 900;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const idx = i * 3;
      starPositions[idx] = (Math.random() - 0.5) * 80;
      starPositions[idx + 1] = (Math.random() - 0.5) * 80;
      starPositions[idx + 2] = -25 - Math.random() * 35;

      const tone = Math.random();
      if (tone > 0.8) {
        starColors[idx] = 1.0; starColors[idx + 1] = 0.85; starColors[idx + 2] = 0.75; // Warm
      } else if (tone > 0.5) {
        starColors[idx] = 0.85; starColors[idx + 1] = 0.92; starColors[idx + 2] = 1.0; // Cool Blue
      } else {
        starColors[idx] = 0.95; starColors[idx + 1] = 0.95; starColors[idx + 2] = 0.95; // Neutral
      }
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMaterial = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
    });
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // Master Axial Tilt Hierarchy
    const axialTiltGroup = new THREE.Group();
    axialTiltGroup.rotation.z = MARS_AXIAL_TILT_RAD;
    scene.add(axialTiltGroup);

    // Planet Rotation Group
    const marsPlanetGroup = new THREE.Group();
    axialTiltGroup.add(marsPlanetGroup);

    // Photorealistic Mars Sphere Geometry
    const sphereGeometry = new THREE.SphereGeometry(MARS_RADIUS, 96, 96);
    const marsMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.88,
      metalness: 0.04,
      bumpScale: 0.05,
    });

    const marsMesh = new THREE.Mesh(sphereGeometry, marsMaterial);
    marsPlanetGroup.add(marsMesh);

    // Load High-Res NASA/USGS Mars Surface Texture
    let marsTexture = null;
    let isDisposed = false;
    const textureLoader = new THREE.TextureLoader();

    textureLoader.load(
      '/assets/mars_2k_color.jpg',
      (tex) => {
        if (isDisposed) {
          tex.dispose();
          return;
        }
        marsTexture = tex;
        marsTexture.colorSpace = THREE.SRGBColorSpace;
        marsTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        marsMaterial.map = marsTexture;
        marsMaterial.bumpMap = marsTexture;
        marsMaterial.needsUpdate = true;
        setLoading(false);
      },
      undefined,
      (err) => {
        console.warn('Mars texture load failed, applying realistic procedural color:', err);
        marsMaterial.color = new THREE.Color(0xd96b43);
        setLoading(false);
      }
    );

    // Authentic Martian Atmospheric Limb Glow (Fresnel Dust Haze)
    const atmosphereGeometry = new THREE.SphereGeometry(MARS_RADIUS * 1.018, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float fresnel = dot(viewDir, vNormal);
          fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
          float glow = pow(fresnel, 2.7);
          vec3 dustColor = vec3(0.92, 0.46, 0.24); // Fine airborne ferric oxide dust
          gl_FragColor = vec4(dustColor, glow * 0.42);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    marsPlanetGroup.add(atmosphereMesh);

    // Jezero Crater Delta Landing Site Beacon (18.38°N, 77.58°E)
    const phi = (90 - JEZERO_LAT_DEG) * (Math.PI / 180);
    const theta = (JEZERO_LON_DEG + 180) * (Math.PI / 180);
    const jx = -(MARS_RADIUS * Math.sin(phi) * Math.cos(theta));
    const jy = MARS_RADIUS * Math.cos(phi);
    const jz = MARS_RADIUS * Math.sin(phi) * Math.sin(theta);

    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(jx, jy, jz);
    beaconGroup.lookAt(jx * 2, jy * 2, jz * 2);

    // Pin Dot
    const pinDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    beaconGroup.add(pinDot);

    // Pulse Ring
    const ringGeo = new THREE.RingGeometry(0.06, 0.1, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd96b43,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const pulseRing = new THREE.Mesh(ringGeo, ringMat);
    beaconGroup.add(pulseRing);

    marsPlanetGroup.add(beaconGroup);

    // Authentic Solar Lighting Configuration
    const sunlight = new THREE.DirectionalLight(0xffedd8, 2.75);
    sunlight.position.set(-5, 2.8, 6.5);
    scene.add(sunlight);

    const ambientLight = new THREE.HemisphereLight(0xffdfcb, 0x120805, 1.25);
    scene.add(ambientLight);

    const rimLight = new THREE.PointLight(0xd96b43, 0.85, 25);
    rimLight.position.set(6, -2.5, 3.5);
    scene.add(rimLight);

    // Responsive Canvas & Planet Placement
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);

      // Desktop: Shifted right so mission HUD sits cleanly on the left
      // Mobile: Centered and scaled
      if (width < 768) {
        axialTiltGroup.position.set(0.65, -0.45, 0);
        axialTiltGroup.scale.setScalar(0.72);
      } else if (width < 1280) {
        axialTiltGroup.position.set(subtle ? 3.4 : 2.2, 0, 0);
        axialTiltGroup.scale.setScalar(subtle ? 0.78 : 0.92);
      } else {
        axialTiltGroup.position.set(subtle ? 3.8 : 2.65, 0, 0);
        axialTiltGroup.scale.setScalar(subtle ? 0.75 : 1.0);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // User Mouse Drag & Touch Orbit Interaction
    const dom = renderer.domElement;
    const c = controlsRef.current;

    const onPointerDown = (e) => {
      c.isDragging = true;
      c.prevPointerX = e.clientX ?? (e.touches && e.touches[0].clientX);
      c.prevPointerY = e.clientY ?? (e.touches && e.touches[0].clientY);
      c.pauseUntil = Date.now() + 4000;
      setIsInteracting(true);
    };

    const onPointerMove = (e) => {
      if (!c.isDragging) return;
      const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
      if (clientX === undefined || clientY === undefined) return;

      const deltaX = clientX - c.prevPointerX;
      const deltaY = clientY - c.prevPointerY;
      c.prevPointerX = clientX;
      c.prevPointerY = clientY;

      c.targetRotY += deltaX * 0.0055;
      c.targetRotX += deltaY * 0.0045;

      // Clamp vertical latitude pitch to prevent camera flip
      c.targetRotX = Math.max(-Math.PI / 2.4, Math.min(Math.PI / 2.4, c.targetRotX));
      c.pauseUntil = Date.now() + 3000;
    };

    const onPointerUp = () => {
      c.isDragging = false;
      setIsInteracting(false);
      c.pauseUntil = Date.now() + 2500;
    };

    const onWheel = (e) => {
      e.preventDefault();
      c.targetZoom += e.deltaY * 0.0045;
      // Clamp zoom distance
      c.targetZoom = Math.max(5.8, Math.min(11.8, c.targetZoom));
      c.pauseUntil = Date.now() + 2000;
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // Touch handlers for mobile
    dom.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // Animation & Render Loop
    let animId;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Skip rendering if document is hidden or subtle background
      if (document.hidden) return;

      const delta = clock.getDelta();
      const now = Date.now();

      // Smooth Inertia Damping
      c.currentRotY += (c.targetRotY - c.currentRotY) * 0.075;
      c.currentRotX += (c.targetRotX - c.currentRotX) * 0.075;
      c.currentZoom += (c.targetZoom - c.currentZoom) * 0.085;

      camera.position.z = c.currentZoom;
      marsPlanetGroup.rotation.y = c.currentRotY;
      marsPlanetGroup.rotation.x = c.currentRotX;

      // Natural Martian Axial Auto-Rotation (Paused during user drag)
      if (!prefersReducedMotion && now > c.pauseUntil) {
        c.targetRotY += 0.00065;
      }

      // Animate Jezero Beacon Pulse
      const pulseTime = clock.getElapsedTime() * 2.2;
      const pulseScale = 1.0 + (Math.sin(pulseTime) * 0.5 + 0.5) * 0.8;
      pulseRing.scale.set(pulseScale, pulseScale, pulseScale);
      ringMat.opacity = Math.max(0.15, 0.9 - (pulseScale - 1.0));

      renderer.render(scene, camera);
    };

    animate();

    // Memory & Context Cleanup on Unmount
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);

      starGeometry.dispose();
      starMaterial.dispose();
      sphereGeometry.dispose();
      atmosphereGeometry.dispose();
      marsMaterial.dispose();
      atmosphereMaterial.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      if (marsTexture) marsTexture.dispose();
      renderer.dispose();
      if (dom.parentNode) dom.parentNode.removeChild(dom);
    };
  }, [subtle, sceneUrl]);

  return (
    <div
      className={`fixed inset-0 overflow-hidden z-0 transition-opacity duration-1000 ${
        subtle ? 'opacity-25 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
    >
      {/* Spline Iframe Embed Mode (If sceneUrl is explicitly provided) */}
      {sceneUrl ? (
        <iframe
          src={sceneUrl}
          title="Spline 3D Mars Scene"
          className="w-full h-full border-0 pointer-events-auto"
          loading="lazy"
        />
      ) : webglFailed ? (
        /* Photorealistic Static NASA Fallback when WebGL is unavailable */
        <div className="absolute inset-0 flex items-center justify-end pr-8 pointer-events-none">
          <div className="relative w-[520px] h-[520px] rounded-full overflow-hidden shadow-2xl">
            <img
              src="/assets/mars_2k_color.jpg"
              alt="Realistic Mars Sphere"
              className="w-full h-full object-cover animate-mars-spin"
            />
            <div className="absolute inset-0 rounded-full shadow-[inset_-40px_-25px_60px_rgba(0,0,0,0.92),inset_15px_10px_35px_rgba(255,190,150,0.3)]" />
          </div>
        </div>
      ) : (
        /* Three.js Interactive Photorealistic Canvas Container */
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      )}

      {/* Atmospheric Space Gradients for Dashboard Readability */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_78%_50%,rgba(217,107,67,0.08),transparent_55%)]" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-space-950 via-space-950/85 to-transparent" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-space-950/90 via-transparent to-space-950/60" />

      {/* Interactive 3D Planet HUD Controls (Only active on Dashboard view) */}
      {!subtle && (
        <div className="absolute bottom-6 right-8 z-10 flex items-center gap-3 font-mono text-xs select-none">
          {/* Landing Target Tag */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-space-900/80 backdrop-blur-md border border-space-700/80 text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mars-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-mars-500" />
            </span>
            <span>JEZERO DELTA • 18.38°N 77.58°E</span>
          </div>

          {/* Interaction status hint */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-space-900/60 backdrop-blur-md border border-space-800 text-slate-400 text-[11px]">
            <Eye className="w-3.5 h-3.5 text-mars-500" />
            <span>{isInteracting ? 'MANUAL ORBIT ACTIVE' : 'DRAG TO REVOLVE • SCROLL TO ZOOM'}</span>
          </div>

          {/* Reset Orientation Button */}
          <button
            onClick={handleResetView}
            title="Reset Mars camera and view Jezero Crater"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-space-900/90 hover:bg-space-800 text-slate-200 hover:text-white border border-space-700 hover:border-mars-500/50 shadow-lg transition-all duration-200 active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-mars-500" />
            <span>RESET VIEW</span>
          </button>
        </div>
      )}

      {/* Subtle Loading Cosmic Glow Indicator */}
      {loading && !webglFailed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-xs font-mono text-mars-500/80 tracking-wider">
            <Sparkles className="w-4 h-4 animate-spin text-mars-500" />
            <span>ALIGNING PLANETARY TELEMETRY...</span>
          </div>
        </div>
      )}
    </div>
  );
}
