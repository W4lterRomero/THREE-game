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
        // Center the geometry so scaling works from center or handle offset in update
        // Extrude geometry usually starts at 0,0,0
        // Let's center it to easier management
        rampGeo.center()

        this.ghostRampMesh = new THREE.Mesh(rampGeo, material) // Reuse material
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

        // Ocultar por defecto
        this.placementGhost.visible = false
    }

    /**
     * Actualiza la posición y visualización del fantasma
     * @param {number} inventorySlot - Índice del slot seleccionado (0 o 1)
     * @param {number} rotationIndex - Índice de rotación (0-3) para pads laterales
     * @returns {THREE.Vector3|null} - Punto de impacto válido o null
     */
    update(item, rotationIndex) {
        this.currentItem = item
        this.rotationIndex = rotationIndex

        // Si no hay item o no es de construcción, ocultar
        if (!item || (!item.isImpulsePad && !item.type)) {
            this.placementGhost.visible = false
            this.currentHit = null
            return
        }

        // Raycast
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera)
        const intersects = raycaster.intersectObjects(this.scene.children, true) // Should filter specific layers?

        // Filter out ghost and characters
        const hit = intersects.find(h =>
            h.distance < 40 && // Increased range for building
            h.object.type === "Mesh" &&
            h.object !== this.placementGhost &&
            !this.placementGhost.children.includes(h.object) &&
            !h.object.userData.isPlayer // Avoid clicking self
        )

        this.currentHit = hit ? hit.point : null

        if (hit) {
            this.placementGhost.visible = true

            // Grid Snapping Logic
            if (this.snapToGrid) {
                const gridSize = this.gridSize || 1
                // We snap to center or edge? 
                // Usually snap to center (grid nodes)
                hit.point.x = Math.round(hit.point.x / gridSize) * gridSize
                hit.point.z = Math.round(hit.point.z / gridSize) * gridSize
                // Y usually stays on floor/surface, assuming flat terrain 0
                // If we want vertical snap, valid too, but mainly horizontal needed.
            }

            this.placementGhost.position.copy(hit.point)

            // Adjust visual based on item type
            if (item.constructor.name === "MapObjectItem") {
                this.ghostArrow.visible = false // Hide arrow for map objects
                this.ghostBaseMat.visible = true

                if (item.type === 'ramp') {
                    // Activate RAMP Mesh
                    this.ghostBoxMesh.visible = false
                    this.ghostRampMesh.visible = true

                    this.ghostRampMesh.scale.set(item.scale.z, item.scale.y, item.scale.x)
                    this.ghostRampMesh.position.y = item.scale.y / 2

                } else {
                    // Activate BOX Mesh
                    this.ghostRampMesh.visible = false
                    this.ghostBoxMesh.visible = true

                    this.ghostBoxMesh.scale.set(item.scale.x, item.scale.y, item.scale.z)
                    this.ghostBoxMesh.position.y = item.scale.y / 2 // Center visually
                }

                // Color Code?
                this.ghostBaseMat.color.setHex(0x00FF00)

            } else {
                // IMPULSE PADS (Legacy)
                this.ghostRampMesh.visible = false
                this.ghostBoxMesh.visible = true

                // Reset scale is 1x1x1? but Pads are 3x0.2x3
                this.ghostBoxMesh.scale.set(3, 0.2, 3)
                this.ghostBoxMesh.position.y = 0.1 // Flush offset

                this.ghostArrow.visible = true
                // this.placementGhost.position.y += 0.1 // Removed double offset

                // Texture Logic
                const isJump = (item.id === "pad_jump")
                if (isJump && this.texSalto) {
                    this.ghostArrowMat.map = this.texSalto
                } else if (!isJump && this.texImpulso) {
                    this.ghostArrowMat.map = this.texImpulso
                }

                // Rotation
                let rotY = 0
                if (rotationIndex === 1) rotY = -Math.PI / 2
                if (rotationIndex === 2) rotY = -Math.PI
                if (rotationIndex === 3) rotY = Math.PI / 2
                this.ghostArrow.rotation.z = rotY
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


            // Validation Logic (Restored)
            let isValid = true
            // Only validate strict overlap for Impulse Pads for now, or all?
            // Let's do generic overlap check for pads
            if (item.id.includes("pad")) {
                const PAD_SIZE = 3
                const isTargetPad = hit.object.userData && hit.object.userData.isImpulsePad
                let isOverlapping = false

                if (!isTargetPad) {
                    for (const obj of this.scene.children) {
                        if (obj.userData && obj.userData.isImpulsePad) {
                            const dx = Math.abs(obj.position.x - hit.point.x)
                            const dz = Math.abs(obj.position.z - hit.point.z)
                            if (dx < PAD_SIZE && dz < PAD_SIZE) {
                                isOverlapping = true
                                break
                            }
                        }
                    }
                }
                isValid = !isTargetPad && !isOverlapping
            }

            // Visual Feedback for Validity
            if (isValid) {
                if (item.constructor.name === "MapObjectItem") {
                    this.ghostBaseMat.color.setHex(0x00FF00)
                } else {
                    const isJump = (item.id === "pad_jump")
                    const color = isJump ? 0x00FFFF : 0x00FF00
                    this.ghostBaseMat.color.setHex(color)
                    this.ghostArrowMat.color.setHex(0xFFFFFF)
                }
                return hit.point
            } else {
                this.ghostBaseMat.color.setHex(0xFF0000)
                this.ghostArrowMat.color.setHex(0xFF0000) // Tint Red
                // Return null to prevent placement if invalid
                return null
            }

        } else {
            this.placementGhost.visible = false
            return null
        }
    }

    getCurrentTarget() {
        return this.currentHit
    }
}
