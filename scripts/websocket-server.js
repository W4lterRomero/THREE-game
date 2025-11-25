// WebSocket Server for Multiplayer Game
// Run with: node scripts/websocket-server.js

import { WebSocketServer } from "ws"

const PORT = process.env.PORT || 8080

const wss = new WebSocketServer({ port: PORT })

// Store connected players
const players = new Map()

// Generate unique player ID
function generatePlayerId() {
    return "player_" + Math.random().toString(36).substring(2, 9)
}

// Broadcast message to all players except sender
function broadcast(message, excludeId = null) {
    const messageStr = JSON.stringify(message)
    wss.clients.forEach((client) => {
        if (client.readyState === 1) {
            // WebSocket.OPEN
            const clientId = client.playerId
            if (clientId !== excludeId) {
                client.send(messageStr)
            }
        }
    })
}

// Broadcast to all players including sender
function broadcastAll(message) {
    const messageStr = JSON.stringify(message)
    wss.clients.forEach((client) => {
        if (client.readyState === 1) {
            client.send(messageStr)
        }
    })
}

console.log(`WebSocket server starting on port ${PORT}...`)

wss.on("connection", (ws) => {
    // Assign player ID
    const playerId = generatePlayerId()
    ws.playerId = playerId

    // Initial spawn position
    const spawnPosition = {
        x: Math.random() * 10 - 5,
        y: 0,
        z: Math.random() * 10 - 5,
    }

    // Store player data
    players.set(playerId, {
        id: playerId,
        position: spawnPosition,
        rotation: 0,
        animation: "Idle",
    })

    console.log(`Player connected: ${playerId} (Total: ${players.size})`)

    // Send welcome message with player ID
    ws.send(
        JSON.stringify({
            type: "welcome",
            playerId: playerId,
        }),
    )

    // Send current game state (all existing players)
    const existingPlayers = Array.from(players.values()).filter((p) => p.id !== playerId)
    if (existingPlayers.length > 0) {
        ws.send(
            JSON.stringify({
                type: "gameState",
                players: existingPlayers,
            }),
        )
    }

    // Notify other players about new player
    broadcast(
        {
            type: "playerJoined",
            playerId: playerId,
            position: spawnPosition,
            rotation: 0,
        },
        playerId,
    )

    // Handle incoming messages
    ws.on("message", (data) => {
        try {
            const message = JSON.parse(data)

            switch (message.type) {
                case "playerUpdate":
                    // Update player state
                    const player = players.get(playerId)
                    if (player) {
                        player.position = message.position
                        player.rotation = message.rotation
                        player.animation = message.animation
                    }

                    // Broadcast to other players
                    broadcast(
                        {
                            type: "playerUpdate",
                            playerId: playerId,
                            position: message.position,
                            rotation: message.rotation,
                            animation: message.animation,
                        },
                        playerId,
                    )
                    break

                case "chat":
                    // Broadcast chat message
                    broadcastAll({
                        type: "chat",
                        playerId: playerId,
                        message: message.text,
                    })
                    break
            }
        } catch (error) {
            console.error("Error parsing message:", error)
        }
    })

    // Handle disconnect
    ws.on("close", () => {
        console.log(`Player disconnected: ${playerId} (Total: ${players.size - 1})`)
        players.delete(playerId)

        // Notify other players
        broadcast({
            type: "playerLeft",
            playerId: playerId,
        })
    })

    ws.on("error", (error) => {
        console.error(`WebSocket error for ${playerId}:`, error)
    })
})

wss.on("listening", () => {
    console.log(`WebSocket server is running on ws://localhost:${PORT}`)
    console.log("Waiting for players to connect...")
})
