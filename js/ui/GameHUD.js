export class GameHUD {
    constructor() {
        this.container = document.createElement('div')
        this.container.id = 'game-hud-layer'
        this.container.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none; z-index: 1000;
        `
        document.body.appendChild(this.container)

        this.timerElement = null
    }

    updateTimer(timeSeconds, style) {
        if (!this.timerElement) {
            this.timerElement = document.createElement('div')
            this.timerElement.id = 'game-timer-display'
            this.container.appendChild(this.timerElement)
        }

        // Format: MM:SS (or HH:MM:SS if needed, keeping it compact logic from before)
        const h = Math.floor(timeSeconds / 3600)
        const m = Math.floor((timeSeconds % 3600) / 60)
        // Ceil seconds so it doesn't stay on "0" for a whole second before finishing
        // Actually, floor is standard for "time passed", ceil for "time remaining"? 
        // LogicSystem calculates remaining. Let's use Ceil for countdown feel.
        const s = Math.ceil(timeSeconds % 60)

        // Adjust cascading if s=60 (edge case with ceil) usually handling in logic is better
        // Let's stick to floor for consistent 5...4...3...0
        // Or if user wants to see "5" when 4.9s remains. 

        const pad = (n) => n.toString().padStart(2, '0')
        const text = (h > 0 ? `${pad(h)}:` : '') + `${pad(m)}:${pad(s)}`

        this.timerElement.textContent = text
        this.timerElement.style.display = 'flex'

        // Reset base styles to avoid conflict
        this.timerElement.className = ''
        this.timerElement.style.cssText = `
            position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
            display: flex; align-items: center; justify-content: center;
        `

        // Apply Styles
        if (style === 'style1') { // Digital Neon
            this.applyNeonStyle(this.timerElement)
        } else if (style === 'style2') { // Minimalist
            this.applyMinimalStyle(this.timerElement)
        } else if (style === 'style3') { // Sports Box
            this.applySportsStyle(this.timerElement)
        } else {
            // Default Fallback
            this.applyNeonStyle(this.timerElement)
        }
    }

    hideTimer() {
        if (this.timerElement) {
            this.timerElement.style.display = 'none'
        }
    }

    // --- STYLES ---

    applyNeonStyle(el) {
        el.style.fontFamily = "'Courier New', monospace"
        el.style.fontSize = "40px"
        el.style.fontWeight = "bold"
        el.style.color = "#0ff"
        el.style.textShadow = "0 0 10px #0ff, 0 0 20px #0ff"
        el.style.background = "rgba(0, 0, 0, 0.6)"
        el.style.padding = "10px 30px"
        el.style.borderRadius = "8px"
        el.style.border = "2px solid #0ff"
        el.style.boxShadow = "0 0 15px rgba(0, 255, 255, 0.3)"
    }

    applyMinimalStyle(el) {
        el.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        el.style.fontSize = "48px"
        el.style.fontWeight = "300"
        el.style.color = "#ffffff"
        el.style.textShadow = "0 2px 4px rgba(0,0,0,0.5)"
    }

    applySportsStyle(el) {
        el.style.fontFamily = "Impact, sans-serif"
        el.style.fontSize = "36px"
        el.style.color = "#FFD700" // Gold
        el.style.background = "linear-gradient(180deg, #333, #111)"
        el.style.padding = "5px 40px"
        el.style.borderRadius = "4px"
        el.style.border = "2px solid #555"
        el.style.borderBottom = "4px solid #333"
        el.style.boxShadow = "0 4px 10px rgba(0,0,0,0.5)"
        el.style.letterSpacing = "2px"
    }
}
