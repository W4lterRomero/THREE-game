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
        // Preset Colors
        const colors = [
            { name: "White", hex: 0xFFFFFF },
            { name: "Gray", hex: 0x888888 },
            { name: "Red", hex: 0xFF0000 },
            { name: "Green", hex: 0x00FF00 },
            { name: "Blue", hex: 0x0000FF },
            { name: "Orange", hex: 0xFFA500 },
            { name: "Purple", hex: 0x800080 },
            { name: "Black", hex: 0x111111 }
        ]

        // Shapes
        const shapes = [
            { id_prefix: "wall", name: "Pared", type: "wall", scale: { x: 4, y: 3, z: 0.5 } },
            { id_prefix: "floor", name: "Suelo", type: "wall", scale: { x: 5, y: 0.5, z: 5 } }, // Floor is a flat wall
            { id_prefix: "pillar", name: "Pilar", type: "pillar", scale: { x: 1, y: 4, z: 1 } },
            { id_prefix: "ramp", name: "Rampa", type: "ramp", scale: { x: 4, y: 2, z: 4 } },
            { id_prefix: "tall", name: "Torre", type: "pillar", scale: { x: 2, y: 10, z: 2 } }
        ]

        let count = 0
        shapes.forEach(shape => {
            colors.forEach(col => {
                count++
                const item = new MapObjectItem(
                    `${shape.id_prefix}_${col.name.toLowerCase()}`,
                    `${shape.name} ${col.name}`,
                    shape.type,
                    "", // Icon gen handled in constructor
                    col.hex,
                    shape.scale
                )
                this.libraryItems.push(item)
            })
        })
    }

    setupUI() {
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

        const tab1 = document.createElement('div')
        tab1.textContent = "Librería de Objetos"
        tab1.style.cursor = "pointer"
        tab1.style.fontWeight = "bold"
        tab1.style.borderBottom = "2px solid white"

        const tab2 = document.createElement('div')
        tab2.textContent = "Configuración Entorno"
        tab2.style.cursor = "pointer"
        tab2.style.color = "#888" // Inactive look
        tab2.onclick = () => alert("Configuración de entorno próximamente...")

        header.appendChild(tab1)
        header.appendChild(tab2)
        this.container.appendChild(header)

        // Content Area (Grid)
        const content = document.createElement('div')
        content.style.cssText = `
            flex: 1;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: 15px;
            overflow-y: auto;
            padding-right: 10px;
        `

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

            content.appendChild(card)
        })

        this.container.appendChild(content)

        // Instructions
        const footer = document.createElement('div')
        footer.textContent = "Arrastra objetos a tu barra de inventario inferior para equiparlos. Pulsa 'E' para cerrar."
        footer.style.marginTop = "20px"
        footer.style.color = "#aaa"
        this.container.appendChild(footer)

        document.body.appendChild(this.container)
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
