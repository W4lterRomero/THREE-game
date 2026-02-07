import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"
import { GLBModel } from "./GLBModel.js"
import { PolygonModel } from "./PolygonModel.js"

export class CharacterController {
    constructor(scene, world, camera, cameraController) {
        this.scene = scene
        this.world = world
        this.camera = camera
        this.cameraController = cameraController

        // Models
        this.glbModel = new GLBModel(scene)
        this.polygonModel = new PolygonModel(scene)
        this.currentType = 'glb' // 'glb' or 'polygon'

        this.rigidBody = null
        this.characterController = null

        // Settings
        this.speed = 10
        this.jumpForce = 20
        this.grounded = false
        this.verticalVelocity = 0
        this.collider = null

        this.ladders = [] // Reference to ladders in level
        this.isClimbing = false

        this.rotationSmoothness = 0.15
        this.currentRotation = 0

        // Flight / Editor Mode
        this.canFly = false
        this.isFlying = false
        this.lastJumpTime = 0

        // Momentum System
        this.momentum = new THREE.Vector3(0, 0, 0)
        this.momentumDamping = 2.0

        // No-Clip / Build Mode Ghost
        this.noClip = false

        this.initPhysics()
        this.setModelType(this.currentType) // Initialize visibility
    }

    setModelType(type) {
        console.log("Setting Model Type:", type)
        this.currentType = type

        if (type === 'glb') {
            this.glbModel.setVisible(true)
            this.polygonModel.setVisible(false)
        } else {
            this.glbModel.setVisible(false)
            this.polygonModel.setVisible(true)
        }
    }

    initPhysics() {
        // 1. Create Rigid Body
        let bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0)
        this.rigidBody = this.world.createRigidBody(bodyDesc)

