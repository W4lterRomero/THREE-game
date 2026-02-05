
export class GameConfigPanel {
    constructor(game, logicSystem) {
        this.game = game
        this.logicSystem = logicSystem
        this.container = null

        // Register itself for callbacks
        this.logicSystem.configPanel = this

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
            position: relative;
        `

        // Inject Styles for Scrollbar
        const style = document.createElement('style')
        style.innerHTML = `
            .game-config-scroll::-webkit-scrollbar { width: 8px; }
            .game-config-scroll::-webkit-scrollbar-track { background: #111; border-radius: 4px; }
            .game-config-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
            .game-config-scroll::-webkit-scrollbar-thumb:hover { background: #666; }
            .active-logic-block { 
                border: 2px solid #00FFFF !important; 
                box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
                transition: all 0.2s;
            }
        `
        this.container.appendChild(style)

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

        // Simulation Controls
        this.createSimulationControls(this.container)

        // Sequence List Area
        this.sequenceList = document.createElement('div')
        this.sequenceList.className = "game-config-scroll" // Apply scroll class
        this.sequenceList.style.cssText = `
            flex: 1; overflow-y: auto; 
            background: #1a1a1a; border: 1px solid #333; border-radius: 8px;
            padding: 10px; display: flex; flex-direction: column; gap: 5px;
        `
        this.container.appendChild(this.sequenceList)

        parentContainer.appendChild(this.container)
        this.render()
    }

    createSimulationControls(container) {
        const simCtn = document.createElement('div')
        simCtn.style.cssText = "display: flex; gap: 5px; background: #222; padding: 8px; border-radius: 6px; align-items: center; border: 1px solid #444;"

        const label = document.createElement('span')
        label.textContent = "Simulación:"
        label.style.cssText = "font-size: 11px; color: #aaa; margin-right: 5px;"
        simCtn.appendChild(label)

        // Helper
        const createCtrlBtn = (icon, title, color, onClick) => {
            const btn = document.createElement('button')
            btn.innerHTML = icon
            btn.title = title
            btn.style.cssText = `
                background: #333; color: ${color}; border: 1px solid #555; 
                width: 30px; height: 30px; border-radius: 4px; cursor: pointer;
                display: flex; align-items: center; justify-content: center; font-size: 14px;
            `
            btn.onclick = onClick
            btn.onmouseenter = () => { if (btn.dataset.active !== "true") btn.style.background = "#444" }
            btn.onmouseleave = () => { if (btn.dataset.active !== "true") btn.style.background = "#333" }
            simCtn.appendChild(btn)
            return btn
        }

        this.playBtn = createCtrlBtn("▶", "Iniciar Simulación", "#0f0", () => this.logicSystem.playConfig())
        this.pauseBtn = createCtrlBtn("⏸", "Pausar", "#fa0", () => this.logicSystem.pauseConfig())
        const stopBtn = createCtrlBtn("⏹", "Detener / Reiniciar", "#f44", () => this.logicSystem.stopConfig())

        // Separator
        const sep = document.createElement('div')
        sep.style.cssText = "width: 1px; height: 20px; background: #555; margin: 0 5px;"
        simCtn.appendChild(sep)

        createCtrlBtn("⏮", "Bloque Anterior", "#fff", () => this.logicSystem.stepConfig(-1))
        createCtrlBtn("⏭", "Bloque Siguiente", "#fff", () => this.logicSystem.stepConfig(1))

        // Time Display
        const timeContainer = document.createElement('div')
        timeContainer.style.cssText = "margin-left: auto; display: flex; align-items: center; gap: 5px;"

        const timeIcon = document.createElement('span')
        timeIcon.textContent = "⏱"
        timeIcon.style.fontSize = "12px"
        timeContainer.appendChild(timeIcon)

        this.timeDisplay = document.createElement('span')
        this.timeDisplay.textContent = "00:00"
        this.timeDisplay.style.cssText = "font-family: monospace; font-size: 14px; color: #0ff;"
        timeContainer.appendChild(this.timeDisplay)

        simCtn.appendChild(timeContainer)

        container.appendChild(simCtn)
    }

    updatePlayState(isPlaying, isPaused) {
        if (!this.playBtn || !this.pauseBtn) return

        if (isPlaying && !isPaused) {
            this.playBtn.style.background = "#050" // Active Green
            this.playBtn.dataset.active = "true"
            this.pauseBtn.style.background = "#333"
            this.pauseBtn.dataset.active = "false"
        } else if (isPaused) {
            this.playBtn.style.background = "#333"
            this.playBtn.dataset.active = "false"
            this.pauseBtn.style.background = "#530" // Active Orange
            this.pauseBtn.dataset.active = "true"
        } else {
            // Stopped
            this.playBtn.style.background = "#333"
            this.playBtn.dataset.active = "false"
            this.pauseBtn.style.background = "#333"
            this.pauseBtn.dataset.active = "false"
        }
    }

    updateTotalTime(seconds) {
        if (!this.timeDisplay) return
        const m = Math.floor(seconds / 60)
        const s = Math.floor(seconds % 60)
        this.timeDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    highlightBlock(index) {
        if (!this.sequenceList) return
        const children = Array.from(this.sequenceList.children)

        children.forEach((child, idx) => {
            if (idx === index) {
                child.classList.add('active-logic-block')
                child.scrollIntoView({ behavior: 'smooth', block: 'center' })
            } else {
                child.classList.remove('active-logic-block')
            }
        })
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
            block.showTimer = false
            block.timerStyle = 'style1'
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
                content.style.flexDirection = "column"
                content.style.alignItems = "flex-start"

                // --- Row 1: Time Inputs ---
                const timeRow = document.createElement('div')
                timeRow.style.display = "flex"
                timeRow.style.alignItems = "center"
                timeRow.style.gap = "5px"
                timeRow.innerHTML = `<strong>Duración:</strong> `

                // Duration Decomposition
                const totalSeconds = block.duration || 0
                const h = Math.floor(totalSeconds / 3600)
                const m = Math.floor((totalSeconds % 3600) / 60)
                const s = Math.floor(totalSeconds % 60)

                const updateDuration = (newH, newM, newS) => {
                    block.duration = (newH * 3600) + (newM * 60) + newS
                }

                // Helper for Labeled Input
                const createLabeledInput = (val, cb, label) => {
                    const wrapper = document.createElement('div')
                    wrapper.style.display = "flex"
                    wrapper.style.flexDirection = "column"
                    wrapper.style.alignItems = "center"

                    const input = this.createNumberInput(val, cb, "", 40)

                    const lbl = document.createElement('span')
                    lbl.textContent = label
                    lbl.style.fontSize = "10px"
                    lbl.style.color = "#888"

                    wrapper.appendChild(input)
                    wrapper.appendChild(lbl)
                    return wrapper
                }

                // H Input
                timeRow.appendChild(createLabeledInput(h, (val) => updateDuration(val, m, s), "Hora"))
                timeRow.appendChild(document.createTextNode(':'))

                // M Input
                timeRow.appendChild(createLabeledInput(m, (val) => updateDuration(h, val, s), "Minuto"))
                timeRow.appendChild(document.createTextNode(':'))

                // S Input
                timeRow.appendChild(createLabeledInput(s, (val) => updateDuration(h, m, val), "Segundo"))

                content.appendChild(timeRow)

                // --- Row 2: HUD Options ---
                const optionsRow = document.createElement('div')
                optionsRow.style.display = "flex"
                optionsRow.style.gap = "15px"
                optionsRow.style.alignItems = "center"
                optionsRow.style.marginTop = "5px"

                // Checkbox
                const chkLabel = document.createElement('label')
                chkLabel.style.display = "flex"
                chkLabel.style.alignItems = "center"
                chkLabel.style.gap = "5px"
                chkLabel.style.fontSize = "12px"
                chkLabel.style.color = "#ddd"
                chkLabel.style.cursor = "pointer"

                const chk = document.createElement('input')
                chk.type = "checkbox"
                chk.checked = block.showTimer || false
                chk.onchange = (e) => {
                    block.showTimer = e.target.checked
                    this.render() // Re-render to show/hide style select potentially
                }
                chkLabel.appendChild(chk)
                chkLabel.appendChild(document.createTextNode("Mostrar en Juego"))
                optionsRow.appendChild(chkLabel)

                // Style Select (Only if checked)
                if (block.showTimer) {
                    const selLabel = document.createElement('label')
                    selLabel.style.display = "flex"
                    selLabel.style.alignItems = "center"
                    selLabel.style.gap = "5px"
                    selLabel.style.fontSize = "12px"
                    selLabel.style.color = "#ddd"

                    selLabel.appendChild(document.createTextNode("Estilo:"))

                    const sel = document.createElement('select')
                    sel.style.background = "#222"
                    sel.style.color = "white"
                    sel.style.border = "1px solid #555"
                    sel.style.fontSize = "11px"
                    sel.style.padding = "2px"

                    const styles = [
                        { id: 'style1', name: 'Digital Neon' },
                        { id: 'style2', name: 'Minimalista' },
                        { id: 'style3', name: 'Caja Deportiva' }
                    ]

                    styles.forEach(st => {
                        const opt = document.createElement('option')
                        opt.value = st.id
                        opt.textContent = st.name
                        if (block.timerStyle === st.id) opt.selected = true
                        sel.appendChild(opt)
                    })

                    sel.onchange = (e) => block.timerStyle = e.target.value
                    selLabel.appendChild(sel)
                    optionsRow.appendChild(selLabel)
                }

                content.appendChild(optionsRow)

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
