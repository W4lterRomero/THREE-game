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
        this.alwaysRotateThirdPerson = false // Added for TP tracking
        this.minDistance = 2
        this.maxDistance = 20
        this.minCameraHeight = 0.5

        // First person settings
        this.firstPersonHeight = 1.7
        this.firstPersonForwardOffset = 0.3

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
        this.maxPitch = Math.PI / 2 - 0.35

        // Axis settings
        this.fpInvertAxisX = true
        this.fpInvertAxisY = true
        this.tpInvertAxisX = true
        this.tpInvertAxisY = true

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
                if (!this.alwaysRotateThirdPerson) {
                    this.domElement.requestPointerLock()
                }
            }
        })

        this.domElement.addEventListener("mouseup", (e) => {
            if (e.button === 2) {
                this.isRightMouseDown = false
                if (!this.isFirstPerson && !this.alwaysRotateThirdPerson) {
                    document.exitPointerLock()
                }
            }
        })

        // Mouse movement for camera rotation
        document.addEventListener("mousemove", (e) => {
            if (this.isPaused) return

            const isLocked = document.pointerLockElement === this.domElement
            const canRotate = this.isFirstPerson || this.isRightMouseDown || (this.alwaysRotateThirdPerson && isLocked)

            if (canRotate) {
                if (this.isFirstPerson) {
                    this.fpYaw += e.movementX * this.rotationSpeed * (this.fpInvertAxisX ? -1 : 1)
                    this.fpPitch -= e.movementY * this.rotationSpeed * (this.fpInvertAxisY ? -1 : 1)
                    this.fpPitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.fpPitch))
                } else {
                    this.theta += e.movementX * this.rotationSpeed * (this.tpInvertAxisX ? -1 : 1)
                    this.phi -= e.movementY * this.rotationSpeed * (this.tpInvertAxisY ? -1 : 1)
                    this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi))
                }
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

        // Click to lock pointer
        this.domElement.addEventListener("click", () => {
            if (!this.isPaused) {
                if (this.isFirstPerson || this.alwaysRotateThirdPerson) {
                    this.domElement.requestPointerLock()
                }
            }
        })
    }

    togglePause() {
        this.isPaused = !this.isPaused

        if (this.isPaused) {
            document.exitPointerLock()
        } else if (this.isFirstPerson || this.alwaysRotateThirdPerson) {
            this.domElement.requestPointerLock()
        }

        const event = new CustomEvent("gamePauseChanged", {
            detail: {
                isPaused: this.isPaused,
                isFirstPerson: this.isFirstPerson,
                fpInvertAxisX: this.fpInvertAxisX,
                fpInvertAxisY: this.fpInvertAxisY,
                tpInvertAxisX: this.tpInvertAxisX,
                tpInvertAxisY: this.tpInvertAxisY,
            },
        })
        document.dispatchEvent(event)
    }

    setFpInvertAxisX(value) {
        this.fpInvertAxisX = value
    }

    setFpInvertAxisY(value) {
        this.fpInvertAxisY = value
    }

    setTpInvertAxisX(value) {
        this.tpInvertAxisX = value
    }

    setTpInvertAxisY(value) {
        this.tpInvertAxisY = value
    }

    setAlwaysRotateThirdPerson(value) {
        this.alwaysRotateThirdPerson = value
        if (value && !this.isPaused && !this.isFirstPerson && document.pointerLockElement !== this.domElement) {
            // Effectively we expect user to click to lock, but we can't force it without user gesture here
            // However, next click will lock it.
        }
        if (!value && !this.isFirstPerson && document.pointerLockElement === this.domElement) {
            document.exitPointerLock()
        }
    }

    resume() {
        this.isPaused = false
        if (this.isFirstPerson || this.alwaysRotateThirdPerson) {
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
            if (!this.alwaysRotateThirdPerson) {
                document.exitPointerLock()
            }
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

        // Add forward offset to avoid seeing inside body
        const forwardOffset = new THREE.Vector3(Math.sin(this.fpYaw), 0, Math.cos(this.fpYaw)).multiplyScalar(this.firstPersonForwardOffset)
        this.camera.position.add(forwardOffset)

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

        targetCameraPos.y = Math.max(targetCameraPos.y, this.minCameraHeight)

        // Smooth camera movement
        this.currentPosition.lerp(targetCameraPos, this.smoothing)

        this.currentPosition.y = Math.max(this.currentPosition.y, this.minCameraHeight)

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
            // Same direction logic as first person, using theta
            return new THREE.Vector3(Math.sin(this.theta), 0, Math.cos(this.theta)).normalize()
        }
    }

    getRightDirection() {
        if (this.isFirstPerson) {
            return new THREE.Vector3(-Math.cos(this.fpYaw), 0, Math.sin(this.fpYaw)).normalize()
        } else {
            // Same direction logic as first person, using theta
            return new THREE.Vector3(-Math.cos(this.theta), 0, Math.sin(this.theta)).normalize()
        }
    }
}
