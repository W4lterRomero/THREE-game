import * as THREE from "three"
import { RemotePlayer } from "./RemotePlayer.js"

export class NetworkManager {
    constructor(scene, onConnected) {
        this.scene = scene
        this.socket = null
        this.playerId = null
        this.remotePlayers = new Map() // Map<playerId, RemotePlayer>
        this.onConnected = onConnected
        this.isConnected = false
        this.serverUrl = null

        // Interpolation settings
        this.updateRate = 1000 / 20 // 20 updates per second
        this.lastUpdateTime = 0
    }

    connect(serverUrl) {
        this.serverUrl = serverUrl

        try {
            this.socket = new WebSocket(serverUrl)

            this.socket.onopen = () => {
                console.log("[Network] Connected to server")
                this.isConnected = true
            }

            this.socket.onmessage = (event) => {
                const message = JSON.parse(event.data)
                this.handleMessage(message)
            }

            this.socket.onclose = () => {
                console.log("[Network] Disconnected from server")
                this.isConnected = false
                this.playerId = null

                // Clean up remote players
                this.remotePlayers.forEach((player) => {
                    player.dispose()
                })
                this.remotePlayers.clear()

                // Try to reconnect after 3 seconds
                setTimeout(() => {
                    if (this.serverUrl) {
                        console.log("[Network] Attempting to reconnect...")
                        this.connect(this.serverUrl)
                    }
                }, 3000)
            }

            this.socket.onerror = (error) => {
                console.error("[Network] WebSocket error:", error)
            }
        } catch (error) {
            console.error("[Network] Failed to connect:", error)
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case "welcome":
                // Server assigned us an ID
                this.playerId = message.playerId
                console.log(`[Network] Assigned player ID: ${this.playerId}`)
                if (this.onConnected) {
                    this.onConnected(this.playerId)
                }
                break

            case "playerJoined":
                // A new player joined
                if (message.playerId !== this.playerId) {
                    this.addRemotePlayer(message.playerId, message.position, message.rotation)
                    console.log(`[Network] Player ${message.playerId} joined`)
                }
                break

            case "playerLeft":
                // A player left
                this.removeRemotePlayer(message.playerId)
                console.log(`[Network] Player ${message.playerId} left`)
                break

            case "playerUpdate":
                // Update remote player position
                if (message.playerId !== this.playerId) {
                    this.updateRemotePlayer(message.playerId, message.position, message.rotation, message.animation)
                }
                break

            case "gameState":
                // Full game state (all current players)
                message.players.forEach((playerData) => {
                    if (playerData.id !== this.playerId) {
                        if (!this.remotePlayers.has(playerData.id)) {
                            this.addRemotePlayer(playerData.id, playerData.position, playerData.rotation)
                        } else {
                            this.updateRemotePlayer(playerData.id, playerData.position, playerData.rotation, playerData.animation)
                        }
                    }
                })
                break
        }
    }

    addRemotePlayer(playerId, position, rotation) {
        if (this.remotePlayers.has(playerId)) return

        const spawnPosition = new THREE.Vector3(
            position?.x || Math.random() * 10 - 5,
            position?.y || 0,
            position?.z || Math.random() * 10 - 5,
        )

        const remotePlayer = new RemotePlayer(this.scene, playerId, spawnPosition)
        if (rotation !== undefined) {
            remotePlayer.setRotation(rotation)
        }
        this.remotePlayers.set(playerId, remotePlayer)
    }

    removeRemotePlayer(playerId) {
        const player = this.remotePlayers.get(playerId)
        if (player) {
            player.dispose()
            this.remotePlayers.delete(playerId)
        }
    }

    updateRemotePlayer(playerId, position, rotation, animation) {
        let player = this.remotePlayers.get(playerId)

        if (!player) {
            // Player doesn't exist yet, create them
            this.addRemotePlayer(playerId, position, rotation)
            player = this.remotePlayers.get(playerId)
        }

        if (player) {
            player.setTargetPosition(position.x, position.y, position.z)
            player.setRotation(rotation)
            if (animation) {
                player.switchAnimation(animation)
            }
        }
    }

    sendPlayerUpdate(position, rotation, animation) {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return

        const now = Date.now()
        if (now - this.lastUpdateTime < this.updateRate) return
        this.lastUpdateTime = now

        const message = {
            type: "playerUpdate",
            position: {
                x: position.x,
                y: position.y,
                z: position.z,
            },
            rotation: rotation,
            animation: animation,
        }

        this.socket.send(JSON.stringify(message))
    }

    update(dt) {
        // Update all remote players (interpolation)
        this.remotePlayers.forEach((player) => {
            player.update(dt)
        })
    }

    getPlayerCount() {
        return this.remotePlayers.size + (this.isConnected ? 1 : 0)
    }

    disconnect() {
        if (this.socket) {
            this.socket.close()
            this.socket = null
        }
        this.isConnected = false
        this.serverUrl = null
    }
}
