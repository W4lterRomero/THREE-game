
import { LogicItem } from "./LogicItem.js"
import { InspectorUtils } from "./InspectorUtils.js"

export class HoldTimeLogic extends LogicItem {
    render(container, props, updateCallback) {
        if (props.holdTime !== undefined) {
            const holdInput = InspectorUtils.createNumberInput(
                "Tiempo Retener (s)",
                (v) => updateCallback('holdTime', v),
                0,
                0.1,
                "#FF4444",
                props.holdTime
            )
            container.appendChild(holdInput.container)
        }
    }
}
