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
        this.alwaysRotateThirdPerson = true // Added for TP tracking
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
        this.smoothing = 1.0 // 1.0 = Instant locking, lower = smoother/laggy

        // Target position (character position)
        this.target = new THREE.Vector3()
        this.currentPosition = new THREE.Vector3()
        this.currentLookAt = new THREE.Vector3()

        this.horizontalOffset = 0.4
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
        this.isUIOpen = false // UI blocks pointer lock

        this.setupEventListeners()
    }

    setupEventListeners() {
        // Tab to switch camera mode
        document.addEventListener("keydown", (e) => {
            if (e.code === "Tab" && !this.isPaused && !this.isUIOpen) {
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
                // Allow interactions even if UI open (for rotation)
                this.isRightMouseDown = true
                if (!this.alwaysRotateThirdPerson && !this.isUIOpen) {
                    this.domElement.requestPointerLock()
                }
            }
        })

        this.domElement.addEventListener("mouseup", (e) => {
            if (e.button === 2) {
                this.isRightMouseDown = false
                if (!this.isFirstPerson && !this.alwaysRotateThirdPerson && !this.isUIOpen) {
                    document.exitPointerLock()
                }
            }
        })

        // Mouse movement for camera rotation
        document.addEventListener("mousemove", (e) => {
            if (this.isPaused) return

            const isLocked = document.pointerLockElement === this.domElement
            // Allow rotation if Right Mouse is Down (even if UI open) OR if Locked/AlwaysRotate
            // We need to ensure we don't rotate if clicking ON UI elements (handled by stopPropagation in UI)
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
            if (!this.isFirstPerson && !this.isPaused && e.shiftKey) {
                // Browsers often map Shift + Wheel to horizontal scroll (deltaX)
                // We sum them or take the one with significant value to support both cases
                let delta = e.deltaY
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                    delta = e.deltaX
                }

                // Normalize delta for different input devices
                if (e.deltaMode === 1) { // Line mode
                    delta *= 40
                }

                this.thirdPersonDistance += delta * 0.01
                this.thirdPersonDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.thirdPersonDistance))
            }
        })

        // Prevent context menu on right click
        this.domElement.addEventListener("contextmenu", (e) => {
            e.preventDefault()
        })

        // Click to lock pointer
        this.domElement.addEventListener("click", () => {
            if (!this.isPaused && !this.isUIOpen) {
                this.lock()
            }
        })

        // Listen for Pointer Lock changes to update state
        document.addEventListener("pointerlockchange", () => {
            const isLocked = document.pointerLockElement === this.domElement
            // console.log("Pointer Lock Changed:", isLocked)
        })
    }

    lock() {
        if (this.isUIOpen) return
        if (this.isFirstPerson || this.alwaysRotateThirdPerson) {
            this.domElement.requestPointerLock()
        }
    }

    unlock() {
        document.exitPointerLock()
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

    setHorizontalOffset(value) {
        this.horizontalOffset = value
    }

    setUIOpen(isOpen) {
        if (this.isUIOpen === isOpen) return
        this.isUIOpen = isOpen

        if (isOpen) {
            // Store previous state
            this.wasAlwaysRotate = this.alwaysRotateThirdPerson
            // Disable auto tracking
            if (this.wasAlwaysRotate) {
                this.setAlwaysRotateThirdPerson(false)
                // Note: setAlwaysRotate... exits pointer lock if false, which is what we want
            }
        } else {
            // Restore state
            if (this.wasAlwaysRotate) {
                this.setAlwaysRotateThirdPerson(true)
                // Re-engage lock if it was active
                if (!this.isPaused) {
                    this.domElement.requestPointerLock()
                }
            }
        }
    }

    setSmoothing(value) {
        this.smoothing = value
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

        // Apply horizontal offset (right vector)
        // Right vector is perpendicular to the look direction (theta)
        // Right vector x = -cos(theta), z = sin(theta) (based on getRightDirection logic)
        const offsetX = -Math.cos(this.theta) * this.horizontalOffset
        const offsetZ = Math.sin(this.theta) * this.horizontalOffset

        targetCameraPos.x += offsetX
        targetCameraPos.z += offsetZ

        targetCameraPos.y = Math.max(targetCameraPos.y, this.minCameraHeight)

        // Smooth camera movement
        this.currentPosition.lerp(targetCameraPos, this.smoothing)

        this.currentPosition.y = Math.max(this.currentPosition.y, this.minCameraHeight)

        this.camera.position.copy(this.currentPosition)

        const targetLookAt = characterPosition.clone()
        targetLookAt.y += 1.2

        // Also offset the look-at target so we look parallel to the character, 
        // effectively strafing the camera
        targetLookAt.x += offsetX
        targetLookAt.z += offsetZ

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
