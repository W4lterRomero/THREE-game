import * as THREE from "three"

export class PolygonModelSkin {
    constructor(scene) {
        this.scene = scene
        this.model = null
        this.isVisible = false

        // Body Parts
        this.head = null
        this.body = null
        this.rightArm = null
        this.leftArm = null
        this.rightLeg = null
        this.leftLeg = null

        // Groups for pivoting
        this.headGroup = null
        this.rightArmGroup = null
        this.leftArmGroup = null
        this.rightLegGroup = null
        this.leftLegGroup = null

        // Default Skin URL (Steve)
        this.skinUrl = "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.19.3/assets/minecraft/textures/entity/player/wide/steve.png"

        this.attackWeight = 0 // For smoothing attack animation

        this.initLoader()
        this.createModel()
    }

    initLoader() {
        this.textureLoader = new THREE.TextureLoader()
    }

    createModel() {
        this.model = new THREE.Group()
        this.model.userData.isPlayer = true
        this.model.visible = false

        // Load Skin
        const texture = this.textureLoader.load(this.skinUrl)
        texture.magFilter = THREE.NearestFilter // Pixelated look
        texture.minFilter = THREE.NearestFilter
        texture.colorSpace = THREE.SRGBColorSpace

        const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 1,
            metalness: 0,
            transparent: true, // For outer layers with transparency
            alphaTest: 0.5,
            side: THREE.DoubleSide
        })

        // Helper to map UVs for a box on a 64x64 texture
        // uv coords: x, y (top-left of the face grid), w, h, d
        // Order of faces in BoxGeometry: +x, -x, +y, -y, +z, -z (Right, Left, Top, Bottom, Front, Back)
        // Wait, three.js BoxGeometry face order is actually: +x, -x, +y, -y, +z, -z
        // Minecraft skin layout is specific. 
        // We will construct geometry manually or update UVs. 
        // Updating UVs is easier on a standard box geometry.

        // --- Model Parameters ---
        const pixelScale = 1 / 16 * 0.9 // Minecraft logic: 1 pixel = 1/16 meterish. slightly scaled to match other chars.

        // --- Head ---
        this.headGroup = new THREE.Group()
        this.headGroup.position.y = 1.30 // Lowered by 0.20
        this.model.add(this.headGroup)

        const headGeo = this.createBoxGeometryWithUVs(8, 8, 8, 0, 0)
        this.head = new THREE.Mesh(headGeo, material)
        this.head.position.y = 4 * pixelScale
        this.head.scale.set(pixelScale, pixelScale, pixelScale)
        this.head.castShadow = true
        this.headGroup.add(this.head)

        // Head Outer Layer (Hat)
        const headOuterGeo = this.createBoxGeometryWithUVs(8, 8, 8, 32, 0)
        const headOuter = new THREE.Mesh(headOuterGeo, material)
        headOuter.position.y = 4 * pixelScale
        headOuter.scale.set(pixelScale * 1.1, pixelScale * 1.1, pixelScale * 1.1)
        headOuter.renderOrder = 1
        this.headGroup.add(headOuter)

        // --- Body ---
        const bodyGeo = this.createBoxGeometryWithUVs(8, 12, 4, 16, 16)
        this.body = new THREE.Mesh(bodyGeo, material)
        this.body.position.y = 1.30 - (6 * pixelScale) // Lowered by 0.20
        this.body.scale.set(pixelScale, pixelScale, pixelScale)
        this.body.castShadow = true
        this.model.add(this.body)

        // Body Outer Layer (Jacket)
        const bodyOuterGeo = this.createBoxGeometryWithUVs(8, 12, 4, 16, 32)
        const bodyOuter = new THREE.Mesh(bodyOuterGeo, material)
        bodyOuter.position.copy(this.body.position)
        bodyOuter.scale.set(pixelScale * 1.05, pixelScale * 1.05, pixelScale * 1.05)
        this.model.add(bodyOuter)

        // --- Arms ---
        // Right Arm
        this.rightArmGroup = new THREE.Group()
        this.rightArmGroup.position.set(4 * pixelScale + 2 * pixelScale, 1.30 - 2 * pixelScale, 0) // Lowered by 0.20
        this.model.add(this.rightArmGroup)

        const rArmGeo = this.createBoxGeometryWithUVs(4, 12, 4, 40, 16)
        this.rightArm = new THREE.Mesh(rArmGeo, material)
        this.rightArm.position.y = -6 * pixelScale + 2 * pixelScale
        this.rightArm.scale.set(pixelScale, pixelScale, pixelScale)
        this.rightArm.castShadow = true
        this.rightArmGroup.add(this.rightArm)

        // Right Arm Outer
        const rArmOuterGeo = this.createBoxGeometryWithUVs(4, 12, 4, 40, 32)
        const rArmOuter = new THREE.Mesh(rArmOuterGeo, material)
        rArmOuter.position.y = -6 * pixelScale + 2 * pixelScale
        rArmOuter.scale.set(pixelScale * 1.05, pixelScale * 1.05, pixelScale * 1.05)
        this.rightArmGroup.add(rArmOuter)

        // Left Arm
        this.leftArmGroup = new THREE.Group()
        this.leftArmGroup.position.set(-4 * pixelScale - 2 * pixelScale, 1.30 - 2 * pixelScale, 0) // Lowered by 0.20
        this.model.add(this.leftArmGroup)

        const lArmGeo = this.createBoxGeometryWithUVs(4, 12, 4, 32, 48)
        this.leftArm = new THREE.Mesh(lArmGeo, material)
        this.leftArm.position.y = -6 * pixelScale + 2 * pixelScale
        this.leftArm.scale.set(pixelScale, pixelScale, pixelScale)
        this.leftArm.castShadow = true
        this.leftArmGroup.add(this.leftArm)

        // Left Arm Outer
        const lArmOuterGeo = this.createBoxGeometryWithUVs(4, 12, 4, 48, 48)
        const lArmOuter = new THREE.Mesh(lArmOuterGeo, material)
        lArmOuter.position.y = -6 * pixelScale + 2 * pixelScale
        lArmOuter.scale.set(pixelScale * 1.05, pixelScale * 1.05, pixelScale * 1.05)
        this.leftArmGroup.add(lArmOuter)

        // --- Legs ---
        // Right Leg
        this.rightLegGroup = new THREE.Group()
        this.rightLegGroup.position.set(2 * pixelScale, 1.30 - 12 * pixelScale, 0) // Lowered by 0.20
        this.model.add(this.rightLegGroup)

        const rLegGeo = this.createBoxGeometryWithUVs(4, 12, 4, 0, 16)
        this.rightLeg = new THREE.Mesh(rLegGeo, material)
        this.rightLeg.position.y = -6 * pixelScale
        this.rightLeg.scale.set(pixelScale, pixelScale, pixelScale)
        this.rightLeg.castShadow = true
        this.rightLegGroup.add(this.rightLeg)

        // Right Leg Outer
        const rLegOuterGeo = this.createBoxGeometryWithUVs(4, 12, 4, 0, 32)
        const rLegOuter = new THREE.Mesh(rLegOuterGeo, material)
        rLegOuter.position.y = -6 * pixelScale
        rLegOuter.scale.set(pixelScale * 1.05, pixelScale * 1.05, pixelScale * 1.05)
        this.rightLegGroup.add(rLegOuter)

        // Left Leg
        this.leftLegGroup = new THREE.Group()
        this.leftLegGroup.position.set(-2 * pixelScale, 1.30 - 12 * pixelScale, 0) // Lowered by 0.20
        this.model.add(this.leftLegGroup)

        const lLegGeo = this.createBoxGeometryWithUVs(4, 12, 4, 16, 48)
        this.leftLeg = new THREE.Mesh(lLegGeo, material)
        this.leftLeg.position.y = -6 * pixelScale
        this.leftLeg.scale.set(pixelScale, pixelScale, pixelScale)
        this.leftLeg.castShadow = true
        this.leftLegGroup.add(this.leftLeg)

        // Left Leg Outer
        const lLegOuterGeo = this.createBoxGeometryWithUVs(4, 12, 4, 0, 48)
        const lLegOuter = new THREE.Mesh(lLegOuterGeo, material)
        lLegOuter.position.y = -6 * pixelScale
        lLegOuter.scale.set(pixelScale * 1.05, pixelScale * 1.05, pixelScale * 1.05)
        this.leftLegGroup.add(lLegOuter)


        this.scene.add(this.model)
    }

    // Helper to map 64x64 skin UVs to BoxGeometry
    createBoxGeometryWithUVs(w, h, d, u, v) {
        const geometry = new THREE.BoxGeometry(w, h, d)

        // Minecraft Texture Layout for a Box (Standard/Steve):
        // Each part (Head, Leg, etc) unfolds into a cross/T shape or similar logic.
        // Top: (u+d, v) size (w, d)
        // Bottom: (u+d+w, v) size (w, d)
        // Right: (u, v+d) size (d, h)
        // Front: (u+d, v+d) size (w, h)
        // Left: (u+d+w, v+d) size (d, h)
        // Back: (u+d+w+d, v+d) size (w, h)

        // However, Three.js BoxGeometry face order is: 
        // 0: +x (Right), 1: -x (Left), 2: +y (Top), 3: -y (Bottom), 4: +z (Front), 5: -z (Back)

        // Wait, Minecraft "Right" in texture matches Right of character?
        // Let's manually map UVs according to standard spec.

        const width = 64
        const height = 64

        // Function to helper convert pixel to UV [0,1]
        // y is inverted in UV (0 bottom, 1 top), but texture coords usually top-left origin.
        // We'll treat v=0 as TOP in param.
        const mapUV = (x, y, w, h) => {
            const u1 = x / width
            const v1 = 1 - (y + h) / height
            const u2 = (x + w) / width
            const v2 = 1 - y / height
            return [
                new THREE.Vector2(u2, v1), // Bottom Right
                new THREE.Vector2(u2, v2), // Top Right
                new THREE.Vector2(u1, v2), // Top Left
                new THREE.Vector2(u1, v1)  // Bottom Left
            ]
        }

        // Faces
        // Right Face (+x): pos(u, v+d), size(d, h)
        const uvRight = mapUV(u, v + d, d, h)

        // Left Face (-x): pos(u+d+w, v+d), size(d, h)
        const uvLeft = mapUV(u + d + w, v + d, d, h)

        // Top Face (+y): pos(u+d, v), size(w, d)
        const uvTop = mapUV(u + d, v, w, d)

        // Bottom Face (-y): pos(u+d+w, v), size(w, d)
        const uvBottom = mapUV(u + d + w, v, w, d)

        // Front Face (+z): pos(u+d, v+d), size(w, h)
        const uvFront = mapUV(u + d, v + d, w, h)

        // Back Face (-z): pos(u+d+w+d, v+d), size(w, h)
        const uvBack = mapUV(u + d + w + d, v + d, w, h)

        // Apply to Geometry
        // Order: Right, Left, Top, Bottom, Front, Back
        const uvs = []
        // Each face has 4 vertices (2 triangles), but geometry.attributes.uv expects per vertex.
        // BoxGeometry is non-indexed (usually) or indexed? Standard is indexed?
        // Actually BufferGeometry non-indexed means 6 vertices per face.
        // Indexed means shared vertices. BoxGeometry is indexed? No, it has split vertices for sharp edges usually.
        // Let's iterate faces.

        // Actually, easiest way is to set .getAttribute('uv') directly.
        // BoxGeometry has 24 vertices (4 per face * 6 faces).

        const order = [uvRight, uvLeft, uvTop, uvBottom, uvFront, uvBack]

        const uvAttribute = geometry.attributes.uv

        for (let i = 0; i < 6; i++) {
            const faceUVs = order[i]
            // Defined as: BR, TR, TL, BL?
            // Three.js PlaneGeometry/BoxGeometry defaults:
            // 0: TL, 1: BL, 2: TR, 3: BR? No.
            // Vertices order usually: 0: top-left, 1: top-right, 2: bottom-left, 3: bottom-right (varies).

            // Let's verify standard UV mapping of BoxGeometry.
            // Usually [0,1], [1,1], [0,0], [1,0]
            // We'll replace them.

            // Indices 4*i + 0,1,2,3

            // Standard Cube UVs:
            // 0 (TL), 1 (TR), 2 (BL), 3 (BR) -> order depends on tri winding.

            // Let's preserve standard orientation.
            // TL: (u1, v2)
            // TR: (u2, v2)
            // BL: (u1, v1)
            // BR: (u2, v1)

            // MapUV returns [BR, TR, TL, BL] order? No let's make it consistent.
            // We returned [BR, TR, TL, BL] vectors.

            // Three.js default BoxGeometry vertex generation order (per face):
            // 0: top-left-ish?
            // It's safer to check standard.

            // Standard: TL, TR, BL, BR
            // i*4 + 0 = TL
            // i*4 + 1 = TR
            // i*4 + 2 = BL
            // i*4 + 3 = BR
            // (Note: might need flipping depending on face normal)

            const u1 = faceUVs[2].x // TL
            const v1 = faceUVs[2].y

            const u2 = faceUVs[1].x // TR
            const v2 = faceUVs[1].y

            const u3 = faceUVs[3].x // BL
            const v3 = faceUVs[3].y

            const u4 = faceUVs[0].x // BR
            const v4 = faceUVs[0].y

            // Set UVs
            uvAttribute.setXY(i * 4 + 0, u1, v1) // TL
            uvAttribute.setXY(i * 4 + 1, u2, v2) // TR
            uvAttribute.setXY(i * 4 + 2, u3, v3) // BL
            uvAttribute.setXY(i * 4 + 3, u4, v4) // BR
        }

        geometry.attributes.uv.needsUpdate = true
        return geometry
    }

    setVisible(visible) {
        this.isVisible = visible
        if (this.model) {
            this.model.visible = visible
        }
    }

    setPosition(pos) {
        if (this.model) {
            this.model.position.copy(pos)
        }
    }

    setRotation(rot) {
        if (this.model) {
            // Offset because we built it facing +Z
            // Controller physics Rotation is typically Backwards (PI) relative to model front?
            // GLB required PI. 
            // Polygon required PI.
            // So this likely requires PI too.
            this.model.rotation.y = rot + Math.PI
        }
    }

    getPosition() {
        return this.model ? this.model.position.clone() : new THREE.Vector3()
    }

    update(dt, isMoving, isCrouching, isAttacking) {
        if (!this.model || !this.isVisible) return

        // --- ATTACK SMOOTHING ---
        // Smoothly transition into and out of attack state
        const attackLerpSpeed = 15 * dt
        const targetWeight = isAttacking ? 1.0 : 0.0
        this.attackWeight = THREE.MathUtils.lerp(this.attackWeight, targetWeight, attackLerpSpeed)

        // Calculate Attack Swing
        const attackSpeed = 25
        const attackVal = Math.sin(Date.now() / 1000 * attackSpeed)
        const swing = (attackVal + 1) / 2 // 0 to 1

        // --- CROUCH ANIMATION ---
        const pixelScale = 1 / 16 * 0.9
        const crouchOffset = isCrouching ? 0.2 : 0
        const legCrouchOffset = isCrouching ? 0.05 : 0 // Sink feet slightly (0.05 units)

        // Target positions (Base Scale reference)
        const targetHeadY = 1.30 - crouchOffset
        const targetBodyY = 1.30 - (6 * pixelScale) - crouchOffset
        const targetArmY = 1.30 - (2 * pixelScale) - crouchOffset

        // Base Leg Y (From constructor: 1.30 - 12 * pixelScale)
        const baseLegY = 1.30 - 12 * pixelScale
        const targetLegY = baseLegY - legCrouchOffset

        const lerpSpeed = 10 * dt

        this.headGroup.position.y = THREE.MathUtils.lerp(this.headGroup.position.y, targetHeadY, lerpSpeed)
        this.body.position.y = THREE.MathUtils.lerp(this.body.position.y, targetBodyY, lerpSpeed)

        this.rightArmGroup.position.y = THREE.MathUtils.lerp(this.rightArmGroup.position.y, targetArmY, lerpSpeed)
        this.leftArmGroup.position.y = THREE.MathUtils.lerp(this.leftArmGroup.position.y, targetArmY, lerpSpeed)

        // Sink Legs
        this.rightLegGroup.position.y = THREE.MathUtils.lerp(this.rightLegGroup.position.y, targetLegY, lerpSpeed)
        this.leftLegGroup.position.y = THREE.MathUtils.lerp(this.leftLegGroup.position.y, targetLegY, lerpSpeed)

        // Body Angle (Lean forward when crouching)
        const targetBodyRotX = isCrouching ? 0.2 : 0
        this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, targetBodyRotX, lerpSpeed)
        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, targetBodyRotX, lerpSpeed)


        // --- BASE MOVEMENT ANIMATION ---
        let baseRArmX = 0
        let baseLArmX = 0
        let baseRLegX = 0
        let baseLLegX = 0

        if (isMoving) {
            const speed = isCrouching ? 5 : 10
            const time = Date.now() / 1000 * speed
            const sinVal = Math.sin(time)

            baseRArmX = sinVal * 0.8
            baseLArmX = -sinVal * 0.8
            baseRLegX = -sinVal * 0.8
            baseLLegX = sinVal * 0.8

            if (isCrouching) {
                baseRArmX += 0.2
                baseLArmX += 0.2
            }
        } else {
            // Idle
            const time = Date.now() / 1000
            this.rightArmGroup.rotation.z = Math.sin(time) * 0.05 + 0.05
            this.leftArmGroup.rotation.z = -Math.sin(time) * 0.05 - 0.05

            if (isCrouching) {
                baseRArmX = 0.2
                baseLArmX = 0.2
            }
        }

        // Apply Leg Animations (Legs just follow walking)
        const animLerp = 0.2
        this.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.rightLegGroup.rotation.x, baseRLegX, animLerp)
        this.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.leftLegGroup.rotation.x, baseLLegX, animLerp)

        // --- BLENDING ATTACK ---
        if (this.attackWeight > 0.01) {
            // Attack Influence
            const blend = this.attackWeight

            // 1. Arm Rotations
            // Punch Arm (Left Group = Visual Right)
            const punchRotX = -swing * 2.5 - 0.2
            // Recoil Arm
            const recoilRotX = swing * 0.5 + 0.5

            // 2. Body Twist (Twist Y)
            const targetTwist = swing * 0.4

            // Blend
            const finalLArmX = THREE.MathUtils.lerp(baseLArmX, punchRotX, blend)
            const finalRArmX = THREE.MathUtils.lerp(baseRArmX, recoilRotX, blend)
            const finalTwist = THREE.MathUtils.lerp(0, targetTwist, blend)

            this.leftArmGroup.rotation.x = finalLArmX
            this.rightArmGroup.rotation.x = finalRArmX

            // Apply Twist to upper body
            this.body.rotation.y = finalTwist
            this.headGroup.rotation.y = finalTwist
            this.leftArmGroup.rotation.y = finalTwist
            this.rightArmGroup.rotation.y = finalTwist

        } else {
            // No Attack
            this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, baseLArmX, animLerp)
            this.rightArmGroup.rotation.x = THREE.MathUtils.lerp(this.rightArmGroup.rotation.x, baseRArmX, animLerp)

            // Reset Twist
            const resetTwist = 0
            this.body.rotation.y = THREE.MathUtils.lerp(this.body.rotation.y, resetTwist, animLerp)
            this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, resetTwist, animLerp)
            this.leftArmGroup.rotation.y = THREE.MathUtils.lerp(this.leftArmGroup.rotation.y, resetTwist, animLerp)
            this.rightArmGroup.rotation.y = THREE.MathUtils.lerp(this.rightArmGroup.rotation.y, resetTwist, animLerp)
        }
    }
}
