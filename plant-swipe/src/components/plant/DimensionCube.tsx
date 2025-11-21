import React from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'

type DimensionCubeProps = {
  scale: number
  className?: string
}

export const DimensionCube: React.FC<DimensionCubeProps> = ({ scale, className }) => {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const container = containerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    const size = Math.min(container.clientWidth, container.clientHeight) || container.clientWidth || 200
    renderer.setSize(size, size)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    const cameraDistance = 4.8

    const cubeCenterY = scale / 2
    const cubeCenter = new THREE.Vector3(0, cubeCenterY, 0)
    const cameraHeightOffset = 1.8
    const cameraHeight = cubeCenterY + cameraHeightOffset
    camera.position.set(cameraDistance, cameraHeight, cameraDistance)
    camera.lookAt(cubeCenter)

    const ambientLight = new THREE.AmbientLight(0xbfffe0, 0.45)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.85)
    directionalLight.position.set(4, 6, 5)
    const pointLight = new THREE.PointLight(0x34d399, 0.8)
    pointLight.position.set(-3, -2, -6)
    scene.add(ambientLight, directionalLight, pointLight)

    const outerGeometry = new THREE.BoxGeometry(scale, scale, scale)
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
    outerMesh.position.set(0, cubeCenterY, 0)
    scene.add(outerMesh)

    const outerWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(outerGeometry),
      new THREE.LineBasicMaterial({ color: 0x34f5c6 }),
    )
    outerWire.position.set(0, cubeCenterY, 0)
    scene.add(outerWire)

    const innerWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(scale * 0.7, scale * 0.7, scale * 0.7)),
      new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.8 }),
    )
    innerWire.position.set(0, cubeCenterY, 0)
    scene.add(innerWire)

    const grid = new THREE.GridHelper(6, 18, 0x34f5c6, 0x0f766e)
    const gridMaterial = grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.25
    grid.position.set(0, 0, 0)
    scene.add(grid)

    const handleResize = () => {
      if (!container) return
      const nextSize = Math.min(container.clientWidth, container.clientHeight) || container.clientWidth || 200
      renderer.setSize(nextSize, nextSize)
      camera.aspect = 1
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', handleResize)

    let autoAngle = 0
    let userRotation = 0
    let isDragging = false
    let lastMouseX = 0
    let lastTouchX = 0
    const rotationSpeed = 0.005
    const autoRotationSpeed = 0.0012

    const handleMouseDown = (event: MouseEvent) => {
      isDragging = true
      lastMouseX = event.clientX
      renderer.domElement.style.cursor = 'grabbing'
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) return
      const deltaX = event.clientX - lastMouseX
      userRotation += deltaX * rotationSpeed
      lastMouseX = event.clientX
    }

    const handleMouseUp = () => {
      isDragging = false
      renderer.domElement.style.cursor = 'grab'
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        isDragging = true
        lastTouchX = event.touches[0]?.clientX ?? 0
        renderer.domElement.style.cursor = 'grabbing'
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!isDragging || event.touches.length !== 1) return
      event.preventDefault()
      const deltaX = event.touches[0]?.clientX ?? 0 - lastTouchX
      userRotation += deltaX * rotationSpeed
      lastTouchX = event.touches[0]?.clientX ?? 0
    }

    const handleTouchEnd = () => {
      isDragging = false
      renderer.domElement.style.cursor = 'grab'
    }

    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false })
    renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false })
    renderer.domElement.addEventListener('touchend', handleTouchEnd)

    let frameId: number
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const animate = () => {
      if (!isDragging) {
        autoAngle += autoRotationSpeed
      }
      const totalRotation = autoAngle + userRotation
      camera.position.x = cubeCenter.x + cameraDistance * Math.cos(totalRotation)
      camera.position.z = cubeCenter.z + cameraDistance * Math.sin(totalRotation)
      camera.position.y = cameraHeight
      camera.lookAt(cubeCenter)

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
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [scale])

  return <div ref={containerRef} className={cn('relative aspect-square w-full', className)} />
}

export default DimensionCube
