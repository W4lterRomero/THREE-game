import * as THREE from "three";
import { Item } from "./Item.js";

export class FuegoItem extends Item {
    constructor() {
        super("fuego", "Fuego", "./assets/textures/fuego.png");
        this.type = "collectible"; 
    }

    getDisplayMesh() {
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load(this.iconPath);
        
        // Sprite? Or Plane? 
        // Plane might be better to control rotation like Minecraft drops
        const geometry = new THREE.PlaneGeometry(0.5, 0.5);
        const material = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true, 
            side: THREE.DoubleSide 
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        return mesh;
    }
}
