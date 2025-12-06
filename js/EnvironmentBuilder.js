import * as THREE from "three"
import { BoxCollider, CollisionLayer } from "./collision/index.js"

export class EnvironmentBuilder {
    constructor(scene, collisionSystem) {
        this.scene = scene
        this.collisionSystem = collisionSystem
    }

    /**
     * Creates a box with collision and visual mesh
     */
    addBox(position, size, rotation = new THREE.Euler(), color = 0x888888) {
        // Visual Mesh
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z)
        const material = new THREE.MeshStandardMaterial({ color: color })
        const mesh = new THREE.Mesh(geometry, material)

        mesh.position.copy(position)
        mesh.rotation.copy(rotation)
        mesh.castShadow = true
        mesh.receiveShadow = true

        this.scene.add(mesh)

        // Collider
        const collider = new BoxCollider({
            id: `env-box-${Math.random().toString(36).substr(2, 9)}`,
            parent: mesh, // Parent to mesh so it follows transform
            size: size.clone(),
            rotation: rotation.clone(), // BoxCollider now uses this rotation
            layer: CollisionLayer.ENVIRONMENT,
            collidesWithMask: CollisionLayer.PLAYER | CollisionLayer.NPC,
            isStatic: true
        })

        // Important: BoxCollider constructor takes options. 
        // Our updated BoxCollider uses `this.rotation`.
        // The Position is taken from `parent.position` in updateWorldPosition, 
        // OR `options.position` if no parent. 
        // Here we provided parent.

        this.collisionSystem.addCollider(collider)

        return mesh
    }

    /**
     * Creates a ramp (rotated box)
     */
    addRamp(position, width, length, height, rotationY = 0) {
        // Calculate the angle needed to achieve the height over the length
        // actually, simpler: just rotate a flat box.
        // If we want a ramp of specific length and height gain:
        // Hypotenuse is the box length.
        // Angle = asin(height / length).

        const angle = Math.asin(height / length)

        const size = new THREE.Vector3(width, 0.2, length) // Thin box acting as ramp
        const rotation = new THREE.Euler(-angle, rotationY, 0) // Negative X rotation to slope up

        // Adjust position so the start of the ramp is at 'position'
        // The box origin is center.
        // We want the "bottom start" to be at position.
        // Local offset: moves up by sin(angle)*length/2 and forward by cos(angle)*length/2

        const offset = new THREE.Vector3(0, height / 2, length / 2 * Math.cos(angle))
        const centerPos = position.clone().add(offset)

        return this.addBox(centerPos, size, rotation, 0xffaa44)
    }

    /**
     * Build the test level
     */
    buildLevel() {
        // Platform
        this.addBox(
            new THREE.Vector3(5, 1, 0),
            new THREE.Vector3(4, 2, 4),
            new THREE.Euler(0, 0, 0),
            0x4488ff
        )

        // Ramp leading up to the platform
        // Platform top is at y=2 (center 1, height 2 -> range 0 to 2)
        // Ramp should start at y=0 and end at y=2
        // Length 6
        // Width 2

        // We use addBox directly for manual control or addRamp helper
        // Let's manually place a rotated box as a ramp
        const rampLength = 6
        const rampHeight = 2
        const angle = Math.atan2(rampHeight, Math.sqrt(rampLength * rampLength - rampHeight * rampHeight))

        // Ramp Center Calculation
        // Start: (1, 0, 0) (just in front of platform)
        // End: (5, 2, 0) (Top of platform edge)
        // Center: (3, 1, 0)

        this.addBox(
            new THREE.Vector3(1, 1, 0),
            new THREE.Vector3(2, 0.2, 5), // Width 2, Thickness 0.2, Length 5
            new THREE.Euler(-0.4, 0, 0), // Approx 20 degrees
            0xffaa00
        )

        // Another geometric shape: Large rotated cube
        this.addBox(
            new THREE.Vector3(-5, 1.5, -5),
            new THREE.Vector3(3, 3, 3),
            new THREE.Euler(0, Math.PI / 4, Math.PI / 4), // Compound rotation
            0xaa44aa
        )

        // Steps
        for (let i = 0; i < 5; i++) {
            this.addBox(
                new THREE.Vector3(-5, i * 0.5 + 0.25, 5 + i * 0.5),
                new THREE.Vector3(2, 0.5, 0.5),
                new THREE.Euler(0, 0, 0),
                0x88cc44
            )
        }

        // Base Floor
        // Y=-0.5, Height=1 -> Top at 0.
        this.addBox(
            new THREE.Vector3(0, -0.5, 0),
            new THREE.Vector3(100, 1, 100),
            new THREE.Euler(0, 0, 0),
            0x333333
        )

        // --- TEST RAMPS ---

        // 1. Walkable Ramp (Low Angle: ~15 deg)
        // Length 8, Height 2 -> ~14 deg
        this.addRampPhysicsTest(new THREE.Vector3(-8, 0, -5), 8, 2, 0x00ff00)

        // 2. Steep Walkable Ramp (Limit: ~40 deg)
        // Length 5, Height 3 -> ~36 deg
        this.addRampPhysicsTest(new THREE.Vector3(-12, 0, -5), 5, 3, 0xffff00)

        // 3. Sliding Ramp (Steep: ~60 deg)
        // Length 3, Height 4 -> ~53 deg
        this.addRampPhysicsTest(new THREE.Vector3(-16, 0, -5), 3, 4, 0xff0000)
    }

    addRampPhysicsTest(pos, length, height, color) {
        const angle = Math.atan2(height, length) // Base length vs Height gives hypotenuse angle
        const hypotenuse = Math.sqrt(length * length + height * height)

        // Create ramp
        const ramp = this.addBox(
            new THREE.Vector3(0, 0, 0), // Temp pos
            new THREE.Vector3(2, 0.5, hypotenuse),
            new THREE.Euler(-angle, 0, 0),
            color
        )

        // Position it explicitly: simple trigonometry
        // Center of box needs to be at:
        // x = pos.x
        // y = pos.y + height/2
        // z = pos.z + length/2
        // BUT due to rotation, the local center is hypotenuse/2 up the ramp.

        // Math matches addRamp logic but simpler for debugging visual:
        // Start at pos.
        // End at pos + (0, height, length)

        // Midpoint:
        ramp.position.set(
            pos.x,
            pos.y + height / 2,
            pos.z + length / 2
        )

        // Add platform at top
        this.addBox(
            new THREE.Vector3(pos.x, height - 0.5, pos.z + length + 2), // Top platform
            new THREE.Vector3(4, 1, 4),
            new THREE.Euler(0, 0, 0),
            color
        )
    }
}
