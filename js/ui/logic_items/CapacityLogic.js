
import { LogicItem } from "./LogicItem.js"
import { InspectorUtils } from "./InspectorUtils.js"

export class CapacityLogic extends LogicItem {
    render(container, props, updateCallback) {
        if (props.capacity !== undefined) {
            const capInput = InspectorUtils.createNumberInput(
                "Capacidad Jugadores",
                (v) => updateCallback('capacity', v),
                1,
                1,
                "#00FFFF",
                props.capacity
            )
            container.appendChild(capInput.container)
        }
    }
}
