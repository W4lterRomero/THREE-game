import { Item } from "../item/Item.js";
import { Projectile } from "../weapons/Projectile.js";
import * as THREE from "three";

export class PelotaItem extends Item {
    constructor(id, name, iconPath, damage, fireRate, bulletSpeed, bulletDrop = 1.0) {
        super(id, name, iconPath);
        this.damage = damage;
        this.fireRate = fireRate; // Shots per second
        this.bulletSpeed = bulletSpeed;
        this.bulletDrop = bulletDrop;

        this.lastShotTime = 0;
    }

    /**
     * @param {Object} context - Contains scene, world, playerPosition, cameraDirection, etc.
     * @returns {boolean} - True if shot was fired
     */
    use(context) {
        // NOTE: 'use' is typically called once per click. 
        // For auto-fire, we need a separate 'update' or 'trigger' called every frame if button held.
        // But for semi-auto or single click, this works.
        // We will adapt logic to support calling 'use' continuously.

        const now = performance.now() / 1000;
        if (now - this.lastShotTime < 1.0 / this.fireRate) {
            return false; // Cooldown active
        }

        this.lastShotTime = now;
        this.shoot(context);
        return true;
    }

    shoot(context) {
        const { scene, world, origin, direction } = context;

        // Spawn Projectile
        // Offset origin slightly to avoid clipping player?
        // Ideally, origin should be the muzzle position of the potential gun model.
        // For now, we use camera position + offset.

        const spawnPos = origin.clone().add(direction.clone().multiplyScalar(1.0)); // 1m in front

        const projectile = new Projectile(
            scene,
            world,
            spawnPos,
            direction,
            this.bulletSpeed,
            this.damage,
            this.bulletDrop
        );

        // Register projectile in the world/game manager so it gets updated
        // We need a way to pass this back.
        if (context.registerProjectile) {
            context.registerProjectile(projectile);
        }
    }

    getDisplayMesh() {
        // Ball mesh for ground
        const geo = new THREE.SphereGeometry(0.3, 16, 16);
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load("./assets/textures/pelota.png");
        const mat = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.5
        });
        return new THREE.Mesh(geo, mat);
    }
}
