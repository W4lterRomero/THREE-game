import { MapObjectItem } from "../item/MapObjectItem.js"
import * as THREE from "three"

export class ConstructionMenu {
    constructor(inventoryManager, gameInstance) {
        this.inventoryManager = inventoryManager
        this.game = gameInstance // Access to toggle pause, input etc.
        this.isVisible = false

        // Data
        this.libraryItems = []
        this.generateLibrary()

        this.setupUI()
    }

    generateLibrary() {
        // Shapes
        const shapes = [
            { id_prefix: "wall", name: "Pared", type: "wall", scale: { x: 5, y: 3, z: 0.5 } },
            { id_prefix: "wall_low", name: "Muro Bajo", type: "wall", scale: { x: 5, y: 1, z: 0.5 } },
            { id_prefix: "floor", name: "Suelo", type: "wall", scale: { x: 5, y: 0.5, z: 5 } },
            { id_prefix: "platform", name: "Plataforma", type: "wall", scale: { x: 10, y: 0.5, z: 10 } },
            { id_prefix: "pillar", name: "Pilar", type: "pillar", scale: { x: 1, y: 4, z: 1 } },
            { id_prefix: "cube_s", name: "Cubo Pequeño", type: "wall", scale: { x: 1, y: 1, z: 1 } },
            { id_prefix: "cube_l", name: "Cubo Grande", type: "wall", scale: { x: 3, y: 3, z: 3 } }, // 3x3x3 fits grid better than 4x4 if grid=1? Let's use 3.
            { id_prefix: "ramp", name: "Rampa", type: "ramp", scale: { x: 4, y: 2, z: 4 } },
            { id_prefix: "stairs", name: "Gradas", type: "stairs", scale: { x: 4, y: 2, z: 4 } }, // Matches ramp/wall size roughly
            { id_prefix: "tall", name: "Torre", type: "pillar", scale: { x: 2, y: 10, z: 2 } }
        ]

        // Single Color (White)
        const whiteHex = 0xFFFFFF

        shapes.forEach(shape => {
            const item = new MapObjectItem(
                `${shape.id_prefix}`, // ID without color suffix
                `${shape.name}`,      // Name without color suffix
                shape.type,
                "",
                whiteHex,
                shape.scale
            )
            this.libraryItems.push(item)
        })
    }

    setupUI() {
        // Init Grid Helper
        this.gridHelper = new THREE.GridHelper(100, 100, 0x888888, 0x444444)
        this.gridHelper.position.y = 0.01 // Slightly above 0 to avoid z-fighting
        this.gridHelper.visible = false
        if (this.game.sceneManager && this.game.sceneManager.scene) {
            this.game.sceneManager.scene.add(this.gridHelper)
        }

        // Main Container
        this.container = document.createElement('div')
        this.container.id = 'construction-menu'
        this.container.style.cssText = `
            position: absolute;
            top: 5%; 
            left: 50%;
            transform: translateX(-50%);
            width: 80%; 
            height: 70%;
            background: rgba(0,0,0,0.9);
            border: 2px solid #444; 
            border-radius: 12px;
            display: none;
            flex-direction: column;
            color: white;
            font-family: sans-serif;
            z-index: 1000;
            padding: 20px;
            box-sizing: border-box;
            box-shadow: 0 0 20px rgba(0,0,0,0.8);
        `

        // Header / Tabs
        const header = document.createElement('div')
        header.style.cssText = `display: flex; gap: 20px; font-size: 24px; margin-bottom: 20px; border-bottom: 1px solid #555; padding-bottom: 10px;`

        this.tabLibrary = document.createElement('div')
        this.tabLibrary.textContent = "Librería de Objetos"
        this.tabLibrary.style.cursor = "pointer"
        this.tabLibrary.style.fontWeight = "bold"
        this.tabLibrary.style.borderBottom = "2px solid white"
        this.tabLibrary.onclick = () => this.switchTab('library')

        this.tabSettings = document.createElement('div')
        this.tabSettings.textContent = "Configuración Entorno"
        this.tabSettings.style.cursor = "pointer"
        this.tabSettings.style.color = "#888" // Inactive look
        this.tabSettings.style.borderBottom = "none"
        this.tabSettings.onclick = () => this.switchTab('settings')

        header.appendChild(this.tabLibrary)
        header.appendChild(this.tabSettings)
        this.container.appendChild(header)

        // Content Area Containers
        this.contentLibrary = document.createElement('div')
        this.contentLibrary.style.cssText = `
            flex: 1;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: 15px;
            overflow-y: auto;
            padding-right: 10px;
        `
        this.renderLibrary(this.contentLibrary)

        this.contentSettings = document.createElement('div')
        this.contentSettings.style.cssText = `
            flex: 1;
            display: none; /* Hidden by default */
            flex-direction: column;
            gap: 15px;
            overflow-y: auto;
            padding: 10px;
        `
        this.renderSettings(this.contentSettings)

        this.container.appendChild(this.contentLibrary)
        this.container.appendChild(this.contentSettings)

        // Instructions
        const footer = document.createElement('div')
        footer.textContent = "Arrastra objetos a tu barra de inventario inferior para equiparlos. Pulsa 'E' para cerrar."
        footer.style.marginTop = "20px"
        footer.style.color = "#aaa"
        this.container.appendChild(footer)

        document.body.appendChild(this.container)
    }

