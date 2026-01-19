import * as THREE from "three"
import { LogicToolbar } from "../ui/LogicToolbar.js"

export class LogicSystem {
    constructor(game) {
        this.game = game
        this.isEditingMap = false
        this.editingObject = null
        this.toolbar = new LogicToolbar(game)

        // Toolbar Callbacks
        this.toolbar.onClose = () => this.endMapEdit()
        this.toolbar.onToolChange = (tool) => {
            console.log("Herramienta Lógica:", tool)
            // Placement Manager will query this state
        }

        // Visualizer for paths
        this.pathVisualizer = new THREE.Group()
        if (this.game.sceneManager && this.game.sceneManager.scene) {
            this.game.sceneManager.scene.add(this.pathVisualizer)
        }
    }

    /**
     * Scans the scene for objects that have logic properties.
     * @param {THREE.Scene} scene 
     * @returns {Array} List of editable objects with logic
     */
    scanScene(scene) {
        const logicObjects = []
        if (!scene) return logicObjects

        scene.children.forEach(child => {
            if (child.userData && child.userData.isEditableMapObject) {
                // Check for inherent logic types or applied logic properties
                const isSpawn = child.userData.mapObjectType === 'spawn_point'
                const hasWaypoints = child.userData.logicProperties &&
                    child.userData.logicProperties.waypoints // Allow empty array

                // Add your own logic flags here
                if (isSpawn || hasWaypoints) {
                    logicObjects.push(child)
                }
            }
        })
        return logicObjects
    }

    /**
     * Renders the properties panel for a selected object.
     * @param {HTMLElement} container The panel container
     * @param {THREE.Object3D} object The selected object
     * @param {Function} refreshCallback Optional callback to refresh the tree view if name/type changes
     */
    renderPanel(container, object, refreshCallback) {
        container.innerHTML = ""

        // Header
        const header = document.createElement('div')
        header.textContent = `Editando: ${this.getHumanReadableName(object.userData.mapObjectType)}`
        header.style.cssText = `
            font-weight: bold;
            border-bottom: 1px solid #555;
            padding-bottom: 5px;
            margin-bottom: 10px;
        `
        container.appendChild(header)

        // Ensure logic props exist
        if (!object.userData.logicProperties) object.userData.logicProperties = {}
        const props = object.userData.logicProperties

        // --- SPECIFIC LOGIC HANDLERS ---

        // 1. Spawn Point Logic
        if (object.userData.mapObjectType === 'spawn_point') {
            this.renderSpawnUI(container, object, props)
        }

        // 2. Movement Logic (Can be on any object)
        // We show this section if the object HAS waypoints OR if we want to Add it?
        // The Tool added the waypoints array.
        if (props.waypoints) {
            this.renderMovementUI(container, object, props, refreshCallback)
        }
    }

    renderSpawnUI(container, object, props) {
        this.createInput(container, object, 'team', props.team || 1, 'number', 'Equipo')
        this.createInput(container, object, 'capacity', props.capacity || 1, 'number', 'Capacidad')
        this.createInput(container, object, 'order', props.order || 1, 'number', 'Orden')
    }

