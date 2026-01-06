import { Item } from "./Item.js";
import { TurretPad } from "../TurretPad.js";
import * as THREE from "three";

export class TurretItem extends Item {
    constructor(id, name, iconPath) {
        super(id, name, iconPath);
    }

    use(context) {
        // context = { scene, world, placementManager, platforms, rotationIndex }
        const { placementManager, scene, world, platforms, rotationIndex } = context;

        // Use a simulated slot index for placement visualization (e.g., 2 for turret if we had specific ghost logic)
        // For now, reusing 0 or 1 might show the wrong ghost (impulse pad arrow).
        // Ideally PlacementManager should handle generic "box" ghosts too.
        // Let's pass -1 or a new index if we update PlacementManager, 
        // but for now let's reuse '0' to get A ghost, even if the arrow is wrong.
        // Or better, update PlacementManager to support a Turret ghost.

        // Let's minimize changes to PlacementManager for now and just use the box shape it likely provides.
        // If I pass a new index '2', PlacementManager might default to something or break.
        // Let's check PlacementManager.js first if I want to be perfect, but 
        // given the instructions, I'll try to just reuse the logic.

        const hitPoint = placementManager.update(0, rotationIndex);

        if (hitPoint) {
            const placePos = hitPoint.clone();
            placePos.y += 0.1;

            // Create TurretPad
            const pad = new TurretPad(
                scene,
                world,
                placePos
            );

            // Add to platforms list so it gets updated
            platforms.push(pad);
            console.log(`Placed ${this.name}`);
            return true;
        }

        return false;
    }

    getDisplayMesh() {
        const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        return new THREE.Mesh(geo, mat);
    }
}
