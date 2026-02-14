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
const HUMAN_HEIGHT_M = 1.8 // Target human height in meters (scene units)

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

    // Convert plant dimensions from cm to meters (1 scene unit = 1 meter)
    // Height → Y axis, Wingspan → both X and Z axes
    const plantH = Math.max((heightCm ?? 30) / 100, 0.05)
    const plantW = Math.max((wingspanCm ?? 30) / 100, 0.05)

    // Estimate the total scene extent for camera framing
    const humanEstimatedWidth = 0.5 // approximate human model width in meters
    const gap = 0.35 // gap between cube and human in meters
    const humanX = plantW / 2 + gap + humanEstimatedWidth / 2
    const sceneMaxHeight = Math.max(plantH, HUMAN_HEIGHT_M)
    const sceneWidth = plantW / 2 + gap + humanEstimatedWidth + 0.3
    const sceneCenterX = humanX / 2
    const sceneCenterY = sceneMaxHeight / 2

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    const resolveSize = () => {
      const width = container.clientWidth || 200
      const h = container.clientHeight || width
      return { width, height: h }
    }
    const { width: initialWidth, height: initialHeight } = resolveSize()
    renderer.setSize(initialWidth, initialHeight)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()

    // Camera setup – frame both the plant box and the human model
    const fov = 38
    const fovRad = (fov * Math.PI) / 180
    const distanceForHeight = sceneMaxHeight / (2 * Math.tan(fovRad / 2)) + 0.5
    const aspect = initialWidth / Math.max(1, initialHeight)
    const distanceForWidth = sceneWidth / (2 * Math.tan(fovRad / 2) * aspect) + 0.5
    const cameraDistance = Math.max(distanceForHeight, distanceForWidth, 3.5)

    const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 200)
    const orbitCenter = new THREE.Vector3(sceneCenterX, sceneCenterY, 0)
    const cameraHeightOffset = sceneMaxHeight * 0.25
    const cameraHeight = sceneCenterY + cameraHeightOffset

    camera.position.set(
      orbitCenter.x + cameraDistance,
      cameraHeight,
      orbitCenter.z + cameraDistance,
    )
    camera.lookAt(orbitCenter)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xbfffe0, 0.5)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9)
    directionalLight.position.set(4, 6, 5)
    const pointLight = new THREE.PointLight(0x34d399, 0.8)
    pointLight.position.set(-3, -2, -6)
    scene.add(ambientLight, directionalLight, pointLight)

    // ── Plant box (outer) ──
    const outerGeometry = new THREE.BoxGeometry(plantW, plantH, plantW)
    const outerMaterial = new THREE.MeshStandardMaterial({
      color: 0x031512,
      transparent: true,
      opacity: 0.22,
      metalness: 0.35,
      roughness: 0.55,
      emissive: 0x0d9488,
      emissiveIntensity: 0.65,
    })
    const outerMesh = new THREE.Mesh(outerGeometry, outerMaterial)
    outerMesh.position.set(0, plantH / 2, 0)
    scene.add(outerMesh)

    // Outer wireframe
    const outerWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(outerGeometry),
      new THREE.LineBasicMaterial({ color: 0x34f5c6 }),
    )
    outerWire.position.set(0, plantH / 2, 0)
    scene.add(outerWire)

    // Inner wireframe (70 % scale)
    const innerWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(plantW * 0.7, plantH * 0.7, plantW * 0.7),
      ),
      new THREE.LineBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.8,
      }),
    )
    innerWire.position.set(0, plantH / 2, 0)
    scene.add(innerWire)

    // ── Ground grid ──
    const gridSize = Math.max(sceneWidth * 2.5, 6)
    const grid = new THREE.GridHelper(
      gridSize,
      Math.round(gridSize * 3),
      0x34f5c6,
      0x0f766e,
    )
    const gridMaterial = grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.25
    grid.position.set(0, 0, 0)
    scene.add(grid)

    // ── Human reference model ──
    const loader = new OBJLoader()
    let humanGroup: THREE.Group | null = null

    loader.load(
      HUMAN_MODEL_URL,
      (obj) => {
        // Compute bounding box of the raw model
        const bbox = new THREE.Box3().setFromObject(obj)
        const rawHeight = bbox.max.y - bbox.min.y
        if (rawHeight <= 0) return

        const scaleFactor = HUMAN_HEIGHT_M / rawHeight
        obj.scale.setScalar(scaleFactor)

        // Recompute bounding box after scale
        const scaledBbox = new THREE.Box3().setFromObject(obj)

        // Position human to the right of the plant box with a gap
        obj.position.x = plantW / 2 + gap - scaledBbox.min.x
        obj.position.y = -scaledBbox.min.y // feet on the ground
        obj.position.z = 0

        // Apply a subtle silhouette material
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x8faaa6,
              transparent: true,
              opacity: 0.55,
              metalness: 0.1,
              roughness: 0.8,
              emissive: 0x34d399,
              emissiveIntensity: 0.15,
            })
          }
        })

        humanGroup = obj
        scene.add(obj)
      },
      undefined, // onProgress
      () => {
        // Silently ignore load errors – the cube still renders
      },
    )

    // ── Resize handling ──
    const setRendererSize = () => {
      const { width, height: h } = resolveSize()
      renderer.setSize(width, h)
      camera.aspect = width / Math.max(1, h)
      camera.updateProjectionMatrix()
    }
    setRendererSize()

    const handleResize = () => {
      if (!container) return
      setRendererSize()
    }
    window.addEventListener('resize', handleResize)

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
      camera.position.y = cameraHeight
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
      window.removeEventListener('resize', handleResize)
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
