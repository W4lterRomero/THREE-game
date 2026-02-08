export class InputManager {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            crouch: false,
            attack: false,
        }

        this.isPaused = false
        this.enabled = true

        document.addEventListener("keydown", (e) => this.onKeyDown(e))
        document.addEventListener("keyup", (e) => this.onKeyUp(e))

        document.addEventListener("gamePauseChanged", (e) => {
            this.isPaused = e.detail.isPaused
            if (this.isPaused) {
                this.reset()
            }
        })

        document.addEventListener("mousedown", (e) => {
            if (this.isPaused || !this.enabled) return
            if (e.button === 0) this.keys.attack = true
        })

        document.addEventListener("mouseup", (e) => {
            if (e.button === 0) this.keys.attack = false
        })
    }

    reset() {
        this.keys.forward = false
        this.keys.backward = false
        this.keys.left = false
        this.keys.right = false
        this.keys.jump = false
        this.keys.crouch = false
        this.keys.attack = false
    }

    onKeyDown(event) {
        if (this.isPaused || !this.enabled) return

        switch (event.code) {
            case "KeyW":
                this.keys.forward = true
                break
            case "KeyS":
                this.keys.backward = true
                break
            case "KeyA":
                this.keys.left = true
                break
            case "KeyD":
                this.keys.right = true
                break
            case "Space":
                this.keys.jump = true
                break
            case "ShiftLeft":
                this.keys.crouch = true
                break
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case "KeyW":
                this.keys.forward = false
                break
            case "KeyS":
                this.keys.backward = false
                break
            case "KeyA":
                this.keys.left = false
                break
            case "KeyD":
                this.keys.right = false
                break
            case "Space":
                this.keys.jump = false
                break
            case "ShiftLeft":
                this.keys.crouch = false
                break
        }
    }
}
