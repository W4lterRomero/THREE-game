---
name: GameTree Development Guidelines
description: Comprehensive skill for maintaining modular architecture and development standards in the GameTree THREE.js project
---

# GameTree Development Guidelines

## Project Overview
This is a **1-year development project** for a multiplayer 3D game built with:
- **Three.js** (v0.160.0) for 3D rendering
- **Rapier3D** for physics simulation
- **WebSocket** for multiplayer networking
- **Vite** for development and bundling
- **Modular architecture** organized by feature domains

## Core Principles

### 1. Modularity First
- **NEVER modify existing modules** unless strictly necessary for bug fixes or critical improvements
- Each new feature MUST be self-contained in its own module
- Modules should communicate through well-defined interfaces
- Prefer composition over modification

### 2. Non-Breaking Changes
- Maintain backward compatibility with existing systems
- Use feature flags or configuration for new behaviors
- Document any breaking changes explicitly
- Test integration points thoroughly

### 3. Reusable Tools Philosophy
- Create **actual tools**, not just "usable" code
- Tools must be:
  - **Generic**: Work across multiple contexts
  - **Configurable**: Accept parameters for customization
  - **Documented**: Include JSDoc comments and usage examples
  - **Tested**: Verify functionality before integration

## Project Structure

```
THREE-game/
├── js/
│   ├── Character/          # Player character logic
│   ├── collision/          # Collision detection systems
│   ├── environment/        # World building and environment
│   ├── item/               # Item system and pickups
│   ├── managers/           # Core game managers
│   ├── ui/                 # UI components and logic
│   ├── utils/              # Utility functions and helpers
│   ├── weapons/            # Weapon systems
│   ├── main_rapier.js      # Main game entry point
│   └── [Standalone Managers]  # Top-level managers
├── server/                 # WebSocket server
├── assets/                 # Game assets (textures, models)
├── resources/              # Styles and resources
└── game.html               # Main HTML entry
```

## Development Guidelines

### Adding New Features

#### Step 1: Analyze Impact
Before adding any feature, ask:
1. Does this require modifying existing code?
2. Can this be implemented as a standalone module?
3. What are the integration points?
4. Will this break existing functionality?

#### Step 2: Design the Module
Create a design document that includes:
- **Module name and location**
- **Dependencies** (what it needs from existing code)
- **Exports** (what it provides to other modules)
- **Configuration options**
- **Integration strategy**

#### Step 3: Implementation Pattern
```javascript
/**
 * [ModuleName] - Brief description
 * 
 * @module [category]/[ModuleName]
 * @requires three
 * @requires [other dependencies]
 * 
 * @example
 * import { ModuleName } from './path/ModuleName.js';
 * const instance = new ModuleName(config);
 * instance.initialize();
 */

export class ModuleName {
    /**
     * @param {Object} config - Configuration object
     * @param {THREE.Scene} config.scene - Three.js scene
     * @param {Object} config.options - Additional options
     */
    constructor(config = {}) {
        this.config = {
            // Default configuration
            enabled: true,
            ...config
        };
        
        this.initialized = false;
    }

    /**
     * Initialize the module
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) {
            console.warn('[ModuleName] Already initialized');
            return;
        }
        
        // Initialization logic
        
        this.initialized = true;
    }

    /**
     * Update loop (if needed)
     * @param {number} deltaTime - Time since last frame
     */
    update(deltaTime) {
        if (!this.initialized) return;
        // Update logic
    }

    /**
     * Clean up resources
     */
    dispose() {
        // Cleanup logic
        this.initialized = false;
    }
}
```

### Creating Reusable Tools

Tools should go in `js/utils/` and follow this pattern:

```javascript
/**
 * [ToolName] - Utility for [purpose]
 * 
 * @module utils/[ToolName]
 * 
 * @example
 * import { toolFunction } from './utils/ToolName.js';
 * const result = toolFunction(input, options);
 */

/**
 * [Function description]
 * 
 * @param {Type} param1 - Description
 * @param {Object} options - Configuration options
 * @param {boolean} [options.flag=false] - Optional flag
 * @returns {Type} Description of return value
 * 
 * @example
 * const result = toolFunction(data, { flag: true });
 */
export function toolFunction(param1, options = {}) {
    const config = {
        flag: false,
        ...options
    };
    
    // Implementation
    
    return result;
}
```

### Manager Integration

When creating managers that need to integrate with existing systems:

1. **Extend, don't modify**: Create wrapper classes if needed
2. **Use events**: Implement event-based communication
3. **Configuration over code**: Use config objects for behavior
4. **Lazy loading**: Initialize only when needed

