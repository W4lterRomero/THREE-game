
import { UIPositionSelector } from "./UIPositionSelector.js"

export class GameConfigPanel {
    constructor(game, logicSystem) {
        this.game = game
        this.logicSystem = logicSystem
        this.container = null
        this.positionSelector = new UIPositionSelector()

        // Register itself for callbacks
        this.logicSystem.configPanel = this

        // Ensure LogicSystem has Config Data
        if (!this.logicSystem.gameConfig) {
            this.logicSystem.gameConfig = {
                sequences: [] // [{ type: 'emit_signal', signal: 'start' }, { type: 'time', duration: 10 }]
            }
        }
    }



    getReadablePosition(pos) {
        if (!pos) return "Top Center"
        switch (pos) {
            case 'top-left': return "↖ Arriba Izq"
            case 'top-center': return "⬆ Arriba Centro"
            case 'top-right': return "↗ Arriba Der"
            case 'middle-left': return "⬅ Medio Izq"
            case 'center': return "● Centro"
            case 'middle-right': return "➡ Medio Der"
            case 'bottom-left': return "↙ Abajo Izq"
            case 'bottom-center': return "⬇ Abajo Centro"
            case 'bottom-right': return "↘ Abajo Der"
            default: return pos
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
            block.timerPosition = 'top-center'
            block.signalStart = ""
            block.signalEnd = ""
            block.intervalSignals = []
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

                // --- Signal Config Button ---
                const signalBtn = document.createElement('button')
                signalBtn.innerHTML = "Editar Señales"
                signalBtn.style.cssText = `
                    margin-top: 5px; width: 100%; background: #333; color: #ddd; 
                    border: 1px dashed #555; padding: 4px; border-radius: 4px; 
                    cursor: pointer; font-size: 11px;
                `
                signalBtn.onmouseenter = () => signalBtn.style.background = "#444"
                signalBtn.onmouseleave = () => signalBtn.style.background = "#333"
                signalBtn.onclick = () => this.openSignalConfig(block)

                content.appendChild(signalBtn)

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

                    // Position Button
                    const posBtn = document.createElement('button')
                    posBtn.textContent = `Posición: ${this.getReadablePosition(block.timerPosition)}`
                    posBtn.style.cssText = "background: #444; color: #fff; border: 1px dashed #777; padding: 2px 8px; font-size: 11px; cursor: pointer; border-radius: 4px;"
                    posBtn.onclick = () => {
                        this.positionSelector.open(block.timerPosition, (newPos) => {
                            block.timerPosition = newPos
                            this.render()
                        })
                    }
                    optionsRow.appendChild(posBtn)
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

    createTimeInputGroup(initialTime, onChange) {
        const container = document.createElement('div')
        container.style.cssText = "display: flex; align-items: center; gap: 2px;"

        // Decompose Time
        let h = Math.floor(initialTime / 3600)
        let m = Math.floor((initialTime % 3600) / 60)
        let s = Math.floor(initialTime % 60)

        const updateTime = () => {
            const total = (h * 3600) + (m * 60) + s
            onChange(total)
        }

        const createInput = (val, setVal, placeholder) => {
            const inp = document.createElement('input')
            inp.type = 'number'
            inp.value = val
            inp.min = 0
            inp.placeholder = placeholder
            inp.style.cssText = "background: #222; border: 1px solid #555; color: white; width: 40px; text-align: center; padding: 2px;"
            inp.onchange = (e) => {
                setVal(parseFloat(e.target.value) || 0)
                updateTime()
            }
            return inp
        }

        container.appendChild(createInput(h, (v) => h = v, "H"))
        container.appendChild(document.createTextNode(":"))
        container.appendChild(createInput(m, (v) => m = v, "M"))
        container.appendChild(document.createTextNode(":"))
        container.appendChild(createInput(s, (v) => s = v, "S"))

        return container
    }

    openSignalConfig(block) {
        // UI Overlay
        const overlay = document.createElement('div')
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.85); z-index: 6000;
            display: flex; align-items: center; justify-content: center;
        `

        const panel = document.createElement('div')
        panel.style.cssText = `
            background: #222; border: 1px solid #444; border-radius: 12px;
            width: 700px; max-height: 80vh; padding: 25px; display: flex; flex-direction: column; gap: 15px;
            box-shadow: 0 0 40px rgba(0,0,0,0.6); font-family: sans-serif;
        `
        overlay.appendChild(panel)

        // Header & Info
        const header = document.createElement('div')
        header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #555; padding-bottom: 10px;"

        const title = document.createElement('h3')
        title.textContent = "Editor de Señales Cronológico"
        title.style.margin = "0"
        title.style.color = "#fff"

        // Duration Info
        const totalSeconds = block.duration || 0
        const h = Math.floor(totalSeconds / 3600)
        const m = Math.floor((totalSeconds % 3600) / 60)
        const s = Math.floor(totalSeconds % 60)
        const durationInfo = document.createElement('div')
        durationInfo.innerHTML = `<span style="color:#aaa;">Duración del Bloque:</span> <span style="color:#0ff; font-family:monospace; font-size:14px;">${h}h ${m}m ${s}s</span>`

        header.appendChild(title)
        header.appendChild(durationInfo)
        panel.appendChild(header)


        // --- Signal Timeline Container ---
        const timeline = document.createElement('div')
        timeline.className = "game-config-scroll"
        timeline.style.cssText = `
            flex: 1; overflow-y: auto; background: #181818; 
            border: 1px solid #333; border-radius: 8px; padding: 10px;
            display: flex; flex-direction: column; gap: 10px;
        `

        // 1. Start Signal (Fixed Top)
        const rowStart = document.createElement('div')
        rowStart.style.cssText = "background: #113311; padding: 10px; border-radius: 6px; border-left: 4px solid #0f0; display: flex; align-items: center; gap: 10px;"

        rowStart.innerHTML = `<strong style="color:#0f0; width: 60px;">T: 0s</strong>`
        const lblStart = document.createElement('span')
        lblStart.textContent = "INICIO DEL BLOQUE"
        lblStart.style.cssText = "flex:1; color: #888; font-size: 12px; font-style: italic;"

        const inputStart = this.createTextInput(block.signalStart || "", (val) => block.signalStart = val)
        inputStart.placeholder = "Nombre señal inicio..."
        inputStart.style.width = "200px"

        rowStart.appendChild(lblStart)
        rowStart.appendChild(inputStart)
        timeline.appendChild(rowStart)

        // 2. Intervals Section (Dynamic)
        const renderIntervals = () => {
            // Sort intervals by time
            if (!block.intervalSignals) block.intervalSignals = []
            block.intervalSignals.sort((a, b) => a.time - b.time)

            // Remove old interval rows (keep start/end fixed, complicated loop, better to rebuild timeline middle)
            // Strategy: Clear timeline content EXCEPT start/end is tricky? 
            // Better Strategy: Re-render the whole inner timeline content.

            // Re-render helper
            timeline.innerHTML = ""
            timeline.appendChild(rowStart) // Re-attach Start

            block.intervalSignals.forEach((intSig, idx) => {
                const row = document.createElement('div')

                // Validation
                const isOutOfRange = intSig.time > (block.duration || 0)
                const borderColor = isOutOfRange ? "#cc0" : "#aaa"
                const bgColor = isOutOfRange ? "#332" : "#2a2a2a"

                row.style.cssText = `background: ${bgColor}; padding: 8px; border-radius: 6px; border-left: 4px solid ${borderColor}; display: flex; align-items: center; gap: 10px;`

                // Time Group
                const timeGroup = this.createTimeInputGroup(intSig.time, (newTime) => {
                    intSig.time = newTime
                    // Force refresh to update validation state immediately
                    renderIntervals()
                })

                // Mode Selector
                const modeSel = document.createElement('select')
                modeSel.style.cssText = `background: #222; color: ${isOutOfRange ? '#cc0' : '#ddd'}; border: 1px solid #555; font-size: 11px; width: 130px;`
                const modes = ["Activar al transcurrir", "Activar en el momento"]
                modes.forEach(m => {
                    const opt = document.createElement('option')
                    opt.value = m
                    opt.textContent = m
                    if (intSig.mode === m) opt.selected = true
                    modeSel.appendChild(opt)
                })
                modeSel.onchange = (e) => intSig.mode = e.target.value

                // Signal Name
                const sIn = this.createTextInput(intSig.signal, (v) => intSig.signal = v)
                sIn.placeholder = "Nombre señal..."
                sIn.style.flex = "1"
                if (isOutOfRange) sIn.style.color = "#cc0"

                // Delete
                const del = document.createElement('button')
                del.textContent = "🗑"
                del.style.cssText = "background: #422; color: #fcc; border: none; padding: 5px; border-radius: 4px; cursor: pointer;"
                del.onclick = () => {
                    block.intervalSignals.splice(idx, 1)
                    renderIntervals()
                }

                // Range Warning Icon
                if (isOutOfRange) {
                    const warn = document.createElement('span')
                    warn.textContent = "⚠"
                    warn.title = "Fuera del rango de duración"
                    warn.style.cssText = "color: #cc0; cursor: help; font-size:14px;"
                    row.appendChild(warn)
                }

                row.appendChild(timeGroup)
                row.appendChild(modeSel)
                row.appendChild(sIn)
                row.appendChild(del)
                timeline.appendChild(row)
            })

