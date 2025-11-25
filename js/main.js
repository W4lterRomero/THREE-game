import * as THREE from "three"
import { SceneManager } from "./SceneManager.js"
import { InputManager } from "./InputManager.js"
import { Character } from "./Character.js"
import { CameraController } from "./CameraController.js"
import { NPC } from "./NPC.js"
import { NetworkManager } from "./NetworkManager.js"

class Game {
    constructor() {
        this.sceneManager = new SceneManager("game-container")
        this.inputManager = new InputManager()
        this.character = new Character(this.sceneManager.scene, this.sceneManager.camera)
        this.npc = new NPC(this.sceneManager.scene, new THREE.Vector3(5, 0, 5))

        this.cameraController = new CameraController(this.sceneManager.camera, this.sceneManager.renderer.domElement)
        this.character.setCameraController(this.cameraController)

        this.networkManager = new NetworkManager(this.sceneManager.scene, (playerId) => {
            console.log(`[Game] Connected as player: ${playerId}`)
            this.updateConnectionStatus(true, playerId)
        })

        this.setupSettingsPanel()
        this.setupMultiplayerUI()

        this.clock = new THREE.Clock()

        this.animate = this.animate.bind(this)
        requestAnimationFrame(this.animate)
    }

    setupMultiplayerUI() {
        const panel = document.createElement("div")
        panel.id = "multiplayer-panel"
        panel.innerHTML = `
            <div class="mp-header">Multijugador</div>
            <div class="mp-status" id="connection-status">Desconectado</div>
            <input type="text" id="server-url" placeholder="ws://localhost:8080" value="ws://localhost:8080">
            <button id="connect-btn">Conectar</button>
            <div class="mp-players" id="player-count">Jugadores: 0</div>
        `
        document.body.appendChild(panel)

        const style = document.createElement("style")
        style.textContent = `
            #multiplayer-panel {
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                border: 1px solid #444;
                border-radius: 8px;
                padding: 15px;
                color: white;
                font-family: 'Segoe UI', sans-serif;
                min-width: 200px;
                z-index: 100;
            }
            .mp-header {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 10px;
                border-bottom: 1px solid #444;
                padding-bottom: 8px;
            }
            .mp-status {
                font-size: 14px;
                padding: 6px 10px;
                border-radius: 4px;
                margin-bottom: 10px;
                text-align: center;
            }
            .mp-status.connected {
                background: #2e7d32;
                color: #a5d6a7;
            }
            .mp-status.disconnected {
                background: #c62828;
                color: #ef9a9a;
            }
            #server-url {
                width: 100%;
                padding: 8px;
                border: 1px solid #555;
                border-radius: 4px;
                background: #333;
                color: white;
                margin-bottom: 8px;
                box-sizing: border-box;
            }
            #connect-btn {
                width: 100%;
                padding: 10px;
                background: #4CAF50;
                border: none;
                border-radius: 4px;
                color: white;
                font-weight: bold;
                cursor: pointer;
                transition: background 0.2s;
            }
            #connect-btn:hover {
                background: #45a049;
            }
            #connect-btn.disconnect {
                background: #f44336;
            }
            #connect-btn.disconnect:hover {
                background: #d32f2f;
            }
            .mp-players {
                margin-top: 10px;
                font-size: 13px;
                color: #aaa;
                text-align: center;
            }
        `
        document.head.appendChild(style)

        const connectBtn = document.getElementById("connect-btn")
        const serverUrlInput = document.getElementById("server-url")

        connectBtn.addEventListener("click", () => {
            if (this.networkManager.isConnected) {
                this.networkManager.disconnect()
                this.updateConnectionStatus(false)
            } else {
                const url = serverUrlInput.value.trim()
                if (url) {
                    this.networkManager.connect(url)
                }
            }
        })
    }

    updateConnectionStatus(connected, playerId = null) {
        const statusEl = document.getElementById("connection-status")
        const connectBtn = document.getElementById("connect-btn")

        if (connected) {
            statusEl.textContent = `Conectado: ${playerId?.slice(-6) || ""}`
            statusEl.className = "mp-status connected"
            connectBtn.textContent = "Desconectar"
            connectBtn.className = "disconnect"
        } else {
            statusEl.textContent = "Desconectado"
            statusEl.className = "mp-status disconnected"
            connectBtn.textContent = "Conectar"
            connectBtn.className = ""
        }
    }

    setupSettingsPanel() {
        const settingsPanel = document.getElementById("settings-panel")
        const overlay = document.getElementById("overlay")
        const resumeBtn = document.getElementById("resume-btn")
        const invertXCheckbox = document.getElementById("invert-x")
        const invertYCheckbox = document.getElementById("invert-y")
        const cameraModeText = document.getElementById("camera-mode-text")

        document.addEventListener("gamePauseChanged", (e) => {
            if (e.detail.isPaused) {
                settingsPanel.style.display = "block"
                overlay.style.display = "block"
                invertXCheckbox.checked = e.detail.invertAxisX
                invertYCheckbox.checked = e.detail.invertAxisY
                cameraModeText.textContent = e.detail.isFirstPerson ? "First Person" : "Third Person"
            } else {
                settingsPanel.style.display = "none"
                overlay.style.display = "none"
            }
        })

        resumeBtn.addEventListener("click", () => {
            this.cameraController.togglePause()
        })

        overlay.addEventListener("click", () => {
            this.cameraController.togglePause()
        })

        invertXCheckbox.addEventListener("change", (e) => {
            this.cameraController.setInvertAxisX(e.target.checked)
        })

        invertYCheckbox.addEventListener("change", (e) => {
            this.cameraController.setInvertAxisY(e.target.checked)
        })
    }

    animate() {
        requestAnimationFrame(this.animate)

        const dt = this.clock.getDelta()

        this.character.update(dt, this.inputManager)
        this.npc.update(dt)

        this.networkManager.update(dt)

        if (this.networkManager.isConnected && this.character.model) {
            const position = this.character.getPosition()
            const rotation = this.character.getRotation()
            const animation = this.character.currentAction === this.character.animations["Run"] ? "Run" : "Idle"
            this.networkManager.sendPlayerUpdate(position, rotation, animation)
        }

        const playerCountEl = document.getElementById("player-count")
        if (playerCountEl) {
            playerCountEl.textContent = `Jugadores: ${this.networkManager.getPlayerCount()}`
        }

        this.cameraController.update(this.character.getPosition(), this.character.getRotation(), dt)

        this.sceneManager.update()
    }
}

new Game()
