import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

export class GLBModel {
    constructor(scene) {
        this.scene = scene
        this.model = null
        this.mixer = null
        this.animations = {}
        this.currentAction = null
        this.isVisible = false

        this.loadModel()
    }

    loadModel() {
        const loader = new GLTFLoader()
        loader.load("https://threejs.org/examples/models/gltf/Soldier.glb", (gltf) => {
            this.model = gltf.scene
            this.model.userData.isPlayer = true
            this.scene.add(this.model)

            // Shadows
            this.model.traverse(o => { if (o.isMesh) o.castShadow = true })

            // Anim
            this.mixer = new THREE.AnimationMixer(this.model)
            this.animations["Idle"] = this.mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "Idle"))
            this.animations["Run"] = this.mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "Run"))

            this.model.visible = this.isVisible
            if (this.isVisible) {
                this.switchAnimation("Idle")
            }

            // Hide Loading Screen (Global effect, maybe move to controller or keep here as it's the main asset)
            const loading = document.getElementById("loading")
            if (loading) loading.style.display = "none"
        })
    }

    setVisible(visible) {
        this.isVisible = visible
        if (this.model) {
            this.model.visible = visible
            if (visible && !this.currentAction) {
                this.switchAnimation("Idle")
            }
        }
    }

    setPosition(pos) {
        if (this.model) {
            this.model.position.copy(pos)
        }
    }

    setRotation(rot) {
        if (this.model) {
            this.model.rotation.y = rot
        }
    }

    getPosition() {
        return this.model ? this.model.position.clone() : new THREE.Vector3()
    }

    switchAnimation(name) {
        if (!this.mixer || !this.animations[name]) return
        const action = this.animations[name]
        if (this.currentAction === action) return
        if (this.currentAction) this.currentAction.fadeOut(0.2)
        action.reset().fadeIn(0.2).play()
        this.currentAction = action
    }

    update(dt, isMoving) {
        if (!this.model || !this.isVisible) return

        if (isMoving) {
            this.switchAnimation("Run")
        } else {
            this.switchAnimation("Idle")
        }

        if (this.mixer) this.mixer.update(dt)
    }
}