Example:
```javascript
import { EventEmitter } from './utils/EventEmitter.js';

export class NewFeatureManager extends EventEmitter {
    constructor(gameContext) {
        super();
        this.game = gameContext;
        this.enabled = false;
    }

    enable() {
        if (this.enabled) return;
        
        // Hook into existing systems without modifying them
        this.game.on('update', this.onUpdate.bind(this));
        this.game.on('render', this.onRender.bind(this));
        
        this.enabled = true;
        this.emit('enabled');
    }

    disable() {
        if (!this.enabled) return;
        
        this.game.off('update', this.onUpdate);
        this.game.off('render', this.onRender);
        
        this.enabled = false;
        this.emit('disabled');
    }
}
```

## Specific System Guidelines

### Character System
- Location: `js/Character/`
- **DO NOT** modify core character controller
- Add new abilities as separate modules
- Use character events for integration

### Physics (Rapier)
- All physics code should be isolated
- Create physics utilities in `js/utils/physics/`
- Document performance implications
- Test with multiple objects

### Networking
- Server code: `server/websocket-server.js`
- Client code: `js/NetworkManager.js`
- **CRITICAL**: Maintain protocol compatibility
- Version all network messages
- Add new message types, don't modify existing ones

### UI System
- Location: `js/ui/`
- Create new UI components as separate files
- Use consistent styling from `resources/style/main.css`
- Ensure mobile responsiveness
- Follow existing UI patterns

### Weapons & Items
- Each weapon/item should be a separate class
- Inherit from base classes if they exist
- Register in appropriate managers
- Include pickup/drop logic

## Code Quality Standards

### Documentation
Every module MUST include:
```javascript
/**
 * Module description
 * 
 * @module category/ModuleName
 * @author [Your Name]
 * @created [Date]
 * @version 1.0.0
 * 
 * @description
 * Detailed description of what this module does,
 * its purpose, and how it fits into the system.
 * 
 * @example
 * // Basic usage
 * import { ModuleName } from './path/ModuleName.js';
 * const instance = new ModuleName(config);
 * 
 * @dependencies
 * - three.js (Scene, Mesh, etc.)
 * - Other modules
 * 
 * @integrations
 * - Where this module hooks into existing systems
 * - What events it listens to/emits
 */
```

### Error Handling
```javascript
try {
    // Risky operation
} catch (error) {
    console.error(`[ModuleName] Error in operation:`, error);
    // Graceful degradation
    this.fallbackBehavior();
}
```

### Performance Considerations
- Use object pooling for frequently created/destroyed objects
- Implement LOD (Level of Detail) for complex systems
- Profile before optimizing
- Document performance characteristics

### Configuration Management
Create configuration files for new systems:
```javascript
// js/config/NewFeatureConfig.js
export const NEW_FEATURE_CONFIG = {
    enabled: true,
    updateInterval: 1000,
    maxInstances: 100,
    debug: false,
    
    // Nested configuration
    physics: {
        gravity: -9.81,
        friction: 0.5
    }
};
```

## Testing Strategy

### Manual Testing Checklist
For each new feature:
- [ ] Works in first-person mode
- [ ] Works in third-person mode
- [ ] Multiplayer compatible (if applicable)
- [ ] No console errors
- [ ] Performance acceptable (60 FPS target)
- [ ] Mobile responsive (if UI)
- [ ] Settings persist correctly

### Integration Testing
- Test with existing features enabled
- Test feature toggle on/off
- Test with different character models
- Test in different environments

## Git Workflow

### Commit Messages
```
[Category] Brief description

- Detailed change 1
- Detailed change 2

Affects: [list of affected systems]
Breaking: [yes/no]
```

Example:
```
[Weapons] Add laser weapon system

- Created LaserWeapon class in js/weapons/
- Added laser beam rendering utility
- Integrated with existing weapon manager
- Added configuration in FarmingSettings

Affects: WeaponManager, UI
Breaking: no
```

### Branch Strategy
- `main` - Stable, production-ready
- `develop` - Integration branch
- `feature/[name]` - New features
- `fix/[name]` - Bug fixes

## Common Patterns

### Singleton Manager
```javascript
let instance = null;

export class SingletonManager {
    constructor() {
        if (instance) {
            return instance;
        }
        instance = this;
        // Initialization
    }

    static getInstance() {
        if (!instance) {
            instance = new SingletonManager();
        }
        return instance;
    }
}
```

