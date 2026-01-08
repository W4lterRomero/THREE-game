import { Item } from "./Item.js"
import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"

export class MapObjectItem extends Item {
    constructor(id, name, type, iconPath, color, scale = { x: 1, y: 1, z: 1 }) {
        super(id, name, iconPath)
        this.type = type // 'wall', 'pillar', 'ramp'
        this.color = color
        this.scale = scale
    }

    use(context) {
        // Context contains placementManager
        if (context.placementManager) {
            // We delegate the "ghost" update to placementManager, 
            // but here we might trigger the "Place" action if clicked?
            // Actually, main_rapier handles the click -> use().
            // So use() is "Attempt to Place".

            const position = context.placementManager.getCurrentTarget()
            if (position) {
                // Determine Rotation
                // context.rotationIndex

                // Create the object in the world
                this.spawnObject(context.scene, context.world, position, context.rotationIndex)
                return true // Consumed (or not, if infinite in creative)
            }
        }
        return false
    }

    spawnObject(scene, world, position, rotationIndex) {
        // 1. Create Mesh
        let geometry
        if (this.type === 'wall' || this.type === 'pillar') {
            geometry = new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z)
        } else if (this.type === 'ramp') {
            // Prism geometry
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            shape.lineTo(this.scale.z, 0); // Base length
            shape.lineTo(0, this.scale.y); // Height
            shape.lineTo(0, 0);

            const extrudeSettings = {
                steps: 1,
                depth: this.scale.x, // Width
                bevelEnabled: false,
            };
            geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            // Re-center geometry? Extrude starts at 0,0
            geometry.center();
        }

        const material = new THREE.MeshStandardMaterial({ color: this.color })
        const mesh = new THREE.Mesh(geometry, material)

        // Position
        mesh.position.copy(position)
        // Adjust Y to be on ground? 
        // PlacementManager usually returns point on surface. 
        // If wall is 3m tall, center is at 1.5. 
        mesh.position.y += this.scale.y / 2

        // Rotation
        if (rotationIndex === 1) mesh.rotation.y = -Math.PI / 2
        if (rotationIndex === 2) mesh.rotation.y = -Math.PI
        if (rotationIndex === 3) mesh.rotation.y = Math.PI / 2

        mesh.castShadow = true
        mesh.receiveShadow = true
        scene.add(mesh)

        // 2. Physics (Fixed RigidBody)
        if (world && RAPIER) {
            // Create RigidBody
            const bodyDesc = RAPIER.RigidBodyDesc.fixed()
                .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
                .setRotation(mesh.quaternion) // Use quaternion for rotation

            const rigidBody = world.createRigidBody(bodyDesc)

            // Create Collider
            let colliderDesc;
            if (this.type === 'ramp') {
                // Approximate ramp with Convex Hull or Box for now? 
                // Creating a true ramp collider is complex without vertices.
                // Let's use a simple box rotated for now, or if possible hull.
                // For simplicity in this demo step: Box matching bounds? No, that's not a ramp.
                // Actually, Rapier has heightfield or trimesh.
                // Re-using the geometry vertices for Convex Hull is best.

                // Extract vertices from geometry?
                // For now, let's just make it a Box Collider 
                // But honestly, without a real ramp collider it feels bad.
                // Let's omit physics for RAMP specifically if too complex, 
                // OR try to approximate with a rotated box?
                // Let's leave Ramp physics as TODO or simplistic box.
                colliderDesc = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2)
            } else {
                // Box (Wall/Pillar)
                // Half Extents
                colliderDesc = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2)
            }

            world.createCollider(colliderDesc, rigidBody)
        }

        console.log(`Spawned ${this.type} at`, position)
    }
}
