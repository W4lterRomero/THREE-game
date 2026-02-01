import * as THREE from "three"
import RAPIER from "@dimforge/rapier3d-compat"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js"

export class LevelLoader {
    constructor(scene, world) {
        this.scene = scene
        this.world = world

        this.loader = new GLTFLoader()

        // Setup Draco
        const dracoLoader = new DRACOLoader()
        // Use a stable CDN for the decoder
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
        dracoLoader.setDecoderConfig({ type: 'js' }) // Force JS for compatibility if WASM fails
        this.loader.setDRACOLoader(dracoLoader)

        // Configuration
        this.debugPhysics = false
        this.ladders = []
    }

    load(url, position = new THREE.Vector3(0, 0, 0), scale = new THREE.Vector3(1, 1, 1)) {
        return new Promise((resolve, reject) => {
            this.loader.load(url, (gltf) => {
                // Apply offset & Scale
                gltf.scene.position.copy(position)
                gltf.scene.scale.copy(scale)

                // Update matrices so world positions are correct for physics
                gltf.scene.updateMatrixWorld(true)

                this.processScene(gltf.scene)
                this.scene.add(gltf.scene)
                console.log("Level loaded:", url)
                resolve(gltf.scene)
            }, undefined, (err) => {
                console.error("Error loading level:", err)
                reject(err)
            })
        })
    }

    processScene(scene) {
        scene.updateMatrixWorld(true)

        const colliders = []

        scene.traverse((child) => {
            if (child.isMesh) {
                // Feature: Shadows enabled by default
                child.castShadow = true
                child.receiveShadow = true

                // Feature: Physics Generation based on Name
                // Naming convention: "ObjectName_Type"
                // Types:
                // _Collider: Invisible static collider (e.g. Wall_Collider)
                // _Fixed: Visible static collider
                // _Sensor: Sensor/Trigger (Ghost)

                const name = child.name.toLowerCase()

                if (name.includes("_collider") || name.includes("_fixed")) {
                    this.createStaticBody(child, !name.includes("_fixed")) // Invisible if just collider
                } else if (name.includes("_ladder")) {
                    // Create ladder logic
                    // We need to create a simple object with a 'bounds' property (Box3)
                    // We assume the mesh ITSELF is the climbing volume or visual.

                    child.updateMatrixWorld(true)
                    const box = new THREE.Box3().setFromObject(child)
                    // Expand slightly?
                    box.expandByScalar(0.2)

                    this.ladders.push({
                        bounds: box,
                        mesh: child
                    })

                    // Ladder usually static visual?
                    // If it needs collision (rails), maybe it has a child _Collider?
                    // Or just treat it as visual. 
                }

                // You can add more types like _Dynamic here
            }
        })
    }

    createStaticBody(mesh, invisible = false) {
        // If "invisible" arg is true, it means it's a collider-only object by naming convention.
        // If mesh.userData.invisible is true, it's a user-set property.

        if (invisible || (mesh.userData && mesh.userData.invisible)) {
            // If manual invisible property and NOT editor mode (LevelLoader usually for play)
            // We assume LevelLoader is used for play mode or background loading.
            // If we want to support Editor visibility, we need context.
            // For now, LevelLoader seems to be used for the "Environment" / "Level" which is usually static.
            // But let's respect the flag.

            mesh.visible = false
        }

        // Get world transform
        const pos = new THREE.Vector3()
        const quat = new THREE.Quaternion()
        const scale = new THREE.Vector3()
        mesh.getWorldPosition(pos)
        mesh.getWorldQuaternion(quat)
        mesh.getWorldScale(scale)

        // Rapier RigidBody
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(quat)
        const body = this.world.createRigidBody(bodyDesc)

        // Collider Geometry
        // We attempt to use the geometry type to decide collider type
        // Optimally, use simple boxes in Blender and name them "Wall_Collider"

        let colliderDesc = null

        // 1. Try Box (Bounding Box) - Best performance / robustness for walls
        // If the mesh is a BoxGeometry or we assume OBB
        // Note: Imported GLTF meshes are usually BufferGeometry. 
        // We can compute OBB or AABB.
        // For simplicity in a robust loader: 
        // If it's a "Complex" mesh, use Trimesh (Slow, but accurate).
        // If it looks like a primitive, use Cuboid.

        // STRATEGY: For "Map Architecture" (Walls, floors), Trimesh is usually fine for static bodies.
        // But Character Controllers often struggle with Trimesh internal edges.
        // Recommendation: Use Trimesh for terrain/complex shapes.

        // Extract vertices and indices for Trimesh
        const geometry = mesh.geometry
        const vertices = geometry.attributes.position.array
        const indices = geometry.index ? geometry.index.array : null // GLTF usually has indices

        // Scale vertices? No, Rapier doesn't support scaling Trimesh easily at runtime without rebuilding data.
        // We must apply scale to the vertices passed to Rapier.

        const scaledVertices = new Float32Array(vertices.length)
        for (let i = 0; i < vertices.length; i += 3) {
            scaledVertices[i] = vertices[i] * scale.x
            scaledVertices[i + 1] = vertices[i + 1] * scale.y
            scaledVertices[i + 2] = vertices[i + 2] * scale.z
        }

        if (indices) {
            colliderDesc = RAPIER.ColliderDesc.trimesh(scaledVertices, indices)
        } else {
            // Generate indices if missing (unindexed mesh)
            const generatedIndices = new Uint32Array(vertices.length / 3)
            for (let i = 0; i < generatedIndices.length; i++) generatedIndices[i] = i
            colliderDesc = RAPIER.ColliderDesc.trimesh(scaledVertices, generatedIndices)
        }

        this.world.createCollider(colliderDesc, body)
    }
}