### Factory Pattern for Items
```javascript
export class ItemFactory {
    static create(type, config) {
        const itemClasses = {
            'weapon': WeaponItem,
            'consumable': ConsumableItem,
            'equipment': EquipmentItem
        };

        const ItemClass = itemClasses[type];
        if (!ItemClass) {
            throw new Error(`Unknown item type: ${type}`);
        }

        return new ItemClass(config);
    }
}
```

### Observer Pattern for Events
```javascript
export class EventSystem {
    constructor() {
        this.listeners = new Map();
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(callback => callback(data));
    }

    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }
}
```

## Utility Tools to Create

### Recommended Utilities
These are examples of **reusable tools** that should be created:

1. **Math Utilities** (`js/utils/MathUtils.js`)
   - Vector operations
   - Interpolation functions
   - Random number generators with seeds

2. **Asset Loader** (`js/utils/AssetLoader.js`)
   - Centralized asset loading
   - Progress tracking
   - Caching system

3. **Debug Tools** (`js/utils/DebugTools.js`)
   - Performance monitoring
   - Visual debugging helpers
   - Console logging utilities

4. **Animation Helpers** (`js/utils/AnimationUtils.js`)
   - Easing functions
   - Animation state machine
   - Blend utilities

5. **Collision Utilities** (`js/utils/CollisionUtils.js`)
   - Raycast helpers
   - Bounding box calculations
   - Collision filtering

## Performance Optimization

### Object Pooling Example
```javascript
export class ObjectPool {
    constructor(factory, initialSize = 10) {
        this.factory = factory;
        this.available = [];
        this.inUse = new Set();

        for (let i = 0; i < initialSize; i++) {
            this.available.push(this.factory());
        }
    }

    acquire() {
        let obj = this.available.pop();
        if (!obj) {
            obj = this.factory();
        }
        this.inUse.add(obj);
        return obj;
    }

    release(obj) {
        if (this.inUse.has(obj)) {
            this.inUse.delete(obj);
            this.available.push(obj);
            if (obj.reset) obj.reset();
        }
    }

    clear() {
        this.available = [];
        this.inUse.clear();
    }
}
```

## Debugging Guidelines

### Debug Mode
Implement debug flags in your modules:
```javascript
const DEBUG = {
    enabled: false,
    showColliders: false,
    showPaths: false,
    logEvents: false
};

// Usage
if (DEBUG.enabled && DEBUG.logEvents) {
    console.log('[ModuleName] Event triggered:', eventData);
}
```

### Visual Debugging
```javascript
export class DebugRenderer {
    static drawLine(from, to, color = 0xff0000, scene) {
        const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
        const material = new THREE.LineBasicMaterial({ color });
        const line = new THREE.Line(geometry, material);
        scene.add(line);
        return line;
    }

    static drawSphere(position, radius, color = 0x00ff00, scene) {
        const geometry = new THREE.SphereGeometry(radius, 8, 8);
        const material = new THREE.MeshBasicMaterial({ 
            color, 
            wireframe: true 
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(position);
        scene.add(sphere);
        return sphere;
    }
}
```

## Migration Strategy

When you MUST modify existing code:

1. **Create a migration plan**
   - Document what needs to change
   - Identify all dependencies
   - Plan rollback strategy

2. **Implement with feature flags**
   ```javascript
   const USE_NEW_SYSTEM = false; // Toggle for testing

   if (USE_NEW_SYSTEM) {
       newImplementation();
   } else {
       oldImplementation();
   }
   ```

3. **Gradual rollout**
   - Test new system in isolation
   - Run both systems in parallel
   - Compare results
   - Switch when confident

4. **Document changes**
   - Update relevant documentation
   - Add migration notes
   - Update examples

## Long-term Maintenance

### Code Review Checklist
- [ ] Follows modular architecture
- [ ] No unnecessary modifications to existing code
- [ ] Properly documented
- [ ] Includes usage examples
- [ ] Error handling implemented
- [ ] Performance considered
- [ ] Mobile compatible (if applicable)
- [ ] Multiplayer compatible (if applicable)

### Refactoring Guidelines
- Refactor only when necessary
- Keep refactoring separate from feature additions
- Test thoroughly after refactoring
- Document what changed and why

### Technical Debt Management
- Track technical debt in comments with `// TODO:` or `// TECH_DEBT:`
- Prioritize debt that blocks new features
- Allocate time for debt reduction
- Don't accumulate debt faster than you pay it

## Communication

### Code Comments
```javascript
// GOOD: Explains WHY
// Using setTimeout instead of requestAnimationFrame because
// we need this to run after the physics update cycle
setTimeout(() => this.updatePosition(), 0);

// BAD: Explains WHAT (code already shows this)
// Set timeout to update position
setTimeout(() => this.updatePosition(), 0);
```

