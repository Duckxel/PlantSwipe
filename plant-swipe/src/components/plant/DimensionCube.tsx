import React from 'react'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { cn } from '@/lib/utils'

type DimensionCubeProps = {
  /** Plant height in centimeters */
  heightCm: number | null
  /** Plant wingspan / spread in centimeters (used for both X and Z) */
  wingspanCm: number | null
  className?: string
}

const HUMAN_MODEL_URL =
  'https://media.aphylia.app/UTILITY/admin/uploads/obj/basespiderman-5d85e4ec-e7a4-4be3-b585-b770d0718bf3.obj'
const HUMAN_HEIGHT_M = 1.8

export const DimensionCube: React.FC<DimensionCubeProps> = ({
  heightCm,
  wingspanCm,
  className,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const container = containerRef.current
    if (!container) return

    const plantH = Math.max((heightCm ?? 30) / 100, 0.05)
    const plantW = Math.max((wingspanCm ?? 30) / 100, 0.05)

    const humanEstimatedWidth = 0.8
    const gap = 0.35
    const sceneMaxHeight = Math.max(plantH, HUMAN_HEIGHT_M)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1

    const resolveSize = () => {
      const rect = container.getBoundingClientRect()
      const width = Math.round(rect.width) || 200
      const h = Math.round(rect.height) || 200
      return { width, height: h }
    }

    const { width: initialWidth, height: initialHeight } = resolveSize()
    renderer.setSize(initialWidth, initialHeight, false)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = `${initialWidth}px`
    renderer.domElement.style.height = `${initialHeight}px`
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x050e0d, 0.06)

    // Scene layout: cube at origin, human to the right
    const humanFarEdge = plantW / 2 + gap + humanEstimatedWidth
    const orbitCenter = new THREE.Vector3(0, plantH / 2, 0)

    // Asymmetric orthographic frustum — ground pinned to viewport bottom
    const groundMargin = 0.08
    const frustumBottom = -(plantH / 2 + groundMargin)
    const frustumTop = (sceneMaxHeight - plantH / 2) * 1.12
    const frustumFullHeight = frustumTop - frustumBottom

    const computeFrustum = (aspect: number) => {
      const halfW = (frustumFullHeight / 2) * aspect
      return { halfW, top: frustumTop, bottom: frustumBottom }
    }

    const initialAspect = initialWidth / Math.max(1, initialHeight)
    let { halfW } = computeFrustum(initialAspect)
    let frustumT = frustumTop
    let frustumB = frustumBottom

    const camera = new THREE.OrthographicCamera(
      -halfW, halfW, frustumT, frustumB, 0.1, 500,
    )

    // Front-facing camera — no tilt, orbits at cube center height
    const cameraDistance = Math.max(sceneMaxHeight, humanFarEdge + 1) * 3
    camera.position.set(
      orbitCenter.x + cameraDistance,
      orbitCenter.y,
      orbitCenter.z + cameraDistance,
    )
    camera.lookAt(orbitCenter)

    // ── Lighting — balanced for flat front view ──
    const ambientLight = new THREE.AmbientLight(0xc8f0e0, 0.7)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8)
    keyLight.position.set(3, 5, 4)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x88ccbb, 0.35)
    fillLight.position.set(-4, 2, -3)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0x34d399, 0.25)
    rimLight.position.set(0, 3, -5)
    scene.add(rimLight)

    // ── Plant box (outer) ──
    const outerGeometry = new THREE.BoxGeometry(plantW, plantH, plantW)
    const outerMaterial = new THREE.MeshStandardMaterial({
      color: 0x041a16,
      transparent: true,
      opacity: 0.18,
      metalness: 0.4,
      roughness: 0.5,
      emissive: 0x0d9488,
      emissiveIntensity: 0.5,
    })
    const outerMesh = new THREE.Mesh(outerGeometry, outerMaterial)
    outerMesh.position.set(0, plantH / 2, 0)
    scene.add(outerMesh)

    const outerWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(outerGeometry),
      new THREE.LineBasicMaterial({ color: 0x34f5c6, linewidth: 2 }),
    )
    outerWire.position.set(0, plantH / 2, 0)
    scene.add(outerWire)

    const innerWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(plantW * 0.7, plantH * 0.7, plantW * 0.7),
      ),
      new THREE.LineBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.6,
      }),
    )
    innerWire.position.set(0, plantH / 2, 0)
    scene.add(innerWire)

    // ── Ground grid — large enough to fill the entire visible floor ──
    const gridExtent = Math.max(frustumFullHeight * 3, humanFarEdge * 5, 20)
    const gridDivisions = Math.round(gridExtent * 2.5)
    const grid = new THREE.GridHelper(
      gridExtent,
      gridDivisions,
      0x1a6b5a,
      0x0d3d33,
    )
    const gridMat = grid.material as THREE.Material
    gridMat.transparent = true
    gridMat.opacity = 0.35
    scene.add(grid)

    // Brighter sub-grid for a premium layered look
    const subGrid = new THREE.GridHelper(
      gridExtent,
      Math.round(gridDivisions / 5),
      0x34f5c6,
      0x34f5c6,
    )
    const subGridMat = subGrid.material as THREE.Material
    subGridMat.transparent = true
    subGridMat.opacity = 0.12
    subGrid.position.y = 0.001
    scene.add(subGrid)

    // ── Human reference model ──
    const loader = new OBJLoader()
    let humanGroup: THREE.Group | null = null

    loader.load(
      HUMAN_MODEL_URL,
      (obj) => {
        const bbox = new THREE.Box3().setFromObject(obj)
        const rawHeight = bbox.max.y - bbox.min.y
        if (rawHeight <= 0) return

        const scaleFactor = HUMAN_HEIGHT_M / rawHeight
        obj.scale.setScalar(scaleFactor)

        const scaledBbox = new THREE.Box3().setFromObject(obj)

        obj.position.x = plantW / 2 + gap - scaledBbox.min.x
        obj.position.y = -scaledBbox.min.y
        obj.position.z = 0

        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x5a8078,
              side: THREE.FrontSide,
              metalness: 0.08,
              roughness: 0.85,
              emissive: 0x1a3a35,
              emissiveIntensity: 0.15,
            })
          }
        })

        humanGroup = obj
        scene.add(obj)
      },
      undefined,
      () => {},
    )

    // ── Resize handling via ResizeObserver ──
    const updateRendererSize = () => {
      const { width, height: h } = resolveSize()
      if (width <= 0 || h <= 0) return
      renderer.setSize(width, h, false)
      renderer.domElement.style.width = `${width}px`
      renderer.domElement.style.height = `${h}px`
      const newAspect = width / Math.max(1, h)
      const f = computeFrustum(newAspect)
      halfW = f.halfW
      frustumT = f.top
      frustumB = f.bottom
      camera.left = -halfW
      camera.right = halfW
      camera.top = frustumT
      camera.bottom = frustumB
      camera.updateProjectionMatrix()
    }

    const resizeObserver = new ResizeObserver(() => {
      updateRendererSize()
    })
    resizeObserver.observe(container)

    // ── Interaction (orbit via drag / touch) ──
    let autoAngle = 0
    let userRotation = 0
    let isDragging = false
    let lastMouseX = 0
    let lastTouchX = 0
    let lastInteractionTime = 0
    let currentVelocity = 0
    const rotationSpeed = 0.005
    const autoRotationSpeed = 0.0012
    const inertiaDecayRate = 0.03

    const handleMouseDown = (event: MouseEvent) => {
      isDragging = true
      lastMouseX = event.clientX
      lastInteractionTime = performance.now()
      currentVelocity = 0
      renderer.domElement.style.cursor = 'grabbing'
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) return
      const deltaX = event.clientX - lastMouseX
      const deltaRotation = deltaX * rotationSpeed
      userRotation += deltaRotation
      const now = performance.now()
      const deltaTime = now - lastInteractionTime
      if (deltaTime > 0) {
        const instantVelocity =
          (deltaRotation / Math.max(deltaTime, 16)) * 16
        currentVelocity = currentVelocity * 0.5 + instantVelocity * 0.5
      }
      lastMouseX = event.clientX
      lastInteractionTime = now
    }

    const handleMouseUp = () => {
      isDragging = false
      renderer.domElement.style.cursor = 'grab'
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        isDragging = true
        lastTouchX = event.touches[0]?.clientX ?? 0
        lastInteractionTime = performance.now()
        currentVelocity = 0
        renderer.domElement.style.cursor = 'grabbing'
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!isDragging || event.touches.length !== 1) return
      event.preventDefault()
      const currentX = event.touches[0]?.clientX ?? 0
      const deltaX = currentX - lastTouchX
      const deltaRotation = deltaX * rotationSpeed
      userRotation += deltaRotation
      const now = performance.now()
      const deltaTime = now - lastInteractionTime
      if (deltaTime > 0) {
        const instantVelocity =
          (deltaRotation / Math.max(deltaTime, 16)) * 16
        currentVelocity = currentVelocity * 0.5 + instantVelocity * 0.5
      }
      lastTouchX = currentX
      lastInteractionTime = now
    }

    const handleTouchEnd = () => {
      isDragging = false
      renderer.domElement.style.cursor = 'grab'
    }

    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    renderer.domElement.addEventListener('touchstart', handleTouchStart, {
      passive: false,
    })
    renderer.domElement.addEventListener('touchmove', handleTouchMove, {
      passive: false,
    })
    renderer.domElement.addEventListener('touchend', handleTouchEnd)

    // ── Animation loop ──
    let frameId: number
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    const animate = () => {
      if (!isDragging) {
        const velocityDiff = Math.abs(currentVelocity - autoRotationSpeed)
        if (velocityDiff > 0.00001) {
          currentVelocity +=
            (autoRotationSpeed - currentVelocity) * inertiaDecayRate
          userRotation += currentVelocity
        } else {
          currentVelocity = autoRotationSpeed
          autoAngle += autoRotationSpeed
        }
      }

      const totalRotation = autoAngle + userRotation
      camera.position.x =
        orbitCenter.x + cameraDistance * Math.cos(totalRotation)
      camera.position.z =
        orbitCenter.z + cameraDistance * Math.sin(totalRotation)
      camera.position.y = orbitCenter.y
      camera.lookAt(orbitCenter)

      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }

    if (prefersReducedMotion) {
      renderer.render(scene, camera)
    } else {
      animate()
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      renderer.domElement.removeEventListener('touchstart', handleTouchStart)
      renderer.domElement.removeEventListener('touchmove', handleTouchMove)
      renderer.domElement.removeEventListener('touchend', handleTouchEnd)
      if (humanGroup) {
        humanGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose()
            if (Array.isArray(child.material)) {
              child.material.forEach((m: THREE.Material) => m.dispose())
            } else {
              child.material.dispose()
            }
          }
        })
      }
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [heightCm, wingspanCm])

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden', className)}
    />
  )
}

export default DimensionCube
