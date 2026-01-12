import * as THREE from "three"

/**
 * Gestor de Colocación de Objetos
 * Maneja la lógica de previsualización (ghost) y raycasting para colocar items.
 */
export class PlacementManager {
    constructor(scene, camera) {
        this.scene = scene
        this.camera = camera

        // Grupo para la visualización fantasma
        this.placementGhost = null
        this.ghostBaseMat = null
        this.ghostArrowMat = null
        this.ghostArrow = null

        // Texturas precargadas
        this.texImpulso = null
        this.texSalto = null

        // Estado del input
        this.currentSlot = -1
        this.rotationIndex = 0

        // Configuración Snapping
        this.snapToGrid = false
        this.gridSize = 1

        // Configuración Aerial Grid
        this.aerialGridActive = false
        this.aerialGridFixed = false
        this.aerialCollider = null
        this.aerialVisual = null

        this.init()
    }

    /**
     * Inicializa recursos y objetos visuales
     */
    init() {
        // Cargar texturas
        const loader = new THREE.TextureLoader()
        this.texImpulso = loader.load('./assets/textures/impulso.png')
        this.texSalto = loader.load('./assets/textures/salto.png')

        // Crear grupo fantasma
        this.placementGhost = new THREE.Group()
        this.scene.add(this.placementGhost)

        // 1. Ghost BOX (Paredes, Pilares, Pads)
        const boxGeo = new THREE.BoxGeometry(1, 1, 1) // Base 1x1x1, scale later
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            wireframe: true
        })
        this.ghostBaseMat = material

        this.ghostBoxMesh = new THREE.Mesh(boxGeo, material)
        // Position handled in update
        this.placementGhost.add(this.ghostBoxMesh)

        // 2. Ghost RAMP (Prisma Triangular)
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(1, 0);
        shape.lineTo(0, 1);
        shape.lineTo(0, 0);

        const extrudeSettings = {
            steps: 1,
            depth: 1,
            bevelEnabled: false,
        };
        const rampGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        rampGeo.center()

        this.ghostRampMesh = new THREE.Mesh(rampGeo, material)
        this.ghostRampMesh.visible = false
        this.placementGhost.add(this.ghostRampMesh)


        // Flecha / Icono indicador (Solo para Pads viejos)
        const arrowGeo = new THREE.PlaneGeometry(2.4, 2.4)
        const arrowMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        })
        this.ghostArrowMat = arrowMat

        this.ghostArrow = new THREE.Mesh(arrowGeo, arrowMat)
        this.ghostArrow.rotation.x = -Math.PI / 2
        this.ghostArrow.position.y = 0.05 // Ligeramente elevado
        this.placementGhost.add(this.ghostArrow)

        // Grid Aéreo
        this.initAerialGrid()

        // Ocultar por defecto
        this.placementGhost.visible = false
    }

    initAerialGrid() {
        // 1. Dynamic Collider Plane (Infinite-like Plane)
        // We use a large flat box or plane. 
        // 100x1x100 is good.
        const geometry = new THREE.PlaneGeometry(1000, 1000)
        geometry.rotateX(-Math.PI / 2) // Horizontal
        const material = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
        this.aerialCollider = new THREE.Mesh(geometry, material)
        this.scene.add(this.aerialCollider)

        // 2. Visual Grid (Single Layer)
        this.aerialVisual = new THREE.Group()

        // Single Grid Helper
        // 100 size, 100 divisions = 1x1 cells
        const grid = new THREE.GridHelper(100, 100, 0x444444, 0x222222)
        this.aerialVisual.add(grid)

        // No bounding box needed for infinite-like plane
        this.aerialVisual.visible = false
        this.scene.add(this.aerialVisual)
    }

    setAerialGrid(active) {
        this.aerialGridActive = active
        // Reset fixed state when disabled? Or keep memory? 
        // User didn't specify, but usually disabling grid implies full reset.
        if (!active) {
            this.aerialGridFixed = false
        }
        if (this.aerialVisual) {
            this.aerialVisual.visible = active
        }
    }

    toggleAerialGridFixed() {
        if (!this.aerialGridActive) return false
        this.aerialGridFixed = !this.aerialGridFixed
        return this.aerialGridFixed
    }

    /**
     * Checks if the object is considered "Ground" (terrain/floor)
     * vs a constructed block.
     */
    isGround(object) {
        // Simple heuristic: if it's explicitly explicitly the aerial collider or flagged as ground
        if (object === this.aerialCollider) return true
        if (object.userData && object.userData.isGround) return true
        // If it's a MapObject (constructed), it's NOT ground
        if (object.userData && object.userData.isMapObject) return false

        // Fallback: Default to true if not clearly a MapObject
        return true
    }

    /**
     * Checks for collisions at the proposed position
     */
    checkCollision(position, size) {
        // Create box for the new object
        const box = new THREE.Box3()
        // Shrink slightly to avoid touching-is-collision
        const hitBoxSize = size.clone().multiplyScalar(0.95)
        box.setFromCenterAndSize(position, hitBoxSize)

        const checkList = this.scene.children.filter(o =>
            o !== this.placementGhost &&
            !this.placementGhost.children.includes(o) &&
            o !== this.aerialCollider &&
            o.visible
        )

        for (const obj of checkList) {
            // Check player collision
            if (obj.userData && obj.userData.isPlayer) {
                // Approximate player size
                const playerPos = obj.position.clone()
                // Player box approx 1x2x1 centered at pos.y + 1
                const playerBox = new THREE.Box3().setFromCenterAndSize(
                    playerPos.clone().add(new THREE.Vector3(0, 1, 0)),
                    new THREE.Vector3(0.8, 1.8, 0.8)
                )
                if (box.intersectsBox(playerBox)) return true
                continue
            }

            // Check against other MapObjects logic
            if (obj.geometry) {
                // If it's a mesh, get its bounding box
                const objBox = new THREE.Box3().setFromObject(obj)

                // Only check reasonable objects
                if (objBox.getSize(new THREE.Vector3()).length() > 1000) continue

                if (box.intersectsBox(objBox)) {
                    return true
                }
            }
        }
        return false
    }

    /**
     * Calculates the actual dimensions of the item after rotation
     */
    getRealSize(item, rotationIndex) {
        let size = new THREE.Vector3(1, 1, 1) // Default
        if (item.constructor.name === "MapObjectItem") {
            size.set(item.scale.x || 1, item.scale.y || 1, item.scale.z || 1)
        } else if (item.id.includes("pad")) {
            size.set(3, 0.2, 3)
        }

        // Swap dimensions based on rotation
        // Rotation 1 (-90) & 3 (+90) swap X and Z
        if (rotationIndex === 1 || rotationIndex === 3) {
            const temp = size.x
            size.x = size.z
            size.z = temp
        }
        return size
    }

    /**
     * Actualiza la posición y visualización del fantasma
     * @param {number} inventorySlot - Índice del slot seleccionado (0 o 1)
     * @param {number} rotationIndex - Índice de rotación (0-3) para pads laterales
     * @param {THREE.Vector3} [playerPosition] - Posición del jugador para altura dinámica
     * @returns {THREE.Vector3|null} - Punto de impacto válido o null
     */
    update(item, rotationIndex, playerPosition) {
        this.currentItem = item
        this.rotationIndex = rotationIndex

        // Si no hay item o no es de construcción, ocultar
        if (!item || (!item.isImpulsePad && !item.type)) {
            this.placementGhost.visible = false
            this.currentHit = null
            if (this.aerialVisual) this.aerialVisual.visible = false
            return
        }

        // --- Aerial Grid Dynamic Update ---
        if (this.aerialGridActive && playerPosition) {
            if (!this.aerialGridFixed) {
                const gridY = Math.round(playerPosition.y)
                this.aerialVisual.position.y = gridY
                this.aerialCollider.position.y = gridY
            }
            this.aerialVisual.visible = true
            this.aerialVisual.position.x = Math.round(playerPosition.x)
            this.aerialVisual.position.z = Math.round(playerPosition.z)
        } else if (!this.aerialGridActive) {
            if (this.aerialVisual) this.aerialVisual.visible = false
        }

        // Raycast
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera)
        const intersects = raycaster.intersectObjects(this.scene.children, true)

        // Filter out ghost and characters
        const hit = intersects.find(h =>
            h.distance < 60 &&
            h.object.type === "Mesh" &&
            h.object !== this.placementGhost &&
            !this.placementGhost.children.includes(h.object) &&
            !h.object.userData.isPlayer &&
            (this.aerialGridActive || h.object !== this.aerialCollider)
        )

        this.currentHit = hit ? hit.point : null

        if (hit) {
            this.placementGhost.visible = true

            // --- Determine Size (Smart Sizing) ---
            const realSize = this.getRealSize(item, rotationIndex)
            const gridSize = this.gridSize || 1
            let targetPos = hit.point.clone()

            // --- Snapping Logic ---
            if (this.snapToGrid || this.aerialGridActive) {
                const isAerialHit = (hit.object === this.aerialCollider)
                const isMapObject = hit.object.userData && hit.object.userData.isMapObject

                if (isMapObject && hit.face) {
                    // --- SMART SNAPPING (Block-to-Block) ---
                    const hitBox = new THREE.Box3().setFromObject(hit.object)
                    const hitCenter = new THREE.Vector3()
                    hitBox.getCenter(hitCenter)
                    const hitSize = new THREE.Vector3()
                    hitBox.getSize(hitSize)

                    // Identify Normal Axis
                    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
                    const axis = new THREE.Vector3(
                        Math.round(normal.x),
                        Math.round(normal.y),
                        Math.round(normal.z)
                    )

                    // Calculate Offset Distance (Center to Center)
                    const offsetDist = new THREE.Vector3()
                        .copy(hitSize).multiplyScalar(0.5)
                        .add(realSize.clone().multiplyScalar(0.5))
                        .multiply(axis)

                    // Initial Target = HitCenter + Offset
                    let finalPos = hitCenter.clone().add(offsetDist)

                    // Surface Axis Snapping (Global Grid)
                    const axes = ['x', 'y', 'z']
                    axes.forEach(ax => {
                        if (Math.abs(axis[ax]) < 0.1) {
                            let val = hit.point[ax]
                            const s = realSize[ax]
                            const offset = (Math.abs(s % 2) > 0.01) ? (gridSize / 2) : 0
                            val = Math.round((val - offset) / gridSize) * gridSize + offset
                            finalPos[ax] = val
                        }
                    })
                    targetPos.copy(finalPos)

                } else {
                    // --- GROUND / GLOBAL LOGIC ---
                    const globalY = isAerialHit ? this.aerialCollider.position.y : hit.point.y;

                    // X/Z Snap
                    ['x', 'z'].forEach(ax => {
                        let val = hit.point[ax]
                        const s = realSize[ax]
                        const offset = (Math.abs(s % 2) > 0.01) ? (gridSize / 2) : 0
                        targetPos[ax] = Math.round((val - offset) / gridSize) * gridSize + offset
                    })

                    // Y Snap
                    if (isAerialHit || !hit.face || Math.abs(hit.face.normal.y) > 0.5 || !isMapObject) {
                        targetPos.y = globalY + realSize.y / 2
                    } else {
                        targetPos.y = Math.round(hit.point.y)
                    }
                }
            } else {
                // --- FREE PLACEMENT (No Grid) ---
                // We still want the object to sit ON the surface, not sink into it.
                // Move center away from hit point by half extent along normal.
                if (hit.face) {
                    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()

                    // Project size onto normal to find extent in that direction
                    // e.g. if normal is (0,1,0), we care about size.y
                    const offset = new THREE.Vector3(
                        normal.x * realSize.x,
                        normal.y * realSize.y,
                        normal.z * realSize.z
                    ).multiplyScalar(0.5)

                    targetPos.add(offset)
                } else {
                    // Fallback if no face (e.g. strict point hit?), just assume Up
                    // targetPos is hit.point. 
                    // Assume floor placement
                    targetPos.y += realSize.y / 2
                }
            }

            this.placementGhost.position.copy(targetPos)

            // Adjust visual geometry matches RealSize
            if (item.constructor.name === "MapObjectItem") {
                this.ghostArrow.visible = false
                this.ghostBaseMat.visible = true
                this.ghostRampMesh.visible = false
                this.ghostBoxMesh.visible = true

                if (item.type === 'ramp') {
                    this.ghostBoxMesh.visible = false
                    this.ghostRampMesh.visible = true
                    this.ghostRampMesh.scale.set(item.scale.z, item.scale.y, item.scale.x)
                    // Reset Y because targetPos is Center now
                    this.ghostRampMesh.position.y = 0
                } else {
                    this.ghostBoxMesh.scale.set(item.scale.x, item.scale.y, item.scale.z)
                    // Reset Y because targetPos is Center now
                    this.ghostBoxMesh.position.y = 0
                }
            } else {
                // Pads
                this.ghostBoxMesh.position.y = 0
            }

            // Apply rotation to ghost group
            if (item.constructor.name === "MapObjectItem") {
                this.placementGhost.rotation.y = 0
                if (rotationIndex === 1) this.placementGhost.rotation.y = -Math.PI / 2
                if (rotationIndex === 2) this.placementGhost.rotation.y = -Math.PI
                if (rotationIndex === 3) this.placementGhost.rotation.y = Math.PI / 2
            } else {
                this.placementGhost.rotation.y = 0
            }


            // --- Validation Logic ---
            let isValid = true

            // Validation uses Center
            if (this.checkCollision(targetPos, realSize)) {
                isValid = false
            }

            // Visual Feedback
            if (isValid) {
                if (item.constructor.name === "MapObjectItem") {
                    this.ghostBaseMat.color.setHex(0x00FF00)
                } else {
                    const isJump = (item.id === "pad_jump")
                    const color = isJump ? 0x00FFFF : 0x00FF00
                    this.ghostBaseMat.color.setHex(color)
                    this.ghostArrowMat.color.setHex(0xFFFFFF)
                }

                // Return Base Position (Bottom Center) for Spawner
                const basePos = targetPos.clone()
                basePos.y -= realSize.y / 2

                this.lastValidPosition = basePos
                return basePos
            } else {
                this.ghostBaseMat.color.setHex(0xFF0000)
                this.ghostArrowMat.color.setHex(0xFF0000)
                this.lastValidPosition = null
                return null
            }

        } else {
            this.placementGhost.visible = false
            this.lastValidPosition = null
            return null
        }
    }

    getCurrentTarget() {
        return this.lastValidPosition || this.currentHit
    }
}
