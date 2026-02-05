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
import { ObjectInspector } from "./ui/ObjectInspector.js"
import { StairsUtils } from "./utils/StairsUtils.js"

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
        this.sceneManager.renderer.autoClear = false // Manual clear for overlays
        this.setupOrientationGizmo()

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
        if (this.gameMode !== 'editor') {
            this.npc = new NPCRapier(
                this.sceneManager.scene,
                this.world,
                new THREE.Vector3(0, 0, -15), // posicion inicial
                [new THREE.Vector3(0, 0, -15), new THREE.Vector3(5, 0, -15), new THREE.Vector3(5, 0, -10), new THREE.Vector3(0, 0, -10)] // patron de movimiento
            )
        }

        // Impulse Platforms
        this.platforms = []
        this.projectiles = [] // Array for active projectiles

        if (this.gameMode !== 'editor') {
            // 1. Forward Boost (Rotatable)
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
                "pad"
            )
            this.platforms.push(jumpPad)
        }

        // ... Code continue ...

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
        if (this.gameMode !== 'editor') {
            this.setupMultiplayerUI()
        }

        // --- New Inventory System ---
        this.inventoryManager = new InventoryManager("inventory-container")
        this.itemDropManager = new ItemDropManager(this.sceneManager.scene, this.world)

        // Farming Zone (Now that itemDropManager exists)
        this.fuegoCount = 0
        if (this.gameMode !== 'editor') {
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
        }

        if (this.gameMode === 'editor') {
            // Editor Items (White default)
            const wall = new MapObjectItem("wall", "Pared", "wall", "./assets/textures/impulso.png", 0xFFFFFF, { x: 5, y: 3, z: 0.5 })
            const pillar = new MapObjectItem("pillar", "Pilar", "pillar", "./assets/textures/salto.png", 0xFFFFFF, { x: 1, y: 4, z: 1 })
            const floor = new MapObjectItem("floor", "Suelo", "wall", "./assets/textures/impulso.png", 0xFFFFFF, { x: 5, y: 0.5, z: 5 })
            const ramp = new MapObjectItem("stairs", "Gradas", "stairs", "./assets/textures/impulso.png", 0xFFFFFF, { x: 4, y: 2, z: 4 })
            const tall = new MapObjectItem("tall", "Torre", "pillar", "./assets/textures/salto.png", 0xFFFFFF, { x: 2, y: 10, z: 2 })

            this.inventoryManager.addItem(wall)
            this.inventoryManager.addItem(pillar)
            this.inventoryManager.addItem(floor)
            this.inventoryManager.addItem(ramp)
            this.inventoryManager.addItem(tall)

            // Create Basic Editor Ground
            const groundGeo = new THREE.BoxGeometry(100, 1, 100);
            const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
            const groundMesh = new THREE.Mesh(groundGeo, groundMat);
            groundMesh.position.y = -0.5; // Surface at 0
            groundMesh.receiveShadow = true;
            this.sceneManager.scene.add(groundMesh);

            // Static Physics for Ground
            const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
            const groundBody = this.world.createRigidBody(groundBodyDesc);
            const groundCollider = RAPIER.ColliderDesc.cuboid(50, 0.5, 50);
            this.world.createCollider(groundCollider, groundBody);

            // Create Save/Load UI
            this.setupEditorUI();

            // Construction Menu
            import("./ui/ConstructionMenu.js").then(module => {
                this.constructionMenu = new module.ConstructionMenu(this.inventoryManager, this)
            })

            // Object Inspector
            this.objectInspector = new ObjectInspector(this)

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

        // Enable DragDrop on Inventory
        if (this.gameMode === 'editor' && this.inventoryManager) {
            this.inventoryManager.enableDragAndDrop((slotIndex) => {
                // Callback when item dropped on slot index
                if (this.constructionMenu && this.constructionMenu.draggedItem) {
                    // Clone the dragged item pattern to new unique item? 
                    // Or reuse reference if infinite?
                    // MapObjectItem logic doesn't store unique state other than ID/Color.
                    // We should clone it to ensure independent lifecycle if needed.
                    const source = this.constructionMenu.draggedItem
                    // Re-create new instance
                    const newItem = new MapObjectItem(
                        source.id, // Reuse ID prefix or make unique? 
                        source.name,
                        source.type,
                        "",
                        source.color,
                        source.scale,
                        source.texturePath
                    )
                    // Copy Logic properties
                    if (source.logicProperties) {
                        newItem.logicProperties = { ...source.logicProperties }
                    }
                    // Copy Opacity
                    if (source.opacity !== undefined) {
                        newItem.opacity = source.opacity
                    }

                    this.inventoryManager.setItem(slotIndex, newItem)
                    console.log("Equipped", newItem.name, "to slot", slotIndex + 1)
                }
            })
        }

        this.setupGameInput() // Replaces setupInventory logic for interactions

        // Environment (Rapier Rigidbody + Three Mesh)
        // Environment (Rapier Rigidbody + Three Mesh)
        // Only build default environment if NOT editor
        if (this.gameMode !== 'editor') {
            this.buildEnvironment()

            // Load Test Map (Offset by 30 units, Scale 0.01)
            this.loadLevelFromFile(
                "https://threejs.org/examples/models/gltf/LittlestTokyo.glb",
                new THREE.Vector3(0, 8, 25),
                new THREE.Vector3(0.04, 0.04, 0.04)
            )
        }

        // Debug
        this.debugEnabled = false
        this.setupDebugRender()
        // Loop
        this.animate = this.animate.bind(this)
        requestAnimationFrame(this.animate)

        // Right Click Handler for Inspector (Using mousedown to support Pointer Lock)
        document.addEventListener('mousedown', (e) => {
            // UI Protection
            if (e.target !== this.sceneManager.renderer.domElement) return

            if (this.gameMode === 'editor') {

                // --- MAP LOGIC CLICK ---
                if (this.constructionMenu && this.constructionMenu.logicSystem && this.constructionMenu.logicSystem.isEditingMap) {
                    // If in Map Edit Mode, we intercept clicks for tools
                    const logicSys = this.constructionMenu.logicSystem
                    if (logicSys.toolbar.activeTool === 'waypoint' && e.button === 0) {
                        const pos = this.placementManager.getCurrentTarget()
                        if (pos && logicSys.editingObject) {
                            const wp = {
                                x: pos.x,
                                y: pos.y,
                                z: pos.z,
                                z: pos.z,
                                delay: 0,
                                rotY: this.placementManager.placementGhost.rotation.y // Save rotation
                            }
                            logicSys.editingObject.userData.logicProperties.waypoints.push(wp)
                            logicSys.updateVisualization()
                            console.log("Waypoint Added via Map Tool", wp)
                        }
                        return // Stop processing
                    }
                }

                // --- TARGET PICKING LOGIC (For Movement Controller) ---
                if (e.button === 2 && this.constructionMenu && this.constructionMenu.isPickingTarget) {
                    // Raycast
                    const mouse = new THREE.Vector2()
                    if (document.pointerLockElement) {
                        mouse.x = 0; mouse.y = 0;
                    } else {
                        mouse.x = (e.clientX / window.innerWidth) * 2 - 1
                        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
                    }
                    const raycaster = new THREE.Raycaster()
                    raycaster.setFromCamera(mouse, this.sceneManager.camera)
                    const intersects = raycaster.intersectObjects(this.sceneManager.scene.children, true)

                    const hit = intersects.find(h => h.object.userData && h.object.userData.isEditableMapObject)

                    if (hit) {
                        // Apply Target
                        if (this.constructionMenu.pickingCallback) {
                            // GENERIC PICKING CALLBACK (New System)
                            this.constructionMenu.pickingCallback(hit.object)
                            this.constructionMenu.isPickingTarget = false
                            this.constructionMenu.pickingCallback = null // Reset
                            this.constructionMenu.pickingController = null
                        } else if (this.constructionMenu.pickingController) {
                            const controller = this.constructionMenu.pickingController
                            const target = hit.object

                            // Prevent self-pick
                            if (target === controller) {
                                alert("No puedes vincular el controlador a sí mismo.")
                                return
                            }

                            // Update Uuid
                            controller.userData.logicProperties.targetUuid = target.userData.uuid

                            // Visual Confirm
                            alert(`Objetivo vinculado: ${target.userData.mapObjectType || "Objeto"}`)

                            // Re-render properties panel
                            this.constructionMenu.renderLogicProperties(controller)
                            this.constructionMenu.isPickingTarget = false

                            // Switch Physics to Kinematic (Runtime Prep)
                            this.setObjectBodyType(target, 'kinematic')
                        }
                    }
                    return // Consume event
                }

                // --- INSPECTOR LOGIC ---
                if (this.objectInspector && e.button === 2) { // Button 2 is Right Click

                    // Raycast
                    const mouse = new THREE.Vector2()

                    // If Pointer Locked (Crosshair mode), raycast from center
                    if (document.pointerLockElement) {
                        mouse.x = 0
                        mouse.y = 0
                    } else {
                        // Else, use mouse pointer position
                        mouse.x = (e.clientX / window.innerWidth) * 2 - 1
                        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
                    }

                    const raycaster = new THREE.Raycaster()
                    raycaster.setFromCamera(mouse, this.sceneManager.camera)

                    const intersects = raycaster.intersectObjects(this.sceneManager.scene.children, true)

                    // Find first editable object (checking parents for Groups)
                    const hit = intersects.find(h => {
                        let obj = h.object
                        while (obj) {
                            if (obj.userData && obj.userData.isEditableMapObject) return true
                            obj = obj.parent
                        }
                        return false
                    })

                    if (hit) {
                        // Traverse up again to get the actual editable root
                        let target = hit.object
                        while (target && (!target.userData || !target.userData.isEditableMapObject)) {
                            target = target.parent
                        }

                        if (target) {
                            this.objectInspector.show(target)
                        }
                    }
                }
            }
        }, false)

        // Prevent Default Context Menu
        document.addEventListener('contextmenu', (e) => e.preventDefault(), false)
    }

    regenerateObjectPhysics(objectMesh) {
        if (!objectMesh || !this.world) return

        // 1. Remove existing RigidBody
        if (objectMesh.userData.rigidBody) {
            this.world.removeRigidBody(objectMesh.userData.rigidBody)
            objectMesh.userData.rigidBody = null
        }

        const dims = objectMesh.userData.originalScale || { x: 1, y: 1, z: 1 }

        // Create Body
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(objectMesh.position.x, objectMesh.position.y, objectMesh.position.z)
            .setRotation(objectMesh.quaternion)

        const rigidBody = this.world.createRigidBody(bodyDesc)
        objectMesh.userData.rigidBody = rigidBody

        // Create Collider
        // Naive Box. If it was Ramp/Stairs, this is wrong. 
        // But `dims` are what we have.
        // If Type is 'stairs', we need complex collider logic...
        // Reuse MapObjectItem logic? 
        // Copying simplified logic here:

        let colDesc
        if (objectMesh.userData.mapObjectType === 'ramp') {
            // Approximation (Box or Convex)
            // Ramp physics is tricky without vertices.
            // Let's use Box for now as fallback or Convex if we can get vertices.
            colDesc = RAPIER.ColliderDesc.cuboid(dims.x / 2, dims.y / 2, dims.z / 2)
            this.world.createCollider(colDesc, rigidBody)
        } else if (objectMesh.userData.mapObjectType === 'stairs') {
            const steps = StairsUtils.calculateSteps(dims)
            steps.forEach(step => {
                const col = RAPIER.ColliderDesc.cuboid(step.size.x / 2, step.size.y / 2, step.size.z / 2)
                    .setTranslation(step.position.x, step.position.y, step.position.z)
                this.world.createCollider(col, rigidBody)
            })
        } else {
            // Box
            colDesc = RAPIER.ColliderDesc.cuboid(dims.x / 2, dims.y / 2, dims.z / 2)
            this.world.createCollider(colDesc, rigidBody)
        }


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

        // Movement Logic Update
        this.updateMovementLogic(dt)
        this.updateCollisionLogic(dt)
        this.updateButtonInteraction(dt) // Process Buttons

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
        if (this.gameMode === 'editor' && this.constructionMenu) {
            // Update Logic System (Handles Map Edit AND Simulation)
            if (this.constructionMenu.logicSystem) {
                this.constructionMenu.logicSystem.update(dt)
            }

            // Logic Map Edit Mode Specifics (Ghost visualization)
            if (this.constructionMenu.logicSystem && this.constructionMenu.logicSystem.isEditingMap) {


                if (this.constructionMenu.logicSystem.toolbar.activeTool === 'waypoint') {
                    if (this.placementManager && this.character) {
                        this.placementManager.updateLogicGhost(
                            this.constructionMenu.logicSystem.editingObject,
                            this.character.getPosition(),
                            this.placementRotationIndex || 0
                        )
                    }
                } else {
                    if (this.placementManager) this.placementManager.placementGhost.visible = false
                }
            }
            // Normal Editor Mode (Menu Closed)
            else if (!this.constructionMenu.isVisible && this.placementManager && this.inventoryManager) {
                const currentItem = this.inventoryManager.getCurrentItem()
                // Pass the item object directly!
                // Also pass position if character exists
                const charPos = this.character ? this.character.getPosition() : null
                this.placementManager.update(currentItem, this.placementRotationIndex || 0, charPos)
            }
        } else if (this.placementManager && this.inventoryManager) {
            // Non-Editor Mode (Not typical, but fallback)
            const currentItem = this.inventoryManager.getCurrentItem()
            const charPos = this.character ? this.character.getPosition() : null
            this.placementManager.update(currentItem, this.placementRotationIndex || 0, charPos)
        }

        // Render
        // Render
        this.updateDebugRender()
        this.sceneManager.renderer.clear() // Manual clear
        this.sceneManager.update()
        this.renderOrientationGizmo()
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

    setupOrientationGizmo() {
        this.gizmoScene = new THREE.Scene()
        // Axes Helper for orientation
        this.gizmoAxes = new THREE.AxesHelper(1)
        // Adjust colors/width if needed, but default RGB is fine
        this.gizmoScene.add(this.gizmoAxes)

        // Gizmo Camera
        // Orthographic is better for UI gizmos usually
        const size = 2
        this.gizmoCamera = new THREE.OrthographicCamera(-size, size, size, -size, 0.1, 100)
        this.gizmoCamera.position.set(0, 0, 10)
        this.gizmoCamera.lookAt(0, 0, 0)
    }

    renderOrientationGizmo() {
        if (!this.gizmoScene || !this.gizmoCamera || !this.sceneManager) return

        const renderer = this.sceneManager.renderer
        const width = window.innerWidth
        const height = window.innerHeight

        // Viewport size for gizmo (e.g. 150px)
        const size = 150
        const padding = 10

        // Sync rotation
        // The gizmo camera should match the main camera's rotation
        // IMPORTANT: We want the axes to rotate as the world rotates.
        // So we copy the main camera's quaternion.
        this.gizmoCamera.position.copy(this.sceneManager.camera.position)
        this.gizmoCamera.position.sub(this.sceneManager.camera.position).setLength(10) // Normalize distance
        this.gizmoCamera.lookAt(0, 0, 0) // Look at distinct origin? 
        // Better: Copy quaternion inverse? No.
        // Standard way: Just copy quaternion and position camera at distance Z

        // Simpler approach for axes:
        // Position camera at 0,0,10.
        // Rotate the AXES object to match world? No.
        // Rotate the GIZMO CAMERA to match MAIN CAMERA?
        this.gizmoCamera.position.copy(this.sceneManager.camera.position)
        this.gizmoCamera.quaternion.copy(this.sceneManager.camera.quaternion)
        // Move to origin relative to camera?
        // Actually, Orthographic camera at 0,0,10 looking at 0,0,0.
        // We shouldn't move the camera position if it's ortho looking at origin, 
        // we should just rotate it?
        // If we rotate the camera, it orbits the origin.

        // Correct approach:
        // Position camera "behind" the origin relative to the view direction,
        // so that when it looks forward (matching main camera), it sees the origin.
        this.gizmoCamera.position.set(0, 0, 10)
        this.gizmoCamera.position.applyQuaternion(this.sceneManager.camera.quaternion)
        this.gizmoCamera.quaternion.copy(this.sceneManager.camera.quaternion)

        // Scissor Test for bottom-left (or right)
        renderer.setScissorTest(true)
        // Bottom Left
        renderer.setScissor(padding, padding, size, size)
        renderer.setViewport(padding, padding, size, size)

        renderer.clearDepth() // Clear depth so gizmo renders on top
        renderer.render(this.gizmoScene, this.gizmoCamera)

        // Reset
        renderer.setScissorTest(false)
        renderer.setViewport(0, 0, width, height)
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
            const key = e.key.toLowerCase()

            // Open/Close Construction Menu (E or ESC) - Editor Only
            if ((key === 'e' || key === 'escape') && this.gameMode === 'editor' && this.constructionMenu) {
                // Special case for ESC: Only close if open
                if (key === 'escape') {
                    if (this.constructionMenu.isVisible) {
                        this.constructionMenu.toggle()
                    }
                    // If not visible, let ESC do default (pause menu?)
                } else {
                    // 'E' toggles
                    this.constructionMenu.toggle()
                }

                if (key === 'e' || (key === 'escape' && this.constructionMenu.isVisible)) return
            }

            // Close Inspector on Esc
            if (key === 'escape' && this.objectInspector && this.objectInspector.isVisible) {
                this.objectInspector.hide()
            }

            if (this.inputManager && !this.inputManager.enabled) return

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

            // Pickup Item (F) OR Instant Button Interaction
            if (key === 'f') {
                const charPos = this.character.getPosition()

                // 1. Check for Instant Button Interaction FIRST
                let triggeredButton = false
                this.sceneManager.scene.children.forEach(obj => {
                    if (!triggeredButton && obj.userData.mapObjectType === 'interaction_button') {
                        const dSq = obj.position.distanceToSquared(charPos)
                        if (dSq < 9.0) { // 3m
                            const props = obj.userData.logicProperties
                            // Pulsation Mode (Instant) OR Normal (HoldTime 0)
                            if (props && (props.pulsationMode || props.holdTime === 0)) {
                                // ONE SHOT check
                                if (!props.oneShot || !props.triggered) {
                                    this.triggerButton(obj)
                                    triggeredButton = true
                                }
                            }
                        }
                    }
                })

                if (triggeredButton) return // Don't pickup if we pressed button

                // 2. Pickup Logic
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

            // Aerial Grid Fixed Toggle (G)
            if (key === 'g' && this.placementManager && this.placementManager.aerialGridActive) {
                const isFixed = this.placementManager.toggleAerialGridFixed()
                const statusEl = document.getElementById("aerial-grid-status")
                if (statusEl) {
                    statusEl.textContent = isFixed ? "G: Suelo Fijado" : "G: Suelo No Fijado"
                    statusEl.style.color = isFixed ? "#FF0000" : "#00FF00"
                }
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

            // Prevent interaction if clicking on UI (Not Canvas)
            if (e.target !== this.sceneManager.renderer.domElement) return

            if (e.button === 0) { // Left Click
                if (this.isMovingFarmingZone && this.moveGhost.visible) {
                    // Confirm Placement
                    this.farmingZone.setPosition(this.moveGhost.position)
                    this.isMovingFarmingZone = false
                    this.moveGhost.visible = false
                    console.log("Farming Zone Moved")
                } else {
                    this.useCurrentItem(false)
                }
            } else if (e.button === 2) { // Right Click
                this.useCurrentItem(true)
            }
        })
    }

    setupEditorUI() {
        // Aerial Grid Status UI
        const aerialStatus = document.createElement("div")
        aerialStatus.id = "aerial-grid-status"
        aerialStatus.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            color: #00FF00;
            font-family: sans-serif;
            font-size: 18px;
            font-weight: bold;
            display: none; /* Hidden by default */
            text-shadow: 1px 1px 2px black;
            pointer-events: none;
        `
        aerialStatus.textContent = "G: Suelo No Fijado"
        document.body.appendChild(aerialStatus)

        // Note: Save/Load UI has been moved to ConstructionMenu (Press 'E')
    }

    saveMap() {
        const objects = []
        this.sceneManager.scene.children.forEach(obj => {
            if (obj.userData.isEditableMapObject) {
                objects.push({
                    type: obj.userData.mapObjectType,
                    color: obj.userData.color,
                    originalScale: obj.userData.originalScale, // {x,y,z}
                    pos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                    rot: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
                    logicProperties: obj.userData.logicProperties, // Create if exists
                    uuid: obj.userData.uuid, // Save UUID for references
                    invisible: obj.userData.invisible, // Save visibility state
                    opacity: obj.userData.opacity // Save opacity
                })
            }
        })

        return {
            gameVersion: "1.0",
            timestamp: Date.now(),
            objects: objects,
            // Save Global Logic Config
            gameConfig: (this.constructionMenu && this.constructionMenu.logicSystem)
                ? this.constructionMenu.logicSystem.gameConfig
                : null
        }
    }

    loadMap(jsonData) {
        if (!jsonData || !jsonData.objects) {
            console.error("Invalid map format")
            return
        }

        // Clear current map objects
        // Warning: This does not clear Physics bodies because we didn't track them.
        // For a hack, since fixed bodies don't move, we could rebuild world? Too heavy.
        // Better: Assuming user reloads page to "edit" safely or we strictly track bodies. 
        // For this step, let's just create new ones. Physics will be duplicated on load 
        // if we don't clear. BUT, reloading page is standard for "Open Map".
        // Let's implement ADDITIVE load for now (Merging), or simply suggest refresh.
        // Or simple hack: Only remove visual for now, let's assume we are empty.

        // Load Global Logic Config
        if (jsonData.gameConfig && this.constructionMenu && this.constructionMenu.logicSystem) {
            this.constructionMenu.logicSystem.gameConfig = jsonData.gameConfig
            console.log("Global Game Config Loaded", jsonData.gameConfig)

            // Refresh UI if open
            if (this.constructionMenu.gameConfigPanel) {
                this.constructionMenu.gameConfigPanel.render()
            }
        }

        // Iterate backwards
        for (let i = this.sceneManager.scene.children.length - 1; i >= 0; i--) {
            const obj = this.sceneManager.scene.children[i]
            if (obj.userData.isEditableMapObject) {
                // Remove Physics Body if exists?
                // Currently fixed bodies.
                // We need access to removeRigidBody from world? Rapier API.
                // We haven't stored the rigidBody reference on the mesh for easy deletion.
                // This is tricky for now without refactor.
                // For now: Visual clear, but physics might persist if not careful!

                // Simpler: Reload page? No.
                // Ideally: Store body handle on mesh.userData logic needed.
                this.sceneManager.scene.remove(obj)
            }
        }

        const loader = new MapObjectItem("loader", "Loading...", "wall", "", 0, { x: 1, y: 1, z: 1 }) // Dummy for spawn access

        jsonData.objects.forEach(data => {
            // Reconstruct MapObjectItem logic
            // Use dummy item to spawn

            // Re-instantiate a temp item with saved properties to reuse spawn logic
            const tempItem = new MapObjectItem(
                "loaded_" + Math.random(),
                "Loaded Obj",
                data.type,
                "",
                data.color,
                data.originalScale
            )

            // Restore Logic Properties
            if (data.logicProperties) {
                tempItem.logicProperties = data.logicProperties
            }

            // Restore Opacity
            if (data.opacity !== undefined) {
                tempItem.opacity = data.opacity
            }

            // Manual Spawn to support fine rotation if needed
            tempItem.spawnObjectFromData(this.sceneManager.scene, this.world, data.pos, data.rot)

            const lastObj = this.sceneManager.scene.children[this.sceneManager.scene.children.length - 1]

            // Apply Opacity Material (if not invisible overridden later)
            if (data.opacity !== undefined && lastObj) {
                lastObj.userData.opacity = data.opacity
                const op = data.opacity
                const appalOp = (mesh) => {
                    if (mesh.material) {
                        mesh.material.transparent = op < 1.0
                        mesh.material.opacity = op
                        mesh.material.needsUpdate = true
                    }
                }
                if (lastObj.isGroup) lastObj.children.forEach(appalOp)
                else appalOp(lastObj)
            }

            if (data.uuid && lastObj) {
                lastObj.userData.uuid = data.uuid

                // Restore Invisible Property
                if (data.invisible) {
                    lastObj.userData.invisible = true

                    // Visibilty Logic
                    // If Editor: Keep Visible but Transparent (Already handled by standard material? No, need to apply)
                    // If Play: Hide

                    if (this.gameMode === 'editor') {
                        // User request: No ghost effect. Completely invisible.
                        // Collision stays (RigidBody created before this).
                        lastObj.visible = false
                    } else {
                        // Game Mode: Invisible
                        lastObj.visible = false
                    }
                }
            }
        })
        console.log("Map Loaded:", jsonData.objects.length, "objects")
    }

    useCurrentItem(isRightClick = false) {
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

        // --- MOVEMENT CONTROLLER APPLICATION ---
        if (item.type === "movement_controller" && this.placementManager) {
            const target = this.placementManager.getCurrentTarget()
            // placementManager.getCurrentTarget() returns Vector3 (hit point).
            // But we need the OBJECT.
            // PlacementManager.update() logic finds the object but only returns the point.
            // We need to access the object from PlacementManager state or re-cast?
            // Checking PlacementManager code: it stores `currentHit` (point) and `lastValidPosition` (point).
            // It uses `hit.object` internally but doesn't expose it clearly via `getCurrentTarget`.
            // But wait! `update` in PlacementManager sets `this.currentItem`, and inside `update` it finds `hit.object`.
            // We should modify PlacementManager to store/expose `lastValidObject` or similar.
            // OR re-raycast here for safety.

            // Let's re-raycast for safety and simplicity as we have camera/scene access here.
            // Or better: Use PlacementManager's last hit state if possible. 
            // In PlacementManager modification, I didn't add an exposed field for the object.
            // Re-raycasting ensures sync with what the user is looking at NOW when clicking.

            const raycaster = new THREE.Raycaster()
            raycaster.setFromCamera(new THREE.Vector2(0, 0), this.sceneManager.camera) // Center screen
            const intersects = raycaster.intersectObjects(this.sceneManager.scene.children, true)

            const hit = intersects.find(h => h.object.userData && h.object.userData.isEditableMapObject)

            if (hit) {
                const targetObj = hit.object

                // Toggle / Apply Logic
                // We want to COPY the properties from the Item to the Object?
                // The prompt says "Apply".
                // Does the Controller Item carry properties?
                // In ConstructionMenu.js:
                /*
                const mover = new MapObjectItem(..., "movement_controller", ...)
                mover.logicProperties = { targetUuid: null, speed: 2.0, loop: true, active: true, waypoints: [] }
                */
                // The item in inventory has default props.
                // Does the user want to apply these defaults (empty waypoints)?
                // Or does clicking simply ENABLE the "movement" feature on the object?
                // "marcar de color azul su colision para indicar el objeto al que se aplicara el controlador"
                // "que se pueda aplicar correctamente la propiedad"

                // If the object doesn't have logic, we add it. 
                if (!targetObj.userData.logicProperties) targetObj.userData.logicProperties = {}

                // Merge/Set properties
                // Look at LogicSystem: waypoints, speed, loop, active.
                if (!targetObj.userData.logicProperties.waypoints) {
                    targetObj.userData.logicProperties.waypoints = []
                    targetObj.userData.logicProperties.speed = 2.0
                    targetObj.userData.logicProperties.loop = true
                    targetObj.userData.logicProperties.active = true

                    alert("Controlador de movimiento aplicado a: " + (targetObj.userData.name || "Objeto"))
                    // Update Preview Text to "Aplicado" immediately?
                    if (this.placementManager && this.placementManager.ghostLabelSprite) {
                        this.placementManager.updateLabelSprite(this.placementManager.ghostLabelSprite, "Aplicado!", "#00FF00"); // Green
                    }
                } else {
                    alert("Este objeto ya tiene controlador de movimiento.")
                    // Make sure it says Applied
                    if (this.placementManager && this.placementManager.ghostLabelSprite) {
                        this.placementManager.updateLabelSprite(this.placementManager.ghostLabelSprite, "Aplicado!", "#00FF00");
                    }
                }

                return; // Consumed
            }
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
            },
            isRightClick: isRightClick
        }

        const consumed = item.use(context)

        // Refresh UI list if usage was successful (e.g. object placed)
        if (consumed && this.constructionMenu) {
            this.constructionMenu.refreshLogicList()
        }

        // if (consumed) this.inventoryManager.removeCurrentItem()
    }

    setObjectBodyType(object, type) {
        if (!object || !object.userData.rigidBody) return

        // If already correct type, skip? Rapier types are integers.
        // Fixed = 1, KinematicPos = 2.
        const currentType = object.userData.rigidBody.bodyType()
        if (type === 'kinematic' && currentType === RAPIER.RigidBodyType.KinematicPositionBased) return
        if (type === 'fixed' && currentType === RAPIER.RigidBodyType.Fixed) return

        if (type === 'kinematic') {
            object.userData.rigidBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased)
            console.log("Output converted to Kinematic:", object.userData.mapObjectType)
        } else {
            object.userData.rigidBody.setBodyType(RAPIER.RigidBodyType.Fixed)
            console.log("Output converted to Fixed:", object.userData.mapObjectType)
        }
    }

    updateButtonInteraction(dt) {
        // UI References
        const promptEl = document.getElementById("button-interaction-prompt")
        const progressCircle = document.getElementById("btn-progress-circle")

        if (!promptEl || !progressCircle) return

        // Hide by default
        promptEl.style.display = "none"

        if (this.gameMode === 'editor') {
            // Optional: Allow logic in editor if specific flag is set, or just allow it.
            // For testing "Por el momento", user likely wants to see it working immediately.
            // Let's comment out the return or just run it.
        }

        const charPos = this.character ? this.character.getPosition() : null
        if (!charPos) return

        // Find nearest button
        let nearest = null
        let minDistSq = 9.0 // 3m radius

        this.sceneManager.scene.children.forEach(obj => {
            if (obj.userData.mapObjectType === 'interaction_button') {
                const props = obj.userData.logicProperties
                // Skip if OneShot and already triggered
                if (props.oneShot && props.triggered) return

                const dSq = obj.position.distanceToSquared(charPos)
                if (dSq < minDistSq) {
                    minDistSq = dSq
                    nearest = obj
                }
            }
        })

        if (nearest) {
            // Show UI
            promptEl.style.display = "flex"

            // Position UI (Project 3D -> 2D)
            // Use button position (plus offsetY)
            const btnPos = nearest.position.clone()
            btnPos.y += 0.5 // Float above
            btnPos.project(this.sceneManager.camera)

            const x = (btnPos.x * .5 + .5) * window.innerWidth
            const y = (-(btnPos.y * .5) + .5) * window.innerHeight

            // Only show if in front
            if (btnPos.z < 1) {
                promptEl.style.left = `${x}px`
                promptEl.style.top = `${y}px`
            } else {
                promptEl.style.display = "none"
            }

            // Logic
            const props = nearest.userData.logicProperties
            const holdTime = props.holdTime || 0

            // Initialize temp state for hold tracking if missing
            if (typeof props._currentHoldTime === 'undefined') props._currentHoldTime = 0

            // UI Elements
            // Using CSS classes on parent promptEl instead of individual element style manipulation

            // CIRCLE PROGRESS LOGIC
            const circumference = 163

            // Refactor: Use CSS Classes
            // Reset potential inline overrides (safety)
            if (progressCircle.style.display === "none") progressCircle.style.display = ""
            // Clear specific inline styles if they were set by previous logic
            const bgCircle = document.getElementById("btn-bg-circle")
            if (bgCircle) {
                bgCircle.style.fill = ""
                bgCircle.style.stroke = ""
            }
            // KeyHint color is now handled by CSS !important rule, no need to touch JS.


            // Toggle Mode Class
            if (props.pulsationMode) {
                promptEl.classList.add("interaction-pulsation-mode")
            } else {
                promptEl.classList.remove("interaction-pulsation-mode")
            }

            // Toggle Active State
            if (this.isFKeyDown) {
                promptEl.classList.add("active")
            } else {
                promptEl.classList.remove("active")
            }

            // PROGRESS UPDATE (Still needed for Hold Mode)
            if (props.pulsationMode) {
                // Pulsation Mode: Purely Visual handled by CSS
            } else {
                // Normal / Hold Mode
                if (holdTime > 0) {
                    if (this.isFKeyDown) {
                        props._currentHoldTime += dt

                        // Update Circle
                        const ratio = Math.min(props._currentHoldTime / holdTime, 1.0)
                        const offset = circumference - (ratio * circumference)
                        progressCircle.style.strokeDashoffset = offset

                        // Trigger?
                        if (props._currentHoldTime >= holdTime) {
                            this.triggerButton(nearest)
                            props._currentHoldTime = 0 // Reset after trigger
                            progressCircle.style.strokeDashoffset = circumference // Visual reset
                            this.isFKeyDown = false
                        }
                    } else {
                        // Decay or Reset
                        props._currentHoldTime = 0
                        progressCircle.style.strokeDashoffset = circumference
                    }
                } else {
                    // Instant Interaction Fallback
                    progressCircle.style.strokeDashoffset = circumference
                }
            }

        }
    }

    emitSignal(signalId) {
        console.log("Emitting Signal:", signalId)

        // Find objects listening to this signal
        if (this.sceneManager && this.sceneManager.scene) {
            this.sceneManager.scene.traverse(obj => {
                // 1. Check for Sequences listening
                if (obj.userData.logicProperties && obj.userData.logicProperties.sequences) {
                    obj.userData.logicProperties.sequences.forEach(seq => {
                        const signalMatches = (targetId, targetIds) => {
                            if (targetIds && Array.isArray(targetIds)) {
                                return targetIds.some(s => s.id === signalId || s === signalId) // Handle object {id,name} or raw string
                            }
                            return targetId === signalId
                        }

                        // 1. Sequence Activation
                        if (seq.triggerType === 'signal') {
                            const match = signalMatches(seq.triggerSignal, seq.triggerSignals)

                            if (match) {
                                seq.active = true // Activate
                                // Reset state to restart
                                seq.currentState = { wpIndex: 0, moveAlpha: 0, waiting: false, waitTimer: 0, segmentStart: obj.position.clone() }
                                console.log(`Sequence '${seq.name}' activated on`, obj.userData.name)

                                // Optional: If valid logic, ensure object is kinematic
                                this.setObjectBodyType(obj, 'kinematic')
                            }
                        }

                        // Check for 'wait_signal' steps in active sequences
                        if (seq.active && seq.currentState) {
                            const currentIdx = seq.currentState.wpIndex
                            if (seq.waypoints && seq.waypoints.length > currentIdx) {
                                const step = seq.waypoints[currentIdx]
                                if (step.type === 'wait_signal') {
                                    const match = signalMatches(step.signalId, step.signalIds)
                                    if (match) {
                                        seq.currentState.signalReceived = true
                                        console.log(`Signal received for step ${currentIdx} in sequence '${seq.name}'`)
                                    }
                                }
                            }
                        }
                    })
                }

                // 2. Legacy / Direct Target Support (Keep for backward compat or simple toggle)
                if (obj.userData.logicProperties && obj.userData.logicProperties.targetUuid === signalId) {
                    if (obj.userData.logicProperties.sequences && obj.userData.logicProperties.sequences.length > 0) {
                        const seq = obj.userData.logicProperties.sequences[0]
                        seq.active = !seq.active
                    } else if (obj.userData.logicProperties.active !== undefined) {
                        // Legacy
                        obj.userData.logicProperties.active = !obj.userData.logicProperties.active
                    }
                }

                // 3. Reverse Link Legacy (EventSubscriptionLogic)
                if (obj.userData.logicProperties && obj.userData.logicProperties.triggerButtonUuid === signalId) {
                    // Toggle Active
                    if (obj.userData.logicProperties.sequences && obj.userData.logicProperties.sequences.length > 0) {
                        const seq = obj.userData.logicProperties.sequences[0]
                        seq.active = !seq.active
                    } else if (obj.userData.logicProperties.active !== undefined) {
                        obj.userData.logicProperties.active = !obj.userData.logicProperties.active
                    }
                }
            })
        }
    }

    triggerButton(buttonObj) {
        console.log("Button Triggered!", buttonObj.userData.uuid)

        // Visual Feedback: Animate Button Mesh
        if (buttonObj.children) {
            const btnMesh = buttonObj.children.find(c => c.userData.isButtonMesh)
            if (btnMesh) {
                // Animate interact (Press down)
                const originalY = 0.05
                btnMesh.position.y = 0.02
                setTimeout(() => {
                    btnMesh.position.y = originalY
                }, 200)
            }
        }

        // Logic
        const props = buttonObj.userData.logicProperties
        if (props.oneShot) props.triggered = true

        this.emitSignal(buttonObj.userData.uuid)
    }

    updateCollisionLogic(dt) {
        if (!this.character) return
        const charPos = this.character.getPosition()
        // Simple Box for character
        const charBox = new THREE.Box3().setFromCenterAndSize(
            charPos.clone().add(new THREE.Vector3(0, 1, 0)),
            new THREE.Vector3(0.8, 1.8, 0.8)
        )

        this.sceneManager.scene.children.forEach(obj => {
            if (obj.userData.mapObjectType === 'interactive_collision') {
                const props = obj.userData.logicProperties

                // 0. Visual Updates (Lazy check)
                if (props.borderColor || props.borderVisible !== undefined) {
                    const wire = obj.children.find(c => c.isLineSegments)
                    if (wire) {
                        if (props.borderColor && wire.material) wire.material.color.set(props.borderColor)
                        if (props.borderVisible !== undefined) wire.visible = props.borderVisible
                    }
                }

                // 1. Handle Traversable (Physics)
                if (obj.userData.rigidBody) {
                    const isSensor = (props.isTraversable === true)
                    const n = obj.userData.rigidBody.numColliders()
                    for (let i = 0; i < n; i++) {
                        const col = obj.userData.rigidBody.collider(i)
                        // Force update if mismatch
                        if (col.isSensor() !== isSensor) {
                            col.setSensor(isSensor)
                            console.log(`[Physics] Updated collider ${i} for ${obj.userData.uuid} to sensor: ${isSensor}`)
                        }
                    }
                }

                // 2. Overlap Check
                const objBox = new THREE.Box3().setFromObject(obj)
                const intersects = charBox.intersectsBox(objBox)

                // State Tracking
                if (props._isInside === undefined) props._isInside = false

                if (intersects && !props._isInside) {
                    // ENTER EVENT
                    props._isInside = true
                    if (props.triggerOnEnter || props.triggerOnTouch) {
                        console.log("Interactive Collision Triggered:", obj.userData.uuid)
                        this.emitSignal(obj.userData.uuid)
                    }
                } else if (!intersects && props._isInside) {
                    // EXIT EVENT
                    props._isInside = false
                }
            }
        })
    }

    updateMovementLogic(dt) {
        // Iterate ALL scene objects to find animatable ones
        if (!this.sceneManager || !this.sceneManager.scene) return

        this.sceneManager.scene.children.forEach(obj => {
            if (!obj.userData.logicProperties) return

            // Handle Sequences
            const sequences = obj.userData.logicProperties.sequences
            // Also support legacy waypoints if migration didn't happen for some reason (runtime added?)
            // But we prefer sequences.

            if (sequences && sequences.length > 0) {
                // Check for Editing Preview Override
                if (this.constructionMenu && this.constructionMenu.logicSystem && this.constructionMenu.logicSystem.editingObject === obj) {
                    // If we are editing this object, ONLY run if previewing
                    if (!obj.userData.logicProperties.isPreviewing) return
                }

                // Iterate active sequences
                // Note: If multiple are active, last one applies transform.
                sequences.forEach(seq => {
                    if (!seq.active) return
                    if (!seq.waypoints || seq.waypoints.length === 0) return

                    // Ensure State
                    if (!seq.currentState) {
                        seq.currentState = { wpIndex: 0, moveAlpha: 0, waiting: false, waitTimer: 0, segmentStart: obj.position.clone() }
                    }
                    const state = seq.currentState

                    // Ensure Physics
                    this.setObjectBodyType(obj, 'kinematic')
                    if (!obj.userData.rigidBody) return

                    const waypoints = seq.waypoints
                    const idx = state.wpIndex
                    const nextIdx = (idx + 1) % waypoints.length

                    // Loop Check
                    if (!seq.loop && nextIdx === 0 && idx === waypoints.length - 1) {
                        // End of sequence
                        // seq.active = false // Auto-stop? Or just stay at end? 
                        // Let's stay at end.
                        return
                    }

                    const p1 = waypoints[idx]
                    const p2 = waypoints[nextIdx]

                    // WAIT LOGIC
                    // Check if p1 has a delay that we haven't satisfied?
                    // Usually delay is "Wait at p1 before moving to p2" or "Wait at p2"?
                    // Let's assume "delay" on a waypoint means "Wait here for X seconds before moving to next".
                    // So we check p1.delay.

                    if (p1.delay > 0 && !state.waitingCompleted) {
                        if (!state.waiting) {
                            state.waiting = true
                            state.waitTimer = 0
                        }
                        state.waitTimer += dt
                        if (state.waitTimer < p1.delay) {
                            // Still waiting
                            // Snap to p1 to ensure stability
                            obj.userData.rigidBody.setNextKinematicTranslation({ x: p1.x, y: p1.y, z: p1.z })
                            obj.position.set(p1.x, p1.y, p1.z)
                            return
                        } else {
                            // Done waiting
                            state.waiting = false
                            state.waitingCompleted = true // Flag to not wait again for this index iteration
                        }
                    }

                    // signal wait logic
                    if (p1.type === 'wait_signal' && !state.signalReceived) {
                        // Stay at p1 until signal received
                        if (p1.x !== undefined) {
                            obj.userData.rigidBody.setNextKinematicTranslation({ x: p1.x, y: p1.y, z: p1.z })
                            obj.position.set(p1.x, p1.y, p1.z)
                        }
                        return
                    } else if (p1.type === 'wait_signal' && state.signalReceived) {
                        // Proceed immediately to next step?
                        // If p1 is purely a logic step, it might not have coordinates (it effectively uses prev pos).
                        // If it has coordinates, we are already there (logic above handles snap).
                        // We just allow the code to flow to movement interpolation? 
                        // But if p1 == p2 (wait step implies 0 distance usually if reusing position), dist < 0.05 check handles jump.

                        // We need to clear the signal flag for the *next* loop, BUT we need to ensure we don't clear it before we actually "leave" this step.
                        // The logic below sets `wpIndex = nextIdx` when `moveAlpha >= 1`.
                        // We should clear `signalReceived` when we switch index.
                    }

                    // MOVEMENT
                    const speed = seq.speed || 2.0

                    // Safe P1 (Start Point)
                    const startPos = new THREE.Vector3()
                    if (p1.x !== undefined) {
                        startPos.set(p1.x, p1.y, p1.z)
                    } else {
                        // Fallback to segmentStart or object position
                        if (state.segmentStart) {
                            startPos.copy(state.segmentStart)
                        } else {
                            startPos.copy(obj.position)
                        }
                    }

                    // Safe P2 (End Point)
                    const endPos = new THREE.Vector3()
                    if (p2.x !== undefined) {
                        endPos.set(p2.x, p2.y, p2.z)
                    } else {
                        endPos.copy(startPos)
                    }

                    // Teleport Check (p2.teleport)
                    if (p2.teleport) {
                        state.wpIndex = nextIdx
                        state.moveAlpha = 0
                        state.waitingCompleted = false
                        state.signalReceived = false
                        state.segmentStart = null // Will set after teleport
                        // Teleport
                        if (p2.x !== undefined) {
                            obj.userData.rigidBody.setNextKinematicTranslation({ x: p2.x, y: p2.y, z: p2.z })
                            obj.position.set(p2.x, p2.y, p2.z)
                        }
                        if (p2.rotY !== undefined) {
                            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p2.rotY)
                            obj.quaternion.copy(q)
                            obj.userData.rigidBody.setNextKinematicRotation(q)
                        }
                        state.segmentStart = obj.position.clone()
                        return
                    }

                    const dist = startPos.distanceTo(endPos)

                    if (dist < 0.05) {
                        // Instant jump (very close points)
                        state.wpIndex = nextIdx
                        state.moveAlpha = 0
                        state.waitingCompleted = false
                        state.signalReceived = false
                        state.signalReceived = false
                        // Set segment start for next step
                        if (p2.x !== undefined) state.segmentStart = new THREE.Vector3(p2.x, p2.y, p2.z)
                        else state.segmentStart = startPos.clone() // Effectively where we are
                        return
                    }

                    const duration = dist / speed
                    state.moveAlpha += dt / duration

                    if (state.moveAlpha >= 1.0) {
                        // Arrived at p2
                        state.moveAlpha = 0
                        state.wpIndex = nextIdx
                        state.waitingCompleted = false // Reset wait for the new current point (p2 becomes p1 next frame)
                        state.signalReceived = false // Reset signal flag

                        // Set segment start for next leg
                        if (p2.x !== undefined) state.segmentStart = new THREE.Vector3(p2.x, p2.y, p2.z)
                        else state.segmentStart = endPos.clone()

                        // Snap
                        if (p2.x !== undefined) {
                            obj.userData.rigidBody.setNextKinematicTranslation({ x: p2.x, y: p2.y, z: p2.z })
                            obj.position.set(p2.x, p2.y, p2.z)
                        }

                        // Rot Snap
                        if (p2.rotY !== undefined) {
                            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p2.rotY)
                            obj.quaternion.copy(q)
                            obj.userData.rigidBody.setNextKinematicRotation(q)
                        }
                    } else {
                        // Interpolate
                        const a = state.moveAlpha
                        const x = THREE.MathUtils.lerp(startPos.x, endPos.x, a)
                        const y = THREE.MathUtils.lerp(startPos.y, endPos.y, a)
                        const z = THREE.MathUtils.lerp(startPos.z, endPos.z, a)

                        obj.userData.rigidBody.setNextKinematicTranslation({ x, y, z })
                        obj.position.set(x, y, z)

                        // Rot Interpolation
                        const r1 = (p1.rotY !== undefined) ? p1.rotY : (obj.userData.originalRotY || 0)
                        const r2 = (p2.rotY !== undefined) ? p2.rotY : r1

                        let diff = r2 - r1
                        while (diff > Math.PI) diff -= Math.PI * 2
                        while (diff < -Math.PI) diff += Math.PI * 2

                        const currentRot = r1 + diff * a
                        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), currentRot)
                        obj.quaternion.copy(q)
                        obj.userData.rigidBody.setNextKinematicRotation(q)
                    }
                })

            } else if (obj.userData.logicProperties.waypoints) {
                // LEGACY SUPPORT (If sequences missing)
                // Copy-paste of old logic but using local variables
                // ... (omitted to encourage migration, but if needed we can fallback)
                // Actually LogicSystem automatically migrates on Edit.
                // But blindly running objects might not have been edited.
                // Let's runtime migrate?
                obj.userData.logicProperties.sequences = [{
                    name: "Secuencia Principal",
                    waypoints: obj.userData.logicProperties.waypoints,
                    loop: obj.userData.logicProperties.loop,
                    active: obj.userData.logicProperties.active,
                    speed: obj.userData.logicProperties.speed
                }]
                // Next frame it will pick up the sequence logic.
            }
        })
    }
}

new Game()
