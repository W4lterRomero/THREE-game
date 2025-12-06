import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { CapsuleCollider, CollisionLayer } from "./collision/index.js"

export class Character {
    constructor(scene, camera) {
        this.scene = scene
        this.camera = camera
        this.model = null
        this.mixer = null
        this.animations = {}
        this.currentAction = null

        this.cameraController = null

        // Physics
        this.velocity = new THREE.Vector3()
        this.direction = new THREE.Vector3()
        this.speed = 10
        this.gravity = 30
        this.jumpForce = 15
        this.onGround = true
        this.isGroundedCollision = false

        this.targetRotation = 0
        this.rotationSmoothness = 0.12
        this.rotationOffset = Math.PI

        this.collider = null

        this.loadModel()
    }

    setCameraController(cameraController) {
        this.cameraController = cameraController
    }

    loadModel() {
        const loader = new GLTFLoader()
        loader.load(
            "https://threejs.org/examples/models/gltf/Soldier.glb",
            (gltf) => {
                this.model = gltf.scene
                this.model.rotation.y = this.rotationOffset
                this.scene.add(this.model)

                this.model.traverse((object) => {
                    if (object.isMesh) object.castShadow = true
                })

                this.mixer = new THREE.AnimationMixer(this.model)
                const clips = gltf.animations

                this.animations["Idle"] = this.mixer.clipAction(THREE.AnimationClip.findByName(clips, "Idle"))
                this.animations["Run"] = this.mixer.clipAction(THREE.AnimationClip.findByName(clips, "Run"))
                this.animations["Walk"] = this.mixer.clipAction(THREE.AnimationClip.findByName(clips, "Walk"))

                this.switchAnimation("Idle")

                this.collider = new CapsuleCollider({
                    id: "local-player",
                    parent: this.model,
                    radius: 0.4,
                    height: 1.8,
                    offset: new THREE.Vector3(0, 0.9, 0),
                    layer: CollisionLayer.PLAYER,
                    collidesWithMask: CollisionLayer.REMOTE_PLAYER | CollisionLayer.NPC | CollisionLayer.ENVIRONMENT,
                    manualResolution: true, // IMPORTANT: Disable auto resolution to handle slope logic manually
                    id: "local-player",
                    parent: this.model,
                    radius: 0.4,
                    height: 1.8,
                    offset: new THREE.Vector3(0, 0.9, 0),
                    layer: CollisionLayer.PLAYER,
                    collidesWithMask: CollisionLayer.REMOTE_PLAYER | CollisionLayer.NPC | CollisionLayer.ENVIRONMENT,
                    onCollisionEnter: (other, response) => {
                        console.log(`[Character] Collision started with: ${other.id}`)
                        if (response && response.normal.y > 0.5) {
                            this.isGroundedCollision = true
                            this.velocity.y = 0
                            this.onGround = true
                        }
                    },
                    onCollisionStay: (other, response) => {
                        if (response && response.normal.y > 0.5) {
                            this.isGroundedCollision = true
                            this.velocity.y = 0
                            this.onGround = true
                        }
                    },
                    onCollisionExit: (other) => {
                        console.log(`[Character] Collision ended with: ${other.id}`)
                    },
                })

                const loading = document.getElementById("loading")
                if (loading) loading.style.display = "none"
            },
            undefined,
            (error) => {
                console.error("An error happened loading the model:", error)
            },
        )
    }

    switchAnimation(name) {
        if (!this.animations[name]) return
        const action = this.animations[name]
        if (this.currentAction === action) return

        if (this.currentAction) {
            this.currentAction.fadeOut(0.2)
        }
        action.reset().fadeIn(0.2).play()
        this.currentAction = action
    }

