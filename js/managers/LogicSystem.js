import * as THREE from "three"
import { LogicToolbar } from "../ui/LogicToolbar.js"
import { LogicSequenceEditor } from "../ui/LogicSequenceEditor.js"

export class LogicSystem {
    constructor(game) {
        this.game = game
        this.isEditingMap = false
        this.editingObject = null
        this.toolbar = new LogicToolbar(game)
        this.sequenceEditor = new LogicSequenceEditor(game, this)

        // Toolbar Callbacks
        this.toolbar.onClose = () => this.endMapEdit()
        this.toolbar.onToolChange = (tool) => {
            console.log("Herramienta Lógica:", tool)

            if (tool === 'play_pause') {
                this.toggleAnimation()
                // Don't keep it 'active' as a selected tool (like waypoint placement)
                // Immediately deselect or just treat as trigger?
                // The toolbar architecture highlights "activeTool". 
                // Let's treat it as a toggle but we probably don't want it to remain "selected" in a way that blocks other inputs?
                // Actually, for this specific button, we might want it to NOT be an exclusive tool mode.
                // But structure uses setActiveTool. 
                // Let's just run logic and let it stay highlighted if we want, OR immediately reset.
                // Better: The toolbar handles highlight. Move logic needs to know if we are "playing".
            }
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
                const isButton = child.userData.mapObjectType === 'interaction_button'
                const hasWaypoints = child.userData.logicProperties &&
                    child.userData.logicProperties.waypoints // Allow empty array

                // Add your own logic flags here
                if (isSpawn || isButton || hasWaypoints) {
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

        // 3. Interaction Button Logic
        if (object.userData.mapObjectType === 'interaction_button') {
            this.renderButtonUI(container, object, props)
        }
    }

    renderButtonUI(container, object, props) {
        this.createInput(container, object, 'holdTime', props.holdTime || 0, 'number', 'Tiempo Retener (s)')
        this.createInput(container, object, 'oneShot', props.oneShot || false, 'boolean', 'Un Solo Uso')
        this.createInput(container, object, 'pulsationMode', props.pulsationMode || false, 'boolean', 'Modo Pulsación')

        const info = document.createElement('div')
        info.textContent = `UUID: ${object.userData.uuid.substring(0, 8)}...`
        info.style.cssText = "font-size:10px; color:#aaa; margin-top:10px;"
        container.appendChild(info)
    }

    renderSpawnUI(container, object, props) {
        this.createInput(container, object, 'team', props.team || 1, 'number', 'Equipo')
        this.createInput(container, object, 'capacity', props.capacity || 1, 'number', 'Capacidad')
        this.createInput(container, object, 'order', props.order || 1, 'number', 'Orden')
    }

    renderMovementUI(container, object, props, refreshCallback) {
        // --- MIGRATION & INIT ---
        if (props.waypoints && !props.sequences) {
            props.sequences = [{
                name: "Secuencia Principal",
                waypoints: props.waypoints,
                loop: props.loop !== false,
                active: props.active !== false,
                speed: props.speed || 2.0,
                triggerType: "none"
            }]
            delete props.waypoints; delete props.loop; delete props.active; delete props.speed
        }
        if (!props.sequences) props.sequences = []
        if (props.sequences.length === 0) {
            props.sequences.push({
                name: "Secuencia Principal",
                waypoints: [],
                loop: true,
                active: true,
                speed: 2.0,
                triggerType: "none"
            })
        }
        props.sequences[0].name = "Secuencia Principal"

        // Primary Sequence (Quick Edit)
        const mainSeq = props.sequences[0]

        const mvHeader = document.createElement('div')
        mvHeader.innerHTML = `<span style="color:#00FFFF"> Animación (Rápida)</span>`
        mvHeader.style.cssText = `
            margin-top: 15px; margin-bottom: 10px; 
            font-weight: bold; border-top: 1px solid #444; padding-top: 10px;
        `
        container.appendChild(mvHeader)

        // --- Edit on Map Button (Quick) ---
        const editMapBtn = document.createElement('button')
        editMapBtn.textContent = "Editar en Mapa 3D"
        editMapBtn.style.cssText = `
            width: 100%; background: #0066cc; color: white; border: none; 
            padding: 8px; cursor: pointer; border-radius: 4px; margin-bottom: 10px; font-weight: bold;
        `
        // Edit Primary Sequence (0) on Map
        editMapBtn.onclick = () => this.startMapEdit(object, 0)
        container.appendChild(editMapBtn)

        // --- Quick Properties (Seq 0) ---
        this.createInput(container, mainSeq, 'speed', mainSeq.speed || 2.0, 'number', 'Velocidad')
        this.createInput(container, mainSeq, 'loop', mainSeq.loop !== false, 'boolean', 'Bucle Infinito')
        this.createInput(container, mainSeq, 'active', mainSeq.active !== false, 'boolean', 'Activo al Inicio')

        // --- Quick Waypoints List ---
        const wpHeader = document.createElement('div')
        wpHeader.textContent = `Puntos (Secuencia Principal): ${mainSeq.waypoints.length}`
        wpHeader.style.cssText = `margin-top: 5px; font-size: 11px; color: #aaa;`
        container.appendChild(wpHeader)

        // Capture Button
        const captureBtn = document.createElement('button')
        captureBtn.textContent = "+ Capturar Posición Actual"
        captureBtn.style.cssText = `
            width: 100%; background: #222; color: #aaa; border: 1px dashed #555; 
            padding: 4px; cursor: pointer; border-radius: 4px; margin-top: 5px; font-size:10px;
        `
        captureBtn.onclick = () => {
            const wp = {
                x: object.position.x,
                y: object.position.y,
                z: object.position.z,
                rotY: object.rotation.y,
                delay: 0,
                teleport: false
            }
            mainSeq.waypoints.push(wp)
            this.renderPanel(container, object, refreshCallback)
            this.updateVisualization()
        }
        container.appendChild(captureBtn)

        // Mini List HIDDEN as requested
        // container.appendChild(wpList)




        // --- ADVANCED SEQUENCES SECION ---
        const advHeader = document.createElement('div')
        advHeader.textContent = "Gestión Avanzada de Secuencias"
        advHeader.style.cssText = "font-size:11px; font-weight:bold; color:#888; margin-bottom:5px;"
        container.appendChild(advHeader)

        // List all sequences
        const seqList = document.createElement('div')
        seqList.style.cssText = `display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px;`

        props.sequences.forEach((seq, idx) => {
            const seqRow = document.createElement('div')
            seqRow.style.cssText = `
                background: #222; padding: 4px; border-radius: 4px; border: 1px solid #444;
            `
            const topRow = document.createElement('div')
            topRow.style.cssText = "display: flex; justify-content: space-between; align-items: center;"

            const nameSpan = document.createElement('span')
            let dispName = seq.name
            nameSpan.textContent = (idx === 0 ? "★ " : "") + dispName
            nameSpan.style.cssText = "font-size:11px; color:#ddd;"

            topRow.appendChild(nameSpan)

            const toolsDiv = document.createElement('div')

            // Edit Visual
            const editBtn = document.createElement('button')
            editBtn.textContent = "Editor Visual"
            editBtn.style.cssText = "background: #0066cc; color: white; border: none; padding: 2px 5px; font-size: 9px; cursor: pointer; border-radius: 3px; margin-right:5px;"
            editBtn.onclick = () => this.openSequenceEditor(object, idx)
            toolsDiv.appendChild(editBtn)

            // Delete
            if (idx > 0) { // Protect main sequence? Or allow delete?
                const delBtn = document.createElement('button')
                delBtn.textContent = "🗑"
                delBtn.style.cssText = "background:none; border:none; color:#f44; cursor:pointer;"
                delBtn.onclick = () => {
                    if (confirm("¿Eliminar?")) {
                        props.sequences.splice(idx, 1)
                        this.renderPanel(container, object, refreshCallback)
                        this.updateVisualization()
                    }
                }
                toolsDiv.appendChild(delBtn)
            }

            topRow.appendChild(toolsDiv)
            seqRow.appendChild(topRow)
            seqList.appendChild(seqRow)
        })
        container.appendChild(seqList)

        // Add
        const addSeqBtn = document.createElement('button')
        addSeqBtn.textContent = "+ Nueva Secuencia"
        addSeqBtn.style.cssText = `width: 100%; background: #333; color: white; border: 1px solid #555; padding: 4px; border-radius: 4px; font-size:10px;`
        addSeqBtn.onclick = () => {
            const name = prompt("Nombre:", "Nueva Secuencia")
            if (name) {
                props.sequences.push({
                    name: name, waypoints: [], loop: true, active: false, speed: 2.0, triggerType: "none"
                })
                this.renderPanel(container, object, refreshCallback)
            }
        }
        container.appendChild(addSeqBtn)
    }

    openSequenceEditor(object, sequenceIndex) {
        // Find or create the editor overlay
        // Implementation of LogicSequenceEditor integration
        console.log("Opening sequence editor for", object, sequenceIndex)
        alert("¡Pronto! Aquí se abrirá el editor visual de secuencias.")
        // TODO: Call LogicSequenceEditor.open(object, sequenceIndex)
    }

    openSequenceEditor(object, sequenceIndex) {
        this.sequenceEditor.open(object, sequenceIndex)
    }

    // --- MAP EDIT MODE ---

    startMapEdit(object, sequenceIndex = 0) {
        this.isEditingMap = true
        this.editingObject = object
        this.editingSequenceIndex = sequenceIndex // Store index

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
        // AUTO-SELECT WAYPOINT TOOL
        this.toolbar.setActiveTool('waypoint')

        // Visualizers
        this.updateVisualization()

        // Init Play Button State
        // We use a temporary runtime flag for previewing while editing
        // If object.userData.logicProperties.active is true, it might already be moving in game.
        // But in "Edit Mode", we usually paused it (forced return in main loop).
        // Let's introduce logicProperties.isPreviewing
        if (this.editingObject.userData.logicProperties.isPreviewing === undefined) {
            this.editingObject.userData.logicProperties.isPreviewing = false
        }
        this.toolbar.setPlayButtonState(this.editingObject.userData.logicProperties.isPreviewing)

        console.log("Started Map Logic Edit Mode")
    }

    toggleAnimation() {
        if (!this.editingObject) return

        const props = this.editingObject.userData.logicProperties
        props.isPreviewing = !props.isPreviewing

        this.toolbar.setPlayButtonState(props.isPreviewing)

        // Also ensure we untoggle the button in toolbar if we don't want it to act as a "tool" that blocks others?
        // But the user might want to see it green. 
        // The toolbar class handles visuals based on checking activeTool. 
        // We added explicit visual update in setPlayButtonState which overrides/supplements.
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

        // Use editingObject OR the one in sequence editor if active
        // Fallback to editingObject from LogicSystem if set.
        const obj = this.editingObject || (this.sequenceEditor && this.sequenceEditor.currentObject)
        if (!obj) return

        const props = obj.userData.logicProperties
        if (!props || !props.sequences) return

        const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF]

        props.sequences.forEach((seq, idx) => {
            if (!seq.waypoints || seq.waypoints.length === 0) return

            const color = colors[idx % colors.length]
            const isEditing = (this.sequenceEditor && this.sequenceEditor.currentObject === obj && this.sequenceEditor.currentSeqIndex === idx)
            const finalColor = isEditing ? 0xFFFFFF : color // Highlight white if editing

            // Draw Lines
            const points = []
            // Start from object position or assume relative? 
            // We visualize assuming start from current obj pos for now, 
            // but effectively the path is relative to where it starts.
            points.push(obj.position.clone())

            seq.waypoints.forEach(wp => {
                if (wp.x !== undefined && wp.y !== undefined && wp.z !== undefined) {
                    points.push(new THREE.Vector3(wp.x, wp.y, wp.z))
                }
            })

            if (seq.loop && points.length > 0) {
                points.push(obj.position.clone())
            }

            if (points.length > 1) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points)
                const material = new THREE.LineBasicMaterial({ color: finalColor, linewidth: isEditing ? 3 : 1 })
                const line = new THREE.Line(geometry, material)
                this.pathVisualizer.add(line)
            }

            // Waypoints
            seq.waypoints.forEach((wp) => {
                // SKIP LOGIC STEPS (No Position)
                if (wp.x === undefined || wp.y === undefined || wp.z === undefined) return;

                const pos = new THREE.Vector3(wp.x, wp.y, wp.z)
                const dotGeo = new THREE.SphereGeometry(0.2, 8, 8)
                const dotMat = new THREE.MeshBasicMaterial({ color: finalColor })
                // ARROWS (DIRECTION) - RESTORED
                const arrowLen = 1.0
                const arrowDir = new THREE.Vector3(0, 0, 1) // Default forward
                if (wp.rotY !== undefined) {
                    arrowDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), wp.rotY)
                }
                const arrow = new THREE.ArrowHelper(arrowDir, pos, arrowLen, 0x00FF00) // Green Arrows
                this.pathVisualizer.add(arrow)

                const dot = new THREE.Mesh(dotGeo, dotMat)
                dot.position.copy(pos)
                this.pathVisualizer.add(dot)

                // Ghost (Only if editing?)
                if (isEditing) {
                    const ghostSize = new THREE.Vector3(1, 1, 1)
                    if (obj.userData.originalScale) {
                        ghostSize.copy(obj.userData.originalScale)
                    } else {
                        const b = new THREE.Box3().setFromObject(obj)
                        b.getSize(ghostSize)
                    }

                    const ghostGeo = new THREE.BoxGeometry(ghostSize.x, ghostSize.y, ghostSize.z)
                    const ghostMat = new THREE.MeshBasicMaterial({ color: finalColor, wireframe: true, transparent: true, opacity: 0.1 })
                    const ghost = new THREE.Mesh(ghostGeo, ghostMat)
                    ghost.position.copy(pos)
                    if (wp.rotY !== undefined) ghost.rotation.y = wp.rotY
                    this.pathVisualizer.add(ghost)
                }
            })
        })
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
            case 'interaction_button': return "Botones Interactivos";
            case 'movement_controller': return "Animador"; // In case it appears as a type
            default: return type ? (type.charAt(0).toUpperCase() + type.slice(1)) : "Objeto";
        }
    }
}
