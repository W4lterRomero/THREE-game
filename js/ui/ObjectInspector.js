import * as THREE from "three"
import { StairsUtils } from "../utils/StairsUtils.js"

export class ObjectInspector {
    constructor(gameInstance) {
        this.game = gameInstance
        this.isVisible = false
        this.selectedObject = null

        this.setupUI()
    }

    setupUI() {
        // Main Container
        this.container = document.createElement('div')
        this.container.id = 'object-inspector'
        this.container.style.cssText = `
            position: absolute;
            top: 20px; 
            right: 20px;
            width: 300px;
            max-height: 90vh;
            background: rgba(0,0,0,0.9);
            border: 2px solid #444; 
            border-radius: 12px;
            display: none;
            flex-direction: column;
            color: white;
            font-family: sans-serif;
            z-index: 2000;
            padding: 15px;
            box-sizing: border-box;
            box-shadow: 0 0 20px rgba(0,0,0,0.8);
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #444 #222;
        `

        // Header
        const header = document.createElement('div')
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #555;
            padding-bottom: 10px;
            margin-bottom: 15px;
        `
        this.title = document.createElement('h3')
        this.title.style.margin = "0"
        this.title.textContent = "Inspector"

        const closeBtn = document.createElement('span')
        closeBtn.textContent = "✕"
        closeBtn.style.cursor = "pointer"
        closeBtn.style.fontSize = "20px"
        closeBtn.onclick = () => this.hide()

        header.appendChild(this.title)
        header.appendChild(closeBtn)
        this.container.appendChild(header)

        // Properties Container
        this.content = document.createElement('div')
        this.content.style.display = "flex"
        this.content.style.flexDirection = "column"
        this.content.style.gap = "15px"
        this.container.appendChild(this.content)

        // 1. Position Controls
        this.createSection("Posición", (section) => {
            const row = document.createElement('div')
            row.style.cssText = `display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px;`

            this.inputPosX = this.createNumberInput("X", (v) => this.updatePosition('x', v), -Infinity, 0.5, "#FF4444")
            this.inputPosY = this.createNumberInput("Y", (v) => this.updatePosition('y', v), -Infinity, 0.5, "#44FF44")
            this.inputPosZ = this.createNumberInput("Z", (v) => this.updatePosition('z', v), -Infinity, 0.5, "#4444FF")

            row.appendChild(this.inputPosX.container)
            row.appendChild(this.inputPosY.container)
            row.appendChild(this.inputPosZ.container)
            section.appendChild(row)

            // Nudge Buttons (Careful Move)
            const nudgeContainer = document.createElement('div')
            // ... (rest of nudge logic)
            nudgeContainer.style.marginTop = "10px"
            nudgeContainer.style.display = "grid"
            nudgeContainer.style.gridTemplateColumns = "repeat(3, 1fr)" // X, Y, Z columns
            nudgeContainer.style.gap = "5px"

            // Helpers for buttons
            const createNudgeGroup = (axis, color) => {
                const group = document.createElement('div')
                group.style.display = "flex"
                group.style.flexDirection = "column"
                group.style.gap = "2px"
                group.style.borderTop = `2px solid ${color}`
                group.style.paddingTop = "2px"

                const btnPlus = document.createElement('button')
                // ...
                btnPlus.textContent = `+${axis}`
                btnPlus.style.cssText = `background: #444; color: white; border: none; padding: 4px; cursor: pointer; border-radius: 3px; font-size: 10px;`
                btnPlus.onclick = () => this.nudge(axis, 0.1)

                const btnMinus = document.createElement('button')
                btnMinus.textContent = `-${axis}`
                btnMinus.style.cssText = `background: #444; color: white; border: none; padding: 4px; cursor: pointer; border-radius: 3px; font-size: 10px;`
                btnMinus.onclick = () => this.nudge(axis, -0.1)

                group.appendChild(btnPlus)
                group.appendChild(btnMinus)
                return group
            }