    update(dt, input, collisionSystem) {
        if (!this.model) return

        this.direction.set(0, 0, 0)

        let moveX = 0
        let moveZ = 0

        if (input.keys.forward) moveZ += 1
        if (input.keys.backward) moveZ -= 1
        if (input.keys.left) moveX -= 1
        if (input.keys.right) moveX += 1

        const hasMovement = moveX !== 0 || moveZ !== 0

        // Handle rotation and direction calculation
        if (hasMovement && this.cameraController) {
            const forward = this.cameraController.getForwardDirection()
            const right = this.cameraController.getRightDirection()

            // Calculate world-space movement direction
            this.direction.x = forward.x * moveZ + right.x * moveX
            this.direction.z = forward.z * moveZ + right.z * moveX
            this.direction.normalize()

            if (this.cameraController.isFirstPerson) {
                this.targetRotation = this.cameraController.fpYaw + this.rotationOffset
                const moveDir = this.direction.clone()
                const dot = forward.dot(moveDir)
                if (this.animations["Run"]) {
                    this.animations["Run"].timeScale = dot >= -0.1 ? 1 : -1
                }
            } else {
                this.targetRotation = Math.atan2(this.direction.x, this.direction.z) + this.rotationOffset
                if (this.animations["Run"]) this.animations["Run"].timeScale = 1
            }

            const currentRotation = this.model.rotation.y
            let diff = this.targetRotation - currentRotation
            while (diff > Math.PI) diff -= Math.PI * 2
            while (diff < -Math.PI) diff += Math.PI * 2
            this.model.rotation.y += diff * this.rotationSmoothness

            this.switchAnimation("Run")
        } else {
            if (this.cameraController && this.cameraController.isFirstPerson) {
                this.targetRotation = this.cameraController.fpYaw + this.rotationOffset
                const currentRotation = this.model.rotation.y
                let diff = this.targetRotation - currentRotation
                while (diff > Math.PI) diff -= Math.PI * 2
                while (diff < -Math.PI) diff += Math.PI * 2
                this.model.rotation.y += diff * this.rotationSmoothness
            }
            this.switchAnimation("Idle")
        }

        // Calculate Velocity (Horizontal)
        if (hasMovement) {
            this.velocity.x = this.direction.x * this.speed
            this.velocity.z = this.direction.z * this.speed
        } else {
            this.velocity.x = 0
            this.velocity.z = 0
        }

        // --- Improved Gravity and Ground Detection ---

        // --- Improved Gravity and Ground Detection ---

        let groundHeight = -Infinity
        let isGrounded = false
        let groundNormal = new THREE.Vector3(0, 1, 0)
        let isOnSlimSlope = false

        if (collisionSystem) {
            const groundCheck = this.checkGround(collisionSystem)
            if (groundCheck.isGrounded) {
                groundNormal = groundCheck.normal

                // Calculate slope angle
                const up = new THREE.Vector3(0, 1, 0)
                const angle = groundNormal.angleTo(up)
                const maxSlopeAngle = Math.PI / 4 // 45 degrees

                if (angle > maxSlopeAngle) {
                    // Too steep! Slide.
                    isGrounded = false // Treat as air (gravity applies)
                    isOnSlimSlope = true

                    // Slide force
                    const slideDirection = new THREE.Vector3(0, -1, 0)
                        .projectOnPlane(groundNormal)
                        .normalize()

                    // Apply slide velocity (stronger on steeper slopes)
                    // Use a higher slide speed factor if requested "fast red ramp"
                    const slideSpeed = 20 * dt
                    this.velocity.add(slideDirection.multiplyScalar(slideSpeed))

                } else {
                    isGrounded = true
                    groundHeight = groundCheck.groundHeight
                }
            }
        } else {
            if (this.model.position.y <= 0) {
                isGrounded = true
                groundHeight = 0
            }
        }

        // Jump
        if (isGrounded && input.keys.jump) {
            this.velocity.y = this.jumpForce
            this.onGround = false
            this.model.position.y += 0.2
        }
        else if (isGrounded && this.velocity.y <= 0) {
            this.onGround = true
            this.velocity.y = 0

            // PROJECT HORIZONTAL VELOCITY ONTO SLOPE
            // This is key for smooth ramp walking without "stutter"
            if (groundNormal.y < 0.99) { // If on a slope
                // Project current horizontal velocity onto the plane defined by groundNormal
                const horizontalVel = new THREE.Vector3(this.velocity.x, 0, this.velocity.z)
                // P_new = V - (V dot N) * N
                // Actually simpler: Vector3.projectOnPlane
                const slopeVel = horizontalVel.clone().projectOnPlane(groundNormal).normalize().multiplyScalar(this.speed)

                // Only apply if we are actually moving
                if (hasMovement) {
                    this.velocity.x = slopeVel.x
                    this.velocity.y = slopeVel.y // This adds "up" velocity from the slope automatically! 
                    this.velocity.z = slopeVel.z
                }
            }

            // Snap to ground
            if (Math.abs(this.model.position.y - groundHeight) < 0.5) {
                this.model.position.y = groundHeight
            }
        } else {
            this.onGround = false
            this.velocity.y -= this.gravity * dt
        }

        // Apply Position
        const deltaPosition = this.velocity.clone().multiplyScalar(dt)

        // Check for Wall Collisions before applying 
        // Simple manual sweep: Check if new position overlaps environment
        if (collisionSystem && this.collider) {
            const nextPos = this.model.position.clone().add(deltaPosition)
            // We need to check collision at nextPos.
            // But we can't easily move the collider without moving the mesh (parent).
            // So we use overlapSphere with a proxy at nextPos?
            // Or simpler: Move, check overlap, resolve (slide).

            this.model.position.add(deltaPosition)
            this.collider.updateWorldPosition() // ensure collider follows

            // Check overlap
            const hits = collisionSystem.overlapSphere(this.model.position.clone().add(new THREE.Vector3(0, 0.9, 0)), 0.5, CollisionLayer.ENVIRONMENT)
            // This is a rough check. Ideally we check the capsule.
            // But let's reuse checkCollision logic via manual iteration if needed.
            // For now, let's rely on `resolveCollision` logic but implemented MANUALLY here for "Slide".

            // Actually, since we disabled auto-resolution, we can iterate colliders and resolve manually.
            const colliders = Array.from(collisionSystem.colliders.values())
            for (const other of colliders) {
                if (other === this.collider) continue
                if (!other.enabled) continue

                // Skip if not Environment
                if (!(other.layer & CollisionLayer.ENVIRONMENT)) continue

                if (collisionSystem.checkCollision(this.collider, other)) {
                    const response = collisionSystem.getCollisionResponse(this.collider, other)
                    // If we hit a wall (horizontal normal), slide along it.
                    // If we hit a floor (vertical normal), we ignore it (handled by checkGround).

                    if (Math.abs(response.normal.y) < 0.5) { // Wall
                        // Push out
                        const push = response.normal.clone().multiplyScalar(response.overlap)
                        this.model.position.add(push)
                        this.collider.updateWorldPosition()
                    }
                }
            }
        } else {
            this.model.position.add(deltaPosition)
        }

        // Lower bound safety
        if (this.model.position.y < -50) {
            this.model.position.set(0, 10, 0)
            this.velocity.set(0, 0, 0)
        }

        if (this.mixer) {
            this.mixer.update(dt)
        }
    }

