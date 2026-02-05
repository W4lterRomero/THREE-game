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

    updateTimer(timeSeconds, style, position = 'top-center') {
        if (!this.timerElement) {
            this.timerElement = document.createElement('div')
            this.timerElement.id = 'game-timer-display'
            this.container.appendChild(this.timerElement)
        }

        const h = Math.floor(timeSeconds / 3600)
        const m = Math.floor((timeSeconds % 3600) / 60)
        const s = Math.ceil(timeSeconds % 60)

        const pad = (n) => n.toString().padStart(2, '0')
        const text = (h > 0 ? `${pad(h)}:` : '') + `${pad(m)}:${pad(s)}`

        this.timerElement.textContent = text
        this.timerElement.style.display = 'flex'

        // Reset base styles
        this.timerElement.className = ''
        this.timerElement.style.cssText = `
            position: absolute; display: flex; align-items: center; justify-content: center;
        `

        // Apply Position
        this.applyPosition(this.timerElement, position)

        // Apply Styles
        if (style === 'style1') { // Digital Neon
            this.applyNeonStyle(this.timerElement)
        } else if (style === 'style2') { // Minimalist
            this.applyMinimalStyle(this.timerElement)
        } else if (style === 'style3') { // Sports Box
            this.applySportsStyle(this.timerElement)
        } else {
            this.applyNeonStyle(this.timerElement)
        }
    }

    applyPosition(el, pos) {
        const margin = "20px"
        switch (pos) {
            case 'top-left':
                el.style.top = margin; el.style.left = margin;
                break;
            case 'top-center':
                el.style.top = margin; el.style.left = "50%"; el.style.transform = "translateX(-50%)";
                break;
            case 'top-right':
                el.style.top = margin; el.style.right = margin;
                break;
            case 'middle-left':
                el.style.top = "50%"; el.style.left = margin; el.style.transform = "translateY(-50%)";
                break;
            case 'center':
                el.style.top = "50%"; el.style.left = "50%"; el.style.transform = "translate(-50%, -50%)";
                break;
            case 'middle-right':
                el.style.top = "50%"; el.style.right = margin; el.style.transform = "translateY(-50%)";
                break;
            case 'bottom-left':
                el.style.bottom = margin; el.style.left = margin;
                break;
            case 'bottom-center':
                el.style.bottom = margin; el.style.left = "50%"; el.style.transform = "translateX(-50%)";
                break;
            case 'bottom-right':
                el.style.bottom = margin; el.style.right = margin;
                break;
            default: // Default Top Center
                el.style.top = margin; el.style.left = "50%"; el.style.transform = "translateX(-50%)";
                break;
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
