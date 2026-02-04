
export class GameConfigPanel {
    constructor(game, logicSystem) {
        this.game = game
        this.logicSystem = logicSystem
        this.container = null

        // Ensure LogicSystem has Config Data
        if (!this.logicSystem.gameConfig) {
            this.logicSystem.gameConfig = {
                sequences: [] // [{ type: 'emit_signal', signal: 'start' }, { type: 'time', duration: 10 }]
            }
        }
    }

    createUI(parentContainer) {
        this.container = document.createElement('div')
        this.container.style.cssText = `
            width: 100%; height: 100%;
            display: flex; flex-direction: column; gap: 10px;
        `

        // Header
        const header = document.createElement('div')
        header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; padding-bottom: 10px;"

        const title = document.createElement('h3')
        title.textContent = "Configuración de Partida"
        title.style.margin = "0"
        header.appendChild(title)

        // Clear Button
        const clearBtn = document.createElement('button')
        clearBtn.textContent = "Limpiar Todo"
        clearBtn.style.cssText = "background: #622; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"
        clearBtn.onclick = () => {
            if (confirm("¿Borrar toda la configuración de la partida?")) {
                this.logicSystem.gameConfig.sequences = []
                this.render()
            }
        }
        header.appendChild(clearBtn)
        this.container.appendChild(header)

        // Toolbar (Add Blocks)
        const toolbar = document.createElement('div')
        toolbar.style.cssText = "display: flex; gap: 10px; flex-wrap: wrap;"

        this.createAddBtn(toolbar, "+ Señal", "#00aa00", () => this.addBlock('emit_signal'))
        this.createAddBtn(toolbar, "+ Tiempo", "#4444ff", () => this.addBlock('time_wait'))
        // Loop and End are still useful structure blocks
        this.createAddBtn(toolbar, "+ Fin Partida", "#aa0000", () => this.addBlock('end_game'))
        this.createAddBtn(toolbar, "+ Loop (Reiniciar)", "#880088", () => this.addBlock('loop_game'))

        this.container.appendChild(toolbar)

        // Sequence List Area
        this.sequenceList = document.createElement('div')
        this.sequenceList.style.cssText = `
            flex: 1; overflow-y: auto; 
            background: #1a1a1a; border: 1px solid #333; border-radius: 8px;
            padding: 10px; display: flex; flex-direction: column; gap: 5px;
        `
        this.container.appendChild(this.sequenceList)

        parentContainer.appendChild(this.container)
        this.render()
    }

    createAddBtn(container, text, color, onClick) {
        const btn = document.createElement('button')
        btn.textContent = text
        btn.style.cssText = `
            background: ${color}; color: white; border: none; padding: 8px 12px; 
            border-radius: 4px; cursor: pointer; font-weight: bold; flex: 1; min-width: 100px;
        `
        btn.onclick = onClick
        container.appendChild(btn)
    }

    addBlock(type) {
        const block = { type: type }
        // Init Defaults
        if (type === 'emit_signal') {
            block.signalName = "game_event"
        } else if (type === 'time_wait') {
            block.duration = 5.0
        }

        this.logicSystem.gameConfig.sequences.push(block)
        this.render()
    }

