import * as THREE from "three";
import { FuegoItem } from "./item/FuegoItem.js";

export class FarmingZone {
    constructor(scene, itemDropManager, position) {
        this.scene = scene;
        this.itemDropManager = itemDropManager;
        this.position = position;

        this.width = 3;
        this.depth = 3;
        this.height = 0.2;

        this.accumulatedTime = 0;
        this.spawnInterval = 1.0; // 1 second
        this.itemsPerSpawn = 1;
        this.itemValue = 1;

        this.initVisuals();
    }

    setSpawnInterval(seconds) {
        if (seconds <= 0) return;
        this.spawnInterval = seconds;
    }

    setItemsPerSpawn(count) {
        this.itemsPerSpawn = Math.max(1, Math.floor(count));
    }

    setItemValue(val) {
        this.itemValue = Math.floor(val);
    }

    initVisuals() {
        const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth);
        const material = new THREE.MeshStandardMaterial({
            color: 0xFF4500, // OrangeRed
            roughness: 0.8
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.position.y -= this.height / 2; // Floor align
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
    }

    update(dt) {
        this.accumulatedTime += dt;

        if (this.accumulatedTime >= this.spawnInterval) {
            this.accumulatedTime -= this.spawnInterval;
            for (let i = 0; i < this.itemsPerSpawn; i++) {
                this.spawnItem();
            }
        }
    }

    spawnItem() {
        const item = new FuegoItem();
        item.value = this.itemValue;

        // Random position within the pad
        const halfW = this.width / 2 * 0.8; // Margin
        const halfD = this.depth / 2 * 0.8;

        const offsetX = (Math.random() - 0.5) * 2 * halfW;
        const offsetZ = (Math.random() - 0.5) * 2 * halfD;

        const spawnPos = new THREE.Vector3(
            this.position.x + offsetX,
            this.position.y + 1.0,
            this.position.z + offsetZ
        );

        // No specific direction, just drop it
        // We can simulate a small upward pop
        const direction = new THREE.Vector3(0, 1, 0);
        this.itemDropManager.dropItem(item, spawnPos, direction, 0.0); // low force
    }

    setPosition(newPos) {
        this.position.copy(newPos);
        if (this.mesh) {
            this.mesh.position.copy(newPos);
            this.mesh.position.y -= this.height / 2;
        }
    }
}
