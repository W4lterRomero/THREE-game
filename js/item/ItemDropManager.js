import * as THREE from "three";
import { DroppedItem } from "./DroppedItem.js";

export class ItemDropManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.droppedItems = [];
    }

    dropItem(item, position, launchDirection) {
        if (!item) return;

        // launchDirection debe ser un vector normalizado de hacia donde mira el jugador
        // Ajustamos la posicion de spawn para que no colisione inmediatamente con el jugador
        const spawnPos = new THREE.Vector3(
            position.x + launchDirection.x * 1.0,
            position.y + 1.0, // Altura del pecho/ojos
            position.z + launchDirection.z * 1.0
        );

        const dropped = new DroppedItem(this.scene, this.world, item, spawnPos);

        // Impulso estilo "Minecraft Q"
        // Un arco hacia adelante
        const force = 0.4;
        const impulse = {
            x: launchDirection.x * force,
            y: 0.8, // Altura moderada (arco pequeño)
            z: launchDirection.z * force
        };

        dropped.rigidBody.applyImpulse(impulse, true);
        // Rotacion aleatoria al lanzar
        dropped.rigidBody.applyTorqueImpulse({
            x: (Math.random() - 0.5) * 0.5,
            y: (Math.random() - 0.5) * 0.5,
            z: (Math.random() - 0.5) * 0.5
        }, true);

        this.droppedItems.push(dropped);
        console.log("Item arrojado:", item.name);
    }

    /**
     * Intenta recoger el item mas cercano a la posicion dada
     * @param {THREE.Vector3} position - Posicion del jugador
     * @returns {Item|null} - El item recogido o null
     */
    tryPickupNearest(position) {
        const pickupRange = 3.0; // Rango de recogida
        let nearest = null;
        let minDistSq = pickupRange * pickupRange;

        for (const dropped of this.droppedItems) {
            const itemPos = dropped.rigidBody.translation();
            const dx = itemPos.x - position.x;
            const dy = itemPos.y - position.y;
            const dz = itemPos.z - position.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < minDistSq) {
                minDistSq = distSq;
                nearest = dropped;
            }
        }

        if (nearest) {
            const item = nearest.item;
            nearest.dispose();

            // Remover de la lista
            const index = this.droppedItems.indexOf(nearest);
            if (index > -1) {
                this.droppedItems.splice(index, 1);
            }

            console.log("Item recogido:", item.name);
            return item;
        }

        return null; // pickup failed
    }

    getNearestItem(position, range = 3.0) {
        let nearest = null;
        let minDistSq = range * range;

        for (const dropped of this.droppedItems) {
            const itemPos = dropped.rigidBody.translation();
            const dx = itemPos.x - position.x;
            const dy = itemPos.y - position.y;
            // Ignoramos Y en la deteccion visual si queremos? No, 3D es mejor.
            const dz = itemPos.z - position.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < minDistSq) {
                minDistSq = distSq;
                nearest = dropped;
            }
        }
        return nearest;
    }

    /**
     * Revisa y recoge automaticamente items de cierto tipo sin interaccion
     * @param {THREE.Vector3} position - Posicion del recolector (jugador)
     * @param {number} range - Radio de recoleccion
     * @param {string} itemType - Tipo de item a recolectar (o null para cualquiera) (propiedad ID o filtro custom)
     * @returns {Array} - Lista de items recogidos
     */
    checkAutoPickup(position, range = 1.0, itemIdFilter = null) {
        const collected = [];
        const rangeSq = range * range;

        // Iterate backwards to safely remove
        for (let i = this.droppedItems.length - 1; i >= 0; i--) {
            const dropped = this.droppedItems[i];

            // Check Filter
            if (itemIdFilter && dropped.item.id !== itemIdFilter) continue;

            const itemPos = dropped.rigidBody.translation();
            const dx = itemPos.x - position.x;
            const dy = itemPos.y - position.y;
            const dz = itemPos.z - position.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < rangeSq) {
                // Collect!
                collected.push(dropped.item);
                dropped.dispose();
                this.droppedItems.splice(i, 1);
            }
        }

        return collected;
    }

    update(dt, time) {
        this.droppedItems.forEach(item => item.update(dt, time));
    }
}
