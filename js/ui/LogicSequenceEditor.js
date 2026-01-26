
import { InspectorUtils } from "./logic_items/InspectorUtils.js"

export class LogicSequenceEditor {
    constructor(game, logicSystem) {
        this.game = game
        this.logicSystem = logicSystem
        this.container = null
        this.currentObject = null
        this.currentSeqIndex = -1
    }

    createUI() {
        if (this.container) return this.container

        const div = document.createElement('div')
        div.id = 'logic-sequence-editor'

        // --- Header ---
        const header = document.createElement('div')
        header.className = 'lse-header'

        const title = document.createElement('div')
        title.className = 'lse-title'
        title.innerHTML = `Editor de Secuencia <span id="seq-editor-subtitle" class="lse-subtitle"></span>`
        header.appendChild(title)

        const closeBtn = document.createElement('button')
        closeBtn.textContent = "Cerrar & Guardar"
        closeBtn.className = 'lse-close-btn'
        closeBtn.onclick = () => this.close()
        header.appendChild(closeBtn)

        div.appendChild(header)

        // --- Main Content (Split View) ---
        const content = document.createElement('div')
        content.className = 'lse-content'
        div.appendChild(content)

        // LEFT: Properties & Triggers
        const sidebar = document.createElement('div')
        sidebar.className = 'lse-sidebar'
        sidebar.id = "seq-editor-sidebar"
        content.appendChild(sidebar)

        // RIGHT: Timeline
        const timelineArea = document.createElement('div')
        timelineArea.className = 'lse-timeline'
        timelineArea.id = "seq-editor-timeline"
        content.appendChild(timelineArea)

        this.container = div
        document.body.appendChild(this.container)

        // Elements references
        this.subtitle = title.querySelector('#seq-editor-subtitle')
        this.sidebar = sidebar
        this.timeline = timelineArea

        return this.container
    }

    open(object, sequenceIndex) {
        if (!object || sequenceIndex < 0) return

        this.currentObject = object
        this.currentSeqIndex = sequenceIndex

        // Ensure UI exists
        this.createUI()
        this.container.style.display = 'flex'

        // Hide other menus if needed (optional)
        // logicSystem.toolbar usually stays? Construction menu might be hidden.

        this.render()
    }

    close() {
        if (this.container) this.container.style.display = 'none'

        // Refresh the main panel in LogicSystem to show updates (e.g. name change)
        if (this.logicSystem.editingObject === this.currentObject) {
            // Re-render the main panel
            // We need a way to trigger refresh. LogicSystem.renderPanel needs container. 
            // Ideally we callback or LogicSystem handles "onEditorClose"
            // For now, we update visualization at least.
            this.logicSystem.updateVisualization()

            // If we want to refresh the sidebar UI in construction menu:
            // We unfortunately don't have direct ref to that specific container div unless passed.
            // But we can rely on user re-opening or maybe we force a refresh if logicSystem allows.
            if (this.logicSystem.currentPanelContainer) {
                this.logicSystem.renderPanel(this.logicSystem.currentPanelContainer, this.currentObject)
            }
        }
    }

