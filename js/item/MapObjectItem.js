import { Item } from "./Item.js"
import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"
import { StairsUtils } from "../utils/StairsUtils.js"

export class MapObjectItem extends Item {
    constructor(id, name, type, iconPath, color, scale = { x: 1, y: 1, z: 1 }, texturePath = null) {
        super(id, name, iconPath)
        this.type = type // 'wall', 'pillar', 'ramp', 'stairs', 'spawn_point'
        this.color = color
        this.scale = scale
        this.texturePath = texturePath
        this.logicProperties = null // Default null

        // Generate Dynamic Icon
        this.iconPath = this.generateIcon()

        // Identity
        this.uuid = THREE.MathUtils.generateUUID()
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
        } else if (this.type === 'spawn_point') {
            // Spawn Point Icon (Circle with S)
            ctx.beginPath()
            ctx.arc(32, 32, 24, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()

            ctx.fillStyle = "white"
            ctx.font = "bold 24px Arial"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillText("S", 32, 32)
        } else if (this.type === 'movement_controller') {
            // Arrow / Mover Icon
            ctx.beginPath()
            ctx.arc(32, 32, 24, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()

            // Arrow
            ctx.fillStyle = "white"
            ctx.beginPath()
            ctx.moveTo(16, 32)
            ctx.lineTo(48, 32)
            ctx.lineTo(40, 24)
            ctx.moveTo(48, 32)
            ctx.lineTo(40, 40)
            ctx.stroke()

            ctx.textAlign = "center"
            ctx.fillText("MOV", 32, 48)

        } else if (this.type === 'interaction_button') {
            // Button Icon
            // Base
            ctx.fillStyle = "#555"
            ctx.fillRect(16, 40, 32, 16)
            ctx.strokeRect(16, 40, 32, 16)

            // Button Top
            ctx.fillStyle = this.color ? '#' + new THREE.Color(this.color).getHexString() : "red"
            ctx.beginPath()
            ctx.arc(32, 32, 12, 0, Math.PI, true) // Semi circle up
            ctx.fill()
            ctx.stroke()

            // "F" text
            ctx.fillStyle = "white"
            ctx.font = "bold 16px Arial"
            ctx.textAlign = "center"
            ctx.fillText("F", 32, 38)

        } else {
            // Wall / Default (Landscape Rect)
            ctx.fillRect(8, 20, 48, 24)
            ctx.strokeRect(8, 20, 48, 24)
        }

        return canvas.toDataURL()
    }

    use(context) {
        // Context contains placementManager, scene, camera, etc.

        if (this.type === 'movement_controller') {
            // TOOL BEHAVIOR: Apply logic to existing object
            // Raycast from Camera (or Origin/Direction provided in context)
            const raycaster = new THREE.Raycaster()
            raycaster.set(context.origin, context.direction)

            const intersects = raycaster.intersectObjects(context.scene.children, true)
            // Find first editable object
            const hit = intersects.find(h => h.object.userData && h.object.userData.isEditableMapObject)

            if (hit) {
                const target = hit.object

                // Toggle / Add Logic
                if (!target.userData.logicProperties) {
                    target.userData.logicProperties = {}
                }

                // Initialize Movement if not present
                if (!target.userData.logicProperties.waypoints) {
                    target.userData.logicProperties.waypoints = []
                    target.userData.logicProperties.speed = 2.0
                    target.userData.logicProperties.loop = true
                    target.userData.logicProperties.active = true

                    alert(`Transformado en Objeto Móvil: ${target.userData.mapObjectType}`)
                } else {
                    alert(`Este objeto ya tiene lógica de movimiento.`)
                }

                // We consumed the action
                return true
            } else {
                return false // Missed
            }
        }

        // Context contains placementManager
        if (context && context.placementManager) {
            const position = context.placementManager.getCurrentTarget()
            let rotationIndex = context.placementManager.getPlacementRotation() // Get rotation from placement manager
            if (position) {
                this.spawnObject(context.scene, context.world, position, rotationIndex)
                return true
            }
        }
        return false
    }

    spawnObject(scene, world, position, rotationOrIndex = 0) {
        let rotationIndex = 0
        let quaternion = null
        let rotation = new THREE.Euler(0, 0, 0)

        if (rotationOrIndex && (typeof rotationOrIndex === 'object') && rotationOrIndex.isQuaternion) {
            quaternion = rotationOrIndex
            rotation.setFromQuaternion(quaternion) // Convert to Euler for createObjectInWorld
        } else {
            rotationIndex = rotationOrIndex
            if (rotationIndex === 1) rotation.y = -Math.PI / 2
            if (rotationIndex === 2) rotation.y = -Math.PI
            if (rotationIndex === 3) rotation.y = Math.PI / 2
            quaternion = new THREE.Quaternion().setFromEuler(rotation) // Convert to Quaternion for rigid body
        }

        let object3D = null
        const collidersDesc = []
        let rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(position.x, position.y, position.z)
        if (quaternion) {
            rigidBodyDesc.setRotation(quaternion)
        }

        this.createObjectInWorld(scene, world, position, rotation)
    }

    spawnObjectFromData(scene, world, pos, rot) {
        // Fix: Use .x .y .z from saved JSON (which matches saveMap structure), fallback to _x if raw Euler stored
        const rx = rot.x !== undefined ? rot.x : rot._x
        const ry = rot.y !== undefined ? rot.y : rot._y
        const rz = rot.z !== undefined ? rot.z : rot._z

        const position = new THREE.Vector3(pos.x, pos.y, pos.z)
        const rotation = new THREE.Euler(rx, ry, rz)

        this.createObjectInWorld(scene, world, position, rotation, true)
    }

    createObjectInWorld(scene, world, position, rotation, isCenterPosition = false) {
        let object3D
        const collidersDesc = []

        if (this.type === 'stairs') {
            // STAIRS GENERATION
            const steps = StairsUtils.calculateSteps(this.scale)

            const group = new THREE.Group()
            const material = new THREE.MeshStandardMaterial({ color: this.color })
            const stepGeo = new THREE.BoxGeometry(steps[0].size.x, steps[0].size.y, steps[0].size.z)

            steps.forEach(step => {
                const mesh = new THREE.Mesh(stepGeo, material)
                mesh.position.set(step.position.x, step.position.y, step.position.z)
                mesh.castShadow = true
                mesh.receiveShadow = true
                group.add(mesh)

                // Physics Collider (Relative to body center)
                const col = RAPIER.ColliderDesc.cuboid(step.size.x / 2, step.size.y / 2, step.size.z / 2)
                    .setTranslation(step.position.x, step.position.y, step.position.z)
                collidersDesc.push(col)
            })

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

        } else if (this.type === 'spawn_point') {
            // SPAWN POINT (Cylinder Pad)
            const geometry = new THREE.CylinderGeometry(1, 1, 0.2, 32)
            const material = new THREE.MeshStandardMaterial({
                color: this.color,
                transparent: true,
                opacity: 0.8,
                emissive: this.color,
                emissiveIntensity: 0.5
            })
            object3D = new THREE.Mesh(geometry, material)
            object3D.receiveShadow = true

            // Add a visual marker for "Forward" direction
            const markerGeo = new THREE.BoxGeometry(0.2, 0.2, 0.8)
            const markerMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
            const marker = new THREE.Mesh(markerGeo, markerMat)
            marker.position.y = 0.11 // Slightly above
            marker.position.z = -0.4 // Forward
            object3D.add(marker)

            // Physics (Sensor?) or just floor?
            // Usually spawns are non-colliding or just floor. 
            // Let's make it a thin cylinder collider so we can place it on ground but not trip over it too much.
            const col = RAPIER.ColliderDesc.cylinder(0.1, 1)
            collidersDesc.push(col)

        } else if (this.type === 'movement_controller') {
            // VISUAL CONTROLLER (Sphere + Arrows)
            const geometry = new THREE.SphereGeometry(this.scale.x, 16, 16)
            const material = new THREE.MeshStandardMaterial({
                color: this.color,
                transparent: true,
                opacity: 0.7,
                wireframe: true
            })
            object3D = new THREE.Mesh(geometry, material)

            // Inner Core
            const core = new THREE.Mesh(
                new THREE.BoxGeometry(this.scale.x, this.scale.x, this.scale.x),
                new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
            )
            object3D.add(core)

            // No Physics for the controller itself? 
            // Better to have a sensor or tiny collider so we can right click efficiently?
            // Let's use a small sensor/collider.
            const col = RAPIER.ColliderDesc.ball(this.scale.x)
            collidersDesc.push(col)

        } else if (this.type === 'interaction_button') {
            // INTERACTION BUTTON 3D (Simple Button)
            const group = new THREE.Group()

            // Button (Cylinder)
            // Radius 0.3, Height 0.1
            const btnGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 32)
            const btnMat = new THREE.MeshStandardMaterial({
                color: this.color || 0xFF0000,
                emissive: this.color || 0xFF0000,
                emissiveIntensity: 0.2
            })
            const btn = new THREE.Mesh(btnGeo, btnMat)
            btn.position.y = 0.05 // Half height, so bottom is at 0
            btn.userData.isButtonMesh = true

            // Add a visual ring/base plate? Low profile.
            const plateGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.02, 32)
            const plateMat = new THREE.MeshStandardMaterial({ color: 0x333333 })
            const plate = new THREE.Mesh(plateGeo, plateMat)
            plate.position.y = 0.01
            group.add(plate)

            group.add(btn)

            // Counteract the generic lift at the end of function (which adds scale.y/2)
            // preventing the button from floating if scale.y > button height
            // group.position.y -= this.scale.y / 2

            object3D = group

            // Physics: Cylinder for button
            const col = RAPIER.ColliderDesc.cylinder(0.05, 0.3)
                .setTranslation(0, 0.05, 0)
            collidersDesc.push(col)

            // Initialize specfic logic props properties
            if (!this.logicProperties) this.logicProperties = {}
            if (this.logicProperties.holdTime === undefined) this.logicProperties.holdTime = 0
            if (this.logicProperties.oneShot === undefined) this.logicProperties.oneShot = false
            if (this.logicProperties.triggered === undefined) this.logicProperties.triggered = false

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
        // BUT if loading from data (isCenterPosition), the position is ALREADY the center.
        if (this.type !== 'interaction_button' && !isCenterPosition) {
            object3D.position.y += this.scale.y / 2
        }

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
        // Save UUID if provided (from constructor), else one will need to be generated if missing
        // ALWAYS generate a new UUID for the object instance in the world to ensure uniqueness.
        // The Item's uuid (this.uuid) is the ID of the TOOL, not the object instance.
        object3D.userData.uuid = THREE.MathUtils.generateUUID()
        object3D.userData.originalUUID = object3D.userData.uuid // Keep original if needed
        object3D.userData.color = this.color
        object3D.userData.originalScale = this.scale
        object3D.userData.originalRotY = object3D.rotation.y // Store initial rotation for logic fallback
        object3D.userData.texturePath = this.texturePath // Store for serialization

        // Initialize Logic Properties if available (from constructor or default)
        if (this.logicProperties) {
            object3D.userData.logicProperties = { ...this.logicProperties }
        }

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
