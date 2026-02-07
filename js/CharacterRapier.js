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
        this.polygonModel = null // Polygon Model Group
        this.currentType = 'glb' // 'glb' or 'polygon'

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

        // No-Clip / Build Mode Ghost
        this.noClip = false

        this.loadModel()
        this.createPolygonModel() // Initialize Polygon Model hidden
        this.initPhysics()
    }

    setModelType(type) {
        console.log("setModelType called with:", type, "Current:", this.currentType)
        if (this.currentType === type) {
            console.log("Type matches current, skipping (unless debug force?)")
            return
        }
        this.currentType = type

        console.log("Switching model visibility...")
        if (type === 'glb') {
            if (this.model) this.model.visible = true
            if (this.polygonModel) this.polygonModel.visible = false
        } else {
            if (this.model) this.model.visible = false
            if (this.polygonModel) this.polygonModel.visible = true
        }
    }

    createPolygonModel() {
        this.polygonModel = new THREE.Group()
        this.polygonModel.visible = false // Start hidden

        // Materials
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.5 })
        const shirtMat = new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.9 })
        const pantsMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })
        const shoesMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x4a3c31, roughness: 1.0 }) // Dark Brown
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.2 })

        // --- Body ---
        this.polyBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), shirtMat)
        this.polyBody.position.y = 0.35 + 0.7 // Legs height approx
        this.polyBody.castShadow = true
        this.polygonModel.add(this.polyBody)

        // --- Head ---
        this.polyHead = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skinMat)
        this.polyHead.position.set(0, 0.35 + 0.2, 0) // On top of body
        this.polyBody.add(this.polyHead)

        // Hair
        const hair = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.42), hairMat)
        hair.position.y = 0.2
        this.polyHead.add(hair)

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05)
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat)
        leftEye.position.set(-0.1, 0.05, 0.2)
        this.polyHead.add(leftEye)

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat)
        rightEye.position.set(0.1, 0.05, 0.2)
        this.polyHead.add(rightEye)

        // --- Arms (Pivoted at shoulder) ---
        // Right Arm
        this.polyRightArm = new THREE.Group()
        this.polyRightArm.position.set(0.35, 0.25, 0) // Shoulder pos relative to body
        this.polyBody.add(this.polyRightArm)

        const rArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), skinMat)
        rArmMesh.position.y = -0.35 // Center of arm relative to pivot
        rArmMesh.castShadow = true
        this.polyRightArm.add(rArmMesh)

        // Sleeve
        const rSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), shirtMat)
        rSleeve.position.y = -0.1
        this.polyRightArm.add(rSleeve)

        // Left Arm
        this.polyLeftArm = new THREE.Group()
        this.polyLeftArm.position.set(-0.35, 0.25, 0)
        this.polyBody.add(this.polyLeftArm)

        const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), skinMat)
        lArmMesh.position.y = -0.35
        lArmMesh.castShadow = true
        this.polyLeftArm.add(lArmMesh)

        // Sleeve
        const lSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), shirtMat)
        lSleeve.position.y = -0.1
        this.polyLeftArm.add(lSleeve)

        // --- Legs (Pivoted at Hip) ---

        // Right Leg
        this.polyRightLeg = new THREE.Group()
        this.polyRightLeg.position.set(0.15, 0.7, 0) // Hip height
        this.polygonModel.add(this.polyRightLeg)

        const rLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), pantsMat)
        rLegMesh.position.y = -0.35
        rLegMesh.castShadow = true
        this.polyRightLeg.add(rLegMesh)

        // Shoes
        const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.35), shoesMat)
        rShoe.position.y = -0.7 + 0.075
        rShoe.position.z = 0.05 // Slightly forward
        rShoe.castShadow = true
        this.polyRightLeg.add(rShoe)

        // Left Leg
        this.polyLeftLeg = new THREE.Group()
        this.polyLeftLeg.position.set(-0.15, 0.7, 0)
        this.polygonModel.add(this.polyLeftLeg)

        const lLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), pantsMat)
        lLegMesh.position.y = -0.35
        lLegMesh.castShadow = true
        this.polyLeftLeg.add(lLegMesh)

        // Shoes
        const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.35), shoesMat)
        lShoe.position.y = -0.7 + 0.075
        lShoe.position.z = 0.05
        lShoe.castShadow = true
        this.polyLeftLeg.add(lShoe)


        this.scene.add(this.polygonModel)
    }

    updatePolygonAnimation(dt, isMoving) {
        if (!this.polygonModel) return

        if (isMoving) {
            const speed = 10
            const angle = Math.sin(Date.now() / 1000 * speed)

            // Walk Cycle
            this.polyRightArm.rotation.x = angle
            this.polyLeftArm.rotation.x = -angle

            this.polyRightLeg.rotation.x = -angle
            this.polyLeftLeg.rotation.x = angle
        } else {
            // Idle
            this.polyRightArm.rotation.x = THREE.MathUtils.lerp(this.polyRightArm.rotation.x, 0, 0.1)
            this.polyLeftArm.rotation.x = THREE.MathUtils.lerp(this.polyLeftArm.rotation.x, 0, 0.1)
            this.polyRightLeg.rotation.x = THREE.MathUtils.lerp(this.polyRightLeg.rotation.x, 0, 0.1)
            this.polyLeftLeg.rotation.x = THREE.MathUtils.lerp(this.polyLeftLeg.rotation.x, 0, 0.1)
        }
    }

    setNoClip(enabled) {
        this.noClip = enabled
        // If enabling no-clip, we might want to ensure flying is on or gravity off? 
        // For now, keep them separate or link them? 
        // User asked for "disable collision", which implies flying through things usually.
        // Let's force flight if noclip is on? Or just gravity exemption?
        // Let's keep it simple: NoClip simply ignores barriers. 
        if (enabled) {
            console.log("No-Clip Enabled")
        } else {
            console.log("No-Clip Disabled")
        }
    }

    applyImpulse(force) {
        // ... unchanged ...
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

    // ... initPhysics ... (unchanged, not included in replacement range unless needed)

    // ... 

    update(dt, input) {
        if (!this.rigidBody) return

        // 0. No-Clip Override
        if (this.noClip) {
            // In No-Clip, we behave like Spectator/God mode. 
            // - No Gravity
            // - Movement is direct translation
            // - Flight mechanics logic reused or custom?

            // Let's use logic similar to Flight but skipping computeColliderMovement
            let speed = this.speed * 2
            let moveDir = new THREE.Vector3()

            if (this.cameraController) {
                const camDir = new THREE.Vector3()
                this.camera.getWorldDirection(camDir)
                const right = this.cameraController.getRightDirection()

                if (input.keys.forward) moveDir.add(camDir)
                if (input.keys.backward) moveDir.sub(camDir)
                if (input.keys.right) moveDir.add(right)
                if (input.keys.left) moveDir.sub(right)

                // Vertical
                if (input.keys.jump) moveDir.y += 1
                if (input.keys.crouch) moveDir.y -= 1 // Assuming crouch key exists or Shift?
                // Default shift usually runs. Let's stick to Camera Pitch for Up/Down + Jump for pure Up.
            }

            if (moveDir.lengthSq() > 0) {
                moveDir.normalize().multiplyScalar(speed * dt)
            }

            // Direct Translation (Bypassing Collider/Physics Solver)
            let newPos = this.rigidBody.translation()
            newPos.x += moveDir.x
            newPos.y += moveDir.y
            newPos.z += moveDir.z

            this.rigidBody.setNextKinematicTranslation(newPos)
            this.updateModelVisuals()
            return // Skip rest of update
        }

        // Flight Mode Check (Standard Physics-based Flight)
        if (this.isFlying) {
            // ... existing flight logic ...
            // We can defer to existing logic
            // But let's keep the existing checkFlightToggle here
        }

        // ... rest of update function ...

        // Flattening the code for replacement context:
        // We are inserting the noClip block at the start of update.
        // And we need to make sure we don't delete the rest.
        // Wait, replace block size is limited? 
        // I will use specific insertion using original lines.

        // ...

        // Retrying with precise target content for just the start of update + constructor
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

            // Visibility Check
            this.model.visible = (this.currentType === 'glb')

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

        // 0. No-Clip Override (God Mode)
        if (this.noClip) {
            let speed = this.speed * 2
            let moveDir = new THREE.Vector3()

            if (this.cameraController) {
                const camDir = new THREE.Vector3()
                this.camera.getWorldDirection(camDir)
                const right = this.cameraController.getRightDirection()

                if (input.keys.forward) moveDir.add(camDir)
                if (input.keys.backward) moveDir.sub(camDir)
                if (input.keys.right) moveDir.add(right)
                if (input.keys.left) moveDir.sub(right)

                if (input.keys.jump) moveDir.y += 1
                // Shift to go down? Or keep simple.
            }

            if (moveDir.lengthSq() > 0) {
                moveDir.normalize().multiplyScalar(speed * dt)
            }

            // Direct Translation (Bypassing Collider/Physics Solver)
            let newPos = this.rigidBody.translation()
            newPos.x += moveDir.x
            newPos.y += moveDir.y
            newPos.z += moveDir.z

            this.rigidBody.setNextKinematicTranslation(newPos)
            this.updateModelVisuals()
            return // Skip physics update
        }

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

            if (this.currentType === 'glb') this.switchAnimation("Run")
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
            if (this.currentType === 'glb') this.switchAnimation("Idle")
        }

        // Update Polygon Animations
        if (this.currentType === 'polygon') {
            this.updatePolygonAnimation(dt, hasInput)
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
            desiredTranslation,
            RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
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
            desiredTranslation,
            RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
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
        if (!this.rigidBody) return

        const pos = this.rigidBody.translation()

        // GLB Model
        if (this.model && this.model.visible) {
            this.model.position.set(pos.x, pos.y, pos.z)
            this.model.rotation.y = this.currentRotation
        }

        // Polygon Model
        if (this.polygonModel && this.polygonModel.visible) {
            this.polygonModel.position.set(pos.x, pos.y, pos.z)
            this.polygonModel.rotation.y = this.currentRotation
        }
    }

    getPosition() {
        if (this.model && this.model.visible) return this.model.position.clone()
        if (this.polygonModel && this.polygonModel.visible) return this.polygonModel.position.clone()
        return new THREE.Vector3()
    }

    getRotation() {
        return this.currentRotation
    }
}
