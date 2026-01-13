import { Item } from "./Item.js"
import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"

export class MapObjectItem extends Item {
    constructor(id, name, type, iconPath, color, scale = { x: 1, y: 1, z: 1 }, texturePath = null) {
        super(id, name, iconPath)
        this.type = type // 'wall', 'pillar', 'ramp', 'stairs'
        this.color = color
        this.scale = scale
        this.texturePath = texturePath

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

        // Apply Texture if exists
        if (this.texturePath) {
            const textureLoader = new THREE.TextureLoader()
            textureLoader.load(this.texturePath, (texture) => {
                texture.wrapS = THREE.RepeatWrapping
                texture.wrapT = THREE.RepeatWrapping

                // Smart Tiling
                // Based on object scale. 1 texture unit per 2 world units? Or 1 per 1?
                // Standard: 1 tile per 1 unit.
                // Box Mapping is complex without UV hacks, but for now we map repeat to X/Y
                // For Box(x,y,z), standard UVs map specific faces.
                // Simple approach: Set repeat.

                // Note: Standard BoxGeometry UVs are 1x1 per face by default.
                // We might need to adjust map per face or just set general repeat.
                // Let's try general repeat based on largest dim or just 1:1.

                // Better approach for construction: 1 tile = 1 meter.
                // But BoxGeometry reuses UVs.
                // Let's just apply 1:1 scaling if possible.
                // Since we can't easily change UVs per face instance without cloning geometry,
                // we'll apply a material property. 
                // Wait, if we share geometry, we can't change UVs.
                // But we create NEW geometry for each object in this code: "new THREE.BoxGeometry".
                // So we CAN modify UVs or simply use texture.repeat on the material.
                // BUT the material is created per object too?
                // Yes: "const material = new THREE.MeshStandardMaterial".

                // So we can set texture.repeat.

                // Determine face dimensions.
                // Box UV mapping: 
                // Front/Back: X * Y
                // Top/Bottom: X * Z
                // Left/Right: Z * Y

                // Since we can only set ONE repeat for the whole material, it will look wrong on non-cubic objects
                // unless we use "Triplanar Mapping" (complex) or distinct materials per face.

                // SIMPLIFIED APPROACH:
                // Just set repeat to 1x1 (stretch) OR 
                // Use a default repeat based on the largest dimension to avoid extreme stretching.
                // OR simpler: Just apply it and let Three.js handle default UVs (usually 0..1).

                // Let's try setting repeat based on X/Y average for now.
                // texture.repeat.set(this.scale.x, this.scale.y) 

                // Actually, for walls (5x3), if we repeat 5x3, it looks perfect on Front/Back.
                // On Top (5x0.5), it will repeat 3 times on 0.5 depth -> Squashed.
                // This is the tradeoff without multi-material.

                // Compromise: Use BoxGeometry with array of materials?
                // Or just accept stretching on thin sides.

                texture.repeat.set(this.scale.x / 2, this.scale.y / 2) // 1 tile = 2 units approx

                // Update Material
                if (object3D.isGroup) {
                    object3D.children.forEach(child => {
                        if (child.material) {
                            child.material.map = texture
                            child.material.needsUpdate = true
                        }
                    })
                } else if (object3D.material) {
                    object3D.material.map = texture
                    object3D.material.needsUpdate = true
                }
            })
        }

        // Metadata
        object3D.userData.isEditableMapObject = true
        object3D.userData.isMapObject = true
        object3D.userData.mapObjectType = this.type
        object3D.userData.color = this.color
        object3D.userData.originalScale = this.scale
        object3D.userData.texturePath = this.texturePath // Store for serialization

        scene.add(object3D)

        // Physics Body
        if (world && RAPIER) {
            const bodyDesc = RAPIER.RigidBodyDesc.fixed()
                .setTranslation(object3D.position.x, object3D.position.y, object3D.position.z)
                .setRotation(object3D.quaternion)

            const rigidBody = world.createRigidBody(bodyDesc)

            // Store reference for editor updates
            object3D.userData.rigidBody = rigidBody

            // Attach all colliders
            collidersDesc.forEach(col => {
                world.createCollider(col, rigidBody)
            })
        }

        console.log(`Spawned ${this.type} at`, position)
    }
}
