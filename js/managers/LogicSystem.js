import * as THREE from "three"

export class LogicSystem {
    constructor(game) {
        this.game = game
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
        mvHeader.innerHTML = `<span style="color:#00FFFF">🏃 Animación</span>`
        mvHeader.style.cssText = `
            margin-top: 15px; margin-bottom: 10px; 
            font-weight: bold; border-top: 1px solid #444; padding-top: 10px;
        `
        container.appendChild(mvHeader)

        this.createInput(container, object, 'speed', props.speed || 2.0, 'number', 'Velocidad')
        this.createInput(container, object, 'loop', props.loop !== false, 'boolean', 'Bucle Infinito')
        this.createInput(container, object, 'active', props.active !== false, 'boolean', 'Activo')

        // Waypoints List
        const wpHeader = document.createElement('div')
        wpHeader.textContent = `Puntos de Ruta (${props.waypoints.length})`
        wpHeader.style.cssText = `margin-top: 10px; font-size: 12px; color: #aaa;`
        container.appendChild(wpHeader)

        // Capture Button
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
            }
        }
        container.appendChild(removeBtn)
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
