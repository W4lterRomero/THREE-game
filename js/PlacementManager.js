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
    update(inventorySlot, rotationIndex) {
        this.currentSlot = inventorySlot
        this.rotationIndex = rotationIndex

        // Solo mostrar para slots 0 y 1
        if (inventorySlot !== 0 && inventorySlot !== 1) {
            this.placementGhost.visible = false
            return null
        }

        // Raycast desde el centro de la cámara
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera)

        // Intersectar con objetos de la escena (excluyendo el ghost mismo)
        const intersects = raycaster.intersectObjects(this.scene.children, true)

        // Encontrar impacto válido en Mesh (suelo/paredes)
        const hit = intersects.find(h =>
            h.distance < 15 &&
            h.object.type === "Mesh" &&
            h.object !== this.placementGhost &&
            !this.placementGhost.children.includes(h.object)
        )

        if (hit) {
            this.placementGhost.visible = true
            this.placementGhost.position.copy(hit.point)
            // Ajuste de altura: Sin offset adicional para que quede a ras del suelo
            // (La geometría base ya está ajustada internamente para que su cara superior esté en 0 local)

            // Actualizar visuales según el slot
            const isJump = (inventorySlot === 1)
            const color = isJump ? 0x00FFFF : 0x00FF00 // Celeste o Verde

            this.ghostBaseMat.color.setHex(color)

            // Aplicar Textura
            if (isJump && this.texSalto) {
                this.ghostArrowMat.map = this.texSalto
                this.ghostArrowMat.needsUpdate = true
            } else if (!isJump && this.texImpulso) {
                this.ghostArrowMat.map = this.texImpulso
                this.ghostArrowMat.needsUpdate = true
            }

            // Manejar Rotación
            if (!isJump) {
                // Lateral: Rotar flecha según índice
                // 0: Norte, 1: Este, etc.
                let rotY = 0
                if (rotationIndex === 1) rotY = -Math.PI / 2
                if (rotationIndex === 2) rotY = -Math.PI
                if (rotationIndex === 3) rotY = Math.PI / 2

                this.ghostArrow.rotation.z = rotY // Z porque el plano está rotado en X (-90)
            } else {
                this.ghostArrow.rotation.z = 0
            }

            return hit.point
        } else {
            this.placementGhost.visible = false
            return null
        }
    }
}
