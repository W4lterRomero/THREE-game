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
        this.generateLogicLibrary() // Logic Items

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

    generateLogicLibrary() {
        // Logic Objects
        this.logicItems = []

        // Player Spawn
        const spawn = new MapObjectItem(
            "spawn_point",
            "Punto de Spawn",
            "spawn_point",
            "",
            0x00FF00, // Green
            { x: 1, y: 2, z: 1 } // Human size roughly
        )
        // Default Logic Properties
        spawn.logicProperties = {
            team: 1,
            capacity: 1,
            order: 1
        }

        this.logicItems.push(spawn)
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

        this.tabLogic = document.createElement('div')
        this.tabLogic.textContent = "Lógica Interactiva"
        this.tabLogic.style.cursor = "pointer"
        this.tabLogic.style.color = "#888" // Inactive look
        this.tabLogic.style.borderBottom = "none"
        this.tabLogic.onclick = () => this.switchTab('logic')

        this.tabSettings = document.createElement('div')
        this.tabSettings.textContent = "Configuración Entorno"
        this.tabSettings.style.cursor = "pointer"
        this.tabSettings.style.color = "#888" // Inactive look
        this.tabSettings.style.borderBottom = "none"
        this.tabSettings.onclick = () => this.switchTab('settings')

        this.tabSaveLoad = document.createElement('div')
        this.tabSaveLoad.textContent = "Guardar / Cargar"
        this.tabSaveLoad.style.cursor = "pointer"
        this.tabSaveLoad.style.color = "#888" // Inactive look
        this.tabSaveLoad.style.borderBottom = "none"
        this.tabSaveLoad.onclick = () => this.switchTab('saveload')

        header.appendChild(this.tabLibrary)
        header.appendChild(this.tabLogic)
        header.appendChild(this.tabSettings)
        header.appendChild(this.tabSaveLoad)
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
        this.renderLibraryGrid(this.libraryGrid, this.libraryItems)

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
            overflow-y: auto; /* Global Scroll */
            scrollbar-width: thin; /* Firefox */
            scrollbar-color: #444 #222; /* Firefox */
        `

        // Inject Custom Scrollbar Style for Webkit
        const style = document.createElement('style')
        style.innerHTML = `
            #construction-menu ::-webkit-scrollbar {
                width: 6px;
            }
            #construction-menu ::-webkit-scrollbar-track {
                background: #222; 
            }
            #construction-menu ::-webkit-scrollbar-thumb {
                background: #444; 
                border-radius: 3px;
            }
            #construction-menu ::-webkit-scrollbar-thumb:hover {
                background: #555; 
            }
        `
        this.container.appendChild(style)

        this.renderLibraryPanel(this.libraryPanel)

        this.contentLibrary.appendChild(this.libraryGrid)
        this.contentLibrary.appendChild(this.libraryPanel)

        // Logic Content
        this.contentLogic = document.createElement('div')
        this.contentLogic.style.cssText = `
            flex: 1;
            display: none; 
            gap: 20px;
            overflow: hidden;
            flex-direction: row; /* Horizontal Split */
        `

        // Left: Logic Library (New Items)
        const leftContainer = document.createElement('div')
        leftContainer.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 10px;
            border-right: 1px solid #444;
            padding-right: 10px;
        `
        const leftTitle = document.createElement('h3')
        leftTitle.textContent = "Nuevo Objeto"
        leftTitle.style.margin = "0 0 10px 0"
        leftTitle.style.color = "#aaa"
        leftContainer.appendChild(leftTitle)

        this.logicGrid = document.createElement('div')
        this.logicGrid.style.cssText = `
            flex: 1;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            grid-auto-rows: 120px;
            gap: 10px;
            overflow-y: auto;
            align-content: start;
        `
        this.renderLibraryGrid(this.logicGrid, this.logicItems)
        leftContainer.appendChild(this.logicGrid)

        this.contentLogic.appendChild(leftContainer)


        // Right: Scene Logic Objects (Tree + Editor)
        const rightContainer = document.createElement('div')
        rightContainer.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `
        const rightTitle = document.createElement('h3')
        rightTitle.textContent = "Objetos en Escena"
        rightTitle.style.margin = "0 0 10px 0"
        rightTitle.style.color = "#aaa"
        rightContainer.appendChild(rightTitle)

        // Tree View Container
        this.logicTreePanel = document.createElement('div')
        this.logicTreePanel.style.cssText = `
            flex: 1;
            background: #222;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 10px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 5px;
        `
        rightContainer.appendChild(this.logicTreePanel)

        // Properties Editor Container (Bottom of Right)
        this.logicPropertiesPanel = document.createElement('div')
        this.logicPropertiesPanel.style.cssText = `
            height: 250px; /* Fixed height for editor */
            background: #2b2b2b;
            border-top: 2px solid #555;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            overflow-y: auto;
            border-radius: 0 0 8px 8px; /* Rounded only bottom if attached */
        `
        this.logicPropertiesPanel.innerHTML = `<div style="color:#666; text-align:center; padding-top:20px;">Selecciona un objeto de la lista para editar</div>`

        rightContainer.appendChild(this.logicPropertiesPanel)
        this.contentLogic.appendChild(rightContainer)


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

        this.contentSaveLoad = document.createElement('div')
        this.contentSaveLoad.style.cssText = `
            flex: 1;
            display: none; /* Hidden by default */
            flex-direction: column;
            gap: 15px;
            overflow-y: auto;
            padding: 10px;
            align-items: center; /* Center content */
        `
        this.renderSaveLoad(this.contentSaveLoad)

        this.container.appendChild(this.contentLibrary)
        this.container.appendChild(this.contentLogic)
        this.container.appendChild(this.contentSettings)
        this.container.appendChild(this.contentSaveLoad)


        // Instructions
        const footer = document.createElement('div')
        footer.textContent = "Arrastra objetos a tu barra de inventario inferior para equiparlos. Pulsa 'E' para cerrar."
        footer.style.marginTop = "20px"
        footer.style.color = "#aaa"
        this.container.appendChild(footer)

        document.body.appendChild(this.container)
    }

    switchTab(tabName) {
        // Reset all
        this.contentLibrary.style.display = 'none'
        this.contentLogic.style.display = 'none'
        this.contentSettings.style.display = 'none'
        this.contentSaveLoad.style.display = 'none'

        this.tabLibrary.style.fontWeight = "normal"
        this.tabLibrary.style.color = "#888"
        this.tabLibrary.style.borderBottom = "none"

        this.tabLogic.style.fontWeight = "normal"
        this.tabLogic.style.color = "#888"
        this.tabLogic.style.borderBottom = "none"

        this.tabSettings.style.fontWeight = "normal"
        this.tabSettings.style.color = "#888"
        this.tabSettings.style.borderBottom = "none"

        this.tabSaveLoad.style.fontWeight = "normal"
        this.tabSaveLoad.style.color = "#888"
        this.tabSaveLoad.style.borderBottom = "none"

        // Activate Selected
        if (tabName === 'library') {
            this.contentLibrary.style.display = 'flex'
            this.tabLibrary.style.fontWeight = "bold"
            this.tabLibrary.style.color = "white"
            this.tabLibrary.style.borderBottom = "2px solid white"

        } else if (tabName === 'logic') {
            this.contentLogic.style.display = 'flex'
            this.tabLogic.style.fontWeight = "bold"
            this.tabLogic.style.color = "white"
            this.tabLogic.style.borderBottom = "2px solid white"
            this.refreshLogicList()

        } else if (tabName === 'settings') {
            this.contentSettings.style.display = 'flex'
            this.tabSettings.style.fontWeight = "bold"
            this.tabSettings.style.color = "white"
            this.tabSettings.style.borderBottom = "2px solid white"

        } else if (tabName === 'saveload') {
            this.contentSaveLoad.style.display = 'flex'
            this.tabSaveLoad.style.fontWeight = "bold"
            this.tabSaveLoad.style.color = "white"
            this.tabSaveLoad.style.borderBottom = "2px solid white"
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

    renderSaveLoad(container) {
        // Save Map Section
        const saveSection = document.createElement('div')
        saveSection.style.cssText = `
            width: 100%;
            max-width: 400px;
            background: #222;
            padding: 20px;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            border: 1px solid #444;
        `

        const saveTitle = document.createElement('h3')
        saveTitle.textContent = "Guardar Mapa"
        saveTitle.style.margin = "0"
        saveTitle.style.borderBottom = "1px solid #555"
        saveTitle.style.paddingBottom = "10px"

        const saveInfo = document.createElement('p')
        saveInfo.textContent = "Descarga el archivo JSON de tu mapa actual para guardarlo en tu computadora."
        saveInfo.style.color = "#aaa"
        saveInfo.style.fontSize = "14px"
        saveInfo.style.margin = "0"

        const saveBtn = document.createElement('button')
        saveBtn.textContent = "Guardar Mapa (JSON)"
        saveBtn.style.cssText = `
            background: #545454ff;
            color: white;
            border: none;
            padding: 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            transition: background 0.2s;
        `
        saveBtn.onmouseover = () => saveBtn.style.background = "#656565ff"
        saveBtn.onmouseout = () => saveBtn.style.background = "#545454ff"
        saveBtn.onclick = () => {
            if (this.game.saveMap) {
                const mapData = this.game.saveMap()
                const json = JSON.stringify(mapData, null, 2)

                // Download
                const blob = new Blob([json], { type: "application/json" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = "mi_mapa.json"
                a.click()
                URL.revokeObjectURL(url)

                alert("Mapa guardado! Archivo descargado.")
            } else {
                alert("Error: Función saveMap no encontrada en el juego.")
            }
        }

        saveSection.appendChild(saveTitle)
        saveSection.appendChild(saveInfo)
        saveSection.appendChild(saveBtn)

        // Load Map Section
        const loadSection = document.createElement('div')
        loadSection.style.cssText = `
            width: 100%;
            max-width: 400px;
            background: #222;
            padding: 20px;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            border: 1px solid #444;
            margin-top: 20px;
        `

        const loadTitle = document.createElement('h3')
        loadTitle.textContent = "Cargar Mapa"
        loadTitle.style.margin = "0"
        loadTitle.style.borderBottom = "1px solid #555"
        loadTitle.style.paddingBottom = "10px"

        const loadInfo = document.createElement('p')
        loadInfo.textContent = "Selecciona un archivo JSON previamente guardado para cargarlo."
        loadInfo.style.color = "#aaa"
        loadInfo.style.fontSize = "14px"
        loadInfo.style.margin = "0"

        const fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.accept = '.json'
        fileInput.style.color = "white"

        const loadBtn = document.createElement('button')
        loadBtn.textContent = "Cargar Mapa"
        loadBtn.style.cssText = `
            background: #545454ff;
            color: white;
            border: none;
            padding: 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            transition: background 0.2s;
        `
        loadBtn.onmouseover = () => loadBtn.style.background = "#656565ff"
        loadBtn.onmouseout = () => loadBtn.style.background = "#545454ff"
        loadBtn.onclick = () => {
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0]
                const reader = new FileReader()
                reader.onload = (e) => {
                    try {
                        const json = JSON.parse(e.target.result)
                        if (this.game.loadMap) {
                            this.game.loadMap(json)
                            // Close menu after successful load? Maybe optional.
                            this.toggle()
                            alert("Mapa cargado correctamente!")
                        } else {
                            alert("Error: Función loadMap no encontrada en el juego.")
                        }
                    } catch (err) {
                        alert("Error al parsear el archivo JSON: " + err)
                    }
                }
                reader.readAsText(file)
            } else {
                alert("Por favor selecciona un archivo primero.")
            }
        }

        loadSection.appendChild(loadTitle)
        loadSection.appendChild(loadInfo)
        loadSection.appendChild(fileInput)
        loadSection.appendChild(loadBtn)

        container.appendChild(saveSection)
        container.appendChild(loadSection)
    }

    renderLibraryGrid(container, items) {
        // Populate Grid
        items.forEach(item => {
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

        // 4. Texture Controls
        const textureContainer = document.createElement('div')
        textureContainer.style.cssText = `
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 10px;
            border-top: 1px solid #444;
            padding-top: 10px;
        `

        const textureLabel = document.createElement('span')
        textureLabel.textContent = "Textura:"
        textureContainer.appendChild(textureLabel)

        const textureGrid = document.createElement('div')
        textureGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 5px;
        `

        // Texture Options
        const textures = [
            { name: "Ninguna", path: null, color: "#333" },
            { name: "Ladrillo", path: "assets/textures/obj/brick.png", img: "assets/textures/obj/brick.png" },
            { name: "Concreto", path: "assets/textures/obj/concrete.png", img: "assets/textures/obj/concrete.png" },
            { name: "Madera", path: "assets/textures/obj/wood.png", img: "assets/textures/obj/wood.png" },
            { name: "Hierro", path: "assets/textures/obj/hierro.png", img: "assets/textures/obj/hierro.png" }
        ]

        textures.forEach(tex => {
            const btn = document.createElement('div')
            btn.className = 'texture-btn'
            btn.title = tex.name
            btn.style.cssText = `
                width: 100%;
                aspect-ratio: 1;
                border: 1px solid #555;
                border-radius: 4px;
                cursor: pointer;
                background-color: ${tex.color || 'transparent'};
                background-image: ${tex.img ? `url(${tex.img})` : 'none'};
                background-size: cover;
                background-position: center;
            `
            btn.onclick = () => {
                this.updateDraftTexture(tex.path)
                // Highlight selection
                const allBtns = this.panelEditor.querySelectorAll('.texture-btn')
                allBtns.forEach(c => c.style.borderColor = "#555")
                btn.style.borderColor = "#00FF00"
            }
            textureGrid.appendChild(btn)
        })
        textureContainer.appendChild(textureGrid)

        // Upload Button
        const uploadRow = document.createElement('div')
        uploadRow.style.cssText = `display: flex; gap: 5px;`

        const fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.accept = 'image/*'
        fileInput.style.display = 'none'
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0]
            if (file) {
                const reader = new FileReader()
                reader.onload = (evt) => {
                    const dataUrl = evt.target.result
                    this.updateDraftTexture(dataUrl)
                    // Visual feedback
                    uploadBtn.textContent = "Textura Cargada"
                    uploadBtn.style.color = "#00FF00"

                    // Reset grid selection
                    const allBtns = this.panelEditor.querySelectorAll('.texture-btn')
                    allBtns.forEach(c => c.style.borderColor = "#555")
                }
                reader.readAsDataURL(file)
            }
        })

        const uploadBtn = document.createElement('button')
        uploadBtn.id = 'texture-upload-btn'
        uploadBtn.textContent = "Subir Textura Personal"
        uploadBtn.style.cssText = `
            flex: 1;
            background: #444;
            color: white;
            border: none;
            padding: 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `
        uploadBtn.onclick = () => fileInput.click()

        uploadRow.appendChild(fileInput)
        uploadRow.appendChild(uploadBtn)
        textureContainer.appendChild(uploadRow)

        this.panelEditor.appendChild(textureContainer)

        // 5. Dimension Controls
        const dimContainer = document.createElement('div')
        dimContainer.style.cssText = `
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 10px;
            border-top: 1px solid #444;
            padding-top: 10px;
        `
        const dimLabel = document.createElement('span')
        dimLabel.textContent = "Dimensiones (X, Y, Z):"
        dimContainer.appendChild(dimLabel)

        const dimRow = document.createElement('div')
        dimRow.style.cssText = `display: flex; gap: 5px;`

        const createDimInput = (axis, label) => {
            const container = document.createElement('div')
            container.style.cssText = `flex: 1; display: flex; flex-direction: column; gap: 2px;`

            const lbl = document.createElement('span')
            lbl.textContent = label
            lbl.style.fontSize = "10px"
            lbl.style.color = "#aaa"

            const input = document.createElement('input')
            input.type = "number"
            input.step = "0.5"
            input.min = "0.1"
            input.style.width = "100%"
            input.style.backgroundColor = "#333"
            input.style.color = "white"
            input.style.border = "1px solid #555"
            input.style.borderRadius = "4px"
            input.style.padding = "4px"
            input.onchange = (e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val) && val > 0) {
                    this.updateDraftScale(axis, val)
                }
            }
            // Store ref to update later
            this[`inputDim${axis}`] = input

            container.appendChild(lbl)
            container.appendChild(input)
            return container
        }

        dimRow.appendChild(createDimInput('x', 'Ancho'))
        dimRow.appendChild(createDimInput('y', 'Alto'))
        dimRow.appendChild(createDimInput('z', 'Prof.'))

        dimContainer.appendChild(dimRow)
        this.panelEditor.appendChild(dimContainer)


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

        // Init Draft - CRITICAL: Copy scale object to avoid mutation
        const scaleCopy = { ...baseItem.scale }
        this.createDraft(baseItem.id, baseItem.name, baseItem.type, baseItem.color, scaleCopy, baseItem.texturePath)

        // Reset color picker
        const hex = '#' + new THREE.Color(baseItem.color).getHexString()
        this.colorPicker.value = hex
        this.updateDraftColor(hex)

        // Reset Texture UI
        const allBtns = this.panelEditor.querySelectorAll('.texture-btn')
        allBtns.forEach(c => c.style.borderColor = "#555")
        // Select None (first one) by default if baseItem has no texture
        if (allBtns.length > 0) allBtns[0].style.borderColor = "#00FF00"

        const uploadBtn = this.panelEditor.querySelector('#texture-upload-btn')
        if (uploadBtn) {
            uploadBtn.textContent = "Subir Textura Personal"
            uploadBtn.style.color = "white"
        }

        // Reset Inputs
        if (this.inputDimx) this.inputDimx.value = scaleCopy.x
        if (this.inputDimy) this.inputDimy.value = scaleCopy.y
        if (this.inputDimz) this.inputDimz.value = scaleCopy.z
    }

    createDraft(id, name, type, color, scale, texturePath = null) {
        // Create a new MapObjectItem that acts as our "Modified" version
        // We pass the color directly
        this.currentDraftItem = new MapObjectItem(id, name, type, "", color, scale, texturePath)
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

    updateDraftTexture(texturePath) {
        if (!this.currentDraftItem) return
        this.currentDraftItem.texturePath = texturePath
    }

    updateDraftScale(axis, value) {
        if (!this.currentDraftItem) return
        this.currentDraftItem.scale[axis] = value
    }

    toggle() {
        this.isVisible = !this.isVisible
        this.container.style.display = this.isVisible ? 'flex' : 'none'

        if (this.isVisible) {
            // Auto-refresh if Logic Tab is active
            if (this.contentLogic.style.display === 'flex') {
                this.refreshLogicList()
            }
        }

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

    refreshLogicList() {
        if (!this.logicTreePanel) return

        this.logicTreePanel.innerHTML = ""

        // Get Logic Objects from Scene
        // We look for objects with userData.isEditableMapObject AND specific logic types
        // Or just all editable objects? The user request said "logic interactiva... dividir por grupos los objetos con logica"
        const logicObjects = []
        if (this.game.sceneManager && this.game.sceneManager.scene) {
            this.game.sceneManager.scene.children.forEach(child => {
                // Filter: Must be editable and have some logic property bucket or be a specific type?
                // For now, let's include anything that has logicProperties OR is a 'spawn_point'
                if (child.userData && child.userData.isEditableMapObject) {
                    // Check if it's a "Logic" type
                    const isLogic = (child.userData.mapObjectType === 'spawn_point')
                    // Add more types here as needed in future

                    if (isLogic) {
                        logicObjects.push(child)
                    }
                }
            })
        }

        if (logicObjects.length === 0) {
            this.logicTreePanel.innerHTML = `<div style="color:#666; text-align:center; padding:10px;">No hay objetos lógicos en la escena.</div>`
            return
        }

        // Group by Type
        const groups = {}
        logicObjects.forEach(obj => {
            const type = obj.userData.mapObjectType || "Desconocido"
            if (!groups[type]) groups[type] = []
            groups[type].push(obj)
        })

        // Render Groups
        for (const [type, objs] of Object.entries(groups)) {
            // Group Header
            const groupDetails = document.createElement('details')
            groupDetails.open = true // Default open
            groupDetails.style.cssText = `
                background: #333;
                border-radius: 4px;
                margin-bottom: 5px;
            `

            const summary = document.createElement('summary')
            summary.textContent = `${this.getHumanReadableName(type)} (${objs.length})`
            summary.style.cssText = `
                padding: 8px;
                cursor: pointer;
                font-weight: bold;
                user-select: none;
                list-style: none; /* Hide default triangle in some browsers if desired, or keep it */
            `
            groupDetails.appendChild(summary)

            const list = document.createElement('div')
            list.style.cssText = `
                display: flex;
                flex-direction: column;
                padding: 5px;
                gap: 2px;
            `

            objs.forEach((obj, index) => {
                const itemRow = document.createElement('div')
                itemRow.textContent = `Objeto #${index + 1}`
                itemRow.style.cssText = `
                    padding: 6px;
                    background: #2a2a2a;
                    cursor: pointer;
                    border-radius: 4px;
                    font-size: 14px;
                `
                itemRow.onmouseover = () => itemRow.style.background = "#444"
                itemRow.onmouseout = () => {
                    if (this.selectedLogicObject !== obj) itemRow.style.background = "#2a2a2a"
                    else itemRow.style.background = "#555"
                }
                itemRow.onclick = () => {
                    // Visual Selection in List
                    // Reset all other highlights in this list (simple brute force or tracking)
                    const allRows = this.logicTreePanel.querySelectorAll('div div') // messy selector
                    allRows.forEach(r => r.style.background = "#2a2a2a")

                    itemRow.style.background = "#555"
                    this.selectedLogicObject = obj

                    this.renderLogicProperties(obj)
                }

                list.appendChild(itemRow)
            })

            groupDetails.appendChild(list)
            this.logicTreePanel.appendChild(groupDetails)
        }
    }

    getHumanReadableName(type) {
        switch (type) {
            case 'spawn_point': return "Puntos de Spawn";
            default: return type.charAt(0).toUpperCase() + type.slice(1);
        }
    }

    renderLogicProperties(object) {
        if (!this.logicPropertiesPanel) return
        this.logicPropertiesPanel.innerHTML = ""

        const header = document.createElement('div')
        header.textContent = `Editando: ${this.getHumanReadableName(object.userData.mapObjectType)}`
        header.style.cssText = `
            font-weight: bold;
            border-bottom: 1px solid #555;
            padding-bottom: 5px;
            margin-bottom: 10px;
        `
        this.logicPropertiesPanel.appendChild(header)

        const props = object.userData.logicProperties || {}

        // Helper to create inputs
        const createInput = (key, val, type) => {
            const row = document.createElement('div')
            row.style.cssText = `display: flex; gap: 10px; align-items: center; justify-content: space-between;`

            const label = document.createElement('label')
            label.textContent = key.charAt(0).toUpperCase() + key.slice(1)
            label.style.color = "#aaa"
            label.style.fontSize = "14px"

            const input = document.createElement('input')
            input.style.cssText = `
                background: #111;
                border: 1px solid #444;
                color: white;
                padding: 4px;
                border-radius: 4px;
                width: 60%;
            `

            if (type === 'number') {
                input.type = "number"
                input.value = val
                input.onchange = (e) => {
                    const newVal = parseFloat(e.target.value)
                    this.updateLogicProperty(object, key, newVal)
                }
            } else if (type === 'string') {
                input.type = "text"
                input.value = val
                input.onchange = (e) => {
                    this.updateLogicProperty(object, key, e.target.value)
                }
            } else if (type === 'boolean') {
                input.type = "checkbox"
                input.checked = val
                input.style.width = "auto"
                input.onchange = (e) => {
                    this.updateLogicProperty(object, key, e.target.checked)
                }
            }

            row.appendChild(label)
            row.appendChild(input)
            this.logicPropertiesPanel.appendChild(row)
        }

        // Iterate specific properties for Spawn Point or generic
        if (object.userData.mapObjectType === 'spawn_point') {
            createInput('team', props.team || 1, 'number')
            createInput('capacity', props.capacity || 1, 'number')
            createInput('order', props.order || 1, 'number')
        } else {
            // Generic fallback
            for (const [k, v] of Object.entries(props)) {
                createInput(k, v, typeof v)
            }
        }
    }

    updateLogicProperty(object, key, value) {
        if (!object.userData.logicProperties) object.userData.logicProperties = {}
        object.userData.logicProperties[key] = value

        console.log(`Updated ${key} to ${value} for object`, object)
        // Note: No need to rebuild physics or anything unless the property affects it.
        // Logic properties are usually metadata.
    }
}
