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
            display: flex; /* Flex Row */
            gap: 20px;
            overflow: hidden; /* Manage overflow internally */
        `

        // Left: Grid
        this.libraryGrid = document.createElement('div')
        this.libraryGrid.style.cssText = `
            flex: 2;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            grid-auto-rows: 120px;
            gap: 10px;
            overflow-y: auto;
            padding-right: 10px;
            align-content: start;
        `
        this.renderLibraryGrid(this.libraryGrid)

        // Right: Customizer Panel
        this.libraryPanel = document.createElement('div')
        this.libraryPanel.style.cssText = `
            flex: 1;
            background: #222;
            border-left: 1px solid #444;
            padding: 15px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            border-radius: 8px;
        `
        this.renderLibraryPanel(this.libraryPanel)

        this.contentLibrary.appendChild(this.libraryGrid)
        this.contentLibrary.appendChild(this.libraryPanel)

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
            this.contentLibrary.style.display = 'flex'
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

    renderLibraryGrid(container) {
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
                justify-content: center;
                gap: 5px;
                cursor: pointer;
                transition: transform 0.1s;
                user-select: none;
            `
            card.onmouseover = () => {
                if (this.selectedItem !== item) card.style.background = "#444"
                else card.style.background = "#555"
            }
            card.onmouseout = () => {
                if (this.selectedItem !== item) card.style.background = "#333"
                else card.style.background = "#555"
            }
            card.onclick = () => {
                // Update selection UI
                Array.from(container.children).forEach(c => c.style.border = "none")
                card.style.border = "2px solid #00FF00"
                this.selectItem(item)
            }

            const img = document.createElement('img')
            img.src = item.iconPath
            img.style.width = "64px"
            img.style.height = "64px"
            img.style.objectFit = "contain"
            img.draggable = false

            const lbl = document.createElement('span')
            lbl.textContent = item.name
            lbl.style.fontSize = "12px"
            lbl.style.textAlign = "center"

            card.appendChild(img)
            card.appendChild(lbl)

            // Drag Events (Default White)
            card.addEventListener('dragstart', (e) => {
                this.draggedItem = item
                e.dataTransfer.effectAllowed = "copy"
                e.dataTransfer.setData("text/plain", "item")
            })

            container.appendChild(card)
        })
    }

    renderLibraryPanel(container) {
        // Placeholder State
        this.panelPlaceholder = document.createElement('div')
        this.panelPlaceholder.textContent = "Selecciona un elemento para editar"
        this.panelPlaceholder.style.cssText = `
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            text-align: center;
        `

        // Editor State
        this.panelEditor = document.createElement('div')
        this.panelEditor.style.cssText = `
            display: none; /* Hidden init */
            flex-direction: column;
            gap: 15px;
            align-items: center;
            width: 100%;
        `

        // 1. Title
        this.editorTitle = document.createElement('h3')
        this.editorTitle.style.margin = "0"
        this.editorTitle.style.borderBottom = "1px solid #444"
        this.editorTitle.style.width = "100%"
        this.editorTitle.style.textAlign = "center"
        this.editorTitle.style.paddingBottom = "10px"

        // 2. Large Preview (Draggable)
        this.editorPreview = document.createElement('div')
        this.editorPreview.draggable = true
        this.editorPreview.style.cssText = `
            width: 128px;
            height: 128px;
            background: #111;
            border: 2px dashed #444;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            transition: 0.2s;
        `
        this.editorPreview.onmouseover = () => this.editorPreview.style.borderColor = "#fff"
        this.editorPreview.onmouseout = () => this.editorPreview.style.borderColor = "#444"

        this.editorImg = document.createElement('img')
        this.editorImg.style.width = "100%"
        this.editorImg.style.height = "100%"
        this.editorImg.style.objectFit = "contain"
        this.editorImg.draggable = false

        this.editorPreview.appendChild(this.editorImg)

        // Drag Logic for Custom Item
        this.editorPreview.addEventListener('dragstart', (e) => {
            if (this.currentDraftItem) {
                this.draggedItem = this.currentDraftItem
                e.dataTransfer.effectAllowed = "copy"
                e.dataTransfer.setData("text/plain", "item")
            }
        })

        // 3. Color Controls Setup
        const controlsContainer = document.createElement('div')
        controlsContainer.style.width = "100%"
        controlsContainer.style.display = "flex"
        controlsContainer.style.flexDirection = "column"
        controlsContainer.style.gap = "10px"

        // Color Picker Row
        const pickerRow = document.createElement('div')
        pickerRow.style.display = "flex"
        pickerRow.style.alignItems = "center"
        pickerRow.style.justifyContent = "space-between"

        const pickerLabel = document.createElement('span')
        pickerLabel.textContent = "Color:"

        this.colorPicker = document.createElement('input')
        this.colorPicker.type = "color"
        this.colorPicker.style.border = "none"
        this.colorPicker.style.width = "40px"
        this.colorPicker.style.height = "40px"
        this.colorPicker.style.cursor = "pointer"
        this.colorPicker.style.backgroundColor = "transparent"
        this.colorPicker.addEventListener('input', (e) => {
            this.updateDraftColor(e.target.value)
        })

        pickerRow.appendChild(pickerLabel)
        pickerRow.appendChild(this.colorPicker)
        controlsContainer.appendChild(pickerRow)

        // Palette
        this.paletteContainer = document.createElement('div')
        this.paletteContainer.style.cssText = `
            display: flex; 
            flex-wrap: wrap; 
            gap: 5px; 
            justify-content: center;
            margin-top: 10px;
        `
        const colors = [
            "#FFFFFF", "#000000", "#FF0000", "#00FF00", "#0000FF",
            "#FFFF00", "#00FFFF", "#FF00FF", "#FFA500", "#800080",
            "#40E0D0", "#FFC0CB", "#8B4513", "#808080"
        ]

        colors.forEach(c => {
            const swatch = document.createElement('div')
            swatch.style.cssText = `
                width: 24px; 
                height: 24px; 
                background-color: ${c}; 
                border-radius: 4px; 
                cursor: pointer; 
                border: 1px solid #555;
            `
            swatch.onclick = () => {
                this.colorPicker.value = c // Sync picker
                this.updateDraftColor(c)
            }
            this.paletteContainer.appendChild(swatch)
        })
        controlsContainer.appendChild(this.paletteContainer)

        // Add to panel
        this.panelEditor.appendChild(this.editorTitle)
        this.panelEditor.appendChild(this.editorPreview)
        this.panelEditor.appendChild(controlsContainer)

        const dragHint = document.createElement('div')
        dragHint.textContent = "Arrastra la imagen superior a tu inventario"
        dragHint.style.fontSize = "12px"
        dragHint.style.color = "#888"
        dragHint.style.marginTop = "auto"
        dragHint.style.textAlign = "center"
        this.panelEditor.appendChild(dragHint)

        container.appendChild(this.panelPlaceholder)
        container.appendChild(this.panelEditor)
    }

    selectItem(baseItem) {
        this.selectedItem = baseItem

        // Show Editor
        this.panelPlaceholder.style.display = 'none'
        this.panelEditor.style.display = 'flex'

        this.editorTitle.textContent = baseItem.name

        // Init Draft
        this.createDraft(baseItem.id, baseItem.name, baseItem.type, baseItem.color, baseItem.scale)

        // Reset color picker
        const hex = '#' + new THREE.Color(baseItem.color).getHexString()
        this.colorPicker.value = hex
        this.updateDraftColor(hex)
    }

    createDraft(id, name, type, color, scale) {
        // Create a new MapObjectItem that acts as our "Modified" version
        // We pass the color directly
        this.currentDraftItem = new MapObjectItem(id, name, type, "", color, scale)
    }

    updateDraftColor(colorHex) {
        if (!this.currentDraftItem) return

        // Update Color
        this.currentDraftItem.color = parseInt(colorHex.replace('#', '0x'))

        // Regenerate Icon
        this.currentDraftItem.iconPath = this.currentDraftItem.generateIcon()

        // Update Preview
        this.editorImg.src = this.currentDraftItem.iconPath
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
