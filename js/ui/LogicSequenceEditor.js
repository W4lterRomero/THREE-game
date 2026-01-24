
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

        // 2. Triggers (Event Listeners)
        const trigHeader = document.createElement('h4')
        trigHeader.textContent = "Disparadores (Triggers)"
        trigHeader.style.marginTop = "20px"
        this.sidebar.appendChild(trigHeader)

        const trigDesc = document.createElement('div')
        trigDesc.style.cssText = "font-size:11px; color:#888; margin-bottom:10px; line-height:1.4;"
        trigDesc.textContent = "Define qué evento inicia esta secuencia. Si 'Activo al Inicio' está apagado, la secuencia esperará esta señal."
        this.sidebar.appendChild(trigDesc)

        // Trigger Type Selector
        const row = document.createElement('div')
        row.style.cssText = `margin-bottom: 10px;`
        row.innerHTML = `<div style="color:#aaa; font-size:12px; margin-bottom:4px;">Tipo de Disparador</div>`

        const select = document.createElement('select')
        select.className = 'lse-input'
        select.style.width = "100%"
        select.innerHTML = `
            <option value="none">Ninguno (Manual / Siempre Activo)</option>
            <option value="signal">Señal de Evento (Botón, etc)</option>
        `
        select.value = seq.triggerType || "none"
        select.onchange = (e) => {
            seq.triggerType = e.target.value
            this.render() // Re-render to show/hide extra fields
        }
        row.appendChild(select)
        this.sidebar.appendChild(row)

        if (seq.triggerType === 'signal') {
            // Signal ID / Button Link
            const signalBox = document.createElement('div')
            signalBox.style.cssText = "background:#2a2a2a; padding:10px; border-radius:4px; margin-top:5px;"

            const linkStatus = document.createElement('div')
            linkStatus.innerHTML = `Estado: <span style="color:${seq.triggerSignal ? '#0f0' : '#f44'}">${seq.triggerSignal ? "Vinculado" : "Sin Vínculo"}</span>`
            linkStatus.style.cssText = "font-size:11px; margin-bottom:5px;"
            signalBox.appendChild(linkStatus)

            const pickBtn = document.createElement('button')
            pickBtn.textContent = "Vincular a Botón"
            pickBtn.style.cssText = "width:100%; background:#444; color:white; border:none; padding:4px; cursor:pointer; font-size:11px;"
            pickBtn.onclick = () => this.pickTriggerObject(seq)
            signalBox.appendChild(pickBtn)

            this.sidebar.appendChild(signalBox)
        }

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

        // Add Waypoint Button
        const addWpBtn = document.createElement('button')
        addWpBtn.textContent = "+ Agregar Punto (Capturar Actual)"
        addWpBtn.className = 'lse-add-btn'
        addWpBtn.onclick = () => this.addWaypoint(seq)
        this.timeline.appendChild(addWpBtn)

        // Timeline Items
        seq.waypoints.forEach((wp, idx) => {
            const item = document.createElement('div')
            item.className = 'lse-item'

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
            this.timeline.appendChild(item)
        })
    }

    addWaypoint(seq) {
        // Capture current transform of the object
        const wp = {
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

    pickTriggerObject(seq) {
        if (this.game.constructionMenu) {
            // Temporarily hide editor? Or just use alert
            this.container.style.display = 'none' // Hide to see
            alert("Selecciona el BOTÓN que activará esta secuencia (Click Derecho).")

            this.game.constructionMenu.isPickingTarget = true
            this.game.constructionMenu.pickingController = this.currentObject
            this.game.constructionMenu.pickingCallback = (selectedObj) => {
                if (selectedObj.userData.mapObjectType === 'interaction_button') {
                    seq.triggerSignal = selectedObj.userData.uuid // Use UUID as signal ID
                    alert("Vinculado correctamente!")
                } else {
                    alert("¡Debes seleccionar un Botón!")
                }
                // Re-open editor
                this.container.style.display = 'flex'
                this.render()

                // Clear picking mode
                this.game.constructionMenu.isPickingTarget = false
                this.game.constructionMenu.pickingCallback = null
            }
        }
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

