import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"

export class ImpulsePlatform {
    constructor(scene, world, position, direction, strength, type = "pad") {
        this.scene = scene
        this.world = world
        this.position = position
        this.direction = direction.normalize()
        this.strength = strength
        this.type = type

        this.width = 3
        this.height = 0.2
        this.depth = 3

        this.collider = null
        this.mesh = null
        this.wasInZone = false
        this.initPhysics()
        this.initVisuals()
    }

    initPhysics() {
        // Sensor Collider (Triggers only)
        // Static rigid body
        let bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
            this.position.x,
            this.position.y - (this.height / 2), // Slightly flush or below?
            this.position.z
        )
        let rigidBody = this.world.createRigidBody(bodyDesc)

        // Collider: Cuboid
        let colliderDesc = RAPIER.ColliderDesc.cuboid(
            this.width / 2,
            this.height / 2, // Very thin vertical trigger
            this.depth / 2
        ).setSensor(true)

        this.collider = this.world.createCollider(colliderDesc, rigidBody)
    }

    initVisuals() {
        // Determine type based on direction
        const isJump = this.direction.y > 0.5

        // Colors
        const lateralColor = 0x00FF00 // Green
        const jumpColor = 0x00FFFF    // Celeste / Cyan

        const color = isJump ? jumpColor : lateralColor

        // Base Platform
        const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth)
        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.8
        })

        this.mesh = new THREE.Mesh(geometry, material)
        this.mesh.userData.isImpulsePad = true // Tag for raycasting/overlap check
        this.mesh.position.copy(this.position)
        this.mesh.position.y -= this.height / 2 // Align with flush floor
        this.mesh.receiveShadow = true
        this.scene.add(this.mesh)

        // Indicator Texture
        const textureLoader = new THREE.TextureLoader()
        const texturePath = isJump ? 'assets/textures/salto.png' : 'assets/textures/impulso.png'
        const texture = textureLoader.load(texturePath)

        // Create a plane for the indicator
        const arrowGeometry = new THREE.PlaneGeometry(this.width * 0.8, this.depth * 0.8)
        const arrowMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        })

        const arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial)

        // Position slightly above the platform
        arrowMesh.position.y = this.height / 2 + 0.01

        // Rotate to lie flat on the platform
        arrowMesh.rotation.x = -Math.PI / 2

        if (!isJump) {
            // Lateral: Rotate to point in the direction of the impulse
            const flatDir = new THREE.Vector3(this.direction.x, 0, this.direction.z).normalize()

            if (flatDir.lengthSq() > 0.001) {
                // Angle calc: we want Local +Y (which is World -Z after X-rot) to point to flatDir
                const targetTheta = Math.atan2(this.direction.x, this.direction.z)
                // Initial angle of World -Z is PI. Rotation needed:
                arrowMesh.rotation.z = targetTheta - Math.PI
            }
        } else {
            // Jump: Default orientation is fine (Top of texture points -Z)
            // If we want it to face the player entering? Usually jump pads are omni or fixed.
            // Leaving it fixed for now.
        }

        this.mesh.add(arrowMesh)
    }



    update(character) {
        if (!character || !character.rigidBody || !this.collider) return

        const charPos = character.getPosition()

        // Simple rectangular bounds check
        const halfW = this.width / 2
        const halfD = this.depth / 2

        const dx = Math.abs(charPos.x - this.position.x)
        const dz = Math.abs(charPos.z - this.position.z)
        const dy = charPos.y - this.position.y

        // Stricter vertical check: Must be close to the platform surface (touching)
        // dy should be around 0.1 (platform top) to 0.5.
        // Also check if we are physically inside the column.
        const inZone = (dx < halfW && dz < halfD && dy >= -0.1 && dy < 0.5)

        if (inZone) {
            if (!this.wasInZone) {
                // Trigger Impulse - ONE SHOT
                const force = this.direction.clone().multiplyScalar(this.strength)
                character.applyImpulse(force)
                this.wasInZone = true
            }
        } else {
            // Reset when leaving the zone (e.g. jumped up high)
            this.wasInZone = false
        }
    }
}