    switchTab(tabName) {
        if (tabName === 'library') {
            this.contentLibrary.style.display = 'grid'
            this.contentSettings.style.display = 'none'

            this.tabLibrary.style.fontWeight = "bold"
            this.tabLibrary.style.color = "white"
            this.tabLibrary.style.borderBottom = "2px solid white"

            this.tabSettings.style.fontWeight = "normal"
            this.tabSettings.style.color = "#888"
            this.tabSettings.style.borderBottom = "none"

        } else if (tabName === 'settings') {
            this.contentLibrary.style.display = 'none'
            this.contentSettings.style.display = 'flex'

            this.tabLibrary.style.fontWeight = "normal"
            this.tabLibrary.style.color = "#888"
            this.tabLibrary.style.borderBottom = "none"

            this.tabSettings.style.fontWeight = "bold"
            this.tabSettings.style.color = "white"
            this.tabSettings.style.borderBottom = "2px solid white"
        }
    }

    renderSettings(container) {
        // Grid Toggle
        const row = document.createElement('div')
        row.style.cssText = `display: flex; align-items: center; gap: 10px;`

        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.id = 'chk-show-grid'
        checkbox.style.transform = 'scale(1.5)'
        checkbox.addEventListener('change', (e) => {
            if (this.gridHelper) {
                this.gridHelper.visible = e.target.checked
            }
        })

        const label = document.createElement('label')
        label.textContent = "Mostrar Cuadrícula de Mapa"
        label.htmlFor = 'chk-show-grid'
        label.style.fontSize = "18px"
        label.style.cursor = "pointer"

        row.appendChild(checkbox)
        row.appendChild(label)
        container.appendChild(row)

        // Snapping Toggle
        const rowSnap = document.createElement('div')
        rowSnap.style.cssText = `display: flex; align-items: center; gap: 10px;`

        const checkSnap = document.createElement('input')
        checkSnap.type = 'checkbox'
        checkSnap.id = 'chk-snap-grid'
        checkSnap.style.transform = 'scale(1.5)'
        checkSnap.addEventListener('change', (e) => {
            // Access placement manager via game instance
            // Assuming game instance has placementManager accessible or sceneManager has it. 
            // Ideally game.js should expose it, or we find it bound somewhere.
            // Checking main_rapier.js: this.placementManager is on the Game instance as 'this.placementManager'
            if (this.game.placementManager) {
                this.game.placementManager.snapToGrid = e.target.checked
            }
        })

        const labelSnap = document.createElement('label')
        labelSnap.textContent = "Activar Construcción en Cuadrícula"
        labelSnap.htmlFor = 'chk-snap-grid'
        labelSnap.style.fontSize = "18px"
        labelSnap.style.cursor = "pointer"

        rowSnap.appendChild(checkSnap)
        rowSnap.appendChild(labelSnap)
        container.appendChild(rowSnap)

        // No-Clip Toggle
        const rowClip = document.createElement('div')
        rowClip.style.cssText = `display: flex; align-items: center; gap: 10px;`

        const checkClip = document.createElement('input')
        checkClip.type = 'checkbox'
        checkClip.id = 'chk-no-clip'
        checkClip.style.transform = 'scale(1.5)'
        checkClip.addEventListener('change', (e) => {
            if (this.game.character && this.game.character.setNoClip) {
                this.game.character.setNoClip(e.target.checked)
            }
        })

        const labelClip = document.createElement('label')
        labelClip.textContent = "Desactivar Colisión (Fantasma)"
        labelClip.htmlFor = 'chk-no-clip'
        labelClip.style.fontSize = "18px"
        labelClip.style.cursor = "pointer"

        rowClip.appendChild(checkClip)
        rowClip.appendChild(labelClip)
        container.appendChild(rowClip)

        // Aerial Grid Toggle
        const rowAerial = document.createElement('div')
        rowAerial.style.cssText = `display: flex; align-items: center; gap: 10px; margin-top: 10px; border-top: 1px solid #444; padding-top: 10px;`

        const checkAerial = document.createElement('input')
        checkAerial.type = 'checkbox'
        checkAerial.id = 'chk-aerial-grid'
        checkAerial.style.transform = 'scale(1.5)'
        checkAerial.addEventListener('change', (e) => {
            if (this.game.placementManager) {
                this.game.placementManager.setAerialGrid(e.target.checked)

                // Toggle Status UI
                const statusEl = document.getElementById("aerial-grid-status")
                if (statusEl) {
                    statusEl.style.display = e.target.checked ? "block" : "none"
                    // Reset to default
                    statusEl.textContent = "G: Suelo No Fijado"
                    statusEl.style.color = "#00FF00"
                }
            }
        })

        const labelAerial = document.createElement('label')
        labelAerial.textContent = "Activar Grid Aéreo (Construcción en el Aire)"
        labelAerial.htmlFor = 'chk-aerial-grid'
        labelAerial.style.fontSize = "18px"
        labelAerial.style.cursor = "pointer"
        labelAerial.style.color = "#00ffcc" // Highlight it

        rowAerial.appendChild(checkAerial)
        rowAerial.appendChild(labelAerial)
        container.appendChild(rowAerial)
    }

