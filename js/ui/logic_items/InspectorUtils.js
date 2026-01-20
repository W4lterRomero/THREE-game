
export const InspectorUtils = {
    createNumberInput(label, onChange, min = -Infinity, step = 0.5, color = null, initialValue = 0) {
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
        input.value = initialValue
        input.onchange = (e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange(v)
        }

        container.appendChild(lbl)
        container.appendChild(input)
        return { container, input }
    }
}
