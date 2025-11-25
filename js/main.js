import * as THREE from "three"
import { SceneManager } from "./SceneManager.js"
import { InputManager } from "./InputManager.js"
import { Character } from "./Character.js"
import { CameraController } from "./CameraController.js"
import { NPC } from "./NPC.js"

class Game {
    constructor() {
        this.sceneManager = new SceneManager("game-container")
        this.inputManager = new InputManager()
        this.character = new Character(this.sceneManager.scene, this.sceneManager.camera)
        this.npc = new NPC(this.sceneManager.scene, new THREE.Vector3(5, 0, 5))

        this.cameraController = new CameraController(this.sceneManager.camera, this.sceneManager.renderer.domElement)
        this.character.setCameraController(this.cameraController)

        this.setupSettingsPanel()

        this.clock = new THREE.Clock()

        this.animate = this.animate.bind(this)
        requestAnimationFrame(this.animate)
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
        this.npc.update(dt)

        this.cameraController.update(this.character.getPosition(), this.character.getRotation(), dt)

        this.sceneManager.update()
    }
}

// Start the game
new Game()
