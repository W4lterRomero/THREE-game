import * as THREE from "three"

export class CameraController {
    constructor(camera, domElement) {
        this.camera = camera
        this.domElement = domElement

        // Camera modes
        this.isFirstPerson = false

        // Third person settings
        this.thirdPersonDistance = 8
        this.thirdPersonHeight = 2
        this.minDistance = 2
        this.maxDistance = 20

        // First person settings
        this.firstPersonHeight = 1.7

        this.theta = 0 // Horizontal angle
        this.phi = Math.PI / 4 // Vertical angle (45 degrees default)
        this.minPhi = -Math.PI / 3 // Allow looking up more
        this.maxPhi = Math.PI / 2.2 // Almost top-down view

        // Mouse control
        this.isRightMouseDown = false
        this.rotationSpeed = 0.004
        this.smoothing = 0.08 // Smoother camera

        // Target position (character position)
        this.target = new THREE.Vector3()
        this.currentPosition = new THREE.Vector3()
        this.currentLookAt = new THREE.Vector3()

        this.horizontalOffset = 0
        this.verticalOffset = 0

        // First person look direction
        this.fpYaw = 0
        this.fpPitch = 0
        this.maxPitch = Math.PI / 2 - 0.1

        this.invertAxisX = false
        this.invertAxisY = false

        this.isPaused = false

        this.setupEventListeners()
    }

    setupEventListeners() {
        // Tab to switch camera mode
        document.addEventListener("keydown", (e) => {
            if (e.code === "Tab" && !this.isPaused) {
                e.preventDefault()
                this.toggleCameraMode()
            }
            if (e.code === "Escape") {
                e.preventDefault()
                this.togglePause()
            }
        })

        // Right mouse button for camera rotation
        this.domElement.addEventListener("mousedown", (e) => {
            if (e.button === 2 && !this.isPaused) {
                this.isRightMouseDown = true
                this.domElement.requestPointerLock()
            }
        })

        this.domElement.addEventListener("mouseup", (e) => {
            if (e.button === 2) {
                this.isRightMouseDown = false
                document.exitPointerLock()
            }
        })

        // Mouse movement for camera rotation
        document.addEventListener("mousemove", (e) => {
            if (this.isFirstPerson && !this.isPaused) {
                if (document.pointerLockElement === this.domElement) {
                    this.fpYaw += e.movementX * this.rotationSpeed * (this.invertAxisX ? -1 : 1)
                    this.fpPitch -= e.movementY * this.rotationSpeed * (this.invertAxisY ? -1 : 1)
                    this.fpPitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.fpPitch))
                }
            } else if (this.isRightMouseDown && !this.isPaused) {
                this.theta += e.movementX * this.rotationSpeed * (this.invertAxisX ? -1 : 1)
                this.phi -= e.movementY * this.rotationSpeed * (this.invertAxisY ? -1 : 1)
                this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi))
            }
        })

        // Scroll to zoom in third person
        this.domElement.addEventListener("wheel", (e) => {
            if (!this.isFirstPerson && !this.isPaused) {
                this.thirdPersonDistance += e.deltaY * 0.01
                this.thirdPersonDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.thirdPersonDistance))
            }
        })

        // Prevent context menu on right click
        this.domElement.addEventListener("contextmenu", (e) => {
            e.preventDefault()
        })

        // Click to lock pointer in first person
        this.domElement.addEventListener("click", () => {
            if (this.isFirstPerson && !this.isPaused) {
                this.domElement.requestPointerLock()
            }
        })
    }

    togglePause() {
        this.isPaused = !this.isPaused

        if (this.isPaused) {
            document.exitPointerLock()
        } else if (this.isFirstPerson) {
            this.domElement.requestPointerLock()
        }

        const event = new CustomEvent("gamePauseChanged", {
            detail: {
                isPaused: this.isPaused,
                isFirstPerson: this.isFirstPerson,
                invertAxisX: this.invertAxisX,
                invertAxisY: this.invertAxisY,
            },
        })
        document.dispatchEvent(event)
    }

    setInvertAxisX(value) {
        this.invertAxisX = value
    }

    setInvertAxisY(value) {
        this.invertAxisY = value
    }

    resume() {
        this.isPaused = false
        if (this.isFirstPerson) {
            this.domElement.requestPointerLock()
        }
    }

    toggleCameraMode() {
        this.isFirstPerson = !this.isFirstPerson

        if (this.isFirstPerson) {
            this.domElement.requestPointerLock()
            this.fpYaw = this.theta
            this.fpPitch = 0
        } else {
            document.exitPointerLock()
            this.theta = this.fpYaw
        }

        const event = new CustomEvent("cameraModeChanged", {
            detail: { isFirstPerson: this.isFirstPerson },
        })
        document.dispatchEvent(event)
    }

    update(characterPosition, characterRotation, dt) {
        if (!characterPosition) return

        this.target.copy(characterPosition)

        if (this.isFirstPerson) {
            this.updateFirstPerson(characterPosition)
        } else {
            this.updateThirdPerson(characterPosition, dt)
        }
    }

    updateFirstPerson(characterPosition) {
        const headPosition = characterPosition.clone()
        headPosition.y += this.firstPersonHeight

        this.camera.position.copy(headPosition)

        const lookDirection = new THREE.Vector3()
        lookDirection.x = Math.sin(this.fpYaw) * Math.cos(this.fpPitch)
        lookDirection.y = Math.sin(this.fpPitch)
        lookDirection.z = Math.cos(this.fpYaw) * Math.cos(this.fpPitch)

        const lookAt = headPosition.clone().add(lookDirection)
        this.camera.lookAt(lookAt)
    }

    updateThirdPerson(characterPosition, dt) {
        const targetCameraPos = new THREE.Vector3()

        // Calculate horizontal distance based on phi angle
        const horizontalDist = this.thirdPersonDistance * Math.cos(this.phi)
        const verticalDist = this.thirdPersonDistance * Math.sin(this.phi)

        targetCameraPos.x = characterPosition.x - horizontalDist * Math.sin(this.theta)
        targetCameraPos.y = characterPosition.y + this.thirdPersonHeight + verticalDist
        targetCameraPos.z = characterPosition.z - horizontalDist * Math.cos(this.theta)

        // Smooth camera movement
        this.currentPosition.lerp(targetCameraPos, this.smoothing)
        this.camera.position.copy(this.currentPosition)

        const targetLookAt = characterPosition.clone()
        targetLookAt.y += 1.2

        this.currentLookAt.lerp(targetLookAt, this.smoothing)
        this.camera.lookAt(this.currentLookAt)
    }

    getForwardDirection() {
        if (this.isFirstPerson) {
            return new THREE.Vector3(Math.sin(this.fpYaw), 0, Math.cos(this.fpYaw)).normalize()
        } else {
            // Inverted for Third Person (W moves away, S moves towards)
            return new THREE.Vector3(Math.sin(this.theta), 0, -Math.cos(this.theta)).normalize()
        }
    }

    getRightDirection() {
        if (this.isFirstPerson) {
            // Inverted for First Person to fix A/D swap
            return new THREE.Vector3(-Math.cos(this.fpYaw), 0, Math.sin(this.fpYaw)).normalize()
        } else {
            // Standard Right for Third Person (A moves Left, D moves Right)
            return new THREE.Vector3(Math.cos(this.theta), 0, Math.sin(this.theta)).normalize()
        }
    }
}
