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

        this.rotationSmoothness = 0.15
        this.currentRotation = 0

        this.loadModel()
        this.initPhysics()
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

        // 1. Calculate Desired Movement (Velocity)
        let moveDir = new THREE.Vector3()
        if (input.keys.forward) moveDir.z += 1
        if (input.keys.backward) moveDir.z -= 1
        if (input.keys.left) moveDir.x -= 1
        if (input.keys.right) moveDir.x += 1

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
            let targetRotation = Math.atan2(desiredTranslation.x, desiredTranslation.z) + Math.PI // Offset?

            // Smooth rotation
            let rotDiff = targetRotation - this.currentRotation
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
            this.currentRotation += rotDiff * this.rotationSmoothness

            this.switchAnimation("Run")
        } else {
            this.switchAnimation("Idle")
        }

        // 2. Physics Movement Calculation

        // Gravity is handled by the controller's "computeColliderMovement" IF we pass it? 
        // No, Rapier Controller expects "desired movement". We must add gravity manually to that vector.
        // We accumulate gravity in a custom velocity variable?

        // Simplified Gravity:
        // Always try to move DOWN by gravity * dt
        let gravityStep = -20 * dt

        // Jump
        if (this.characterController.computedGrounded() && input.keys.jump) {
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

        desiredTranslation.y = this.verticalVelocity * dt

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
