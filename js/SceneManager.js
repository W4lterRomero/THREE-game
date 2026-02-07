import * as THREE from 'three';

export class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 10, 50);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 10);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        this.initLights();
        this.initFloor();

        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    initLights() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(this.ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.dirLight.position.set(10, 20, 10);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.camera.top = 20;
        this.dirLight.shadow.camera.bottom = -20;
        this.dirLight.shadow.camera.left = -20;
        this.dirLight.shadow.camera.right = 20;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.scene.add(this.dirLight);
    }

    initFloor() {
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const grid = new THREE.GridHelper(100, 20, 0x000000, 0x000000);
        grid.material.opacity = 0.2;
        grid.material.transparent = true;
        this.scene.add(grid);

        // Initialize Stars (hidden by default)
        this.createStars();
    }

    createStars() {
        const starGeometry = new THREE.BufferGeometry();
        const starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.2,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.8
        });

        const starVertices = [];
        for (let i = 0; i < 2000; i++) {
            const x = (Math.random() - 0.5) * 200;
            const y = (Math.random() - 0.5) * 100 + 50; // Higher up
            const z = (Math.random() - 0.5) * 200;
            starVertices.push(x, y, z);
        }

        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.stars.visible = false;
        this.scene.add(this.stars);
    }

    setSky(type) {
        // ALWAYS use Day/Default lighting to preserve object colors
        if (this.ambientLight) {
            this.ambientLight.intensity = 0.6;
            this.ambientLight.color.setHex(0xffffff);
        }
        if (this.dirLight) {
            this.dirLight.intensity = 0.8;
            this.dirLight.color.setHex(0xffffff);
            this.dirLight.position.set(10, 20, 10);
        }

        if (type === 'night') {
            this.scene.background = new THREE.Color(0x020210); // Deep Space Blue/Black
            this.scene.fog = new THREE.FogExp2(0x020210, 0.015);
            if (this.stars) this.stars.visible = true;

        } else if (type === 'sunset') {
            const sunsetColor = 0xffae88; // Soft peach/orange
            this.scene.background = new THREE.Color(sunsetColor);
            this.scene.fog = new THREE.Fog(sunsetColor, 10, 60);
            if (this.stars) this.stars.visible = false;

        } else {
            // Day (Default)
            this.scene.background = new THREE.Color(0x87CEEB); // Sky Blue
            this.scene.fog = new THREE.Fog(0x87CEEB, 10, 50);
            if (this.stars) this.stars.visible = false;
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    update() {
        this.renderer.render(this.scene, this.camera);
    }
}
