import { Item } from "./Item.js";
import { ImpulsePlatform } from "../ImpulsePlatform.js";
import * as THREE from "three";

export class ImpulseItem extends Item {
    constructor(id, name, iconPath, type, strength) {
        super(id, name, iconPath);
        this.type = type; // "lateral" | "jump"
        this.strength = strength;
    }

    use(context) {
        // Necesitamos acceso a los componentes de contexto
        // context = { scene, world, placementManager, platforms, rotationIndex }

        const { placementManager, scene, world, platforms, rotationIndex } = context;

        // Reutilizamos el manager de colocacion para saber donde ponerlo
        // Simulamos un update o necesitamos un metodo para obtener posicion actual
        // Dado que se llama en el mismo frame o muy cerca, podemos llamar update otra vez
        // o mejor aun, el PlacementManager deberia tener un metodo 'getPlacementPosition()' 
        // pero por ahora usaremos update() ya que es ligero (raycast)

        const hitPoint = placementManager.update(this, rotationIndex);

        if (hitPoint) {
            const placePos = hitPoint.clone();
            placePos.y += 0.1; // Offset visual

            let dir = new THREE.Vector3(0, 1, 0); // Default Up

            if (this.type === "lateral") {
                dir = new THREE.Vector3(0, 0, -1); // Default Forward (-Z)
                if (rotationIndex === 1) dir.set(1, 0, 0); // East
                if (rotationIndex === 2) dir.set(0, 0, 1); // South
                if (rotationIndex === 3) dir.set(-1, 0, 0); // West
            }

            const pad = new ImpulsePlatform(
                scene,
                world,
                placePos,
                dir,
                this.strength,
                "pad"
            );
            platforms.push(pad);
            console.log(`Placed ${this.name}`);
            return true; // Item usado
        }

        return false;
    }

    getDisplayMesh() {
        const geo = new THREE.BoxGeometry(0.5, 0.1, 0.5);
        const color = this.type === "jump" ? 0x00FFFF : 0x00FF00;
        const mat = new THREE.MeshStandardMaterial({ color: color });
        const mesh = new THREE.Mesh(geo, mat);

        // Si quisieramos textura, cargariamos aqui o usariamos loader global
        // Por simpleza, malla coloreada

        return mesh;
    }
}