    render() {
        this.sequenceList.innerHTML = ""
        const seq = this.logicSystem.gameConfig.sequences

        if (seq.length === 0) {
            this.sequenceList.innerHTML = "<div style='color:#666; text-align:center; padding:20px;'>No hay bloques de lógica. Agrega uno arriba.</div>"
            return
        }

        seq.forEach((block, idx) => {
            const item = document.createElement('div')
            item.className = 'game-config-block'
            item.style.cssText = `
                background: #333; padding: 10px; border-radius: 6px; 
                display: flex; align-items: center; gap: 10px; position: relative;
                border-left: 5px solid #555;
            `

            // Color Coding
            if (block.type === 'start_signal' || block.type === 'emit_signal') item.style.borderLeftColor = "#00aa00"
            if (block.type === 'time_wait') item.style.borderLeftColor = "#4444ff"
            if (block.type === 'end_game') item.style.borderLeftColor = "#aa0000"
            if (block.type === 'loop_game') item.style.borderLeftColor = "#880088"

            // Index
            const idxSpan = document.createElement('span')
            idxSpan.textContent = `#${idx + 1}`
            idxSpan.style.color = "#888"
            idxSpan.style.width = "30px"
            item.appendChild(idxSpan)

            // Content based on Type
            const content = document.createElement('div')
            content.style.flex = "1"
            content.style.display = "flex"
            content.style.alignItems = "center"
            content.style.gap = "10px"

            // Unified Signal Handler
            if (block.type === 'start_signal' || block.type === 'emit_signal') {
                content.innerHTML = `<strong>Señal:</strong> `
                const input = this.createTextInput(block.signalName, (val) => block.signalName = val)
                content.appendChild(input)

            } else if (block.type === 'time_wait') {
                content.innerHTML = `<strong>Tiempo:</strong> `

                // Duration Decomposition
                const totalSeconds = block.duration || 0
                const h = Math.floor(totalSeconds / 3600)
                const m = Math.floor((totalSeconds % 3600) / 60)
                const s = Math.floor(totalSeconds % 60)

                const updateDuration = (newH, newM, newS) => {
                    block.duration = (newH * 3600) + (newM * 60) + newS
                }

                // H Input
                const hInput = this.createNumberInput(h, (val) => updateDuration(val, m, s), "H", 40)
                content.appendChild(hInput)
                content.appendChild(document.createTextNode(':'))

                // M Input
                const mInput = this.createNumberInput(m, (val) => updateDuration(h, val, s), "M", 40)
                content.appendChild(mInput)
                content.appendChild(document.createTextNode(':'))

                // S Input
                const sInput = this.createNumberInput(s, (val) => updateDuration(h, m, val), "S", 40)
                content.appendChild(sInput)

            } else if (block.type === 'end_game') {
                content.innerHTML = `<strong>Fin de Partida</strong>`
            } else if (block.type === 'loop_game') {
                content.innerHTML = `<strong>Reiniciar Secuencia (Loop)</strong>`
            }

            item.appendChild(content)

            // Actions (Move/Delete)
            const actions = document.createElement('div')
            actions.style.display = "flex"
            actions.style.gap = "5px"

            // Up
            if (idx > 0) {
                const upBtn = document.createElement('button')
                upBtn.textContent = "▲"
                upBtn.onclick = () => {
                    [seq[idx], seq[idx - 1]] = [seq[idx - 1], seq[idx]]
                    this.render()
                }
                this.styleActionBtn(upBtn)
                actions.appendChild(upBtn)
            }

            // Down
            if (idx < seq.length - 1) {
                const downBtn = document.createElement('button')
                downBtn.textContent = "▼"
                downBtn.onclick = () => {
                    [seq[idx], seq[idx + 1]] = [seq[idx + 1], seq[idx]]
                    this.render()
                }
                this.styleActionBtn(downBtn)
                actions.appendChild(downBtn)
            }

            // Delete
            const delBtn = document.createElement('button')
            delBtn.textContent = "✕"
            delBtn.onclick = () => {
                seq.splice(idx, 1)
                this.render()
            }
            this.styleActionBtn(delBtn, true)
            actions.appendChild(delBtn)

            item.appendChild(actions)
            this.sequenceList.appendChild(item)
        })
    }

    createTextInput(val, onChange) {
        const input = document.createElement('input')
        input.type = 'text'
        input.value = val
        input.style.cssText = "background: #222; border: 1px solid #555; color: white; padding: 2px 5px; width: 120px;"
        input.onchange = (e) => onChange(e.target.value)
        return input
    }

    createNumberInput(val, onChange, placeholder, width = 60) {
        const input = document.createElement('input')
        input.type = 'number'
        input.value = val
        input.min = 0
        input.placeholder = placeholder
        input.style.cssText = `background: #222; border: 1px solid #555; color: white; padding: 2px 5px; width: ${width}px; text-align: center;`
        input.onchange = (e) => onChange(parseFloat(e.target.value) || 0)
        return input
    }

    styleActionBtn(btn, isDestructive = false) {
        btn.style.cssText = `
            background: ${isDestructive ? '#622' : '#444'}; 
            color: white; border: none; width: 24px; height: 24px; 
            border-radius: 4px; cursor: pointer; display: flex; 
            align-items: center; justify-content: center;
        `
    }
}
