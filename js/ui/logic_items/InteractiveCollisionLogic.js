export class InteractiveCollisionLogic {
    static getLabel() {
        return "Colisión Interactiva"
    }

    static setupUI(container, object, props, logicSystem) {
        // --- Properties ---

        // Manual implementation for "isTraversable" to ensure Physics Update
        const travRow = document.createElement('div')
        travRow.style.cssText = `display: flex; gap: 10px; align-items: center; justify-content: space-between; margin-bottom:5px;`

        const travLabel = document.createElement('label')
        travLabel.textContent = 'Atravesable (Fantasma)'
        travLabel.style.color = "#aaa"; travLabel.style.fontSize = "14px"

        const travInput = document.createElement('input')
        travInput.type = "checkbox"
        travInput.checked = props.isTraversable === true
        travInput.style.width = "auto"

        travInput.onchange = (e) => {
            const val = e.target.checked
            props.isTraversable = val
            object.userData.logicProperties.isTraversable = val // redundant? props IS reference to userData.logicProperties usually.

            // Immediate Physics Update
            if (object.userData.rigidBody) {
                const n = object.userData.rigidBody.numColliders()
                for (let i = 0; i < n; i++) {
                    const col = object.userData.rigidBody.collider(i)
                    col.setSensor(val)
                    console.log(`[UI] Set Sensor to ${val} for`, object.userData.uuid)
                }
            }
        }

        travRow.appendChild(travLabel)
        travRow.appendChild(travInput)
        container.appendChild(travRow)

        logicSystem.createInput(container, object, 'triggerOnTouch', props.triggerOnTouch || false, 'boolean', 'Evento al Tocar')
        logicSystem.createInput(container, object, 'triggerOnEnter', props.triggerOnEnter || false, 'boolean', 'Evento al Entrar (Centro)')

        // --- Visuals ---
        const visualContainer = document.createElement('div')
        visualContainer.style.cssText = "border-top: 1px solid #444; margin-top: 10px; padding-top: 5px;"
        visualContainer.innerHTML = "<div style='color:#aaa; font-size:12px; margin-bottom:5px;'>Visuales</div>"

        // Border Color
        const colorRow = document.createElement('div')
        colorRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;"
        const colorLabel = document.createElement('label'); colorLabel.textContent = "Color Borde"; colorLabel.style.color = "#ccc"
        const colorInput = document.createElement('input'); colorInput.type = 'color';
        colorInput.value = props.borderColor || '#00FFFF' // Default Cyan
        colorInput.onchange = (e) => {
            props.borderColor = e.target.value
            // Immediate Update
            const wire = object.children.find(c => c.isLineSegments)
            if (wire && wire.material) {
                wire.material.color.set(e.target.value)
            }
        }
        colorRow.appendChild(colorLabel); colorRow.appendChild(colorInput)
        visualContainer.appendChild(colorRow)

        // Border Visible
        logicSystem.createInput(visualContainer, object, 'borderVisible', props.borderVisible !== false, 'boolean', 'Mostrar Borde')
        // Hook into the just created input to add immediate update?
        // createInput doesn't return the element effortlessly or allow callback easily without refactor.
        // We can manually add a listener or just let the loop handle it? 
        // Loop is expensive/delayed. Let's find the input we just made? 
        // LogicSystem.createInput appends to container.
        const lastInput = visualContainer.lastElementChild.querySelector('input')
        if (lastInput) {
            lastInput.addEventListener('change', (e) => {
                const wire = object.children.find(c => c.isLineSegments)
                if (wire) wire.visible = e.target.checked
            })
        }

        container.appendChild(visualContainer)

        // --- Navigation ---
        const navBtn = document.createElement('button')
        navBtn.textContent = "Ir al Objeto"
        navBtn.style.cssText = "width: 100%; margin-top: 10px; background: #444; color: white; border: 1px solid #666; padding: 5px; cursor: pointer;"
        navBtn.onclick = () => {
            if (logicSystem.game.character) {
                // Teleport player
                const pos = object.position.clone()
                pos.y += 2 // Avoid stuck
                logicSystem.game.character.setPosition(pos)
                console.log("Teleported to", pos)
            }
        }
        container.appendChild(navBtn)

        // --- Shape ---
        const shapeRow = document.createElement('div')
        shapeRow.style.cssText = "margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;"
        const shapeLabel = document.createElement('label')
        shapeLabel.textContent = "Forma:"
        shapeLabel.style.color = "#aaa"
        const shapeSelect = document.createElement('select')
        shapeSelect.style.cssText = "background: #333; color: white; border: 1px solid #555; padding: 2px;"
        const optBox = document.createElement('option'); optBox.value = 'box'; optBox.textContent = 'Cubo';
        const optSphere = document.createElement('option'); optSphere.value = 'sphere'; optSphere.textContent = 'Esfera';
        shapeSelect.add(optBox); shapeSelect.add(optSphere);

        // Load existing shape
        if (object.userData.logicProperties && object.userData.logicProperties.shapeType) {
            shapeSelect.value = object.userData.logicProperties.shapeType
        } else if (object.userData.shapeType) {
            shapeSelect.value = object.userData.shapeType
        } else {
            shapeSelect.value = 'box' // Default
        }

        const updateShapeVisibility = (boxContainer, sphereContainer, shape) => {
            if (shape === 'sphere') {
                boxContainer.style.display = 'none'
                sphereContainer.style.display = 'flex'
            } else {
                boxContainer.style.display = 'block'
                sphereContainer.style.display = 'none'
            }
        }

        // Logic extraction for physics update
        const updatePhysics = () => {
            if (window.game && window.game.updateObjectPhysics) {
                window.game.updateObjectPhysics(object)
            } else if (logicSystem.game && logicSystem.game.updateObjectPhysics) { // Fallback
                logicSystem.game.updateObjectPhysics(object)
            }
        }

        const updateVisuals = () => {
            const shape = object.userData.shapeType
            if (shape === 'sphere') {
                if (object.geometry.type !== 'SphereGeometry') {
                    object.geometry.dispose()
                    object.geometry = new THREE.SphereGeometry(0.5, 16, 16)
                }
            } else {
                if (object.geometry.type !== 'BoxGeometry') {
                    object.geometry.dispose()
                    object.geometry = new THREE.BoxGeometry(1, 1, 1)
                }
            }
        }

        shapeSelect.onchange = (e) => {
            if (!object.userData.logicProperties) object.userData.logicProperties = {}
            object.userData.logicProperties.shapeType = e.target.value
            object.userData.shapeType = e.target.value

            updateShapeVisibility(dimContainer, radiusContainer, e.target.value)
            updateVisuals()
            updatePhysics()
        }
        shapeRow.appendChild(shapeLabel)
        shapeRow.appendChild(shapeSelect)
        container.appendChild(shapeRow)

        // --- Radius (Sphere) ---
        const radiusContainer = document.createElement('div')
        radiusContainer.style.cssText = "margin-bottom: 10px; display: none; justify-content: space-between; align-items: center;"
        const radLabel = document.createElement('label')
        radLabel.textContent = "Radio:"
        radLabel.style.color = "#aaa"
        const radInput = document.createElement('input')
        radInput.type = "number"
        radInput.step = "0.1"
        radInput.style.cssText = "width: 60px; background: #333; color: white; border: 1px solid #555;"

        let currentRadius = 1.0
        if (object.userData.logicProperties?.radius) currentRadius = object.userData.logicProperties.radius
        else if (object.userData.radius) currentRadius = object.userData.radius
        else if (object.scale) currentRadius = object.scale.x / 2 // Fallback

        radInput.value = currentRadius

        radInput.onchange = (e) => {
            let val = parseFloat(e.target.value)
            if (isNaN(val) || val < 0.1) val = 0.1

            if (!object.userData.logicProperties) object.userData.logicProperties = {}
            object.userData.logicProperties.radius = val
            object.userData.radius = val

            // Visual Update (Scale)
            // Sphere geometry is radius 0.5, so scale 2 = radius 1.
            object.scale.set(val * 2, val * 2, val * 2)

            updatePhysics()
        }
        radiusContainer.appendChild(radLabel)
        radiusContainer.appendChild(radInput)
        container.appendChild(radiusContainer)


        // --- Dimensions (Box) ---
        const dimContainer = document.createElement('div')
        dimContainer.style.cssText = "border-top: 1px solid #444; margin-top: 10px; padding-top: 5px;"
        dimContainer.innerHTML = "<div style='color:#aaa; font-size:12px; margin-bottom:5px;'>Dimensiones</div>"

        // Helper to update scale
        const updateScale = (axis, val) => {
            object.scale[axis] = val
            // Update Visual Mesh if child exists?
            // Usually these logic objects are just a mesh.

            // We must update the physics body!
            // This is complex b/c Rapier bodies are created on spawn.
            // We might need a "Rebuild Body" signal or simply update collider if possible.
            // For now, let's just update visual scale and userData.
            if (!object.userData.originalScale) object.userData.originalScale = { x: 1, y: 1, z: 1 }
            object.userData.originalScale[axis] = val

            // Notify System to rebuild physics?
            updatePhysics()
        }

        // We can reuse logicSystem.createInput but need custom callback for scale
        const axes = ['x', 'y', 'z']
        axes.forEach(axis => {
            const row = document.createElement('div')
            row.style.cssText = `display: flex; gap: 10px; align-items: center; justify-content: space-between; margin-bottom:2px;`

            const label = document.createElement('label')
            label.textContent = axis.toUpperCase()
            label.style.color = "#888"

            const input = document.createElement('input')
            input.type = 'number'
            input.value = object.scale[axis]
            input.step = 0.1
            input.style.cssText = `background: #111; border: 1px solid #444; color: white; padding: 2px; width: 50px;`

            input.onchange = (e) => {
                const val = parseFloat(e.target.value)
                updateScale(axis, val)
            }

            row.appendChild(label)
            row.appendChild(input)
            dimContainer.appendChild(row)
        })
        container.appendChild(dimContainer)

        // Initial Visibility
        updateShapeVisibility(dimContainer, radiusContainer, shapeSelect.value)

        // --- Info ---
        const info = document.createElement('div')
        info.textContent = `UUID: ${object.userData.uuid ? object.userData.uuid.substring(0, 8) : 'N/A'}...`
        info.style.cssText = "font-size:10px; color:#aaa; margin-top:10px;"
        container.appendChild(info)
    }
}
