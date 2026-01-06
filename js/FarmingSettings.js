export class FarmingSettings {
    constructor(farmingZone) {
        this.farmingZone = farmingZone;
        this.init();
    }

    init() {
        // Find UI elements
        this.intervalInput = document.getElementById("farming-interval");
        this.intervalValue = document.getElementById("farming-interval-val");

        this.countInput = document.getElementById("farming-count");
        this.countValue = document.getElementById("farming-count-val");

        this.valueInput = document.getElementById("farming-value");
        this.valueValue = document.getElementById("farming-value-val");

        if (this.intervalInput) {
            // Set initial
            this.intervalInput.value = this.farmingZone.spawnInterval;

            this.intervalInput.addEventListener("input", (e) => {
                const val = parseInt(e.target.value);
                this.farmingZone.setSpawnInterval(val);
                // No text content update needed if using number input directly, except maybe debugging
            });
        }

        if (this.countInput) {
            // Set initial
            this.countInput.value = this.farmingZone.itemsPerSpawn;

            this.countInput.addEventListener("input", (e) => {
                const val = parseInt(e.target.value);
                this.farmingZone.setItemsPerSpawn(val);
            });
        }

        if (this.valueInput) {
            // Set initial
            this.valueInput.value = this.farmingZone.itemValue;

            this.valueInput.addEventListener("input", (e) => {
                const val = parseInt(e.target.value);
                this.farmingZone.setItemValue(val);
            });
        }
    }
}
