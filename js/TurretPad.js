import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class TurretPad {
    constructor(scene, world, position) {
        this.scene = scene
        this.world = world
        this.position = position

        this.width = 3
        this.height = 0.2
        this.depth = 3

        this.collider = null
        this.mesh = null
        this.model = null
        this.mixer = null
        this.animations = []

        this.initPhysics()
        this.initVisuals()
    }

    initPhysics() {
        // Static rigid body for the base
        let bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
            this.position.x,
            this.position.y - (this.height / 2),
            this.position.z
        )
        let rigidBody = this.world.createRigidBody(bodyDesc)

        // Collider: Cuboid
        let colliderDesc = RAPIER.ColliderDesc.cuboid(
            this.width / 2,
            this.height / 2,
            this.depth / 2
        )

        this.collider = this.world.createCollider(colliderDesc, rigidBody)
    }

    initVisuals() {
        // Base Platform Visualization
        const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth)
        const material = new THREE.MeshStandardMaterial({
            color: 0x444444, // Dark Grey for mechanical look
            roughness: 0.6,
            metalness: 0.5
        })

        this.mesh = new THREE.Mesh(geometry, material)
        this.mesh.position.copy(this.position)
        this.mesh.position.y -= this.height / 2
        this.mesh.receiveShadow = true
        this.scene.add(this.mesh)

        // Load Turret Model
        const loader = new GLTFLoader()
        loader.load('./assets/torreta.glb', (gltf) => {
            this.model = gltf.scene

            // Adjust scale if necessary - assuming generic size for now, might need tweaking
            this.model.scale.set(0.25, 0.25, 0.25)

            // Position on top of the pad
            this.model.position.set(0, this.height / 2, 0)

            this.mesh.add(this.model)

            // Handle Animations
            this.animations = gltf.animations
            if (this.animations && this.animations.length > 0) {
                console.log(`TurretPad: Found ${this.animations.length} animations in torreta.glb`)
                this.animations.forEach(clip => console.log(`- ${clip.name}`))

                this.mixer = new THREE.AnimationMixer(this.model)
                // Play the first animation by default
                const action = this.mixer.clipAction(this.animations[0])
                action.play()
            } else {
                console.log("TurretPad: No animations found in torreta.glb")
            }

        }, undefined, (error) => {
            console.error('TurretPad: Error loading torreta.glb', error)
        })
    }

    update(delta) {
        if (this.mixer) {
            this.mixer.update(delta)
        }
    }
}