### Documentation Updates
When adding features, update:
- This SKILL.MD if it affects development patterns
- README.md for user-facing changes
- Inline code documentation
- Configuration examples

## User Communication & Feedback

### **CRITICAL: Never Assume - Always Ask**

This is a **collaborative project**. The AI assistant must NEVER make assumptions about requirements, preferences, or implementation details.

### Principles of User Communication

#### 1. **Ask Before Implementing**
When receiving a feature request, ALWAYS:
- ✅ Clarify ambiguous requirements
- ✅ Confirm the scope of changes
- ✅ Ask about preferred approaches when multiple options exist
- ✅ Verify integration points with existing systems
- ❌ NEVER assume you know what the user wants
- ❌ NEVER implement without confirming unclear details

**Example Questions to Ask:**
```
- "Should this new weapon system use the existing WeaponManager or be independent?"
- "Do you want this feature to be toggleable via settings?"
- "Should this work in both first-person and third-person modes?"
- "What should happen if the player already has this item?"
- "Should this persist across sessions or reset on reload?"
```

#### 2. **Present Options, Not Decisions**
When there are multiple valid approaches:
```
I see three possible approaches for implementing this:

Option A: Extend the existing ItemManager
  Pros: Integrates seamlessly, uses existing UI
  Cons: Adds complexity to an already large class

Option B: Create a new standalone manager
  Pros: Modular, easier to test and maintain
  Cons: Requires new UI integration

Option C: Use a hybrid approach with a facade pattern
  Pros: Best of both worlds
  Cons: More initial setup

Which approach would you prefer, or do you have another idea?
```

#### 3. **Confirm Before Modifying Existing Code**
If a feature requires modifying existing code:
```
⚠️ WARNING: This feature requires modifying [FileName.js]

Changes needed:
- Line 45-60: Add new parameter to constructor
- Line 120: Add event listener hook
- Line 200: Modify update loop

This could affect:
- Character movement system
- Multiplayer synchronization
- Save/load functionality

Do you want to proceed with these modifications, or should I find an alternative approach?
```

#### 4. **Request Feedback During Development**
For complex features, provide checkpoints:
```
I've completed the basic structure for [Feature]:
- ✅ Created module skeleton
- ✅ Defined configuration interface
- ✅ Added basic integration hooks

Before I continue with the full implementation, please review:
- Does the configuration structure look correct?
- Are the integration points in the right places?
- Should I add any additional options?
```

#### 5. **Explain Trade-offs**
When there are performance, complexity, or maintenance trade-offs:
```
This implementation will:
✅ Provide real-time updates (good UX)
⚠️ Require checking collision every frame (performance cost)
⚠️ Add ~500 lines of code (maintenance cost)

Alternative: Update every 100ms instead
✅ Much better performance
✅ Simpler code
⚠️ Slightly less responsive

What's your priority: responsiveness or performance?
```

### Feedback Request Templates

#### For New Features
```markdown
## Feature: [Name]

### Proposed Implementation
[Brief description]

### Questions Before Starting:
1. [Specific question about scope]
2. [Question about integration]
3. [Question about behavior]

### Assumptions (Please Confirm):
- [ ] This should work in multiplayer
- [ ] This should be saved in player preferences
- [ ] This should have a UI toggle

Please confirm or correct these assumptions before I proceed.
```

#### For Bug Fixes
```markdown
## Bug: [Description]

### Root Cause
[Explanation of what's wrong]

### Proposed Fix
[How you plan to fix it]

### Potential Side Effects
- [System that might be affected]
- [Behavior that might change]

### Questions:
- Is this the expected behavior, or should I fix it differently?
- Are there other places with similar issues?

Should I proceed with this fix?
```

#### For Refactoring
```markdown
## Refactoring: [Component]

### Current Issues
- [Problem 1]
- [Problem 2]

### Proposed Changes
- [Change 1] - Affects: [files]
- [Change 2] - Affects: [files]

### Risk Assessment
- **Low Risk**: [Changes that are safe]
- **Medium Risk**: [Changes that need testing]
- **High Risk**: [Changes that could break things]

Do you want to proceed with all changes, or should I start with low-risk items only?
```

### When to Ask for Clarification

**ALWAYS ask when:**
- Requirements are vague or incomplete
- Multiple interpretations are possible
- Changes affect existing functionality
- Performance implications are significant
- Security or data integrity is involved
- User experience could vary based on approach
- You're unsure about naming conventions
- Integration points are unclear

