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
        this.networkManager = new NetworkManager(this.sceneManager.scene, this.world, (id) => {
            console.log("Player joined", id)
            this.updateConnectionStatus(true, id)
        })

        this.chatManager = new ChatManager(this.networkManager)

        // NPC
        this.npc = new NPCRapier(
            this.sceneManager.scene,
            this.world,
            new THREE.Vector3(0, 0, -15), // posicion inicial
            [new THREE.Vector3(0, 0, -15), new THREE.Vector3(5, 0, -15), new THREE.Vector3(5, 0, -10), new THREE.Vector3(0, 0, -10)] // patron de movimiento
        )


        // Impulse Platforms
        this.platforms = []

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
        this.setupInventory()

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
        if (this.platforms) {
            this.platforms.forEach(p => p.update(this.character))
        }

        // Ghost Preview Update
        this.updatePlacementIndicator()

        // Render
        this.updateDebugRender()
        this.sceneManager.update()
    }

    updatePlacementIndicator() {
        // Initialize ghost if not exists
        if (!this.placementGhost) {
            this.placementGhost = new THREE.Group()
            this.sceneManager.scene.add(this.placementGhost)

            // Base Box
            const geometry = new THREE.BoxGeometry(3, 0.2, 3)
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.3,
                wireframe: true
            })
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.y -= 0.1 // Flush
            this.placementGhost.add(mesh)

            // Arrow/Icon
            const arrowGeo = new THREE.PlaneGeometry(2.4, 2.4)
            const arrowMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide
            })
            this.ghostArrow = new THREE.Mesh(arrowGeo, arrowMat)
            this.ghostArrow.rotation.x = -Math.PI / 2
            this.ghostArrow.position.y = 0.05
            this.placementGhost.add(this.ghostArrow)

            // Store material refs for color changing
            this.ghostBaseMat = material
            this.ghostArrowMat = arrowMat
        }

        // Hide by default
        this.placementGhost.visible = false

        // Only show for slots 0 and 1
        if (this.currentInventorySlot !== 0 && this.currentInventorySlot !== 1) return

        // Raycast
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.sceneManager.camera)
        const intersects = raycaster.intersectObjects(this.sceneManager.scene.children, true)

        // Find valid hit
        const hit = intersects.find(h => h.distance < 15 && h.object.type === "Mesh" && h.object !== this.placementGhost && !this.placementGhost.children.includes(h.object))

        if (hit) {
            this.placementGhost.visible = true
            this.placementGhost.position.copy(hit.point)
            // No vertical lift needed if we want it flush/embedded (geometry is centered)
            // Actually ghost geometry is:
            // BoxGeometry(3, 0.2, 3) -> Center 0.
            // mesh.position.y -= 0.1 -> Bottom at -0.2, Top at 0 relative to ghost group.
            // Ghost Group at hit.point.
            // So Top is at hit.point.
            // Perfect.


            // Update Visuals based on slot
            const isJump = this.currentInventorySlot === 1
            const color = isJump ? 0x00FFFF : 0x00FF00

            this.ghostBaseMat.color.setHex(color)

            // Texture loading
            if (isJump && this.texSalto) {
                this.ghostArrowMat.map = this.texSalto
                this.ghostArrowMat.needsUpdate = true
            } else if (!isJump && this.texImpulso) {
                this.ghostArrowMat.map = this.texImpulso
                this.ghostArrowMat.needsUpdate = true
            }
        }

        // Handle Rotation
        if (this.placementGhost.visible) {
            if (this.currentInventorySlot === 0) {
                // Lateral: Rotate arrow
                // 0: North (-Z) -> 0 rot around Y? 
                // We need to match logic in placeItem
                // 0: Forward (-Z). Texture points Up (Y+). Plane X -90 => Up is -Z. 
                // So 0 rot is correct for North.

                // 0 -> 0 (North)
                // 1 -> -PI/2 (East) (Right) ?
                // placeItem logic:
                // 1: East (+X). 
                // To point East (-Z rotated to +X), we rotate -90 deg (Clockwise from top) around Y.
                // Wait, standard rotation Y is Counter-Clockwise.
                // -Z to +X is +90 deg not -90?
                // -1 (0,0,-1) -> +1 (1,0,0)? No.
                // let's retry visual check logic.

                // If default is -Z.
                // Rot Y +90 => Points -X.
                // Rot Y -90 => Points +X.

                // My placeItem logic:
                // 1: East (+X). 
                // So we need Rot Y -90 (or 270).

                let rotY = 0
                if (this.placementRotationIndex === 1) rotY = -Math.PI / 2
                if (this.placementRotationIndex === 2) rotY = -Math.PI
                if (this.placementRotationIndex === 3) rotY = Math.PI / 2 // West (-X)

                this.ghostArrow.rotation.z = rotY // Since plane is X -90, Z is World Y.
            } else {
                this.ghostArrow.rotation.z = 0
            }
        }
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
    setupInventory() {
        this.currentInventorySlot = 0 // 0-indexed (0 to 5)
        this.placementRotationIndex = 0 // 0=Forward, 1=Right, 2=Back, 3=Left

        const loader = new THREE.TextureLoader()
        this.texImpulso = loader.load('./assets/textures/impulso.png')
        this.texSalto = loader.load('./assets/textures/salto.png')


        const slots = document.querySelectorAll(".inventory-slot")

        const selectSlot = (index) => {
            // Validate index
            if (index < 0) index = 5
            if (index > 5) index = 0

            this.currentInventorySlot = index

            // Visual update
            slots.forEach(s => s.classList.remove("active"))
            if (slots[this.currentInventorySlot]) {
                slots[this.currentInventorySlot].classList.add("active")
            }
        }

        // Initialize first slot
        selectSlot(0)

        // Key selection
        document.addEventListener("keydown", (e) => {
            if (this.inputManager && !this.inputManager.enabled) return

            const key = parseInt(e.key)
            if (key >= 1 && key <= 6) {
                selectSlot(key - 1)
            }

            // Rotation Binding
            if (e.key.toLowerCase() === 'r') {
                this.placementRotationIndex = (this.placementRotationIndex + 1) % 4
                console.log("Placement Rotation:", this.placementRotationIndex)
                // TODO: Add visual feedback for rotation
            }
        })

        // Scroll selection
        document.addEventListener("wheel", (e) => {
            // Only scroll inventory if Shift is NOT held (Shift is for zoom)
            if (!e.shiftKey && !this.inputManager.enabled === false) {
                // Logic: Scroll Down (positive delta) -> Next slot
                // Scroll Up (negative delta) -> Previous slot
                if (e.deltaY > 0) {
                    selectSlot(this.currentInventorySlot + 1)
                } else if (e.deltaY < 0) {
                    selectSlot(this.currentInventorySlot - 1)
                }
            }
        })

        // Placement Input
        document.addEventListener("mousedown", (e) => {
            if (this.inputManager && !this.inputManager.enabled) return
            // 0 is Left Click
            if (e.button === 0) {
                this.placeItem()
            }
        })
    }

    placeItem() {
        // Only allow placement for slots 1 and 2 (index 0 and 1)
        if (this.currentInventorySlot !== 0 && this.currentInventorySlot !== 1) return

        // Raycast from camera center
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.sceneManager.camera)

        // Intersect with world meshes (exclude dynamic characters if possible, but environment is key)
        // We can just intersect everything and filter? 
        // For simplicity, let's intersect visual scene. 
        // Ideally we should have a list of "placeable" meshes. 
        // Let's assume everything visible is placeable for now except triggers.

        const intersects = raycaster.intersectObjects(this.sceneManager.scene.children, true)

        if (intersects.length > 0) {
            // Find first valid hit (distance < some max range)
            const hit = intersects.find(h => h.distance < 10 && h.object.type === "Mesh")

            if (hit) {
                const position = hit.point
                // Lift slightly so it sits on top? ImpulsePlatform handles y alignment relative to its center?
                // ImpulsePlatform constructor takes center position.
                // It builds mesh from center - height/2 to center + height/2 ?
                // Code says: this.mesh.position.y -= this.height / 2 
                // So if we pass P, mesh bottom is at P - height. 
                // Wait. 
                // ImpulsePlatform:
                // constructor(..., position, ...)
                // mesh.position.copy(position)
                // mesh.position.y -= height/2
                // So if we pass P, the mesh CENTER is at P, and VISUAL is shifted down.
                // If P is on floor (Y=0), Visual is at -0.1 (flush with floor if height=0.2).
                // Usually we want the bottom of the pad to be at hit.point.y.
                // If mesh bottom is at `pos.y - height/2`, and we want that to be `hit.y`.
                // Then `pos.y - height/2 = hit.y` => `pos.y = hit.y + height/2`.

                // Let's assume height is 0.2 from ImpulsePlatform class
                const height = 0.2
                const placePos = position.clone()
                // placePos.y += height / 2 // Removed to keep it flush with ground


                if (this.currentInventorySlot === 0) {
                    // Lateral Pad
                    // Calculate direction based on rotation index relative to Camera or Fixed?
                    // User asked for "Forward, Back, Right, Left".
                    // Let's align with World Axes for simplicity + Rotation.
                    // 0: Forward (Z+), 1: Right (X-), 2: Backward (Z-), 3: Left (X+)
                    // Wait, standard ThreeJS coords:
                    // Z+ is usually "Forward" out of screen? No, Z- is forward for camera.
                    // Let's use World Coordinate directions.
                    // 0: North (-Z)
                    // 1: East (+X)
                    // 2: South (+Z)
                    // 3: West (-X)

                    let dir = new THREE.Vector3(0, 0, -1) // Default Forward (-Z)
                    if (this.placementRotationIndex === 1) dir.set(1, 0, 0) // East
                    if (this.placementRotationIndex === 2) dir.set(0, 0, 1) // South
                    if (this.placementRotationIndex === 3) dir.set(-1, 0, 0) // West

                    const pad = new ImpulsePlatform(
                        this.sceneManager.scene,
                        this.world,
                        placePos,
                        dir,
                        25.0,
                        "pad"
                    )
                    this.platforms.push(pad)
                    console.log("Placed Lateral Pad", dir)

                } else if (this.currentInventorySlot === 1) {
                    // Jump Pad
                    const pad = new ImpulsePlatform(
                        this.sceneManager.scene,
                        this.world,
                        placePos,
                        new THREE.Vector3(0, 1, 0), // Up
                        35.0, // Higher strength for jump
                        "pad"
                    )
                    this.platforms.push(pad)
                    console.log("Placed Jump Pad")
                }
            }
        }
    }
}

new Game()
