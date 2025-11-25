import * as THREE from "three"
import { SceneManager } from "./SceneManager.js"
import { InputManager } from "./InputManager.js"
import { Character } from "./Character.js"
import { CameraController } from "./CameraController.js"

class Game {
    constructor() {
        this.sceneManager = new SceneManager("game-container")
        this.inputManager = new InputManager()
        this.character = new Character(this.sceneManager.scene, this.sceneManager.camera)

        this.cameraController = new CameraController(this.sceneManager.camera, this.sceneManager.renderer.domElement)
        this.character.setCameraController(this.cameraController)

        this.setupUI()
        this.setupSettingsPanel()

        this.clock = new THREE.Clock()

        this.animate = this.animate.bind(this)
        requestAnimationFrame(this.animate)
    }

    setupUI() {
        // Create camera mode indicator
        const indicator = document.createElement("div")
        indicator.id = "camera-indicator"
        indicator.innerHTML = `
            <div style="position: fixed; top: 20px; left: 20px; background: rgba(0,0,0,0.7); 
                        color: white; padding: 10px 15px; border-radius: 8px; font-family: sans-serif;
                        font-size: 14px; z-index: 1000;">
                <div id="camera-mode">Third Person</div>
                <div style="font-size: 11px; opacity: 0.7; margin-top: 5px;">
                    [Tab] Cambiar cámara<br>
                    [Click derecho] Rotar cámara<br>
                    [Scroll] Zoom<br>
                    [ESC] Configuración
                </div>
            </div>
        `
        document.body.appendChild(indicator)

        // Listen for camera mode changes
        document.addEventListener("cameraModeChanged", (e) => {
            const modeText = document.getElementById("camera-mode")
            if (modeText) {
                modeText.textContent = e.detail.isFirstPerson ? "First Person" : "Third Person"
            }
            const settingsModeText = document.getElementById("camera-mode-text")
            if (settingsModeText) {
                settingsModeText.textContent = e.detail.isFirstPerson ? "First Person" : "Third Person"
            }
        })
    }

    setupSettingsPanel() {
        const settingsPanel = document.getElementById("settings-panel")
        const overlay = document.getElementById("overlay")
        const resumeBtn = document.getElementById("resume-btn")
        const invertXCheckbox = document.getElementById("invert-x")
        const invertYCheckbox = document.getElementById("invert-y")
        const cameraModeText = document.getElementById("camera-mode-text")

        // Listen for pause state changes
        document.addEventListener("gamePauseChanged", (e) => {
            if (e.detail.isPaused) {
                settingsPanel.style.display = "block"
                overlay.style.display = "block"
                // Sync checkbox states with current settings
                invertXCheckbox.checked = e.detail.invertAxisX
                invertYCheckbox.checked = e.detail.invertAxisY
                cameraModeText.textContent = e.detail.isFirstPerson ? "First Person" : "Third Person"
            } else {
                settingsPanel.style.display = "none"
                overlay.style.display = "none"
            }
        })

        // Resume button click
        resumeBtn.addEventListener("click", () => {
            this.cameraController.togglePause()
        })

        // Overlay click to resume
        overlay.addEventListener("click", () => {
            this.cameraController.togglePause()
        })

        // Invert X axis toggle
        invertXCheckbox.addEventListener("change", (e) => {
            this.cameraController.setInvertAxisX(e.target.checked)
        })

        // Invert Y axis toggle
        invertYCheckbox.addEventListener("change", (e) => {
            this.cameraController.setInvertAxisY(e.target.checked)
        })
    }

    animate() {
        requestAnimationFrame(this.animate)

        const dt = this.clock.getDelta()

        this.character.update(dt, this.inputManager)

        this.cameraController.update(this.character.getPosition(), this.character.getRotation(), dt)

        this.sceneManager.update()
    }
}

// Start the game
new Game()
