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
            if (obj.userData && obj.userData.isMapObject && obj.geometry) {
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

    rebuildStairsGhost(item) {
        // Prevent rebuilding if same item scale
        const key = `${item.scale.x}_${item.scale.y}_${item.scale.z}`
        if (this.ghostStairsLastKey === key && this.ghostStairsGroup.children.length > 0) return

        this.ghostStairsLastKey = key

        // Clear existing
        while (this.ghostStairsGroup.children.length > 0) {
            this.ghostStairsGroup.remove(this.ghostStairsGroup.children[0]);
        }

        // Generate Steps (Logic from MapObjectItem)
        const targetStepHeight = 0.25
        const numSteps = Math.max(1, Math.round(item.scale.y / targetStepHeight))

        const stepHeight = item.scale.y / numSteps
        const stepDepth = item.scale.z / numSteps
        const stepWidth = item.scale.x

        const stepGeo = new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth)

        const startY = -item.scale.y / 2 + stepHeight / 2 // Bottom relative to center
        const startZ = -item.scale.z / 2 + stepDepth / 2 // Back relative to center

        for (let i = 0; i < numSteps; i++) {
            const mesh = new THREE.Mesh(stepGeo, this.ghostBaseMat)

            // Position
            mesh.position.y = startY + (i * stepHeight)
            mesh.position.z = startZ + (i * stepDepth)
            mesh.position.x = 0 // Centered width

            // OPTIMIZATION: Disable raycasting for ghost meshes
            mesh.raycast = () => { }

            this.ghostStairsGroup.add(mesh)
        }
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
        const hit = intersects.find(h => {
            if (h.distance >= 60) return false
            if (h.object.type !== "Mesh") return false

            // Ignore Player
            if (h.object.userData.isPlayer) return false

            // Ignore Aerial Collider if not active
            if (!this.aerialGridActive && h.object === this.aerialCollider) return false

            // Ignore the entire Ghost Hierarchy
            let parent = h.object
            while (parent) {
                if (parent === this.placementGhost) return false
                parent = parent.parent
            }

            return true
        })

        this.currentHit = hit ? hit.point : null

        if (hit) {
            this.lastValidQuaternion = null

            // --- MOVEMENT CONTROLLER LOGIC ---
            if (item.type === 'movement_controller') {
                const isTargetObject = hit.object.userData && hit.object.userData.isEditableMapObject;

                if (!isTargetObject) {
                    this.placementGhost.visible = false;
                    this.lastValidPosition = null;
                    return null;
                }

                this.placementGhost.visible = true;

                // 1. Match Target Size
                const targetBox = new THREE.Box3().setFromObject(hit.object);
                const targetSize = new THREE.Vector3();
                targetBox.getSize(targetSize);
                const targetCenter = new THREE.Vector3();
                targetBox.getCenter(targetCenter);

                this.ghostBaseMat.visible = true;
                this.ghostArrow.visible = false;
                if (this.ghostRampMesh) this.ghostRampMesh.visible = false;
                if (this.ghostStairsGroup) this.ghostStairsGroup.visible = false;

                // Use Box Mesh for highlight
                this.ghostBoxMesh.visible = true;
                this.ghostBoxMesh.scale.copy(targetSize);

                // Color Blue
                this.ghostBaseMat.color.setHex(0x0000FF);
                this.ghostBaseMat.opacity = 0.5

                // Position at Center of Target
                this.placementGhost.position.copy(targetCenter);
                this.placementGhost.rotation.set(0, 0, 0);
                this.placementGhost.quaternion.copy(hit.object.quaternion);

                // 2. Text Label
                if (!this.ghostLabelSprite) {
                    this.ghostLabelSprite = this.createLabelSprite("Aplicar", "#FFFF00");
                    this.placementGhost.add(this.ghostLabelSprite);
                }
                this.ghostLabelSprite.visible = true;
                this.ghostLabelSprite.position.set(0, targetSize.y / 2 + 0.5, 0); // Above object

                // Update text
                const hasLogic = hit.object.userData.logicProperties && hit.object.userData.logicProperties.waypoints;
                const txt = hasLogic ? "Aplicado!" : "Aplicar";
                const col = hasLogic ? "#00FF00" : "#FFFF00";
                this.updateLabelSprite(this.ghostLabelSprite, txt, col);

                this.lastValidPosition = hit.point;
                return hit.point;
            }

            // Disable Label for others
            if (this.ghostLabelSprite) this.ghostLabelSprite.visible = false;
            this.ghostBaseMat.opacity = 0.3 // Reset opacity

            this.placementGhost.visible = true

            // --- Determine Size (Smart Sizing) ---
            let realSize = this.getRealSize(item, rotationIndex)
            const gridSize = this.gridSize || 1
            let targetPos = hit.point.clone()

            // --- Snapping Logic ---
            if (this.snapToGrid || this.aerialGridActive) {
                const isAerialHit = (hit.object === this.aerialCollider)
                const isMapObject = hit.object.userData && hit.object.userData.isMapObject

                if (item.type === 'interaction_button' && hit.face) {
                    // --- BUTTON SURFACE LOGIC (GRID) ---
                    // Button specific size (Visual 0.6 x 0.1 x 0.6)
                    realSize = new THREE.Vector3(0.6, 0.1, 0.6)

                    // Align to Normal
                    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
                    const quaternion = new THREE.Quaternion()
                    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)

                    this.lastValidQuaternion = quaternion.clone()
                    this.placementGhost.quaternion.copy(quaternion)

                    // Snap Logic on Surface
                    // Keep axis parallel to normal (flush)
                    // Snap axes perpendicular to normal
                    const axes = ['x', 'y', 'z']
                    axes.forEach(ax => {
                        if (Math.abs(normal[ax]) > 0.5) {
                            // Parallel to normal -> flush but OFFSET by half height
                            targetPos[ax] = hit.point[ax] + normal[ax] * (realSize.y / 2)
                        } else {
                            // Perpendicular -> Snap to Grid Center
                            const offset = gridSize / 2
                            targetPos[ax] = Math.round((hit.point[ax] - offset) / gridSize) * gridSize + offset
                        }
                    })

                } else if (isMapObject && hit.face) {
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

                    // Surface Axis Snapping
                    const axes = ['x', 'y', 'z']
                    axes.forEach(ax => {
                        if (Math.abs(axis[ax]) < 0.1) {
                            // If dimensions match, align perfectly with the target object (Stacking/Rowing)
                            if (Math.abs(realSize[ax] - hitSize[ax]) < 0.1) {
                                finalPos[ax] = hitCenter[ax]
                            } else {
                                // Default Grid Snapping
                                let val = hit.point[ax]
                                const s = realSize[ax]

                                // Dual Snap for Thin Objects (Consistency with Ground Logic)
                                if (Math.abs(s - 0.5) < 0.1) {
                                    const baseGrid = Math.round(val / gridSize) * gridSize
                                    if (val >= baseGrid) {
                                        finalPos[ax] = baseGrid + 0.25
                                    } else {
                                        finalPos[ax] = baseGrid - 0.25
                                    }
                                } else {
                                    // Standard 
                                    const offset = (Math.abs(s % 2) > 0.01) ? (gridSize / 2) : 0
                                    val = Math.round((val - offset) / gridSize) * gridSize + offset
                                    finalPos[ax] = val
                                }
                            }
                        }
                    })
                    targetPos.copy(finalPos)

                } else {
                    // --- GROUND / GLOBAL LOGIC ---
                    const globalY = isAerialHit ? this.aerialCollider.position.y : hit.point.y;

                    // X/Z Snap with Dual-Snap for Thin Walls
                    ['x', 'z'].forEach(ax => {
                        let val = hit.point[ax]
                        const s = realSize[ax]

                        // Check for "Thin" object (e.g. Wall thickness ~0.5)
                        // Precision check: 0.5 is typical. Let's say < 0.9 and > 0.1
                        if (Math.abs(s - 0.5) < 0.1) {
                            // DUAL SNAP LOGIC
                            // We want to snap to Grid +/- 0.25
                            // 1. Find nearest Grid Line
                            const baseGrid = Math.round(val / gridSize) * gridSize

                            // 2. Determine side (Inner/Outer) based on cursor relative to line
                            if (val >= baseGrid) {
                                targetPos[ax] = baseGrid + 0.25
                            } else {
                                targetPos[ax] = baseGrid - 0.25
                            }
                        } else {
                            // Standard Center Snapping
                            const offset = (Math.abs(s % 2) > 0.01) ? (gridSize / 2) : 0
                            targetPos[ax] = Math.round((val - offset) / gridSize) * gridSize + offset
                        }
                    })

                    // Y Snap
                    if (isAerialHit || !hit.face || Math.abs(hit.face.normal.y) > 0.5 || !isMapObject) {
                        targetPos.y = globalY + realSize.y / 2
                    } else {
                        targetPos.y = Math.round(hit.point.y)
                    }
                }
            } else {
                // --- FREE PLACEMENT & SURFACE ALIGNMENT ---

                // Special case: Interaction Buttons Align to Surface Normal
                if (item.type === 'interaction_button' && hit.face) {
                    // Custom Size override for free placement too
                    realSize = new THREE.Vector3(0.6, 0.1, 0.6)
                    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()

                    // Align Y up to Normal
                    const quaternion = new THREE.Quaternion()
                    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)

                    // Apply to ghost
                    this.placementGhost.quaternion.copy(quaternion)
                    this.lastValidQuaternion = quaternion.clone()

                    // Position needs offset by half height along normal
                    // Use updated realSize.y
                    const offset = normal.multiplyScalar(realSize.y / 2)
                    targetPos.add(offset)

                    this.placementGhost.rotation.setFromQuaternion(quaternion)

                } else {
                    // Reset Quaternion for normal items (Vertical Up)
                    this.placementGhost.quaternion.identity()
                    this.lastValidQuaternion = null
                }

                // We still want the object to sit ON the surface, not sink into it.
                // Move center away from hit point by half extent along normal.
                if (hit.face) {
                    if (item.type !== 'interaction_button') {
                        // Generic surface offset logic
                        const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
                        const yOffset = realSize.y / 2
                        const offset = new THREE.Vector3(
                            normal.x * yOffset,
                            normal.y * yOffset,
                            normal.z * yOffset
                        )
                        targetPos.add(offset)
                    }
                } else {
                    // Fallback
                    targetPos.y += realSize.y / 2
                }
            }

            this.placementGhost.position.copy(targetPos)

            // Adjust visual geometry matches RealSize
            if (item.constructor.name === "MapObjectItem") {
                this.ghostArrow.visible = false
                this.ghostBaseMat.visible = true
                this.ghostRampMesh.visible = false
                this.ghostBoxMesh.visible = false
                if (this.ghostStairsGroup) {
                    this.ghostStairsGroup.visible = false
                }

                if (item.type === 'ramp') {
                    this.ghostRampMesh.visible = true
                    this.ghostRampMesh.scale.set(item.scale.z, item.scale.y, item.scale.x)
                    // Reset Y because targetPos is Center now
                    this.ghostRampMesh.position.y = 0
                } else if (item.type === 'stairs') {
                    // STAIRS PREVIEW
                    if (!this.ghostStairsGroup) {
                        this.ghostStairsGroup = new THREE.Group()
                        this.placementGhost.add(this.ghostStairsGroup)
                    }
                    this.ghostStairsGroup.visible = true
                    this.rebuildStairsGhost(item)
                } else {
                    // Standard Box
                    this.ghostBoxMesh.visible = true
                    if (item.type === 'interaction_button') {
                        // Use correct visual size for ghost
                        this.ghostBoxMesh.scale.set(realSize.x, realSize.y, realSize.z)
                    } else {
                        this.ghostBoxMesh.scale.set(item.scale.x, item.scale.y, item.scale.z)
                    }
                    // Reset Y because targetPos is Center now
                    this.ghostBoxMesh.position.y = 0
                }
            } else {
                // Pads
                this.ghostBoxMesh.position.y = 0
                // Ensure other meshes are hidden for pads if reused
                if (this.ghostRampMesh) this.ghostRampMesh.visible = false
                if (this.ghostStairsGroup) this.ghostStairsGroup.visible = false
                this.ghostBoxMesh.visible = true
            }

            // Apply rotation to ghost group
            if (this.lastValidQuaternion) {
                this.placementGhost.quaternion.copy(this.lastValidQuaternion)
            } else if (item.constructor.name === "MapObjectItem") {
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

    /**
     * Updates ghost for Logic Map Editor (References a live scene object instead of inventory item)
     */
    updateLogicGhost(targetObject, playerPosition, rotationIndex) {
        if (!targetObject) {
            this.placementGhost.visible = false
            return null
        }


        this.placementGhost.visible = true

        // --- Aerial Grid Dynamic Update (Logic Mode) ---
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

        // Hide standard ghosts
        if (this.ghostRampMesh) this.ghostRampMesh.visible = false
        if (this.ghostStairsGroup) this.ghostStairsGroup.visible = false
        if (this.ghostArrow) this.ghostArrow.visible = false
        if (this.ghostLabelSprite) this.ghostLabelSprite.visible = false // Hide Label

        this.ghostBoxMesh.visible = true

        // Match Size
        const box = new THREE.Box3().setFromObject(targetObject)
        const size = new THREE.Vector3()
        box.getSize(size)
        // Adjust size if target is rotated? Box3 is AABB. 
        // We want local size. userData usually has originalScale or we get from geometry parameters if BoxGeometry.
        // If we use AABB of rotated object, size changes. 
        // Best to use userData.originalScale if available.
        if (targetObject.userData.originalScale) {
            this.ghostBoxMesh.scale.copy(targetObject.userData.originalScale)
        } else {
            this.ghostBoxMesh.scale.copy(size)
        }

        this.ghostBaseMat.color.setHex(0x0000FF) // Logic Color (BLUE)
        this.ghostBaseMat.opacity = 0.5 // Higher opacity

        // Raycast logic
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera)
        const intersects = raycaster.intersectObjects(this.scene.children, true)

        const hit = intersects.find(h => {
            if (h.distance >= 100) return false
            if (h.object.type !== "Mesh") return false
            if (h.object.userData.isPlayer) return false
            let parent = h.object
            while (parent) {
                if (parent === this.placementGhost || parent === targetObject) return false
                parent = parent.parent
            }
            return true
        })

        if (!hit) {
            this.placementGhost.visible = false
            this.lastValidPosition = null
            return null
        }

        let targetPos = hit.point.clone()

        // Snap to grid if active
        // User wants "Cube" (size 1) to be centered in square.
        // Size 1 is ODD. Center should be at 0.5, 1.5, etc.
        // Size 2 is EVEN. Center should be at 1.0, 2.0 (On lines).
        // Formula: 
        // offset = (size % 2 !== 0) ? 0.5 : 0
        // val = Math.round(val - offset) + offset

        if (this.snapToGrid || this.aerialGridActive) {
            const gridSize = this.gridSize || 1

            // X Snap
            const sx = this.ghostBoxMesh.scale.x
            const offsetX = (Math.abs(sx % 2) > 0.01) ? (gridSize / 2) : 0
            targetPos.x = Math.round((targetPos.x - offsetX) / gridSize) * gridSize + offsetX

            // Z Snap
            const sz = this.ghostBoxMesh.scale.z
            const offsetZ = (Math.abs(sz % 2) > 0.01) ? (gridSize / 2) : 0
            targetPos.z = Math.round((targetPos.z - offsetZ) / gridSize) * gridSize + offsetZ

            // Y Snap
            const sy = this.ghostBoxMesh.scale.y
            // For Y, we usually want it sitting ON the grid/floor.
            // If we hit a face, we want y = hit.y + sy/2.
            // But we also want to snap that height to steps?
            // User compliant about "cuadricula" usually refers to X/Z plane.
            // Let's keep Y logical:

            // If floor hit, sit on it.
            if (hit.face && hit.face.normal.y > 0.5) {
                // But usually we want Snapped X/Z but Y on surface.

                // Let's stick to full grid snap for now as requested.
            }
        } else {
            // Free placement, sit on floor
            // Match standard logic
        }

        // Adjust Y to be Center
        targetPos.y += this.ghostBoxMesh.scale.y / 2

        this.placementGhost.position.copy(targetPos)

        // Rotation Lognic ('R')
        // Rotate the GHOST group
        this.placementGhost.rotation.set(0, 0, 0) // Reset
        // Apply Y rotation based on index
        let rotY = 0
        if (rotationIndex === 1) rotY = -Math.PI / 2
        if (rotationIndex === 2) rotY = -Math.PI
        if (rotationIndex === 3) rotY = Math.PI / 2

        this.placementGhost.rotation.y = rotY

        this.lastValidPosition = targetPos
        return targetPos
    }

    getCurrentTarget() {
        return this.lastValidPosition || this.currentHit
    }

    createLabelSprite(text, colorStr) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128; // Rectangular

        this.drawLabelOnCanvas(ctx, text, colorStr, canvas.width, canvas.height);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(2, 1, 1); // Adjust size
        return sprite;
    }

    updateLabelSprite(sprite, text, colorStr) {
        if (!sprite || !sprite.material || !sprite.material.map) return;

        const tex = sprite.material.map;
        const canvas = tex.image;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.drawLabelOnCanvas(ctx, text, colorStr, canvas.width, canvas.height);

        tex.needsUpdate = true;
    }

    drawLabelOnCanvas(ctx, text, colorStr, w, h) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, w, h);

        ctx.font = "bold 40px Arial";
        ctx.fillStyle = colorStr;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, w / 2, h / 2);

        // Border
        ctx.strokeStyle = colorStr;
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, w, h);
    }
    // Expose current rotation for spawner
    getPlacementRotation() {
        if (this.lastValidQuaternion) {
            return this.lastValidQuaternion
        }
        return this.rotationIndex
    }
}
