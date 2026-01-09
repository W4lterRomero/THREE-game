import { Item } from "./Item.js"
import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"

export class MapObjectItem extends Item {
    constructor(id, name, type, iconPath, color, scale = { x: 1, y: 1, z: 1 }) {
        super(id, name, iconPath)
        this.type = type // 'wall', 'pillar', 'ramp', 'stairs'
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
        } else if (this.type === 'stairs') {
            // Steps Icon
            ctx.beginPath()
            ctx.moveTo(8, 56)
            ctx.lineTo(24, 56); ctx.lineTo(24, 40)
            ctx.lineTo(40, 40); ctx.lineTo(40, 24)
            ctx.lineTo(56, 24); ctx.lineTo(56, 8) // Top
            ctx.lineTo(56, 56) // Right down
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
            const position = context.placementManager.getCurrentTarget()
            if (position) {
                this.spawnObject(context.scene, context.world, position, context.rotationIndex)
                return true
            }
        }
        return false
    }

    spawnObject(scene, world, position, rotationIndex) {
        // Delegate to unified builder
        // Convert rotation index to Euler
        const rotation = new THREE.Euler(0, 0, 0)
        if (rotationIndex === 1) rotation.y = -Math.PI / 2
        if (rotationIndex === 2) rotation.y = -Math.PI
        if (rotationIndex === 3) rotation.y = Math.PI / 2

        this.createObjectInWorld(scene, world, position, rotation)
    }

    spawnObjectFromData(scene, world, pos, rot) {
        // rot is Euler or Quaternion? JSON usually stores Euler or Quat components.
        // Assuming Euler based on original code mesh.rotation.set()
        const rotation = new THREE.Euler(rot.x, rot.y, rot.z)
        const position = new THREE.Vector3(pos.x, pos.y, pos.z)

        this.createObjectInWorld(scene, world, position, rotation)
    }

    createObjectInWorld(scene, world, position, rotation) {
        let object3D
        const collidersDesc = []

        if (this.type === 'stairs') {
            // STAIRS GENERATION
            // Based on scale (x=Width, y=Height, z=Depth)
            // Default step height ~0.25 (match reference stairs usually)
            const targetStepHeight = 0.25
            const numSteps = Math.max(1, Math.round(this.scale.y / targetStepHeight))

            const stepHeight = this.scale.y / numSteps
            const stepDepth = this.scale.z / numSteps
            const stepWidth = this.scale.x

            const group = new THREE.Group()
            const material = new THREE.MeshStandardMaterial({ color: this.color })
            const stepGeo = new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth)

            // We build the stairs such that their bounding box center is (0,0,0) locally
            // Total Bounds: W, H, D. 
            // Local Y range: [-H/2, H/2]
            // Local Z range: [-D/2, D/2] (Direction?)

            // Start Bottom-Back? Or Bottom-Front?
            // Stairs go UP as they go Z+? Or Z-?
            // Usually "Forward" implies walking into them to go up.
            // Let's assume Z- is "Forward" (Camera looks -Z).
            // But let's check Ramp. Ramp shape was (0,0) -> (scale.z, 0) -> (0, scale.y).
            // This is X/Y plane? No, Extrude depth is X. Shape is on XY? Wait.
            // Ramp code: Shape(0,0)->(Z,0)->(0,Y). Extrude(depth=X).
            // Shape in XY plane. Extruded along Z? No, Extruding usually along Z default.
            // If Extrude depth is X, geometry is likely rotated later?
            // "geometry.center()" is used.
            // Let's stick to standard Box Coordinates.
            // Width = X, Height = Y, Depth = Z.
            // Stairs going Up-Forward usually means +Y and -Z (ahead) or +Z.
            // Let's do +Y and +Z for simplicity. Rotation handles direction.

            const startY = -this.scale.y / 2 + stepHeight / 2 // Bottom
            const startZ = -this.scale.z / 2 + stepDepth / 2 // Back

            for (let i = 0; i < numSteps; i++) {
                const mesh = new THREE.Mesh(stepGeo, material)

                // Position
                mesh.position.y = startY + (i * stepHeight)
                mesh.position.z = startZ + (i * stepDepth)
                mesh.position.x = 0 // Centered width

                mesh.castShadow = true
                mesh.receiveShadow = true
                group.add(mesh)

                // Physics Collider (Relative to body center)
                // Cuboid is half-extents
                const col = RAPIER.ColliderDesc.cuboid(stepWidth / 2, stepHeight / 2, stepDepth / 2)
                    .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)

                collidersDesc.push(col)
            }
            object3D = group

        } else if (this.type === 'ramp') {
            // RAMP GENERATION
            // Note: Original code used Shape on XY and Extruded.
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            shape.lineTo(this.scale.z, 0); // Base on X (which effectively becomes Z after rotation/mapping?)
            // Actually let's assume standard dims.
            shape.lineTo(0, this.scale.y);
            shape.lineTo(0, 0);

            const extrudeSettings = { steps: 1, depth: this.scale.x, bevelEnabled: false };
            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geometry.center();

            const material = new THREE.MeshStandardMaterial({ color: this.color })
            object3D = new THREE.Mesh(geometry, material)
            object3D.castShadow = true
            object3D.receiveShadow = true

            // Physics
            const vertices = geometry.attributes.position.array
            let col = RAPIER.ColliderDesc.convexHull(vertices)
            if (!col) col = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2)
            collidersDesc.push(col)

        } else {
            // BOX (Wall/Pillar)
            const geometry = new THREE.BoxGeometry(this.scale.x, this.scale.y, this.scale.z)
            const material = new THREE.MeshStandardMaterial({ color: this.color })
            object3D = new THREE.Mesh(geometry, material)
            object3D.castShadow = true
            object3D.receiveShadow = true

            const col = RAPIER.ColliderDesc.cuboid(this.scale.x / 2, this.scale.y / 2, this.scale.z / 2)
            collidersDesc.push(col)
        }

        // Apply Transforms
        object3D.position.copy(position)
        // Center Y Adjust: object origin is center. 
        // We want placement on ground. So move up by Half Height.
        object3D.position.y += this.scale.y / 2

        object3D.rotation.copy(rotation)
        object3D.scale.set(1, 1, 1) // Scale already built-in

        // Metadata
        object3D.userData.isEditableMapObject = true
        object3D.userData.mapObjectType = this.type
        object3D.userData.color = this.color
        object3D.userData.originalScale = this.scale

        scene.add(object3D)

        // Physics Body
        if (world && RAPIER) {
            const bodyDesc = RAPIER.RigidBodyDesc.fixed()
                .setTranslation(object3D.position.x, object3D.position.y, object3D.position.z)
                .setRotation(object3D.quaternion)

            const rigidBody = world.createRigidBody(bodyDesc)

            // Attach all colliders
            collidersDesc.forEach(col => {
                world.createCollider(col, rigidBody)
            })
        }

        console.log(`Spawned ${this.type} at`, position)
    }
}
