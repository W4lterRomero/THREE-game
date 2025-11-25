import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

export class NPC {
    constructor(scene, position = new THREE.Vector3(0, 0, 0)) {
        this.scene = scene
        this.position = position
        this.model = null
        this.mixer = null
        this.animations = {}
        this.currentAction = null
        this.rotationOffset = Math.PI // Adjust if needed
        this.scale = 1.8 // Adjust scale: 1.0 = normal, 2.0 = double size
        this.emissiveIntensity = 0.00 // Adjust brightness: 0.0 = normal, 1.0 = very bright

        this.loadModel()
    }

    loadModel() {
        const loader = new GLTFLoader()
        loader.load(
            "./assets/cesarM.glb",
            (gltf) => {
                this.model = gltf.scene
                this.model.position.copy(this.position)
                this.model.rotation.y = this.rotationOffset
                this.model.scale.set(this.scale, this.scale, this.scale)
                this.scene.add(this.model)

                this.model.traverse((object) => {
                    if (object.isMesh) {
                        object.castShadow = true
                        object.receiveShadow = true

                        // Fix darkness/color
                        if (object.material) {
                            // Add a slight emission to make it brighter
                            object.material.emissive = new THREE.Color(0xffffff)
                            object.material.emissiveIntensity = this.emissiveIntensity
                        }
                    }
                })

                this.mixer = new THREE.AnimationMixer(this.model)
                const clips = gltf.animations

                if (clips && clips.length > 0) {
                    const runClip = THREE.AnimationClip.findByName(clips, "Running") || clips[0]
                    this.animations["Running"] = this.mixer.clipAction(runClip)
                    this.switchAnimation("Running")
                }
            },
            undefined,
            (error) => {
                console.error("An error happened loading the NPC model:", error)
            }
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

    update(dt) {
        if (this.mixer) {
            this.mixer.update(dt)
        }
    }
}
