
import { TeamLogic } from "./TeamLogic.js"
import { CapacityLogic } from "./CapacityLogic.js"
import { OrderLogic } from "./OrderLogic.js"
import { HoldTimeLogic } from "./HoldTimeLogic.js"

export class LogicItemsManager {
    constructor() {
        this.items = [
            new TeamLogic(),
            new CapacityLogic(),
            new OrderLogic(),
            new HoldTimeLogic()
        ]
    }

    renderAll(container, properties, updateCallback) {
        container.innerHTML = ''

        this.items.forEach(item => {
            item.render(container, properties, updateCallback)
        })
    }
}