**Examples of Unclear Requests:**
- ❌ "Add a new weapon" → ✅ Ask: Type? Damage? Range? Ammo system? Visual effects?
- ❌ "Make it faster" → ✅ Ask: What specifically? Loading? Movement? Rendering?
- ❌ "Fix the camera" → ✅ Ask: What's wrong with it? Which mode? What's the expected behavior?

### Response Format for Clarification

```markdown
I need some clarification on [feature/request]:

**What I understand:**
- [Point 1]
- [Point 2]

**What's unclear:**
1. [Specific question]
2. [Specific question]

**My assumptions (please correct if wrong):**
- [Assumption 1]
- [Assumption 2]

Once you clarify these points, I can proceed with implementation.
```

### Iterative Development Communication

For large features, break into phases and request feedback:

```markdown
## Phase 1: Core Structure ✅ COMPLETE
- Created base classes
- Set up configuration

**Please review before I continue to Phase 2**

## Phase 2: Integration (NEXT)
- Hook into existing managers
- Add UI elements

**Questions before starting Phase 2:**
- [Question 1]
- [Question 2]

## Phase 3: Polish (PLANNED)
- Add animations
- Optimize performance
```

### Handling Ambiguity

When a request is ambiguous:

```markdown
Your request could mean several things:

**Interpretation A:** [Description]
  - Implementation: [How]
  - Time: [Estimate]

**Interpretation B:** [Description]
  - Implementation: [How]
  - Time: [Estimate]

**Interpretation C:** [Description]
  - Implementation: [How]
  - Time: [Estimate]

Which interpretation matches your intent, or is it something else entirely?
```

### Red Flags - Stop and Ask

**STOP and ask for clarification if:**
- 🚩 You're about to delete significant code
- 🚩 Changes affect more than 3 existing files
- 🚩 You're changing core game mechanics
- 🚩 Implementation requires external dependencies
- 🚩 You're unsure about the user's intent
- 🚩 Multiple team members might be affected
- 🚩 Changes could break multiplayer compatibility
- 🚩 You're considering a workaround instead of a proper fix

### Success Criteria for Communication

Good communication means:
- ✅ User confirms understanding before implementation starts
- ✅ No surprises when showing completed work
- ✅ Clear documentation of decisions made
- ✅ User feels involved in the development process
- ✅ Assumptions are explicitly stated and confirmed
- ✅ Trade-offs are discussed, not hidden

### Anti-Patterns to Avoid

❌ **"I'll just implement it and they can tell me if it's wrong"**
  → ✅ Ask first, implement after confirmation

❌ **"This is probably what they meant"**
  → ✅ Confirm your interpretation

❌ **"I'll add this extra feature since I'm already here"**
  → ✅ Ask if additional features are wanted

❌ **"I'll modify this existing code, it's easier"**
  → ✅ Ask if modification is acceptable or if a new module is preferred

❌ **"They didn't mention [detail], so I'll decide"**
  → ✅ Ask about unspecified details

### Remember

> **"When in doubt, ask. When certain, ask anyway."**

The cost of asking a question is minimal.
The cost of implementing the wrong thing is significant.

**This is a 1-year project. Taking 5 minutes to clarify now saves hours of rework later.**

## Emergency Procedures

### Rollback Process
If a feature breaks the game:
1. Disable the feature via configuration
2. Identify the breaking change
3. Create a fix or revert
4. Test thoroughly
5. Re-enable

### Hotfix Process
For critical bugs:
1. Create `fix/critical-[name]` branch
2. Implement minimal fix
3. Test in isolation
4. Merge to main
5. Update develop branch

## Success Metrics

A well-implemented feature should:
- ✅ Work without modifying existing modules
- ✅ Be toggleable via configuration
- ✅ Include comprehensive documentation
- ✅ Have clear integration points
- ✅ Maintain 60 FPS performance
- ✅ Work in multiplayer (if applicable)
- ✅ Be reusable in other contexts

## Questions to Ask Before Coding

1. **Can this be a separate module?** (Answer should be YES)
2. **Does this require modifying existing code?** (Answer should be NO)
3. **Is this tool reusable?** (Answer should be YES)
4. **Have I documented the integration points?** (Answer should be YES)
5. **Will this work in 6 months when I've forgotten the details?** (Answer should be YES)

## Final Notes

This is a **1-year project**. Code written today will be maintained for months. Prioritize:
- **Clarity** over cleverness
- **Modularity** over quick fixes
- **Documentation** over assumptions
- **Reusability** over one-off solutions

Remember: **The best code is code that doesn't need to be changed.**
