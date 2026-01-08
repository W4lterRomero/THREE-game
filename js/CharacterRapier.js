import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

export class CharacterRapier {
    constructor(scene, world, camera, cameraController) {
        this.scene = scene
        this.world = world
        this.camera = camera
        this.cameraController = cameraController

        this.model = null
        this.mixer = null
        this.animations = {}
        this.currentAction = null

        this.rigidBody = null
        this.characterController = null

        // Settings
        this.speed = 10
        this.jumpForce = 20 // Rapier needs explicit impulses or vertical velocity handling
        this.grounded = false
        this.verticalVelocity = 0
        this.collider = null

        this.ladders = [] // Reference to ladders in level
        this.isClimbing = false

        this.rotationSmoothness = 0.15

        // Flight / Editor Mode
        this.canFly = false
        this.isFlying = false
        this.lastJumpTime = 0


        this.rotationSmoothness = 0.15
        this.currentRotation = 0

        // Momentum System
        this.momentum = new THREE.Vector3(0, 0, 0)
        this.momentumDamping = 2.0 // Friction/Air resistance for momentum

        this.loadModel()
        this.initPhysics()
    }

    applyImpulse(force) {
        // Add to current momentum
        this.momentum.add(force)

        // If force has Y component, handle vertical velocity explicitly
        if (force.y !== 0) {
            this.verticalVelocity = force.y
            // Remove Y from momentum to avoid double counting if we use momentum for XZ primarily
            // But let's keep it simple: Momentum handles XZ, verticalVelocity handles Y
            this.momentum.y = 0
            this.grounded = false // Force ungrounded
        }
    }

    initPhysics() {
        // 1. Create Rigid Body
        // KinematicPositionBased means we control position directly (via controller), perfect for characters
        let bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0)
        this.rigidBody = this.world.createRigidBody(bodyDesc)

