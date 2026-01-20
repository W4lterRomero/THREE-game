
import { LogicItem } from "./LogicItem.js"
import { InspectorUtils } from "./InspectorUtils.js"

export class TeamLogic extends LogicItem {
    render(container, props, updateCallback) {
        if (props.team !== undefined) {
            const teamInput = InspectorUtils.createNumberInput(
                "Equipo (1-4)",
                (v) => updateCallback('team', v),
                1,
                1,
                "#00FF00",
                props.team
            )
            teamInput.input.max = 4
            container.appendChild(teamInput.container)
        }
    }
}