    renderMovementUI(container, object, props, refreshCallback) {
        const mvHeader = document.createElement('div')
        mvHeader.innerHTML = `<span style="color:#00FFFF"> Animación</span>`
        mvHeader.style.cssText = `
            margin-top: 15px; margin-bottom: 10px; 
            font-weight: bold; border-top: 1px solid #444; padding-top: 10px;
        `
        container.appendChild(mvHeader)

        // --- Edit on Map Button ---
        const editMapBtn = document.createElement('button')
        editMapBtn.textContent = "Editar en Mapa"
        editMapBtn.style.cssText = `
            width: 100%; background: #0066cc; color: white; border: none; 
            padding: 8px; cursor: pointer; border-radius: 4px; margin-bottom: 10px; font-weight: bold;
        `
        editMapBtn.onclick = () => this.startMapEdit(object)
        container.appendChild(editMapBtn)
        // --------------------------

        this.createInput(container, object, 'speed', props.speed || 2.0, 'number', 'Velocidad')
        this.createInput(container, object, 'loop', props.loop !== false, 'boolean', 'Bucle Infinito')
        this.createInput(container, object, 'active', props.active !== false, 'boolean', 'Activo')

        // Waypoints List
        const wpHeader = document.createElement('div')
        wpHeader.textContent = `Puntos de Ruta (${props.waypoints.length})`
        wpHeader.style.cssText = `margin-top: 10px; font-size: 12px; color: #aaa;`
        container.appendChild(wpHeader)

        // Capture Button (Legacy)
        const captureBtn = document.createElement('button')
        captureBtn.textContent = "+ Capturar Ubicación Actual"
        captureBtn.style.cssText = `
            width: 100%; background: #004400; color: white; border: none; 
            padding: 6px; cursor: pointer; border-radius: 4px; margin-top: 5px;
        `
        captureBtn.onclick = () => {
            const wp = {
                x: object.position.x,
                y: object.position.y,
                z: object.position.z,
                delay: 0
            }
            props.waypoints.push(wp)
            this.renderPanel(container, object, refreshCallback) // Re-render self
            this.updateVisualization() // Refresh lines
        }
        container.appendChild(captureBtn)

        // List
        const wpList = document.createElement('div')
        wpList.style.cssText = `
            max-height: 100px; overflow-y: auto; display: flex; 
            flex-direction: column; gap: 2px; margin-top: 5px;
        `

        props.waypoints.forEach((wp, idx) => {
            const row = document.createElement('div')
            row.style.cssText = `
                background: #222; padding: 2px; font-size: 11px; 
                display: flex; justify-content: space-between;
            `
            row.innerHTML = `<span>#${idx + 1} [${wp.x.toFixed(1)}, ${wp.y.toFixed(1)}, ${wp.z.toFixed(1)}]</span>`

            const del = document.createElement('span')
            del.textContent = "🗑"
            del.style.cursor = "pointer"
            del.onclick = () => {
                props.waypoints.splice(idx, 1)
                this.renderPanel(container, object, refreshCallback)
                this.updateVisualization()
            }
            row.appendChild(del)
            wpList.appendChild(row)
        })
        container.appendChild(wpList)

        // Remove Logic Button
        const removeBtn = document.createElement('button')
        removeBtn.textContent = "Eliminar Animación"
        removeBtn.style.cssText = `
            width: 100%; background: #440000; color: white; border: none; 
            padding: 4px; cursor: pointer; border-radius: 4px; margin-top: 10px; font-size: 10px;
        `
        removeBtn.onclick = () => {
            if (confirm("¿Eliminar lógica de movimiento?")) {
                delete object.userData.logicProperties.waypoints
                delete object.userData.logicProperties.speed
                delete object.userData.logicProperties.loop
                delete object.userData.logicProperties.active

                // Clear panel or refresh
                container.innerHTML = "<div style='color:#666;text-align:center'>Lógica eliminada.</div>"
                if (refreshCallback) refreshCallback()
                this.updateVisualization()
            }
        }
        container.appendChild(removeBtn)
    }

    // --- MAP EDIT MODE ---

    startMapEdit(object) {
        this.isEditingMap = true
        this.editingObject = object

        // Hide Main Menu
        if (this.game.constructionMenu) {
            this.game.constructionMenu.container.style.display = 'none'
            // Keep game input disabled if needed, or ENABLE it for walking?
            // "cuando le des a ese boton lo que va pasar es que se va poner visible un menu de opciones en el mapa"
            // Typically map edit usually means we can fly/move to place things.
            // Let's ENABLE game input but capture clicks.
            if (this.game.inputManager) {
                this.game.inputManager.enabled = true
                this.game.isMouseDown = false // Reset
                if (this.game.cameraController) this.game.cameraController.lock() // Lock mouse for look
            }
        }

        // Show Toolbar
        this.toolbar.show()

        // Visualizers
        this.updateVisualization()

        console.log("Started Map Logic Edit Mode")
    }

    endMapEdit() {
        this.isEditingMap = false
        this.editingObject = null
        this.toolbar.hide()

        // Show Main Menu
        if (this.game.constructionMenu) {
            this.game.constructionMenu.container.style.display = 'flex'
            // Disable input as menu is open
            document.exitPointerLock()
            if (this.game.inputManager) this.game.inputManager.enabled = false
        }

        // Clear Viz (Optional, or keep it?)
        // Usually we want to see it while editing, hide when done? 
        // Or hide when not in Logic Tab?
        this.pathVisualizer.clear()
    }

    update(dt) {
        if (!this.isEditingMap || !this.editingObject) return

        // Handle Active Tool Logic
        if (this.toolbar.activeTool === 'waypoint') {
            // Let Placement Manager handle the Ghost preview if we hook it validly.
            // Or we handle it here. 
        }

        // We should ensure visualization is up to date (moving object?)
        // If object moves, we update lines. But object shouldn't move while editing unless we drag it.
    }

