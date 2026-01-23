
import { LogicItem } from "./LogicItem.js"
import { InspectorUtils } from "./InspectorUtils.js"

export class EventSubscriptionLogic extends LogicItem {
    render(container, props, updateCallback, context) {
        if (props.triggerButtonUuid !== undefined) {
            const wrapper = document.createElement('div')
            wrapper.style.cssText = `margin-top: 5px; border-top: 1px solid #444; padding-top: 5px;`

            const title = document.createElement('div')
            title.textContent = "VINCULAR EVENTO (BOTÓN)"
            title.style.cssText = `font-size: 10px; color: #888; margin-bottom: 5px; font-weight: bold;`
            wrapper.appendChild(title)

            // Display Current Link
            const status = document.createElement('div')
            status.style.cssText = `font-size: 11px; color: ${props.triggerButtonUuid ? '#00FF00' : '#FF4444'}; margin-bottom: 5px;`
            status.textContent = props.triggerButtonUuid ? "Vinculado" : "Sin Vinculación"
            wrapper.appendChild(status)

            // Button to Pick
            const pickBtn = document.createElement('button')
            pickBtn.textContent = props.triggerButtonUuid ? "Cambiar Botón" : "Seleccionar Botón"
            pickBtn.style.cssText = `
                width: 100%; padding: 4px; background: #333; color: white; border: 1px solid #555; 
                cursor: pointer; border-radius: 4px; font-size: 10px;
             `

            pickBtn.onclick = () => {
                // Start Picking Mode
                // We need access to ConstructionMenu or a global picker.
                // Context probably contains 'game' reference?
                let gameInstance = context && context.game ? context.game : null
                if (!gameInstance && window.game) gameInstance = window.game // Fallback to global if available

                if (gameInstance && gameInstance.constructionMenu) {
                    alert("Selecciona el BOTÓN que activará este objeto (Click Derecho)")

                    // Set picking mode on ConstructionMenu
                    gameInstance.constructionMenu.isPickingTarget = true
                    gameInstance.constructionMenu.pickingController = context.object // The object being edited
                    gameInstance.constructionMenu.pickingCallback = (selectedObj) => {
                        if (selectedObj.userData.mapObjectType === 'interaction_button') {
                            updateCallback('triggerButtonUuid', selectedObj.userData.uuid)
                            alert("Vinculado correctamente!")
                        } else {
                            alert("Error: Debes seleccionar un Botón de Interacción.")
                        }
                    }
                } else {
                    console.error("Context missing game reference for picking")
                }
            }

            wrapper.appendChild(pickBtn)
            container.appendChild(wrapper)
        }
    }
}
