import { Item } from "./Item.js"
import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"

export class MapObjectItem extends Item {
    constructor(id, name, type, iconPath, color, scale = { x: 1, y: 1, z: 1 }) {
        super(id, name, iconPath)
        this.type = type // 'wall', 'pillar', 'ramp'
        this.color = color
        this.scale = scale

        // Generate Dynamic Icon
        this.iconPath = this.generateIcon()
    }

    generateIcon() {
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 64
        const ctx = canvas.getContext('2d')

        // Clear
        ctx.clearRect(0, 0, 64, 64)

        // Color
        ctx.fillStyle = '#' + new THREE.Color(this.color).getHexString()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2

        // Draw Shape
        // Padding 8px
        if (this.type === 'ramp') {
            // Triangle
            ctx.beginPath()
            ctx.moveTo(8, 56) // Bottom Left
            ctx.lineTo(56, 56) // Bottom Right
            ctx.lineTo(56, 8)  // Top Right (Slope up)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()
        } else if (this.type === 'pillar') {
            // Tall Rect
            ctx.fillRect(20, 8, 24, 48)
            ctx.strokeRect(20, 8, 24, 48)
        } else {
            // Wall / Default (Landscape Rect)
            ctx.fillRect(8, 20, 48, 24)
            ctx.strokeRect(8, 20, 48, 24)
        }

        return canvas.toDataURL()
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

        // TAGGING FOR SAVE SYSTEM
        mesh.userData.isEditableMapObject = true
        mesh.userData.mapObjectType = this.type
        mesh.userData.color = this.color
        mesh.userData.originalScale = this.scale // Save config scale

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

    spawnObjectFromData(scene, world, pos, rot) {
        // Reuse Spawn logic but override transforms
        // Copied geometry creation part:
        let geometry
        if (this.type === 'wall' || this.type === 'pillar') {
            geometry = new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z)
        } else if (this.type === 'ramp') {
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            shape.lineTo(this.scale.z, 0);
            shape.lineTo(0, this.scale.y);
            shape.lineTo(0, 0);

            const extrudeSettings = {
                steps: 1,
                depth: this.scale.x,
                bevelEnabled: false,
            };
            geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geometry.center();
        }

        const material = new THREE.MeshStandardMaterial({ color: this.color })
        const mesh = new THREE.Mesh(geometry, material)

        mesh.position.set(pos.x, pos.y, pos.z)
        mesh.rotation.set(rot.x, rot.y, rot.z)

        mesh.castShadow = true
        mesh.receiveShadow = true

        mesh.userData.isEditableMapObject = true
        mesh.userData.mapObjectType = this.type
        mesh.userData.color = this.color
        mesh.userData.originalScale = this.scale

        scene.add(mesh)

        // Physics
        if (world && RAPIER) {
            const bodyDesc = RAPIER.RigidBodyDesc.fixed()
                .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
                .setRotation(mesh.quaternion)

            const rigidBody = world.createRigidBody(bodyDesc)

            let colliderDesc;
            if (this.type === 'ramp') {
                colliderDesc = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2)
            } else {
                colliderDesc = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2)
            }
            world.createCollider(colliderDesc, rigidBody)
        }
    }
}
