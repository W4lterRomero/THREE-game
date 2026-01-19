export class LogicToolbar {
    constructor(game) {
        this.game = game
        this.isVisible = false
        this.activeTool = null // 'waypoint', 'select', etc.
        this.onToolChange = null // Callback
        this.onClose = null // Callback

        this.setupUI()
    }

    setupUI() {
        this.container = document.createElement('div')
        this.container.id = 'logic-toolbar'
        this.container.style.cssText = `
            position: absolute;
            top: 50%;
            left: 20px;
            transform: translateY(-50%);
            display: none;
            flex-direction: column;
            gap: 10px;
            background: rgba(0,0,0,0.8);
            padding: 10px;
            border-radius: 8px;
            border: 1px solid #444;
            z-index: 2000;
        `

        // Title
        const title = document.createElement('div')
        title.innerHTML = "🛠<br>LOGIC"
        title.style.cssText = `
            color: #aaa; font-weight: bold; font-size: 10px; 
            text-align: center; border-bottom: 1px solid #555; 
            padding-bottom: 5px; margin-bottom: 5px;
        `
        this.container.appendChild(title)

        // Tools
        this.addToolButton("📍", "Añadir Punto de Ruta", "waypoint")
        // this.addToolButton("✋", "Mover Puntos", "move_wp") // Future

        // Spacer
        const spacer = document.createElement('div')
        spacer.style.height = "20px"
        this.container.appendChild(spacer)

        // Close / Done
        const doneBtn = document.createElement('div')
        doneBtn.textContent = "✔"
        doneBtn.title = "Terminar Edición"
        doneBtn.style.cssText = `
            width: 40px; height: 40px; background: #004400; color: white;
            display: flex; align-items: center; justify-content: center;
            border-radius: 6px; cursor: pointer; border: 1px solid #006600;
            font-size: 20px;
        `
        doneBtn.onclick = () => {
            if (this.onClose) this.onClose()
        }
        this.container.appendChild(doneBtn)

        document.body.appendChild(this.container)
    }

    addToolButton(icon, title, toolId) {
        const btn = document.createElement('div')
        btn.textContent = icon
        btn.title = title
        btn.dataset.tool = toolId
        btn.style.cssText = `
            width: 40px; height: 40px; background: #333; color: white;
            display: flex; align-items: center; justify-content: center;
            border-radius: 6px; cursor: pointer; border: 1px solid #555;
            font-size: 20px; transition: background 0.2s;
        `

        btn.onmouseover = () => {
            if (this.activeTool !== toolId) btn.style.background = "#444"
        }
        btn.onmouseout = () => {
            if (this.activeTool !== toolId) btn.style.background = "#333"
        }
        btn.onclick = () => {
            this.setActiveTool(toolId)
        }

        this.container.appendChild(btn)
    }

    setActiveTool(toolId) {
        this.activeTool = (this.activeTool === toolId) ? null : toolId

        // Update UI
        Array.from(this.container.children).forEach(c => {
            if (c.dataset && c.dataset.tool) {
                if (c.dataset.tool === this.activeTool) {
                    c.style.background = "#0066cc"
                    c.style.borderColor = "#0088ff"
                } else {
                    c.style.background = "#333"
                    c.style.borderColor = "#555"
                }
            }
        })

        if (this.onToolChange) this.onToolChange(this.activeTool)
    }

    show() {
        this.isVisible = true
        this.container.style.display = 'flex'
    }

    hide() {
        this.isVisible = false
        this.container.style.display = 'none'
        // Reset tool
        this.setActiveTool(null)
    }
}