            nudgeContainer.appendChild(createNudgeGroup('X', '#FF4444'))
            nudgeContainer.appendChild(createNudgeGroup('Y', '#44FF44'))
            nudgeContainer.appendChild(createNudgeGroup('Z', '#4444FF'))
            section.appendChild(nudgeContainer)
        })

        // 2. Dimensions/Scale Controls
        this.createSection("Dimensiones", (section) => {
            const row = document.createElement('div')
            row.style.cssText = `display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px;`

            this.inputScaleX = this.createNumberInput("Ancho", (v) => this.updateDimensions('x', v), 0.1, 0.5, "#FF4444")
            this.inputScaleY = this.createNumberInput("Alto", (v) => this.updateDimensions('y', v), 0.1, 0.5, "#44FF44")
            this.inputScaleZ = this.createNumberInput("Prof.", (v) => this.updateDimensions('z', v), 0.1, 0.5, "#4444FF")

            row.appendChild(this.inputScaleX.container)
            row.appendChild(this.inputScaleY.container)
            row.appendChild(this.inputScaleZ.container)
            section.appendChild(row)
        })

        // ...


        // ...


        // 3. Color Controls
        this.createSection("Color", (section) => {
            const row = document.createElement('div')
            row.style.display = "flex"
            row.style.alignItems = "center"
            row.style.gap = "10px"

            this.colorPicker = document.createElement('input')
            this.colorPicker.type = "color"
            this.colorPicker.style.border = "none"
            this.colorPicker.style.width = "40px"
            this.colorPicker.style.height = "40px"
            this.colorPicker.style.cursor = "pointer"
            this.colorPicker.addEventListener('input', (e) => this.updateColor(e.target.value))

            row.appendChild(this.colorPicker)
            section.appendChild(row)

            // Palette (Reuse generic logic or simple one)
            const palette = document.createElement('div')
            palette.style.cssText = `display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px;`
            const colors = ["#FFFFFF", "#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#00FFFF", "#FF00FF"]
            colors.forEach(c => {
                const s = document.createElement('div')
                s.style.cssText = `width: 20px; height: 20px; background: ${c}; cursor: pointer; border: 1px solid #555;`
                s.onclick = () => {
                    this.colorPicker.value = c
                    this.updateColor(c)
                }
                palette.appendChild(s)
            })
            section.appendChild(palette)
        })

        // 4. Texture Controls
        this.createSection("Textura", (section) => {
            this.textureGrid = document.createElement('div')
            this.textureGrid.style.cssText = `display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 10px;`
            this.renderTextures(this.textureGrid)
            section.appendChild(this.textureGrid)

            // Upload
            const uploadBtn = document.createElement('button')
            uploadBtn.textContent = "Cargar Textura..."
            uploadBtn.style.cssText = `width: 100%; padding: 5px; cursor: pointer; background: #333; color: white; border: 1px solid #555; border-radius: 4px;`

            const fileInput = document.createElement('input')
            fileInput.type = "file"
            fileInput.accept = "image/*"
            fileInput.style.display = "none"
            fileInput.onchange = (e) => {
                const file = e.target.files[0]
                if (file) {
                    const reader = new FileReader()
                    reader.onload = (evt) => this.updateTexture(evt.target.result)
                    reader.readAsDataURL(file)
                }
            }
            uploadBtn.onclick = () => fileInput.click()

            section.appendChild(fileInput)
            section.appendChild(uploadBtn)
        })

        // 5. Logic Properties (Dynamic)
        // 5. Logic Properties (Dynamic)
        this.logicSectionWrapper = this.createSection("Lógica de Juego", (section) => {
            this.logicContainer = document.createElement('div')
            this.logicContainer.style.display = 'flex'
            this.logicContainer.style.flexDirection = 'column'
            this.logicContainer.style.gap = '5px'
            section.appendChild(this.logicContainer)
        })
        this.logicSectionWrapper.style.display = 'none'
            // Move the logic section into the main content
            // Note: createSection appends to this.content immediately.
            // So I need to capture the section element wrapper if I want to hide it whole.
            // My createSection implementation doesn't return the wrapper easily to `this`.
            // I will modify createSection slightly or just access the last child.
            // Actually, I can just modify `createSection` to return the section element.

            // Stop propagation of events to prevent game interaction when over the UI
            ;['mousedown', 'mouseup', 'click', 'wheel', 'keydown', 'keyup'].forEach(eventType => {
                this.container.addEventListener(eventType, (e) => {
                    e.stopPropagation()
                })
            })

        document.body.appendChild(this.container)
    }

    createSection(title, contentBuilder) {
        const section = document.createElement('div')
        section.style.cssText = `border: 1px solid #333; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05);`

        const lbl = document.createElement('div')
        lbl.textContent = title
        lbl.style.cssText = `font-size: 12px; color: #aaa; margin-bottom: 8px; font-weight: bold; text-transform: uppercase;`
        section.appendChild(lbl)

        contentBuilder(section)
        this.content.appendChild(section)
        return section
    }

    createNumberInput(label, onChange, min = -Infinity, step = 0.5, color = null) {
        const container = document.createElement('div')
        container.style.cssText = `display: flex; flex-direction: column; gap: 2px;`
        if (color) {
            container.style.borderLeft = `3px solid ${color}`
            container.style.paddingLeft = "4px"
        }

        const lbl = document.createElement('span')
        lbl.textContent = label
        lbl.style.fontSize = "10px"
        lbl.style.color = color ? color : "#888"

        const input = document.createElement('input')
        input.type = "number"
        input.step = step.toString()
        if (min !== -Infinity) input.min = min
        input.style.cssText = `
            width: 100%; background: #222; color: white; border: 1px solid #444; 
            border-radius: 4px; padding: 4px; font-size: 11px;
        `
        input.onchange = (e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange(v)
        }

        container.appendChild(lbl)
        container.appendChild(input)
        return { container, input }
    }

    renderTextures(container) {
        const textures = [
            { name: "Ninguna", path: null, color: "#333" },
            { name: "Ladrillo", path: "assets/textures/obj/brick.png" },
            { name: "Concreto", path: "assets/textures/obj/concrete.png" },
            { name: "Madera", path: "assets/textures/obj/wood.png" },
            { name: "Hierro", path: "assets/textures/obj/hierro.png" }
        ];

        textures.forEach(tex => {
            const t = document.createElement('div')
            t.title = tex.name
            t.style.cssText = `
                aspect-ratio: 1; border: 1px solid #444; cursor: pointer; border-radius: 4px;
                background-color: ${tex.color || 'transparent'};
                background-size: cover; background-position: center;
            `
            if (tex.path) t.style.backgroundImage = `url(${tex.path})`

            t.onclick = () => this.updateTexture(tex.path)
            container.appendChild(t)
        })
    }

    show(object) {
        if (!object) return
        this.selectedObject = object
        this.isVisible = true
        this.container.style.display = 'flex'

        // Populate Data
        this.title.textContent = `Propiedades: ${object.userData.mapObjectType || "Objeto"}`

        // Position
        this.inputPosX.input.value = object.position.x.toFixed(2)
        this.inputPosY.input.value = object.position.y.toFixed(2)
        this.inputPosZ.input.value = object.position.z.toFixed(2)

        // Scale/Dim (Assuming box geometry for now, or reading scale from userData if available)
        // If it's a scaled standard mesh, we use .scale properties combined with geometry params?
        // Our system uses geometry parameters for size usually.
        // Let's assume userData.originalScale holds the dimensions.
        const dims = object.userData.originalScale || { x: 1, y: 1, z: 1 }
        this.inputScaleX.input.value = dims.x
        this.inputScaleY.input.value = dims.y
        this.inputScaleZ.input.value = dims.z

        // Color
        if (object.material && object.material.color) {
            this.colorPicker.value = '#' + object.material.color.getHexString()
        }

        // Logic Properties
        if (object.userData.logicProperties) {
            this.logicSectionWrapper.style.display = 'block'
            this.renderLogicProperties(object.userData.logicProperties)
        } else {
            this.logicSectionWrapper.style.display = 'none'
        }

        // 6. Link to Logic Panel (New)
        // Check if object has modifiers that should be edited in Logic Panel
        const hasLogicParams = object.userData.logicProperties && (
            object.userData.logicProperties.waypoints ||
            object.userData.mapObjectType === 'movement_controller' ||
            object.userData.mapObjectType === 'spawn_point'
        )

        if (hasLogicParams) {
            // Remove existing button if any (for safety, though rebuild happens somewhat)
            // Actually, we should probably append this to the Logic Section or a new footer.
            // Let's append to logicSectionWrapper

            // Check if button already exists in logicSection (container)
            if (!this.editLogicBtn) {
                this.editLogicBtn = document.createElement('button')
                this.editLogicBtn.textContent = "⚙ Editar Lógica Avanzada"
                this.editLogicBtn.style.cssText = `
                    width: 100%; margin-top: 10px; padding: 8px; 
                    background: #552200; color: orange; border: 1px solid orange; 
                    cursor: pointer; border-radius: 4px; font-size: 11px;
                `
                this.editLogicBtn.onclick = () => this.openLogicPanel()
                this.logicSectionWrapper.appendChild(this.editLogicBtn)
            }
            this.editLogicBtn.style.display = "block"
        } else {
            if (this.editLogicBtn) this.editLogicBtn.style.display = "none"
        }

        // Disable Game Input - REMOVED to allow movement
        // if (this.game.inputManager) this.game.inputManager.enabled = false
        document.exitPointerLock()
        if (this.game.cameraController) this.game.cameraController.setUIOpen(true)

        // Add Axes Helper
        if (!this.axesHelper) {
            this.axesHelper = new THREE.AxesHelper(3) // Size 3
            // Make it visible on top? No, just add to object.
            // If we add to object, it rotates with object.
            // If users want Global axes, we'd add to scene. 
            // "Show Red/Green/Blue arrows on the selected object" implies local axes usually.
            // Let's add to scene and copy transforms or add to object?
            // Adding to object is easiest.
        }
        // Always add (re-parent) to current object
        object.add(this.axesHelper)
    }

    hide() {
        this.isVisible = false
        this.container.style.display = 'none'

        // Remove Axes Helper
        if (this.selectedObject && this.axesHelper) {
            this.selectedObject.remove(this.axesHelper)
            this.axesHelper.dispose()
            this.axesHelper = null
        }

        this.selectedObject = null
        if (this.game.cameraController) this.game.cameraController.setUIOpen(false)

        // Enable Game Input - REMOVED (never disabled)
        // if (this.game.inputManager) this.game.inputManager.enabled = true
    }

    updatePosition(axis, value) {
        if (!this.selectedObject) return
        this.selectedObject.position[axis] = value
        this.refreshPhysicsAndVisuals()
    }

    nudge(axisAxis, amount) {
        if (!this.selectedObject) return
        const axis = axisAxis.toLowerCase()
        this.selectedObject.position[axis] += amount
        // Update input
        if (axis === 'x') this.inputPosX.input.value = this.selectedObject.position.x.toFixed(2)
        if (axis === 'y') this.inputPosY.input.value = this.selectedObject.position.y.toFixed(2)
        if (axis === 'z') this.inputPosZ.input.value = this.selectedObject.position.z.toFixed(2)

        this.refreshPhysicsAndVisuals()
    }

    updateDimensions(axis, value) {
        if (!this.selectedObject) return

        // Update userData dimensions
        if (!this.selectedObject.userData.originalScale) this.selectedObject.userData.originalScale = { x: 1, y: 1, z: 1 }
        this.selectedObject.userData.originalScale[axis] = value

        // We need to REGENERATE the geometry to match dimensions
        // This is complex because we need to know the type...
        // For now, let's just scale the mesh if simple? 
        // No, MapObjectItem logic uses Geometry params. 
        // Let's try to rescale the mesh geometry directly or replace it.

        // Easier: Just modify scale. But our system sets scale to 1,1,1 and uses geometry for size.
        // So we should verify if we can just scale the mesh.
        // If we scale the mesh, physics must match.

        // Let's rely on refreshPhysicsAndVisuals to rebuild or resize.
        // For a simple resize without full rebuild:
        // We can't resize BoxGeometry easily. We replace it.

        const oldGeo = this.selectedObject.geometry
        const dims = this.selectedObject.userData.originalScale

        let newGeo
        // Detect type (Naively)
        if (this.selectedObject.userData.mapObjectType === 'ramp') {
            // Rebuild shape... (Complex) - Skip/Warn?
            console.warn("Resizing ramps dynamically not fully supported yet in simple mode")
        } else if (this.selectedObject.userData.mapObjectType === 'stairs') {
            // Rebuild Stairs
            const steps = StairsUtils.calculateSteps(dims)

            // Get existing material from first child
            let material
            if (this.selectedObject.children.length > 0) {
                material = this.selectedObject.children[0].material
            } else {
                material = new THREE.MeshStandardMaterial({ color: this.selectedObject.userData.color })
            }

            // Remove old children (steps)
            // Iterate backwards or use clear(), but we must NOT remove the AxesHelper if attached!
            // Children include AxesHelper? Yes if we just added it.
            // Filter out AxesHelper
            const toRemove = this.selectedObject.children.filter(c => c !== this.axesHelper)
            toRemove.forEach(c => {
                if (c.geometry) c.geometry.dispose()
                this.selectedObject.remove(c)
            })

            const stepGeo = new THREE.BoxGeometry(steps[0].size.x, steps[0].size.y, steps[0].size.z)

            steps.forEach(step => {
                const mesh = new THREE.Mesh(stepGeo, material)
                mesh.position.set(step.position.x, step.position.y, step.position.z)
                mesh.castShadow = true
                mesh.receiveShadow = true
                this.selectedObject.add(mesh)
            })

        } else {
            // Default Box
            newGeo = new THREE.BoxGeometry(dims.x, dims.y, dims.z)
        }

        if (newGeo) {
            this.selectedObject.geometry.dispose()
            this.selectedObject.geometry = newGeo
        }

        this.refreshPhysicsAndVisuals()
    }

    updateColor(hex) {
        if (!this.selectedObject) return

        this.selectedObject.userData.color = parseInt(hex.replace('#', '0x'))

        if (this.selectedObject.material) {
            this.selectedObject.material.color.set(hex)
        }
        // If Group (Stairs)
        if (this.selectedObject.isGroup) {
            this.selectedObject.children.forEach(c => {
                if (c.material) c.material.color.set(hex)
            })
        }
    }

    updateTexture(pathOrDataUrl) {
        if (!this.selectedObject) return

        this.selectedObject.userData.texturePath = pathOrDataUrl

        if (pathOrDataUrl) {
            const loader = new THREE.TextureLoader()
            loader.load(pathOrDataUrl, (tex) => {
                tex.wrapS = THREE.RepeatWrapping
                tex.wrapT = THREE.RepeatWrapping

                // Simple repeat logic (match MapObjectItem logic)
                const dims = this.selectedObject.userData.originalScale || { x: 1, y: 1 }
                tex.repeat.set(dims.x / 2, dims.y / 2)

                const apply = (mesh) => {
                    if (mesh.material) {
                        mesh.material.map = tex
                        mesh.material.needsUpdate = true
                    }
                }

                if (this.selectedObject.isGroup) {
                    this.selectedObject.children.forEach(apply)
                } else {
                    apply(this.selectedObject)
                }
            })
        } else {
            // Remove
            const remove = (mesh) => {
                if (mesh.material) {
                    mesh.material.map = null
                    mesh.material.needsUpdate = true
                }
            }
            if (this.selectedObject.isGroup) {
                this.selectedObject.children.forEach(remove)
            } else {
                remove(this.selectedObject)
            }
        }
    }

    refreshPhysicsAndVisuals() {
        if (!this.game || !this.selectedObject) return

        // Calls a method in Game to regenerate body
        if (this.game.regenerateObjectPhysics) {
            this.game.regenerateObjectPhysics(this.selectedObject)
        }
    }

    renderLogicProperties(props) {
        this.logicContainer.innerHTML = '' // Clear previous

        // Helper to update props
        const updateProp = (key, value) => {
            if (this.selectedObject && this.selectedObject.userData.logicProperties) {
                this.selectedObject.userData.logicProperties[key] = value
                console.log(`Updated Logic Prop [${key}]:`, value)
            }
        }

        // 1. Team (Equipo)
        if (props.team !== undefined) {
            const teamInput = this.createNumberInput("Equipo (1-4)", (v) => updateProp('team', v), 1, 1, "#00FF00")
            teamInput.input.value = props.team
            teamInput.input.max = 4
            this.logicContainer.appendChild(teamInput.container)
        }

        // 2. Capacity
        if (props.capacity !== undefined) {
            const capInput = this.createNumberInput("Capacidad Jugadores", (v) => updateProp('capacity', v), 1, 1, "#00FFFF")
            capInput.input.value = props.capacity
            this.logicContainer.appendChild(capInput.container)
        }

        // 3. Order (Priority)
        if (props.order !== undefined) {
            const ordInput = this.createNumberInput("Orden de Spawn", (v) => updateProp('order', v), 0, 1, "#FFFF00")
            ordInput.input.value = props.order
            this.logicContainer.appendChild(ordInput.container)
        }

        // Future: More properties loop
    }
    openLogicPanel() {
        if (!this.selectedObject || !this.game || !this.game.constructionMenu) return

        const target = this.selectedObject

        // Hide Inspector
        this.hide()

        // Open Construction Menu -> Logic Panel -> Select Object
        this.game.constructionMenu.toggle() // Ensure it opens (toggle works if closed)
        if (!this.game.constructionMenu.isVisible) {
            this.game.constructionMenu.toggle()
        }

        this.game.constructionMenu.selectLogicObject(target)
    }
}
