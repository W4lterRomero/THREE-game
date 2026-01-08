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

        // Geometría Base (Caja transparente)
        const geometry = new THREE.BoxGeometry(3, 0.2, 3)
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            wireframe: true
        })
        this.ghostBaseMat = material

        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.y -= 0.1 // Alinear flush con el suelo (centro es 0, mitad 0.1, movemos -0.1 para que top sea 0)
        this.placementGhost.add(mesh)

        // Flecha / Icono indicador
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
            this.placementGhost.position.copy(hit.point)

            // Adjust visual based on item type
            if (item.constructor.name === "MapObjectItem") {
                // Resize base to match item scale
                this.ghostArrow.visible = false
                this.ghostBaseMat.visible = true

                // We should ideally resize the box geometry to match the item
                // But geometry is shared? Scale the mesh!
                // Assuming first child is the Box Mesh
                const mesh = this.placementGhost.children[0]
                if (mesh) {
                    mesh.scale.set(item.scale.x / 3, item.scale.y / 0.2, item.scale.z / 3) // Base is 3x0.2x3
                    mesh.position.y = item.scale.y / 2 // Center visually
                }

                // Color Code?
                this.ghostBaseMat.color.setHex(0x00FF00)

            } else {
                // IMPULSE PADS (Legacy)
                // Reset scale
                const mesh = this.placementGhost.children[0]
                if (mesh) {
                    mesh.scale.set(1, 1, 1)
                    mesh.position.y = 0 // Flush
                }

                this.ghostArrow.visible = true
                this.placementGhost.position.y += 0.1

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
