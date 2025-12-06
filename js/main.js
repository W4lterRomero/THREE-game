import * as THREE from "three"
import { SceneManager } from "./SceneManager.js"
import { InputManager } from "./InputManager.js"
import { Character } from "./Character.js"
import { CameraController } from "./CameraController.js"
import { NPC } from "./NPC.js"
import { NetworkManager } from "./NetworkManager.js"
import { ChatManager } from "./ChatManager.js"
import { CollisionSystem, BoxCollider, CollisionLayer } from "./collision/index.js"
import { EnvironmentBuilder } from "./EnvironmentBuilder.js"

class Game {
  constructor() {
    this.sceneManager = new SceneManager("game-container")
    this.inputManager = new InputManager()
    this.character = new Character(this.sceneManager.scene, this.sceneManager.camera)
    this.npc = new NPC(this.sceneManager.scene, new THREE.Vector3(5, 0, 5), "npc-guide")

    this.cameraController = new CameraController(this.sceneManager.camera, this.sceneManager.renderer.domElement)
    this.character.setCameraController(this.cameraController)

    this.collisionSystem = new CollisionSystem(this.sceneManager.scene)
    this.environmentBuilder = new EnvironmentBuilder(this.sceneManager.scene, this.collisionSystem)

    this.setupCollisions()

    this.networkManager = new NetworkManager(this.sceneManager.scene, (playerId) => {
      console.log(`[Game] Connected as player: ${playerId}`)
      this.updateConnectionStatus(true, playerId)
    })

    this.networkManager.onPlayerAdded = (remotePlayer) => {
      if (remotePlayer.collider) {
        this.collisionSystem.addCollider(remotePlayer.collider)
      }
    }
    this.networkManager.onPlayerRemoved = (playerId) => {
      this.collisionSystem.removeCollider(`remote-player-${playerId}`)
    }

    this.networkManager.onChatMessage = (playerId, message) => {
      if (this.chatManager) {
        this.chatManager.addChatMessage(playerId, message)
      }
    }

    this.chatManager = new ChatManager(this.networkManager)

    document.addEventListener("chatFocus", () => {
      this.inputManager.enabled = false
    })
    document.addEventListener("chatBlur", () => {
      this.inputManager.enabled = true
    })

    this.setupSettingsPanel()
    this.setupMultiplayerUI()
    this.setupCollisionDebugUI()

    this.clock = new THREE.Clock()

    this.animate = this.animate.bind(this)
    requestAnimationFrame(this.animate)
  }

  setupCollisions() {
    // Esperar a que los modelos carguen para registrar colisionadores
    const checkAndAddColliders = () => {
      // Agregar colisionador del personaje local
      if (this.character.collider && !this.collisionSystem.getCollider("local-player")) {
        this.collisionSystem.addCollider(this.character.collider)
      }

      // Agregar colisionador del NPC
      if (this.npc.collider && !this.collisionSystem.getCollider(this.npc.id)) {
        this.collisionSystem.addCollider(this.npc.collider)
      }
    }

    // Verificar periódicamente hasta que los modelos carguen
    const interval = setInterval(() => {
      checkAndAddColliders()

      // Verificar si todos los colisionadores están registrados
      if (this.collisionSystem.getCollider("local-player") && this.collisionSystem.getCollider(this.npc.id)) {
        clearInterval(interval)
        console.log("[Game] All colliders registered")
      }
    }, 100)

    // Agregar algunas cajas de prueba en el entorno
    this.addEnvironmentColliders()
  }

  addEnvironmentColliders() {
    this.environmentBuilder.buildLevel() // estructura del nivel prueba 

    // Caja de prueba 1
    const box1 = new BoxCollider({
      id: "env-box-1",
      parent: { position: new THREE.Vector3(3, 0.5, 0) },
      size: new THREE.Vector3(1, 1, 1),
      layer: CollisionLayer.ENVIRONMENT,
      collidesWithMask: CollisionLayer.PLAYER,
      isStatic: true,
    })
    this.collisionSystem.addCollider(box1)

    // Crear mesh visual para la caja
    const boxMesh1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x8844aa }))
    boxMesh1.position.set(3, 0.5, 0)
    boxMesh1.castShadow = true
    boxMesh1.receiveShadow = true
    this.sceneManager.scene.add(boxMesh1)

    // Caja de prueba 2
    const box2 = new BoxCollider({
      id: "env-box-2",
      parent: { position: new THREE.Vector3(-3, 0.75, 2) },
      size: new THREE.Vector3(1.5, 1.5, 1.5),
      layer: CollisionLayer.ENVIRONMENT,
      collidesWithMask: CollisionLayer.PLAYER,
      isStatic: true,
    })
    this.collisionSystem.addCollider(box2)

    const boxMesh2 = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.5, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x44aa88 }),
    )
    boxMesh2.position.set(-3, 0.75, 2)
    boxMesh2.castShadow = true
    boxMesh2.receiveShadow = true
    this.sceneManager.scene.add(boxMesh2)
  }

  setupCollisionDebugUI() { //boton checkbox para mostrar colisiones

    document.getElementById("debug-collisions").addEventListener("change", (e) => {
      this.collisionSystem.setDebugMode(e.target.checked)
    })
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
  }

  animate() {
    requestAnimationFrame(this.animate)

    const dt = this.clock.getDelta()

    this.character.update(dt, this.inputManager, this.collisionSystem)
    this.npc.update(dt)

    this.networkManager.update(dt)

    this.collisionSystem.update()

    this.networkManager.remotePlayers.forEach((player) => {
      if (player.collider && !this.collisionSystem.getCollider(player.collider.id)) {
        this.collisionSystem.addCollider(player.collider)
      }
    })

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
