export class StairsUtils {
    static calculateSteps(scale) {
        // Based on scale (x=Width, y=Height, z=Depth)
        // Default step height ~0.25
        const targetStepHeight = 0.25
        const numSteps = Math.max(1, Math.round(scale.y / targetStepHeight))

        const stepHeight = scale.y / numSteps
        const stepDepth = scale.z / numSteps
        const stepWidth = scale.x

        const steps = []

        const startY = -scale.y / 2 + stepHeight / 2 // Bottom
        const startZ = -scale.z / 2 + stepDepth / 2 // Back

        for (let i = 0; i < numSteps; i++) {
            steps.push({
                size: { x: stepWidth, y: stepHeight, z: stepDepth },
                position: {
                    x: 0,
                    y: startY + (i * stepHeight),
                    z: startZ + (i * stepDepth)
                }
            })
        }

        return steps
    }
}
