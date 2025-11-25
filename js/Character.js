import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

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

        this.targetRotation = 0
        this.rotationSmoothness = 0.12
        this.rotationOffset = Math.PI // Ajustar este valor para rotar el modelo (e.g. Math.PI, Math.PI / 2)

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

    update(dt, input) {
        if (!this.model) return

        this.direction.set(0, 0, 0)

        let moveX = 0
        let moveZ = 0

        if (input.keys.forward) moveZ += 1
        if (input.keys.backward) moveZ -= 1
        if (input.keys.left) moveX -= 1
        if (input.keys.right) moveX += 1

        const hasMovement = moveX !== 0 || moveZ !== 0

        if (hasMovement && this.cameraController) {
            const forward = this.cameraController.getForwardDirection()
            const right = this.cameraController.getRightDirection()

            // Calculate world-space movement direction
            this.direction.x = forward.x * moveZ + right.x * moveX
            this.direction.z = forward.z * moveZ + right.z * moveX
            this.direction.normalize()

            if (this.cameraController.isFirstPerson) {
                // In First Person, character always faces camera direction
                this.targetRotation = this.cameraController.fpYaw + this.rotationOffset

                // Calculate dot product to determine if moving forward or backward relative to camera
                const forward = this.cameraController.getForwardDirection()
                const moveDir = this.direction.clone()
                const dot = forward.dot(moveDir)

                // If moving backwards (dot < 0), reverse animation
                if (this.animations["Run"]) {
                    this.animations["Run"].timeScale = dot >= -0.1 ? 1 : -1
                }
            } else {
                // In Third Person, character faces movement direction
                this.targetRotation = Math.atan2(this.direction.x, this.direction.z) + this.rotationOffset
                if (this.animations["Run"]) this.animations["Run"].timeScale = 1
            }

            const currentRotation = this.model.rotation.y
            let diff = this.targetRotation - currentRotation

            // Handle angle wrapping
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

        // Calculate Velocity
        if (hasMovement) {
            this.velocity.x = this.direction.x * this.speed
            this.velocity.z = this.direction.z * this.speed
        } else {
            this.velocity.x = 0
            this.velocity.z = 0
        }

        // Jump
        if (this.onGround && input.keys.jump) {
            this.velocity.y = this.jumpForce
            this.onGround = false
        }

        // Gravity
        this.velocity.y -= this.gravity * dt

        // Apply Position
        const deltaPosition = this.velocity.clone().multiplyScalar(dt)
        this.model.position.add(deltaPosition)

        // Floor Collision
        if (this.model.position.y < 0) {
            this.model.position.y = 0
            this.velocity.y = 0
            this.onGround = true
        }

        // Update Animation Mixer
        if (this.mixer) {
            this.mixer.update(dt)
        }
    }

    getPosition() {
        return this.model ? this.model.position.clone() : new THREE.Vector3()
    }

    getRotation() {
        return this.model ? this.model.rotation.y : 0
    }
}
