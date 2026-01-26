import * as THREE from "three"

export class SequenceExecutor {
    constructor(object) {
        this.object = object
        this.active = false
        this.sequence = null
        this.state = {
            wpIndex: 0,
            moveAlpha: 0,
            waitTimer: 0,
            waiting: false,
            signalReceived: false,
            waitingForSignal: false
        }
    }

    start(sequence) {
        if (!sequence || !sequence.waypoints || sequence.waypoints.length === 0) return
        this.sequence = sequence
        this.active = true
        this.resetState()

        // Initial snap if first point is not just a logic step?
        // Actually, we usually want to start FROM where we are TO the first point?
        // Or snap to first point? Standard logic was snap to first.
        // But if restart, maybe snap.
    }

    resetState() {
        this.state = {
            wpIndex: 0,
            moveAlpha: 0,
            waitTimer: 0,
            waiting: false,
            signalReceived: false,
            waitingForSignal: false
        }
    }

    update(dt) {
        if (!this.active || !this.sequence) return

        const waypoints = this.sequence.waypoints
        const idx = this.state.wpIndex
        const nextIdx = (idx + 1) % waypoints.length

        // Loop Check
        if (!this.sequence.loop && nextIdx === 0 && idx === waypoints.length - 1) {
            // End of Sequence
            return
        }

        const pCurrent = waypoints[idx]

        // --- 1. WAIT LOGIC (Delay at current step) ---
        if (pCurrent.delay > 0 && !this.state.waitingCompleted) {
            if (!this.state.waiting) {
                this.state.waiting = true
                this.state.waitTimer = 0
            }
            this.state.waitTimer += dt
            if (this.state.waitTimer < pCurrent.delay) {
                this.maintainPosition(pCurrent)
                return
            } else {
                this.state.waiting = false
                this.state.waitingCompleted = true
            }
        }

        // --- 2. SIGNAL WAIT LOGIC ---
        if (pCurrent.type === 'wait_signal') {
            if (!this.state.signalReceived) {
                // HOLD POSITION
                // If this step has no coordinates, we must hold at the LAST VALID position.
                // This prevents drifting if we just 'freeze' current physics each frame.

                let anchor = null
                if (pCurrent.x !== undefined) {
                    anchor = pCurrent
                } else {
                    // Search backwards for a waypoint with coordinates
                    let searchIdx = idx - 1
                    let found = false
                    // Limit search to avoid infinite loops if all are logic
                    let checked = 0
                    while (checked < waypoints.length) {
                        if (searchIdx < 0) {
                            if (this.sequence.loop) searchIdx = waypoints.length - 1
                            else break // Start of list, no prev
                        }

                        const wp = waypoints[searchIdx]
                        if (wp.x !== undefined) {
                            anchor = wp
                            found = true
                            break
                        }

                        searchIdx--
                        checked++
                    }

                    if (!found) {
                        // No previous coordinates found (maybe start of sequence), freeze current
                        anchor = { x: this.object.position.x, y: this.object.position.y, z: this.object.position.z }
                    }
                }

                if (anchor) {
                    this.snapTo(anchor)
                }
                return
            }
            // Signal Received! Proceed.
            // We consume the signal flags ONLY when we transition out?
            // Actually, we can just proceed to interpolation.
            // NOTE: If pCurrent is logic-only (no coords), distance is 0 to itself, 
            // so logic below will immediately switch to next index.
        }

        // --- 3. MOVEMENT ---
        const pNext = waypoints[nextIdx]
        const speed = this.sequence.speed || 2.0

        // Determine Start and End positions
        let startPos = new THREE.Vector3()
        let endPos = new THREE.Vector3()

        // Start: Is Current Step (or Object Pos if Current has no coords)
        if (pCurrent.x !== undefined) {
            startPos.set(pCurrent.x, pCurrent.y, pCurrent.z)
        } else {
            // Logic step, allow object to be where it is
            startPos.copy(this.object.position)
        }

        // End: Is Next Step
        if (pNext.x !== undefined) {
            endPos.set(pNext.x, pNext.y, pNext.z)
        } else {
            // Logic step in next? Then we travel to... where?
            // If next is logic only, effectively dist is 0, so we arrive immediately.
            endPos.copy(startPos)
        }

        const dist = startPos.distanceTo(endPos)

        // Interpolation
        if (dist < 0.05) {
            // Arrived / Instant Step
            this.advanceIndex()
        } else {
            // Move
            const dir = new THREE.Vector3().subVectors(endPos, startPos).normalize()
            const moveAmt = speed * dt

            // We can strictly interpolate using alpha if we want fixed time, 
            // OR just move towards target. Moving towards is safer for variable dt.

            const currentPos = this.object.position.clone()
            const distRemaining = currentPos.distanceTo(endPos)

            if (distRemaining < moveAmt) {
                // Snap and Advance
                this.snapTo(endPos)
                this.advanceIndex()
            } else {
                // Move logic
                const newPos = currentPos.add(dir.multiplyScalar(moveAmt))
                this.snapTo({ x: newPos.x, y: newPos.y, z: newPos.z })

                // Rotation (LookAt)
                // If pure visual, direct. If physics, maybe setRotation.
                this.object.lookAt(endPos)
                if (this.object.userData.rigidBody) {
                    this.object.userData.rigidBody.setRotation(this.object.quaternion)
                }
            }
        }
    }

    advanceIndex() {
        const waypoints = this.sequence.waypoints
        this.state.wpIndex = (this.state.wpIndex + 1) % waypoints.length

        // Reset Logic Flags for the NEW index
        this.state.waiting = false
        this.state.waitingCompleted = false
        this.state.signalReceived = false
        this.state.moveAlpha = 0
    }

    snapTo(pos) {
        if (this.object.userData.rigidBody) {
            this.object.userData.rigidBody.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z })
        }
        this.object.position.set(pos.x, pos.y, pos.z)
    }

    maintainPosition(pos) {
        if (pos.x !== undefined) {
            this.snapTo(pos)
        } else {
            // Freeze at current
            if (this.object.userData.rigidBody) {
                this.object.userData.rigidBody.setNextKinematicTranslation(this.object.position)
            }
        }
    }

    receiveSignal(signalId) {
        // Check if current wait step matches signal
        if (!this.sequence) return
        const pCurrent = this.sequence.waypoints[this.state.wpIndex]
        if (pCurrent && pCurrent.type === 'wait_signal' && pCurrent.signalId === signalId) {
            this.state.signalReceived = true
            console.log("Executor: Signal Verified!", signalId)
        }
    }
}