    renderLibrary(container) {
        // Populate Grid
        this.libraryItems.forEach(item => {
            const card = document.createElement('div')
            card.draggable = true
            card.style.cssText = `
                background: #333;
                border-radius: 8px;
                padding: 10px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
                cursor: grab;
                transition: transform 0.1s;
                user-select: none;
            `
            card.onmouseover = () => card.style.background = "#444"
            card.onmouseout = () => card.style.background = "#333"

            const img = document.createElement('img')
            img.src = item.iconPath
            img.style.width = "64px"
            img.style.height = "64px"
            img.style.objectFit = "contain"
            img.draggable = false // Drag container

            const lbl = document.createElement('span')
            lbl.textContent = item.name
            lbl.style.fontSize = "12px"
            lbl.style.textAlign = "center"

            card.appendChild(img)
            card.appendChild(lbl)

            // Drag Events
            card.addEventListener('dragstart', (e) => {
                // IMPORTANT: We must NOT stringify circular structs. 
                // We use module-level or instance-level tracker.
                this.draggedItem = item
                e.dataTransfer.effectAllowed = "copy"
                e.dataTransfer.setData("text/plain", "item") // Required for drag to work in some browsers
            })

            container.appendChild(card)
        })
    }

    toggle() {
        this.isVisible = !this.isVisible
        this.container.style.display = this.isVisible ? 'flex' : 'none'

        // Pause Game Input / Pointer Lock
        if (this.isVisible) {
            document.exitPointerLock()
            if (this.game.inputManager) {
                this.game.inputManager.enabled = false
                if (this.game.inputManager.reset) this.game.inputManager.reset()
                this.game.isMouseDown = false // Clear stickiness
            }
        } else {
            // Resume
            if (this.game.inputManager) {
                this.game.inputManager.enabled = true
                if (this.game.inputManager.reset) this.game.inputManager.reset()
            }

            // Re-request pointer lock after a small delay to ensure browser handles it
            setTimeout(() => {
                if (this.game.cameraController) {
                    this.game.cameraController.lock()
                } else {
                    document.body.requestPointerLock()
                }
            }, 100)
        }
    }
}
