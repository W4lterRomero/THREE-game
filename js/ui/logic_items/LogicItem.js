
export class LogicItem {
    constructor() {
        if (this.constructor === LogicItem) {
            throw new Error("LogicItem cannot be instantiated directly");
        }
    }

    /**
     * Renders the logic item editor
     * @param {HTMLElement} container - The container to append to
     * @param {Object} props - The current logic properties object
     * @param {Function} updateCallback - Callback(key, value) to update property
     */
    render(container, props, updateCallback) {
        throw new Error("render must be implemented");
    }
}
