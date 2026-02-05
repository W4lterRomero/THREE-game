export class UIPositionSelector {
    constructor() {
        this.overlay = null
        this.onSelectCallback = null
        this.currentValue = 'top-center'
    }

    /**
     * Opens the position selector modal.
     * @param {string} currentPosition - The currently selected position ID (e.g., 'top-left')
     * @param {Function} onSelect - Callback function receiving the new position ID.
     */
    open(currentPosition, onSelect) {
        this.currentValue = currentPosition || 'top-center'
        this.onSelectCallback = onSelect
        this.createUI()
    }

    createUI() {
        if (this.overlay) return // Already open

        // Full Screen Overlay (dimmed)
        this.overlay = document.createElement('div')
        this.overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.85); z-index: 5000;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        `

        // Header / Instructions
        const header = document.createElement('div')
        header.innerHTML = `<h2>Selecciona una Posición</h2><p>Haz clic en una de las zonas resaltadas para ubicar el elemento.</p>`
        header.style.cssText = "color: white; text-align: center; margin-bottom: 20px; font-family: sans-serif;"
        this.overlay.appendChild(header)

        // Screen Simulator Container
        const screenSim = document.createElement('div')
        screenSim.style.cssText = `
            width: 80%; height: 70%; border: 4px solid #444; border-radius: 12px;
            background: #222; position: relative; box-shadow: 0 0 50px rgba(0,0,0,0.5);
            display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr 1fr;
            padding: 20px; gap: 10px;
        `

        // Grid Cells (9 Positions)
        const positions = [
            { id: 'top-left', label: '↖' },
            { id: 'top-center', label: '⬆' },
            { id: 'top-right', label: '↗' },
            { id: 'middle-left', label: '⬅' },
            { id: 'center', label: '●' },
            { id: 'middle-right', label: '➡' },
            { id: 'bottom-left', label: '↙' },
            { id: 'bottom-center', label: '⬇' },
            { id: 'bottom-right', label: '↘' }
        ]

        positions.forEach(pos => {
            const cell = document.createElement('div')
            const isSelected = this.currentValue === pos.id

            cell.style.cssText = `
                border: 2px dashed #555; border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; transition: all 0.2s;
                background: ${isSelected ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
                color: ${isSelected ? '#0f0' : '#888'};
                font-size: 24px; font-weight: bold;
                border-color: ${isSelected ? '#0f0' : '#555'};
            `

            cell.innerHTML = `<span>${pos.label}</span>` // Could add text label too

            cell.onmouseover = () => {
                if (this.currentValue !== pos.id) {
                    cell.style.background = 'rgba(255, 255, 255, 0.1)'
                    cell.style.borderColor = '#888'
                }
            }
            cell.onmouseout = () => {
                const sel = this.currentValue === pos.id
                cell.style.background = sel ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)'
                cell.style.borderColor = sel ? '#0f0' : '#555'
            }

            cell.onclick = () => {
                this.selectPosition(pos.id)
            }

            screenSim.appendChild(cell)
        })

        this.overlay.appendChild(screenSim)

        // Cancel Button
        const cancelBtn = document.createElement('button')
        cancelBtn.textContent = "Cancelar / Cerrar"
        cancelBtn.style.cssText = "margin-top: 20px; padding: 10px 20px; background: #666; border: none; color: white; cursor: pointer; border-radius: 6px; font-size: 16px;"
        cancelBtn.onclick = () => this.close()
        this.overlay.appendChild(cancelBtn)

        document.body.appendChild(this.overlay)
    }

    selectPosition(id) {
        if (this.onSelectCallback) this.onSelectCallback(id)
        this.close()
    }

    close() {
        if (this.overlay) {
            document.body.removeChild(this.overlay)
            this.overlay = null
        }
    }
}