            timeline.appendChild(createAddButtonRow())
            timeline.appendChild(rowEnd) // Re-attach End
        }

        // Add Button Row
        const createAddButtonRow = () => {
            const row = document.createElement('div')
            row.style.textAlign = "center"
            row.style.padding = "10px"
            const btn = document.createElement('button')
            btn.innerHTML = "+ Agregar Señal Intermedia"
            btn.style.cssText = "background: #333; color: white; border: 1px dashed #666; width: 100%; padding: 8px; cursor: pointer;"
            btn.onmouseenter = () => btn.style.background = "#444"
            btn.onmouseleave = () => btn.style.background = "#333"
            btn.onclick = () => {
                block.intervalSignals.push({ time: Math.floor((block.duration || 0) / 2), signal: "signal_event", mode: "Activar al transcurrir" })
                renderIntervals()
            }
            row.appendChild(btn)
            return row
        }

        // 3. End Signal (Fixed Bottom)
        const rowEnd = document.createElement('div')
        rowEnd.style.cssText = "background: #331111; padding: 10px; border-radius: 6px; border-left: 4px solid #f44; display: flex; align-items: center; gap: 10px;"

        rowEnd.innerHTML = `<strong style="color:#f44; width: 60px;">T: FIN</strong>`
        const lblEnd = document.createElement('span')
        lblEnd.textContent = "FINAL DEL BLOQUE"
        lblEnd.style.cssText = "flex:1; color: #888; font-size: 12px; font-style: italic;"

        const inputEnd = this.createTextInput(block.signalEnd || "", (val) => block.signalEnd = val)
        inputEnd.placeholder = "Nombre señal final..."
        inputEnd.style.width = "200px"

        rowEnd.appendChild(lblEnd)
        rowEnd.appendChild(inputEnd)

        // Initial Render
        renderIntervals()
        panel.appendChild(timeline)

        // Footer
        const footer = document.createElement('div')
        footer.style.textAlign = "right"
        const closeBtn = document.createElement('button')
        closeBtn.textContent = "Guardar y Cerrar"
        closeBtn.style.cssText = "background: #44f; color: white; border: none; padding: 10px 20px; font-size: 14px; border-radius: 4px; cursor: pointer;"
        closeBtn.onclick = () => {
            document.body.removeChild(overlay)
            this.render()
        }
        footer.appendChild(closeBtn)
        panel.appendChild(footer)

        document.body.appendChild(overlay)
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
