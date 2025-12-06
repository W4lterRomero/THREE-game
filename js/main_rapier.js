import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"
import { SceneManager } from "./SceneManager.js"
import { InputManager } from "./InputManager.js"
import { CameraController } from "./CameraController.js"
import { CharacterRapier } from "./CharacterRapier.js"
import { NetworkManager } from "./NetworkManager.js"
import { ChatManager } from "./ChatManager.js"

class Game {
    constructor() {
        // Init Rapier
        RAPIER.init().then(() => {
            console.log("Rapier Physics Initialized")
            this.initGame()
        })
    }

    initGame() {
        this.sceneManager = new SceneManager("game-container")
        this.inputManager = new InputManager()
        this.clock = new THREE.Clock()

        // Physics World
        let gravity = { x: 0.0, y: -20.0, z: 0.0 }
        this.world = new RAPIER.World(gravity)

        // Local Character
        this.character = new CharacterRapier(
            this.sceneManager.scene,
            this.world,
            this.sceneManager.camera,
            null // Set later
        )

        // Camera Controller
        this.cameraController = new CameraController(
            this.sceneManager.camera,
            this.sceneManager.renderer.domElement
        )
        this.character.cameraController = this.cameraController

        // Network & UI
        this.networkManager = new NetworkManager(this.sceneManager.scene, (id) => {
            console.log("Player joined", id)
            this.updateConnectionStatus(true, id)
        })

        this.chatManager = new ChatManager(this.networkManager)

        // Wire up Chat Events
        this.networkManager.onChatMessage = (playerId, msg) => {
            this.chatManager.addChatMessage(playerId, msg)
        }

        document.addEventListener("chatFocus", () => {
            this.inputManager.enabled = false
        })

        document.addEventListener("chatBlur", () => {
            this.inputManager.enabled = true
        })

        this.setupSettingsPanel()
        this.setupMultiplayerUI()

        // Environment (Rapier Rigidbody + Three Mesh)
        this.buildEnvironment()

        // Debug
        this.debugEnabled = false
        this.setupDebugRender()

        // Loop
        this.animate = this.animate.bind(this)
        requestAnimationFrame(this.animate)
    }

    buildEnvironment() {
        // Helper to add Box
        const addStaticBox = (x, y, z, w, h, d, color, rotation = { x: 0, y: 0, z: 0 }) => {
            // Three
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(w, h, d),
                new THREE.MeshStandardMaterial({ color: color })
            )
            mesh.position.set(x, y, z)
            mesh.rotation.set(rotation.x, rotation.y, rotation.z)
            mesh.receiveShadow = true
            mesh.castShadow = true
            this.sceneManager.scene.add(mesh)

            // Rapier
            // RigidBody
            let dt = new THREE.Vector3(x, y, z)
            let dr = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x, rotation.y, rotation.z))

            let bodyDesc = RAPIER.RigidBodyDesc.fixed()
                .setTranslation(dt.x, dt.y, dt.z)
                .setRotation(dr)
            let body = this.world.createRigidBody(bodyDesc)

            // Collider
            let colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
            this.world.createCollider(colliderDesc, body)
        }

        // Floor
        addStaticBox(0, -0.5, 0, 100, 1, 100, 0x333333)

        // Platform
        addStaticBox(5, 1, 0, 4, 2, 4, 0x4488ff)

        // --- RAMPS (Using the same test ramps as before) ---

        // 1. Green (Low Angle ~15deg)
        // Length 8, Height 2
        // Tan(a) = 2/8 -> atan(0.25) = 14 deg = 0.24 rad
        const angle1 = Math.atan2(2, 8)
        const hyp1 = Math.sqrt(8 * 8 + 2 * 2)
        // Center: x=-8, y=1 (0 + h/2), z=-5 + 8/2 = -1 (approx center of ramp footprint)
        // Actually center logic: Start(-8, 0, -5). End(-8, 2, -5+8).
        // Mid: (-8, 1, -1)
        addStaticBox(-8, 1, -1, 2, 0.2, hyp1, 0x00ff00, { x: -angle1, y: 0, z: 0 })
        // Top Platform
        addStaticBox(-8, 1.5, -1 + 4 + 2, 4, 1, 4, 0x00ff00)


        // 2. Yellow (Medium Angle ~30deg)
        // Length 5, Height 3
        // atan(0.6) = 31 deg
        const angle2 = Math.atan2(3, 5)
        const hyp2 = Math.sqrt(5 * 5 + 3 * 3)
        addStaticBox(-12, 1.5, -2, 2, 0.2, hyp2, 0xffff00, { x: -angle2, y: 0, z: 0 })
        // Top Platform
        addStaticBox(-12, 2.5, -2 + 2.5 + 2, 4, 1, 4, 0xffff00)


        // 3. Red (Steep Angle ~53deg)
        // Length 3, Height 4
        // atan(1.33) = 53 deg
        // Rapier Controller maxSlopeClimbAngle should block this (set to 45 deg)
        const angle3 = Math.atan2(4, 3)
        const hyp3 = Math.sqrt(3 * 3 + 4 * 4)
        addStaticBox(-16, 2, -3, 2, 0.2, hyp3, 0xff0000, { x: -angle3, y: 0, z: 0 })
        // Top Platform
        addStaticBox(-16, 3.5, -3 + 1.5 + 2, 4, 1, 4, 0xff0000)
    }

    animate() {
        requestAnimationFrame(this.animate)

        const dt = this.clock.getDelta()

        // Step Physics 
        this.world.step()

        // Character Update
        this.character.update(dt, this.inputManager)

        // Camera Update
        this.cameraController.update(this.character.getPosition(), this.character.getRotation(), dt)

        // Network Update
        if (this.networkManager) {
            this.networkManager.update(dt)

            // Send local state
            if (this.character) {
                this.networkManager.sendPlayerUpdate(
                    this.character.getPosition(),
                    this.character.getRotation(),
                    this.character.currentAction ? this.character.currentAction.getClip().name : "Idle"
                )
            }

            // Update Player Count UI
            const countEl = document.getElementById("player-count")
            if (countEl) countEl.textContent = `Jugadores: ${this.networkManager.getPlayerCount()}`
        }

        // Render
        this.updateDebugRender()
        this.sceneManager.update()
    }

    setupDebugRender() {
        this.debugMesh = new THREE.LineSegments(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0xffffff, vertexColors: true })
        )
        this.debugMesh.frustumCulled = false
        this.debugMesh.visible = false
        this.sceneManager.scene.add(this.debugMesh)
    }

    updateDebugRender() {
        if (!this.debugEnabled) return

        const buffers = this.world.debugRender()
        const vertices = buffers.vertices
        const colors = buffers.colors

        this.debugMesh.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
        this.debugMesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4))
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

        const showNamesCheckbox = document.getElementById("show-names")
        if (showNamesCheckbox) {
            showNamesCheckbox.addEventListener("change", (e) => {
                this.networkManager.setShowPlayerNames(e.target.checked)
            })
        }
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

        const debugCheckbox = document.getElementById("debug-collisions")
        if (debugCheckbox) {
            debugCheckbox.addEventListener("change", (e) => {
                this.debugEnabled = e.target.checked
                if (this.debugMesh) this.debugMesh.visible = e.target.checked
            })
        }
    }
}

new Game()