    updateVisualization() {
        this.pathVisualizer.clear()
        if (!this.editingObject) return

        const wps = this.editingObject.userData.logicProperties.waypoints
        if (!wps || wps.length === 0) return

        // Draw Lines
        const points = []
        // Start from object position
        points.push(this.editingObject.position.clone())
        wps.forEach(wp => points.push(new THREE.Vector3(wp.x, wp.y, wp.z)))

        // Loop?
        if (this.editingObject.userData.logicProperties.loop) {
            points.push(this.editingObject.position.clone())
        }

        // Draw Line
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const material = new THREE.LineBasicMaterial({ color: 0xFF0000, linewidth: 2 })
        const line = new THREE.Line(geometry, material)
        this.pathVisualizer.add(line)

        // Draw Waypoint Indicators (Only registered points)
        // Removed the points.forEach loop that included current position.

        wps.forEach((wp, idx) => {
            const pos = new THREE.Vector3(wp.x, wp.y, wp.z)
            // Dot (Visual anchor)
            const dotGeo = new THREE.SphereGeometry(0.2, 8, 8)
            const dotMat = new THREE.MeshBasicMaterial({ color: 0xFFAA00 })
            const dot = new THREE.Mesh(dotGeo, dotMat)
            dot.position.copy(pos)
            this.pathVisualizer.add(dot)

            // Arrow
            const arrowLen = 1.0
            const arrowDir = new THREE.Vector3(0, 0, 1) // Default forward
            if (wp.rotY !== undefined) {
                arrowDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), wp.rotY)
            } else {
                // Use object rotation? Or default?
                // If no rotation saved, assume 0 or previous?
                // Let's just use Z+
            }

            const arrow = new THREE.ArrowHelper(arrowDir, pos, arrowLen, 0x00FF00)
            this.pathVisualizer.add(arrow)

            // Ghost Mesh Representation (Wireframe Box?)
            // "quiero que quede la previzualizacion en el mapa cuando se coloque ... solo para saber de que forma va estar el objeto"
            const ghostSize = new THREE.Vector3(1, 1, 1) // Default
            if (this.editingObject.userData.originalScale) {
                ghostSize.copy(this.editingObject.userData.originalScale)
            } else {
                const b = new THREE.Box3().setFromObject(this.editingObject)
                b.getSize(ghostSize)
            }

            const ghostGeo = new THREE.BoxGeometry(ghostSize.x, ghostSize.y, ghostSize.z)
            const ghostMat = new THREE.MeshBasicMaterial({ color: 0x0088ff, wireframe: true, transparent: true, opacity: 0.3 })
            const ghost = new THREE.Mesh(ghostGeo, ghostMat)
            ghost.position.copy(pos)
            // Adjust Y center
            ghost.position.y += ghostSize.y / 2

            if (wp.rotY !== undefined) {
                ghost.rotation.y = wp.rotY
            }

            this.pathVisualizer.add(ghost)
        })

        this.pathVisualizer.add(line)
    }

    // --- UTILS ---

    createInput(container, object, key, val, type, labelText) {
        const row = document.createElement('div')
        row.style.cssText = `display: flex; gap: 10px; align-items: center; justify-content: space-between; margin-bottom:5px;`

        const label = document.createElement('label')
        label.textContent = labelText || key
        label.style.color = "#aaa"
        label.style.fontSize = "14px"

        const input = document.createElement('input')
        input.style.cssText = `background: #111; border: 1px solid #444; color: white; padding: 4px; border-radius: 4px; width: 60%;`

        if (type === 'number') {
            input.type = "number"
            input.value = val
            input.step = "0.1"
            input.onchange = (e) => {
                object.userData.logicProperties[key] = parseFloat(e.target.value)
            }
        } else if (type === 'boolean') {
            input.type = "checkbox"
            input.checked = val
            input.style.width = "auto"
            input.onchange = (e) => {
                object.userData.logicProperties[key] = e.target.checked
            }
        } else {
            input.type = "text"
            input.value = val
            input.onchange = (e) => {
                object.userData.logicProperties[key] = e.target.value
            }
        }

        row.appendChild(label)
        row.appendChild(input)
        container.appendChild(row)
    }

    getHumanReadableName(type) {
        switch (type) {
            case 'spawn_point': return "Punto de Spawn";
            case 'movement_object': return "Objetos con Movimiento";
            case 'movement_controller': return "Animador"; // In case it appears as a type
            default: return type ? (type.charAt(0).toUpperCase() + type.slice(1)) : "Objeto";
        }
    }
}
