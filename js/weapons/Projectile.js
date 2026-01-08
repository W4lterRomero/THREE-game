import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export class Projectile {
    constructor(scene, world, origin, direction, speed, damage, bulletDrop = 1.0) {
        this.scene = scene;
        this.world = world;
        this.damage = damage;
        this.isDead = false;
        this.lifetime = 5.0; // Segundos antes de auto eliminar

        // 1. Visuals
        const geo = new THREE.SphereGeometry(0.1, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(origin);
        this.scene.add(this.mesh);

        // 2. Physics (Dynamic RigidBody)
        let bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(origin.x, origin.y, origin.z)
            .setCcdEnabled(true) // Continuous Collision Detection for fast objects
            .setGravityScale(bulletDrop); // Adjustable gravity (bullet drop)

        this.rigidBody = this.world.createRigidBody(bodyDesc);

        // Initial Velocity
        const velocity = direction.clone().normalize().multiplyScalar(speed);
        this.rigidBody.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);

        // Collider (Sensor vs Solid?)
        // Solid allows it to bounce/push things. Sensor just detects overlap.
        // User wants "colisiones", implies physical interaction.
        let colliderDesc = RAPIER.ColliderDesc.ball(0.1)
            .setRestitution(0.5) // Bounciness
            .setDensity(5.0);   // Heavy enough to push small things?

        this.collider = this.world.createCollider(colliderDesc, this.rigidBody);

        // Mark as projectile for collision filtering if needed
        // this.collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    }

    update(dt) {
        if (this.isDead) return;

        this.lifetime -= dt;
        if (this.lifetime <= 0) {
            this.destroy();
            return;
        }

        // Sync visual mesh with physics body
        if (this.rigidBody) {
            const pos = this.rigidBody.translation();
            this.mesh.position.set(pos.x, pos.y, pos.z);
        }
    }

    destroy() {
        if (this.isDead) return;
        this.isDead = true;

        // Cleanup ThreeJS
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }

        // Cleanup Rapier
        if (this.rigidBody) {
            this.world.removeRigidBody(this.rigidBody);
        }
    }
}