    checkGround(collisionSystem) {
        if (!this.model) return { isGrounded: false }

        const raySameHeight = 0.5
        const rayLen = 1.0 // Look down far enough
        const rayOriginCenter = this.model.position.clone()
        rayOriginCenter.y += raySameHeight

        const offsets = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0.3, 0, 0),
            new THREE.Vector3(-0.3, 0, 0),
            new THREE.Vector3(0, 0, 0.3),
            new THREE.Vector3(0, 0, -0.3)
        ]

        // Redo to capture best hit normal? 
        // Optimization: track bestHit object
        // Let's rewrite the loop above properly in a following edit or now?
        // Let's rely on standard logic:

        // Actually, to make it robust, we should restructure the loop.
        // Let's do it right.

        let bestHit = null;

        for (const offset of offsets) {
            const origin = rayOriginCenter.clone().add(offset)
            const hits = collisionSystem.raycast(origin, new THREE.Vector3(0, -1, 0), rayLen, CollisionLayer.ENVIRONMENT | CollisionLayer.DEFAULT)

            for (const hit of hits) {
                if (hit.collider.id !== "local-player") {
                    if (!bestHit || hit.point.y > bestHit.point.y) {
                        bestHit = hit
                    }
                    break
                }
            }
        }

        if (bestHit) {
            const currentY = this.model.position.y
            const diff = bestHit.point.y - currentY

            if (diff <= 0.6 && diff >= -rayLen) {
                return {
                    isGrounded: true,
                    groundHeight: bestHit.point.y,
                    normal: bestHit.normal
                }
            }
        }

        return { isGrounded: false, normal: new THREE.Vector3(0, 1, 0) }
    }

    getPosition() {
        return this.model ? this.model.position.clone() : new THREE.Vector3()
    }

    getRotation() {
        return this.model ? this.model.rotation.y : 0
    }

    getCollider() {
        return this.collider
    }
}