    render() {
        const seq = this.currentObject.userData.logicProperties.sequences[this.currentSeqIndex]
        if (!seq) return

        this.subtitle.textContent = `: ${seq.name}`

        // --- SIDEBAR ---
        this.sidebar.innerHTML = ""

        // 1. General Props
        const propsHeader = document.createElement('h4')
        propsHeader.textContent = "Propiedades"
        this.sidebar.appendChild(propsHeader)

        this.createInput(this.sidebar, seq, 'name', seq.name, 'text', 'Nombre')
        this.createInput(this.sidebar, seq, 'loop', seq.loop, 'boolean', 'Bucle')
        this.createInput(this.sidebar, seq, 'speed', seq.speed, 'number', 'Velocidad')
        this.createInput(this.sidebar, seq, 'active', seq.active, 'boolean', 'Activo al Inicio')

        // --- MAP 3D EDIT BUTTON ---
        const map3dBtn = document.createElement('button')
        map3dBtn.textContent = "Editar en Mapa 3D"
        map3dBtn.className = 'lse-map-btn'
        map3dBtn.onclick = () => {
            this.close() // Close editor
            // Trigger map edit mode for this sequence
            this.logicSystem.startMapEdit(this.currentObject, this.currentSeqIndex)
        }
        this.sidebar.appendChild(map3dBtn)


        // --- TIMELINE ---
        this.timeline.innerHTML = ""

        // Wrapper for buttons
        const btnWrapper = document.createElement('div')
        btnWrapper.style.cssText = "display: flex; gap: 10px; margin-bottom: 20px;"

        // Add Waypoint Button
        const addWpBtn = document.createElement('button')
        addWpBtn.textContent = "+ Punto (Posición)"
        addWpBtn.className = 'lse-add-btn'
        addWpBtn.style.marginBottom = "0"
        addWpBtn.style.flex = "1"
        addWpBtn.onclick = () => this.addWaypoint(seq)
        btnWrapper.appendChild(addWpBtn)

        // Add Signal Wait Button
        const addSigBtn = document.createElement('button')
        addSigBtn.textContent = "+ Señal de Botón"
        addSigBtn.className = 'lse-add-btn'
        addSigBtn.style.background = "#cc7700"
        addSigBtn.style.marginBottom = "0"
        addSigBtn.style.flex = "1"
        addSigBtn.onclick = () => this.showButtonSelector(seq)
        btnWrapper.appendChild(addSigBtn)

        this.timeline.appendChild(btnWrapper)

        // Timeline Items
        seq.waypoints.forEach((wp, idx) => {
            const item = document.createElement('div')
            item.className = 'lse-item'

            if (wp.type === 'wait_signal') {
                item.style.borderLeftColor = "#cc7700"
                item.innerHTML = `
                    <div class="lse-item-header">
                        <strong>Paso #${idx + 1}</strong> <span style="color:#ffa500;">Esperar Señal</span>
                    </div>
                    <div style="font-size:13px; color:#ddd; margin-bottom:5px;">
                        Botón: <span style="color:white; font-weight:bold;">${wp.signalName || "Desconocido"}</span>
                    </div>
                `
                // Delete Btn
                const delBtn = document.createElement('button')
                delBtn.textContent = "🗑"
                delBtn.style.cssText = "float:right; background:none; border:none; cursor:pointer; font-size:14px; margin-top:-20px;"
                delBtn.onclick = () => {
                    seq.waypoints.splice(idx, 1)
                    this.render()
                    this.logicSystem.updateVisualization()
                }
                item.appendChild(delBtn)

            } else {
                // Standard Waypoint
                // Header: #1 -> 2.5s Delay -> ...
                const header = document.createElement('div')
                header.className = 'lse-item-header'
                header.innerHTML = `<strong>Paso #${idx + 1}</strong> <span style='font-family:monospace; color:#aaa;'>[${wp.x.toFixed(1)}, ${wp.y.toFixed(1)}, ${wp.z.toFixed(1)}]</span>`
                item.appendChild(header)

                // Actions
                const actions = document.createElement('div')
                actions.className = 'lse-item-actions'

                // Delay Input
                const delayLabel = document.createElement('label')
                delayLabel.textContent = "Espera (s): "
                delayLabel.style.fontSize = "12px"
                const delayInput = document.createElement('input')
                delayInput.type = "number"
                delayInput.value = wp.delay || 0
                delayInput.style.cssText = "width:50px; background:#222; border:1px solid #444; color:white; font-size:12px;"
                delayInput.onchange = (e) => wp.delay = parseFloat(e.target.value)

                actions.appendChild(delayLabel)
                actions.appendChild(delayInput)

                // Teleport Flag?
                const tpLabel = document.createElement('label')
                tpLabel.innerHTML = `<input type="checkbox" ${wp.teleport ? 'checked' : ''}> Teleport`
                tpLabel.style.fontSize = "12px"
                tpLabel.querySelector('input').onchange = (e) => wp.teleport = e.target.checked
                actions.appendChild(tpLabel)

                // Delete
                const delBtn = document.createElement('button')
                delBtn.textContent = "🗑"
                delBtn.style.cssText = "margin-left:auto; background:none; border:none; cursor:pointer; font-size:14px;"
                delBtn.onclick = () => {
                    seq.waypoints.splice(idx, 1)
                    this.render()
                    this.logicSystem.updateVisualization()
                }
                actions.appendChild(delBtn)

                item.appendChild(actions)
            }
            this.timeline.appendChild(item)
        })
    }

