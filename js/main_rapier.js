import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"
import { SceneManager } from "./SceneManager.js"
import { InputManager } from "./InputManager.js"
import { CameraController } from "./CameraController.js"
import { CharacterRapier } from "./CharacterRapier.js"
import { NetworkManager } from "./NetworkManager.js"
import { ChatManager } from "./ChatManager.js"
import { NPCRapier } from "./NPCRapier.js"
import { LevelBuilder } from "./environment/LevelBuilder.js"
import { LevelLoader } from "./environment/LevelLoader.js"
import { ImpulsePlatform } from "./ImpulsePlatform.js"
import { PlacementManager } from "./PlacementManager.js"
import { InventoryManager } from "./item/InventoryManager.js"
import { ItemDropManager } from "./item/ItemDropManager.js"
import { ImpulseItem } from "./item/ImpulseItem.js"
import { FarmingZone } from "./FarmingZone.js"
import { FuegoItem } from "./item/FuegoItem.js"
import { FarmingSettings } from "./FarmingSettings.js"
import { TurretItem } from "./item/TurretItem.js"
import { TurretPad } from "./TurretPad.js"
import { PelotaItem } from "./item/PelotaItem.js"
import { MapObjectItem } from "./item/MapObjectItem.js"

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

        // Game Mode Check
        const urlParams = new URLSearchParams(window.location.search);
        this.gameMode = urlParams.get('mode') || 'play'; // 'play' or 'editor'

        // Local Character
        this.character = new CharacterRapier(
            this.sceneManager.scene,
            this.world,
            this.sceneManager.camera,
            null // Set later
        )
        if (this.gameMode === 'editor') {
            this.character.canFly = true;
            console.log("Editor Mode Enabled: Flight Active");
        }

        // Camera Controller
        this.cameraController = new CameraController(
            this.sceneManager.camera,
            this.sceneManager.renderer.domElement
        )
        this.character.cameraController = this.cameraController

        // Network & UI
        this.networkManager = new NetworkManager(this.sceneManager.scene, this.world, (id) => {
            console.log("Player joined", id)
            this.updateConnectionStatus(true, id)
        })

        this.chatManager = new ChatManager(this.networkManager)

        // Manager de colocación
        this.placementManager = new PlacementManager(this.sceneManager.scene, this.sceneManager.camera)

        // NPC
        this.npc = new NPCRapier(
            this.sceneManager.scene,
            this.world,
            new THREE.Vector3(0, 0, -15), // posicion inicial
            [new THREE.Vector3(0, 0, -15), new THREE.Vector3(5, 0, -15), new THREE.Vector3(5, 0, -10), new THREE.Vector3(0, 0, -10)] // patron de movimiento
        )


        // Impulse Platforms
        this.platforms = []
        this.projectiles = [] // Array for active projectiles

        // 1. Forward Boost (Rotatable)
        // Positioned in front of spawn
        const forwardPad = new ImpulsePlatform(
            this.sceneManager.scene,
            this.world,
            new THREE.Vector3(0, 0.1, 10), // Position
            new THREE.Vector3(1, 0, 0),    // Direction (Forward Z+)
            25.0,                          // Strength
            "pad"
        )
        this.platforms.push(forwardPad)

        // 2. Upward Jump Pad
        const jumpPad = new ImpulsePlatform(
            this.sceneManager.scene,
            this.world,
            new THREE.Vector3(5, 0.1, 10), // Side
            new THREE.Vector3(0, 1, 0),    // Direction (Up)
            25.0,                          // Strength (Needs high value to overcome gravity/mass?) 
            // Note: applyImpulse in Character assigns direct vertical velocity if Y > 0.
            "pad"
        )
        this.platforms.push(jumpPad)

        // 3. Farming Zone
        // moved to after itemDropManager init


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

        // --- New Inventory System ---
        this.inventoryManager = new InventoryManager("inventory-container")
        this.itemDropManager = new ItemDropManager(this.sceneManager.scene, this.world)

        // Farming Zone (Now that itemDropManager exists)
        this.fuegoCount = 0
        this.farmingZone = new FarmingZone(
            this.sceneManager.scene,
            this.itemDropManager,
            new THREE.Vector3(-5, 0.1, 10)
        )
        // Farming Settings
        this.farmingSettings = new FarmingSettings(this.farmingZone)
        // Move Logic State
        this.fKeyHeldTime = 0
        this.isMovingFarmingZone = false
        this.isFKeyDown = false

        // Ghost for Moving Farming Zone
        this.moveGhost = new THREE.Mesh(
            new THREE.BoxGeometry(3, 0.2, 3),
            new THREE.MeshBasicMaterial({ color: 0xFF4500, transparent: true, opacity: 0.5, wireframe: true })
        )
        this.moveGhost.visible = false
        this.sceneManager.scene.add(this.moveGhost)

        if (this.gameMode === 'editor') {
            // Editor Items
            const wall = new MapObjectItem("wall_1", "Pared", "wall", "./assets/textures/impulso.png", 0x888888, { x: 4, y: 3, z: 0.5 })
            const pillar = new MapObjectItem("pillar_1", "Pilar", "pillar", "./assets/textures/salto.png", 0xFFFFFF, { x: 1, y: 4, z: 1 })
            const floor = new MapObjectItem("floor_1", "Suelo", "wall", "./assets/textures/impulso.png", 0x333333, { x: 5, y: 0.5, z: 5 })
            const ramp = new MapObjectItem("ramp_1", "Rampa", "ramp", "./assets/textures/impulso.png", 0xFFA500, { x: 4, y: 2, z: 4 })

            this.inventoryManager.addItem(wall)
            this.inventoryManager.addItem(pillar)
            this.inventoryManager.addItem(floor)
            this.inventoryManager.addItem(ramp)
        } else {
            // Seed Inventory (Normal)
            const item1 = new ImpulseItem("pad_lat", "Impulso Lateral", "./assets/textures/impulso.png", "lateral", 25.0)
            const item2 = new ImpulseItem("pad_jump", "Salto Vertical", "./assets/textures/salto.png", "jump", 35.0)
            const item3 = new TurretItem("pad_turret", "Torreta", "./assets/textures/impulso.png")
            const item4 = new PelotaItem("pelota", "Lanzador de Pelotas", "./assets/textures/pelota.png", 10, 10, 30, 1.0)

            this.inventoryManager.addItem(item1)
            this.inventoryManager.addItem(item2)
            this.inventoryManager.addItem(item3)
            this.inventoryManager.addItem(item4)
        }

        this.setupGameInput() // Replaces setupInventory logic for interactions

        // Environment (Rapier Rigidbody + Three Mesh)
        // Environment (Rapier Rigidbody + Three Mesh)
        this.buildEnvironment()

        // Load Test Map (Offset by 30 units, Scale 0.01)
        this.loadLevelFromFile(
            "https://threejs.org/examples/models/gltf/LittlestTokyo.glb",
            new THREE.Vector3(0, 8, 25),
            new THREE.Vector3(0.04, 0.04, 0.04)
        )

        // Debug
        this.debugEnabled = false
        this.setupDebugRender()

        // Loop
        this.animate = this.animate.bind(this)
        requestAnimationFrame(this.animate)
    }

    buildEnvironment() {
        // Use the new LevelBuilder
        this.levelBuilder = new LevelBuilder(this.sceneManager.scene, this.world)
        this.levelBuilder.build()

        // Pass ladders to character if character exists
        if (this.character) {
            this.character.ladders = this.levelBuilder.ladders
        }
    }

    /**
     * Example of how to load a GLTF map
     * Use offset to place it away from generated geometry
     */
    async loadLevelFromFile(url, position, scale) {
        this.levelLoader = new LevelLoader(this.sceneManager.scene, this.world)
        try {
            await this.levelLoader.load(url, position, scale)
            console.log("Map loaded successfully")

            if (this.character) {
                // Append loaded ladders to character's ladder list (or replace)
                // If we want to support multiple sources, we should concat.
                // For now, simpler to just add them.
                if (this.levelLoader.ladders.length > 0) {
                    this.character.ladders = this.character.ladders.concat(this.levelLoader.ladders)
                }
            }
        } catch (e) {
            console.error("Failed to load map, falling back to procedural", e)
            this.buildEnvironment()
        }
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

        // NPC Update
        if (this.npc) this.npc.update(dt)

        // Platforms Update
        // Platforms Update
        if (this.platforms) {
            this.platforms.forEach(p => p.update(this.character))
        }

        // Projectiles Update
        if (this.projectiles) {
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const proj = this.projectiles[i]
                proj.update(dt)
                if (proj.isDead) {
                    this.projectiles.splice(i, 1)
                }
            }
        }

        // Weapon Auto-Fire Logic
        if (this.isMouseDown && this.inventoryManager) {
            const currentItem = this.inventoryManager.getCurrentItem()
            if (currentItem instanceof PelotaItem) {
                this.useCurrentItem(currentItem) // Pass item directly optimization
            }
        }

        // Dropped Items Update
        if (this.itemDropManager) {
            this.itemDropManager.update(dt, this.clock.getElapsedTime())

            if (this.character) {
                // Auto Pickup Fuego logic
                const charPos = this.character.getPosition()
                const collectedFuego = this.itemDropManager.checkAutoPickup(charPos, 1.5, "fuego")

                if (collectedFuego.length > 0) {
                    // Sum up values
                    let valueAdded = 0;
                    collectedFuego.forEach(item => {
                        valueAdded += (item.value || 1);
                    });
                    this.fuegoCount += valueAdded;
                    const counterEl = document.getElementById("fuego-count")
                    if (counterEl) counterEl.textContent = this.fuegoCount
                    console.log("Recogido fuego! Total:", this.fuegoCount)
                }

                // Interaction Prompt Logic (Existing code)
                const nearest = this.itemDropManager.getNearestItem(charPos, 3.0)
                // ... rest of prompt logic ...
                // Need to replicate internal logic or just reuse block carefully. 
                // To avoid breaking existing prompt logic, I will copy the nearest finding part again 
                // because I cannot easily "insert" without context of the whole block if I don't replace the whole block.
                // Actually, let's keep it simple and just INSERT the auto-pickup BEFORE the prompt logic.

                const promptEl = document.getElementById("interaction-prompt")
                const promptTextEl = document.getElementById("prompt-text")

                if (nearest && promptEl) {
                    // Update text
                    promptTextEl.textContent = `Recoger ${nearest.item.name}`

                    // Show IT
                    promptEl.style.display = "flex"

                    // Project 3D position to 2D screen
                    const itemPos = nearest.rigidBody.translation()
                    const vec = new THREE.Vector3(itemPos.x, itemPos.y + 0.5, itemPos.z)
                    vec.project(this.sceneManager.camera)

                    const x = (vec.x * .5 + .5) * window.innerWidth
                    const y = (-(vec.y * .5) + .5) * window.innerHeight

                    // Only show if in front of camera (z < 1)
                    if (vec.z < 1) {
                        promptEl.style.left = `${x}px`
                        promptEl.style.top = `${y}px`
                    } else {
                        promptEl.style.display = "none"
                    }

                } else if (promptEl) {
                    promptEl.style.display = "none"
                }
            }
        }

        // Farming Zone Update
        if (this.farmingZone) {
            this.farmingZone.update(dt)

            // Move Logic Check
            if (this.character && !this.isMovingFarmingZone) {
                const charPos = this.character.getPosition()
                const zonePos = this.farmingZone.position

                // Dist check (simple Euclidean)
                const dx = charPos.x - zonePos.x
                const dz = charPos.z - zonePos.z
                const distSq = dx * dx + dz * dz

                const promptContainer = document.getElementById("move-prompt-container")
                const progressBar = document.getElementById("move-progress-bar")

                if (distSq < 16.0) { // Radius 4
                    if (promptContainer) promptContainer.style.display = "flex"

                    if (this.isFKeyDown) {
                        this.fKeyHeldTime += dt
                        const progress = Math.min(this.fKeyHeldTime / 5.0, 1.0)
                        if (progressBar) progressBar.style.width = `${progress * 100}%`

                        if (this.fKeyHeldTime >= 5.0) {
                            // Trigger Move Mode
                            this.isMovingFarmingZone = true
                            this.fKeyHeldTime = 0
                            if (promptContainer) promptContainer.style.display = "none"
                            console.log("Farming Zone Move Mode Activated")
                        }
                    } else {
                        this.fKeyHeldTime = 0
                        if (progressBar) progressBar.style.width = "0%"
                    }
                } else {
                    if (promptContainer) promptContainer.style.display = "none"
                    this.fKeyHeldTime = 0 // Reset if walked away
                }
            } else if (this.isMovingFarmingZone) {
                // In Move Mode
                const raycaster = new THREE.Raycaster()
                raycaster.setFromCamera(new THREE.Vector2(0, 0), this.sceneManager.camera)
                const intersects = raycaster.intersectObjects(this.sceneManager.scene.children, true)
                const hit = intersects.find(h => h.distance < 20 && h.object.type === "Mesh" && h.object !== this.moveGhost)

                if (hit) {
                    this.moveGhost.visible = true
                    this.moveGhost.position.copy(hit.point)
                    this.moveGhost.position.y += 0.1 // Flush
                } else {
                    this.moveGhost.visible = false
                }
            }
        }

        // Ghost Preview Update (via Manager)
        if (this.placementManager && this.inventoryManager) {
            const currentItem = this.inventoryManager.getCurrentItem()
            // Pass the item object directly!
            this.placementManager.update(currentItem, this.placementRotationIndex || 0)
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

        // Tab switching logic
        const tabs = document.querySelectorAll(".tab-btn")
        const contents = document.querySelectorAll(".settings-content")

        tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                tabs.forEach(t => t.classList.remove("active"))
                contents.forEach(c => c.classList.remove("active"))

                tab.classList.add("active")
                document.getElementById(tab.dataset.tab).classList.add("active")
            })
        })

        // Inputs
        const fpInvertX = document.getElementById("fp-invert-x")
        const fpInvertY = document.getElementById("fp-invert-y")
        const tpInvertX = document.getElementById("tp-invert-x")
        const tpInvertY = document.getElementById("tp-invert-y")
        const tpTrackingCheckbox = document.getElementById("tp-tracking")
        const cameraModeText = document.getElementById("camera-mode-text")

        document.addEventListener("gamePauseChanged", (e) => {
            if (e.detail.isPaused) {
                settingsPanel.style.display = "block"
                overlay.style.display = "block"

                // Update inputs from controller state
                fpInvertX.checked = e.detail.fpInvertAxisX
                fpInvertY.checked = e.detail.fpInvertAxisY
                tpInvertX.checked = e.detail.tpInvertAxisX
                tpInvertY.checked = e.detail.tpInvertAxisY

                if (tpTrackingCheckbox) tpTrackingCheckbox.checked = this.cameraController.alwaysRotateThirdPerson

                const camHorizontalOffset = document.getElementById("cam-horizontal-offset")
                const camHorizontalOffsetVal = document.getElementById("cam-horizontal-offset-val")
                if (camHorizontalOffset) {
                    camHorizontalOffset.value = this.cameraController.horizontalOffset
                    if (camHorizontalOffsetVal) camHorizontalOffsetVal.textContent = this.cameraController.horizontalOffset.toFixed(2)
                }

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

        // Bind events
        fpInvertX.addEventListener("change", (e) => this.cameraController.setFpInvertAxisX(e.target.checked))
        fpInvertY.addEventListener("change", (e) => this.cameraController.setFpInvertAxisY(e.target.checked))
        tpInvertX.addEventListener("change", (e) => this.cameraController.setTpInvertAxisX(e.target.checked))
        tpInvertY.addEventListener("change", (e) => this.cameraController.setTpInvertAxisY(e.target.checked))

        if (tpTrackingCheckbox) {
            tpTrackingCheckbox.addEventListener("change", (e) => {
                this.cameraController.setAlwaysRotateThirdPerson(e.target.checked)
            })
        }

        const camSmoothing = document.getElementById("cam-smoothing")
        const camSmoothingVal = document.getElementById("cam-smoothing-val")
        if (camSmoothing && camSmoothingVal) {
            camSmoothing.addEventListener("input", (e) => {
                const val = parseFloat(e.target.value)
                this.cameraController.setSmoothing(val)
                camSmoothingVal.textContent = val.toFixed(2)
            })
            // Set initial value
            camSmoothing.value = this.cameraController.smoothing
            camSmoothingVal.textContent = this.cameraController.smoothing.toFixed(2)
        }

        const camHorizontalOffset = document.getElementById("cam-horizontal-offset")
        const camHorizontalOffsetVal = document.getElementById("cam-horizontal-offset-val")
        if (camHorizontalOffset && camHorizontalOffsetVal) {
            camHorizontalOffset.addEventListener("input", (e) => {
                const val = parseFloat(e.target.value)
                this.cameraController.setHorizontalOffset(val)
                camHorizontalOffsetVal.textContent = val.toFixed(1)
            })
        }

        const debugCheckbox = document.getElementById("debug-collisions")
        if (debugCheckbox) {
            debugCheckbox.addEventListener("change", (e) => {
                this.debugEnabled = e.target.checked
                if (this.debugMesh) this.debugMesh.visible = e.target.checked
            })
        }

        // Crosshair Settings Logic
        const chDynamic = document.getElementById("ch-dynamic")
        const chType = document.getElementById("ch-type")
        const chSize = document.getElementById("ch-size")
        const chSizeVal = document.getElementById("ch-size-val")
        const crosshair = document.getElementById("crosshair")

        if (chDynamic && crosshair) {
            chDynamic.addEventListener("change", (e) => {
                if (e.target.checked) {
                    crosshair.classList.add("crosshair-dynamic")
                } else {
                    crosshair.classList.remove("crosshair-dynamic")
                }
            })
        }

        if (chType && crosshair) {
            chType.addEventListener("change", (e) => {
                const type = e.target.value
                // Reset
                crosshair.style.backgroundImage = ""
                crosshair.classList.remove("crosshair-dot", "crosshair-plus")

                if (type === "image") {
                    crosshair.style.backgroundImage = "url('./assets/ui/pointer.png')"
                } else if (type === "dot") {
                    crosshair.classList.add("crosshair-dot")
                } else if (type === "plus") {
                    crosshair.classList.add("crosshair-plus")
                }
            })
        }

        if (chSize && chSizeVal && crosshair) {
            chSize.addEventListener("input", (e) => {
                const size = e.target.value
                crosshair.style.width = size + "px"
                crosshair.style.height = size + "px"
                chSizeVal.textContent = size + "px"
            })
        }
    }
    setupGameInput() {
        this.placementRotationIndex = 0

        document.addEventListener("keydown", (e) => {
            if (this.inputManager && !this.inputManager.enabled) return

            const key = e.key.toLowerCase()

            // Rotation (R)
            if (key === 'r') {
                this.placementRotationIndex = (this.placementRotationIndex + 1) % 4
                console.log("Placement Rotation:", this.placementRotationIndex)
            }

            // Drop Item (Q)
            if (key === 'q') {
                const item = this.inventoryManager.removeCurrentItem()
                if (item) {
                    const charPos = this.character.getPosition()

                    // Direction from Camera
                    const camDir = new THREE.Vector3()
                    this.sceneManager.camera.getWorldDirection(camDir)

                    // Drop slightly in front of camera/character
                    this.itemDropManager.dropItem(item, charPos, camDir)
                }
            }

            // Pickup Item (F)
            if (key === 'f') {
                const charPos = this.character.getPosition()
                const picked = this.itemDropManager.tryPickupNearest(charPos)
                if (picked) {
                    if (picked.id === "fuego") {
                        this.fuegoCount += (picked.value || 1)
                        const counterEl = document.getElementById("fuego-count")
                        if (counterEl) counterEl.textContent = this.fuegoCount
                        console.log("Manual pickup fuego! Total:", this.fuegoCount)
                    } else {
                        const added = this.inventoryManager.addItem(picked)
                        if (!added) {
                            // Inventory full, drop it back?
                            console.log("Inventario lleno, soltando de nuevo...")
                            const camDir = new THREE.Vector3()
                            this.sceneManager.camera.getWorldDirection(camDir)
                            this.itemDropManager.dropItem(picked, charPos, camDir)
                        }
                    }
                }
            }
            // Pickup Item (F) Logic is already handled above in 'keydown'
            // We need to track F state for holding
            if (key === 'f') {
                this.isFKeyDown = true

                // Only trigger pickup if NOT moving zone and NOT holding long enough?
                // Actually user said: "mantener presionado F por 5s". 
                // Immediate press is pickup. Long press is move.
                // We should theoretically block pickup if hold started? 
                // Or allow pickup on press down, and start counting for move.
                // Current pickup logic is on keydown. If close to item, it picks up.
                // If close to zone, it starts counting. Both can happen. It's fine.
            }
        })

        document.addEventListener("keyup", (e) => {
            if (e.key.toLowerCase() === 'f') {
                this.isFKeyDown = false
                this.fKeyHeldTime = 0
                const progressBar = document.getElementById("move-progress-bar")
                if (progressBar) progressBar.style.width = "0%"
            }
        })

        // Use Item (Click)
        document.addEventListener("mousedown", (e) => {
            if (this.inputManager && !this.inputManager.enabled) return
            if (e.button === 0) { // Left Click
                if (this.isMovingFarmingZone && this.moveGhost.visible) {
                    // Confirm Placement
                    this.farmingZone.setPosition(this.moveGhost.position)
                    this.isMovingFarmingZone = false
                    this.moveGhost.visible = false
                    console.log("Farming Zone Moved")
                } else {
                    this.useCurrentItem()
                }
            }
        })
    }

    useCurrentItem() {
        const item = this.inventoryManager.getCurrentItem()
        if (!item) return

        let origin = new THREE.Vector3()
        let direction = new THREE.Vector3()

        if (this.character) {
            origin = this.character.getPosition()
            // A bit higher for "eye" or "gun" level
            origin.y += 1.5

            // Get Camera Direction
            this.sceneManager.camera.getWorldDirection(direction)
        }

        // Context needed for item usage
        const context = {
            scene: this.sceneManager.scene,
            world: this.world,
            placementManager: this.placementManager,
            platforms: this.platforms,
            rotationIndex: this.placementRotationIndex,
            origin: origin,
            direction: direction,
            registerProjectile: (proj) => {
                this.projectiles.push(proj)
            }
        }

        const consumed = item.use(context)
        // If we implemented consumption (removing item), we would do it here
        // if (consumed) this.inventoryManager.removeCurrentItem()
    }
}

new Game()