        // 2. Create Collider (Capsule)
        // Radius 0.4, Total Height 1.8 -> HalfHeight = 0.9.
        // Rapier Capsule is (HalfHeight, Radius). Note: "HalfHeight" is the distance from center to hemisphere center.
        // Total Height = 2 * halfHeight + 2 * radius.
        // We want Total = 1.8. Radius = 0.4.
        // 1.8 = 2*hh + 0.8 => 1.0 = 2*hh => hh = 0.5.
        let colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.4).setTranslation(0, 0.9, 0)
        this.collider = this.world.createCollider(colliderDesc, this.rigidBody)

        // 3. Create Key Character Controller
        // offset 0.1 helps with small bumps
        this.characterController = this.world.createCharacterController(0.1)
        this.characterController.enableAutostep(0.6, 0.25, true) // Max height 0.6, Min width 0.25, include dynamic bodies
        this.characterController.enableSnapToGround(0.5) // Snap distance
        this.characterController.setApplyImpulsesToDynamicBodies(true) // Push boxes

        // Determine slope limit (45 deg = ~0.78 rad)
        this.characterController.setMaxSlopeClimbAngle(45 * Math.PI / 180);
        this.characterController.setMinSlopeSlideAngle(45 * Math.PI / 180);
    }

    loadModel() {
        const loader = new GLTFLoader()
        loader.load("https://threejs.org/examples/models/gltf/Soldier.glb", (gltf) => {
            this.model = gltf.scene
            this.scene.add(this.model)

            // Shadows
            this.model.traverse(o => { if (o.isMesh) o.castShadow = true })

            // Anim
            this.mixer = new THREE.AnimationMixer(this.model)
            this.animations["Idle"] = this.mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "Idle"))
            this.animations["Run"] = this.mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "Run"))
            this.switchAnimation("Idle")

            // Initial sync
            this.updateModelVisuals()

            // Hide Loading Screen
            const loading = document.getElementById("loading")
            if (loading) loading.style.display = "none"
        })
    }

    switchAnimation(name) {
        if (!this.animations[name]) return
        const action = this.animations[name]
        if (this.currentAction === action) return
        if (this.currentAction) this.currentAction.fadeOut(0.2)
        action.reset().fadeIn(0.2).play()
        this.currentAction = action
    }

    update(dt, input) {
        if (!this.rigidBody) return

        // Flight Mode Check
        if (this.isFlying) {
            // Handle Jump Toggle separately or just movement?
            // Checks for toggle are in Input/Jump section below? 
            // Better to handle flight movement entirely here and return.
            // BUT we need to check for "Double Jump" to exit flight too.
            this.checkFlightToggle(input)
            if (this.isFlying) {
                // Determine moveDir for flight
                let moveDir = new THREE.Vector3()
                if (input.keys.forward) moveDir.z += 1
                if (input.keys.backward) moveDir.z -= 1
                if (input.keys.left) moveDir.x -= 1
                if (input.keys.right) moveDir.x += 1

                this.handleFlightMovement(dt, input, moveDir)
                return
            }
        }

        // Double Jump Check (To Enter Flight)
        // Must be enabled by game mode (checked externally or flag set)
        if (this.canFly) { // Only if enabled
            this.checkFlightToggle(input)
        }


        // 1. Calculate Desired Movement (Velocity)
        let moveDir = new THREE.Vector3()
        if (input.keys.forward) moveDir.z += 1
        if (input.keys.backward) moveDir.z -= 1
        if (input.keys.left) moveDir.x -= 1
        if (input.keys.left) moveDir.x -= 1
        if (input.keys.right) moveDir.x += 1

        // Check for Ladder Interaction
        this.checkClimbing()

        // Camera relative
        let desiredTranslation = new THREE.Vector3()
        let hasInput = moveDir.lengthSq() > 0

        if (hasInput && this.cameraController) {
            const forward = this.cameraController.getForwardDirection()
            const right = this.cameraController.getRightDirection()

            desiredTranslation.x = forward.x * moveDir.z + right.x * moveDir.x
            desiredTranslation.z = forward.z * moveDir.z + right.z * moveDir.x
            desiredTranslation.normalize().multiplyScalar(this.speed * dt)

            // Rotation Logic
            let targetRotation = 0
            if (this.cameraController.isFirstPerson) {
                // In First Person: Character always faces Camera Direction (plus offset)
                // This ensures "strafing" doesn't turn the body 90 degrees
                targetRotation = this.cameraController.fpYaw + Math.PI
            } else {
                // In Third Person: Character faces Movement Direction
                targetRotation = Math.atan2(desiredTranslation.x, desiredTranslation.z) + Math.PI
            }

            // Smooth rotation
            let rotDiff = targetRotation - this.currentRotation
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
            this.currentRotation += rotDiff * this.rotationSmoothness

            this.switchAnimation("Run")
        } else {
            // Idle Logic with Deadzone
            if (this.cameraController && this.cameraController.isFirstPerson) {
                const cameraYaw = this.cameraController.fpYaw
                const offset = Math.PI // Model offset
                const limit = Math.PI / 2 // 90 degrees left/right = 180 total

                let angleDiff = (cameraYaw + offset) - this.currentRotation
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

                if (Math.abs(angleDiff) > limit) {
                    // Turn character to keep within limit
                    // If Diff > Limit, we are too far left (Camera > Body + Limit)
                    // We need Body = Camera - Limit
                    const targetBody = (cameraYaw + offset) - (Math.sign(angleDiff) * limit)

                    let correction = targetBody - this.currentRotation
                    while (correction > Math.PI) correction -= Math.PI * 2
                    while (correction < -Math.PI) correction += Math.PI * 2

                    // Apply correction smoothly but fast
                    this.currentRotation += correction * 5.0 * dt
                }
            }
            this.switchAnimation("Idle")
        }

        // 2. Physics Movement Calculation

        // Gravity is handled by the controller's "computeColliderMovement" IF we pass it? 
        // No, Rapier Controller expects "desired movement". We must add gravity manually to that vector.
        // We accumulate gravity in a custom velocity variable?

        // Simplified Gravity
        // If climbing, no gravity.
        if (this.isClimbing) {
            this.verticalVelocity = 0 // Reset standard gravity

            // Map Forward/Back to Up/Down
            if (input.keys.forward) this.verticalVelocity = 3
            if (input.keys.backward) this.verticalVelocity = -3

            // Override forward movement to be "Up" visually? 
            // Actually, we want W to go UP the ladder. And S to go DOWN.
            // But we also want to stick to the ladder?
            // Simple approach: When climbing, W/S controls Y, A/D controls X/Z (strafe).

            // Re-calculate moveDir usage for X/Z
            // If climbing, remove Z component from desiredTranslation calculation down below?
            // Actually, let's keep it simple. W usually moves forward.
            // On a ladder, Forward IS Up.

            // We need to suppress "Forward" causing Z-movement if we are moving Vertically.
            // Let's modify desiredTranslation after calculation or change inputs before.

        } else {
            // Gravity
            let gravityStep = -20 * dt
        }

        // Jump
        if (this.isClimbing) {
            // Allow jumping off?
            if (input.keys.jump) {
                this.isClimbing = false
                this.verticalVelocity = 5
                // Jump AWAY from ladder?
                // For now just up
            }
        } else if (this.characterController.computedGrounded() && input.keys.jump) {
            // We need vertical velocity state
            this.verticalVelocity = 10
        } else {
            // Simple state for jump curve
            if (this.verticalVelocity > -15) this.verticalVelocity -= 50 * dt // Gravity accumulation
        }

        // Reset gravity if Grounded
        // Note: computedGrounded() is from Last Frame's compute
        if (this.characterController.computedGrounded() && this.verticalVelocity <= 0) {
            this.verticalVelocity = -5 // Stick to ground force
        }

        if (this.isClimbing) {
            // If climbing, desiredTranslation.z (Forward) should be ZEROed out 
            // because we converted it to Vertical Velocity above?
            // Wait, I didn't zero it yet.

            // When climbing, "Forward" input makes us go UP.
            // So we shouldn't move Forward in XZ plane.
            if (input.keys.forward || input.keys.backward) {
                desiredTranslation.x = 0
                desiredTranslation.z = 0

                // If we want allow Strafing (A/D), we keep it. 
                if (input.keys.left || input.keys.right) {
                    // Recalculate just strafe
                    const right = this.cameraController.getRightDirection()
                    desiredTranslation.x = right.x * moveDir.x
                    desiredTranslation.z = right.z * moveDir.x
                    desiredTranslation.normalize().multiplyScalar(this.speed / 2 * dt) // Slower strafe
                }
            }
        }

        desiredTranslation.y = this.verticalVelocity * dt

        // Apply Momentum (Decay)
        // Damping
        const dampingFactor = Math.exp(-this.momentumDamping * dt)
        this.momentum.multiplyScalar(dampingFactor)

        // Threshold to zero out
        if (this.momentum.lengthSq() < 0.01) {
            this.momentum.set(0, 0, 0)
        }

        // Add momentum to translation
        desiredTranslation.add(this.momentum.clone().multiplyScalar(dt))

        // 3. EXECUTE MOVEMENT
        this.characterController.computeColliderMovement(
            this.collider,
            desiredTranslation
        )

        // 4. Apply result to RigidBody
        let correctedMovement = this.characterController.computedMovement()
        let newPos = this.rigidBody.translation()
        newPos.x += correctedMovement.x
        newPos.y += correctedMovement.y
        newPos.z += correctedMovement.z

        this.rigidBody.setNextKinematicTranslation(newPos)

        // 5. Update Visuals (Mesh)
        this.updateModelVisuals()

        if (this.mixer) this.mixer.update(dt)
    }

    // --- Flight Mode Logic ---
    toggleFlight() {
        this.isFlying = !this.isFlying
        this.verticalVelocity = 0
        this.momentum.set(0, 0, 0)
        console.log("Flight Mode:", this.isFlying)
    }

    handleFlightMovement(dt, input, moveDir) {
        // No gravity
        this.verticalVelocity = 0

        let desiredTranslation = new THREE.Vector3()
        let speed = this.speed * 2 // Faster fly

        if (this.cameraController) {
            const forward = this.cameraController.getForwardDirection()
            const right = this.cameraController.getRightDirection()

            // Fly uses camera forward for Z (Pitch included) equivalent?
            // Usually creative flight: W moves in Camera Direction (including Y)
            let camDir = new THREE.Vector3()
            this.camera.getWorldDirection(camDir)

            // Re-calculate move based on camera Look vector for "Free Cam" feel
            if (input.keys.forward) desiredTranslation.add(camDir)
            if (input.keys.backward) desiredTranslation.sub(camDir)
            if (input.keys.right) desiredTranslation.add(right)
            if (input.keys.left) desiredTranslation.sub(right)

            // Space / Shift for straight Up/Down
            if (input.keys.jump) desiredTranslation.y += 1
            // Basic crouch/down key? Let's use Shift (running) or C? 
            // Usually Shift is down in some editors, or Control. 
            // Rapier Controller doesn't have "C". Let's use a convention if possible.
            // For now, rely on Camera Look + W/S to change altitude effortlessly.
            // And Jump to go straight up.
        }

        if (desiredTranslation.lengthSq() > 0) {
            desiredTranslation.normalize().multiplyScalar(speed * dt)
        }

        // Apply
        this.characterController.computeColliderMovement(
            this.collider,
            desiredTranslation
        )
        let corrected = this.characterController.computedMovement()
        let newPos = this.rigidBody.translation()
        newPos.x += corrected.x
        newPos.y += corrected.y
        newPos.z += corrected.z
        this.rigidBody.setNextKinematicTranslation(newPos)

        this.updateModelVisuals()
    }

    checkFlightToggle(input) {
        if (input.keys.jump && !this.wasJumpDown) {
            const now = Date.now()
            if (now - this.lastJumpTime < 300) { // 300ms double click
                this.toggleFlight()
            }
            this.lastJumpTime = now
        }
        this.wasJumpDown = input.keys.jump
    }

    checkClimbing() {
        if (!this.ladders || this.ladders.length === 0) return

        const myPos = this.getPosition()
        // Simple bounding box check
        // Player height center
        const center = myPos.clone().add(new THREE.Vector3(0, 1, 0))

        let touchingLadder = false

        for (const ladder of this.ladders) {
            if (ladder.bounds.containsPoint(center)) {
                touchingLadder = true
                break
            }
        }

        // State transition
        if (touchingLadder && !this.isClimbing) {
            // Only enter climbing if moving forward? Or auto?
            // Auto is easier
            this.isClimbing = true
            this.verticalVelocity = 0
        } else if (!touchingLadder && this.isClimbing) {
            this.isClimbing = false
        }
    }

    updateModelVisuals() {
        if (!this.model || !this.rigidBody) return

        const pos = this.rigidBody.translation()
        this.model.position.set(pos.x, pos.y, pos.z)
        // Apply rotation (Calculated manually for character)
        this.model.rotation.y = this.currentRotation
    }

    getPosition() {
        if (this.model) return this.model.position.clone()
        return new THREE.Vector3()
    }

    getRotation() {
        return this.currentRotation
    }
}