    addWaypoint(seq) {
        // Capture current transform of the object
        const wp = {
            type: 'move',
            x: this.currentObject.position.x,
            y: this.currentObject.position.y,
            z: this.currentObject.position.z,
            rotY: this.currentObject.rotation.y,
            delay: 0,
            teleport: false
        }
        seq.waypoints.push(wp)
        this.render()
        this.logicSystem.updateVisualization()
    }

    showButtonSelector(seq) {
        // Create a modal list of buttons on top of existing UI
        const overlay = document.createElement('div')
        overlay.style.cssText = `
            position: absolute; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.8); z-index: 2100;
            display: flex; justify-content: center; align-items: center;
        `

        const panel = document.createElement('div')
        panel.style.cssText = `
            background: #222; border: 2px solid #444; border-radius: 8px;
            width: 300px; max-height: 80%; padding: 20px;
            display: flex; flex-direction: column; gap: 10px;
        `

        const title = document.createElement('h3')
        title.textContent = "Selecciona un Botón"
        title.style.margin = "0 0 10px 0"
        title.style.textAlign = "center"
        panel.appendChild(title)

        const list = document.createElement('div')
        list.style.cssText = "overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 5px;"

        // Find buttons using LogicSystem's helper or manually
        // We need Scene reference
        const buttons = []
        if (this.game.sceneManager && this.game.sceneManager.scene) {
            this.game.sceneManager.scene.traverse(obj => {
                if (obj.userData && obj.userData.mapObjectType === 'interaction_button') {
                    buttons.push(obj)
                }
            })
        }

        if (buttons.length === 0) {
            list.innerHTML = "<div style='color:#666; text-align:center;'>No hay botones en la escena.</div>"
        } else {
            buttons.forEach(btn => {
                const row = document.createElement('button')
                // Name or ID
                const name = btn.userData.logicProperties && btn.userData.logicProperties.name
                    ? btn.userData.logicProperties.name
                    : "Botón Sin Nombre"
                const uuid = btn.userData.uuid.substring(0, 5)

                row.textContent = `${name} (${uuid})`
                row.style.cssText = `
                    background: #333; color: white; border: 1px solid #444;
                    padding: 8px; text-align: left; cursor: pointer; border-radius: 4px;
                `
                row.onmouseover = () => row.style.background = "#444"
                row.onmouseout = () => row.style.background = "#333"

                row.onclick = () => {
                    // Add Wait Step
                    seq.waypoints.push({
                        type: 'wait_signal',
                        signalId: btn.userData.uuid,
                        signalName: name
                    })
                    this.render()
                    this.logicSystem.updateVisualization()
                    document.body.removeChild(overlay)
                }
                list.appendChild(row)
            })
        }
        panel.appendChild(list)

        const cancelBtn = document.createElement('button')
        cancelBtn.textContent = "Cancelar"
        cancelBtn.style.cssText = "padding: 8px; background: #666; border: none; color: white; cursor: pointer; border-radius: 4px; margin-top: 10px;"
        cancelBtn.onclick = () => document.body.removeChild(overlay)
        panel.appendChild(cancelBtn)

        overlay.appendChild(panel)
        document.body.appendChild(overlay)
    }

    createInput(container, targetObj, key, val, type, labelText) {
        const row = document.createElement('div')
        row.className = 'lse-input-row'

        const label = document.createElement('label')
        label.className = 'lse-input-label'
        label.textContent = labelText || key

        const input = document.createElement('input')
        input.className = 'lse-input'

        if (type === 'number') {
            input.type = "number"
            input.value = val
            input.step = "0.1"
            input.onchange = (e) => {
                targetObj[key] = parseFloat(e.target.value)
            }
        } else if (type === 'boolean') {
            input.type = "checkbox"
            input.checked = val
            input.style.width = "auto"
            input.onchange = (e) => {
                targetObj[key] = e.target.checked
            }
        } else {
            input.type = "text"
            input.value = val
            input.onchange = (e) => {
                targetObj[key] = e.target.value
            }
        }

        row.appendChild(label)
        row.appendChild(input)
        container.appendChild(row)
    }
}