        // 2. Create Collider (Capsule)
        let colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.4).setTranslation(0, 0.9, 0)
        this.collider = this.world.createCollider(colliderDesc, this.rigidBody)

        // 3. Create Key Character Controller
        this.characterController = this.world.createCharacterController(0.1)
        this.characterController.enableAutostep(0.6, 0.25, true)
        this.characterController.enableSnapToGround(0.5)
        this.characterController.setApplyImpulsesToDynamicBodies(true)

        this.characterController.setMaxSlopeClimbAngle(45 * Math.PI / 180);
        this.characterController.setMinSlopeSlideAngle(45 * Math.PI / 180);
    }

    setNoClip(enabled) {
        this.noClip = enabled
        console.log("No-Clip", enabled ? "Enabled" : "Disabled")
    }

    applyImpulse(force) {
        this.momentum.add(force)
        if (force.y !== 0) {
            this.verticalVelocity = force.y
            this.momentum.y = 0
            this.grounded = false
        }
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
            }

            if (moveDir.lengthSq() > 0) {
                moveDir.normalize().multiplyScalar(speed * dt)
            }

            let newPos = this.rigidBody.translation()
            newPos.x += moveDir.x
            newPos.y += moveDir.y
            newPos.z += moveDir.z

            this.rigidBody.setNextKinematicTranslation(newPos)
            this.updateModelVisuals()
            return
        }

        // Flight Mode Check
        if (this.isFlying) {
            this.checkFlightToggle(input)
            if (this.isFlying) {
                let moveDir = new THREE.Vector3()
                if (input.keys.forward) moveDir.z += 1
                if (input.keys.backward) moveDir.z -= 1
                if (input.keys.left) moveDir.x -= 1
                if (input.keys.right) moveDir.x += 1

                this.handleFlightMovement(dt, input, moveDir)
                return
            }
        }

        // Double Jump Check
        if (this.canFly) {
            this.checkFlightToggle(input)
        }

        // 1. Calculate Desired Movement
        let moveDir = new THREE.Vector3()
        if (input.keys.forward) moveDir.z += 1
        if (input.keys.backward) moveDir.z -= 1
        if (input.keys.left) moveDir.x -= 1
        if (input.keys.right) moveDir.x += 1

        this.checkClimbing()

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
                targetRotation = this.cameraController.fpYaw + Math.PI
            } else {
                targetRotation = Math.atan2(desiredTranslation.x, desiredTranslation.z) + Math.PI
            }

            let rotDiff = targetRotation - this.currentRotation
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
            this.currentRotation += rotDiff * this.rotationSmoothness

        } else {
            // Idle Logic with Deadzone
            if (this.cameraController && this.cameraController.isFirstPerson) {
                const cameraYaw = this.cameraController.fpYaw
                const offset = Math.PI
                const limit = Math.PI / 2

                let angleDiff = (cameraYaw + offset) - this.currentRotation
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

                if (Math.abs(angleDiff) > limit) {
                    const targetBody = (cameraYaw + offset) - (Math.sign(angleDiff) * limit)
                    let correction = targetBody - this.currentRotation
                    while (correction > Math.PI) correction -= Math.PI * 2
                    while (correction < -Math.PI) correction += Math.PI * 2
                    this.currentRotation += correction * 5.0 * dt
                }
            }
        }

        // Update Model Animations
        this.glbModel.update(dt, hasInput)
        this.polygonModel.update(dt, hasInput)

        // 2. Physics Movement Calculation
        if (this.isClimbing) {
            this.verticalVelocity = 0
            if (input.keys.forward) this.verticalVelocity = 3
            if (input.keys.backward) this.verticalVelocity = -3

            if (input.keys.forward || input.keys.backward) {
                desiredTranslation.x = 0
                desiredTranslation.z = 0
                if (input.keys.left || input.keys.right) {
                    const right = this.cameraController.getRightDirection()
                    desiredTranslation.x = right.x * moveDir.x
                    desiredTranslation.z = right.z * moveDir.x
                    desiredTranslation.normalize().multiplyScalar(this.speed / 2 * dt)
                }
            }
        } else {
            let gravityStep = -20 * dt
        }

        // Jump
        if (this.isClimbing) {
            if (input.keys.jump) {
                this.isClimbing = false
                this.verticalVelocity = 5
            }
        } else if (this.characterController.computedGrounded() && input.keys.jump) {
            this.verticalVelocity = 10
        } else {
            if (this.verticalVelocity > -15) this.verticalVelocity -= 50 * dt
        }

        if (this.characterController.computedGrounded() && this.verticalVelocity <= 0) {
            this.verticalVelocity = -5
        }

        desiredTranslation.y = this.verticalVelocity * dt

        // Momentum
        const dampingFactor = Math.exp(-this.momentumDamping * dt)
        this.momentum.multiplyScalar(dampingFactor)
        if (this.momentum.lengthSq() < 0.01) {
            this.momentum.set(0, 0, 0)
        }
        desiredTranslation.add(this.momentum.clone().multiplyScalar(dt))

        // 3. EXECUTE MOVEMENT
        this.characterController.computeColliderMovement(
            this.collider,
            desiredTranslation,
            RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
        )

        let correctedMovement = this.characterController.computedMovement()
        let newPos = this.rigidBody.translation()
        newPos.x += correctedMovement.x
        newPos.y += correctedMovement.y
        newPos.z += correctedMovement.z

        this.rigidBody.setNextKinematicTranslation(newPos)

        // 5. Update Visuals (Mesh)
        this.updateModelVisuals()
    }

    toggleFlight() {
        this.isFlying = !this.isFlying
        this.verticalVelocity = 0
        this.momentum.set(0, 0, 0)
        console.log("Flight Mode:", this.isFlying)
    }

    handleFlightMovement(dt, input, moveDir) {
        this.verticalVelocity = 0
        let desiredTranslation = new THREE.Vector3()
        let speed = this.speed * 2

        if (this.cameraController) {
            const forward = this.cameraController.getForwardDirection()
            const right = this.cameraController.getRightDirection()
            let camDir = new THREE.Vector3()
            this.camera.getWorldDirection(camDir)

            // Re-calculate move based on camera Look vector for "Free Cam" feel
            // We use the input moveDir to determine which direction relative to cam
            // Actually, we should just use input keys mapping to cam direction
            if (input.keys.forward) desiredTranslation.add(camDir)
            if (input.keys.backward) desiredTranslation.sub(camDir)
            if (input.keys.right) desiredTranslation.add(right)
            if (input.keys.left) desiredTranslation.sub(right)

            if (input.keys.jump) desiredTranslation.y += 1
        }

        if (desiredTranslation.lengthSq() > 0) {
            desiredTranslation.normalize().multiplyScalar(speed * dt)
        }

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
            if (now - this.lastJumpTime < 300) {
                this.toggleFlight()
            }
            this.lastJumpTime = now
        }
        this.wasJumpDown = input.keys.jump
    }

    checkClimbing() {
        if (!this.ladders || this.ladders.length === 0) return

        const myPos = this.getPosition()
        const center = myPos.clone().add(new THREE.Vector3(0, 1, 0))

        let touchingLadder = false

        for (const ladder of this.ladders) {
            if (ladder.bounds.containsPoint(center)) {
                touchingLadder = true
                break
            }
        }

        if (touchingLadder && !this.isClimbing) {
            this.isClimbing = true
            this.verticalVelocity = 0
        } else if (!touchingLadder && this.isClimbing) {
            this.isClimbing = false
        }
    }

    updateModelVisuals() {
        if (!this.rigidBody) return

        const pos = this.rigidBody.translation()
        const position = new THREE.Vector3(pos.x, pos.y, pos.z)

        this.glbModel.setPosition(position)
        this.glbModel.setRotation(this.currentRotation)

        this.polygonModel.setPosition(position)
        this.polygonModel.setRotation(this.currentRotation)
    }

    getPosition() {
        if (this.rigidBody) {
            const t = this.rigidBody.translation()
            return new THREE.Vector3(t.x, t.y, t.z)
        }
        return new THREE.Vector3()
    }

    getRotation() {
        return this.currentRotation
    }
}
