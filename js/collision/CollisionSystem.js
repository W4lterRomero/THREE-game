import * as THREE from "three"
import { ColliderType, CollisionLayer } from "./Collider.js"

/**
 * Sistema central de detección y resolución de colisiones
 */
export class CollisionSystem {
  constructor(scene) {
    this.scene = scene
    this.colliders = new Map() // Map<id, Collider>
    this.debugMode = false

    // Estadísticas para optimización
    this.stats = {
      totalChecks: 0,
      collisionsDetected: 0,
      lastUpdateTime: 0,
    }
  }

  /**
   * Registra un colisionador en el sistema
   */
  addCollider(collider) {
    if (this.colliders.has(collider.id)) {
      console.warn(`[CollisionSystem] Collider ${collider.id} already exists`)
      return
    }

    this.colliders.set(collider.id, collider)

    if (this.debugMode) {
      collider.createDebugMesh(this.scene)
      collider.setDebugVisible(true, this.scene)
    }

    return collider
  }

  /**
   * Elimina un colisionador del sistema
   */
  removeCollider(colliderId) {
    const collider = this.colliders.get(colliderId)
    if (collider) {
      if (collider.debugMesh) {
        this.scene.remove(collider.debugMesh)
      }
      collider.dispose()
      this.colliders.delete(colliderId)
    }
  }

  /**
   * Obtiene un colisionador por ID
   */
  getCollider(colliderId) {
    return this.colliders.get(colliderId)
  }

  /**
   * Activa/desactiva modo debug para todos los colisionadores
   */
  setDebugMode(enabled) {
    this.debugMode = enabled

    this.colliders.forEach((collider) => {
      if (enabled && !collider.debugMesh) {
        collider.createDebugMesh(this.scene)
      }
      collider.setDebugVisible(enabled, this.scene)
    })
  }

  /**
   * Verifica colisión entre dos colisionadores
   */
  checkCollision(a, b) {
    if (!a.canCollideWith(b)) return false

    this.stats.totalChecks++

    // Actualizar posiciones
    a.updateWorldPosition()
    b.updateWorldPosition()

    // Detección según tipos
    if (a.type === ColliderType.SPHERE && b.type === ColliderType.SPHERE) {
      return a.intersectsSphere(b)
    }

    if (a.type === ColliderType.CAPSULE && b.type === ColliderType.CAPSULE) {
      return a.intersectsCapsule(b)
    }

    if (a.type === ColliderType.CAPSULE && b.type === ColliderType.SPHERE) {
      return a.intersectsSphere(b)
    }

    if (a.type === ColliderType.SPHERE && b.type === ColliderType.CAPSULE) {
      return b.intersectsSphere(a)
    }

    if (a.type === ColliderType.BOX && b.type === ColliderType.BOX) {
      return a.intersectsBox(b)
    }

    if (a.type === ColliderType.BOX && b.type === ColliderType.SPHERE) {
      return a.intersectsSphere(b)
    }

    if (a.type === ColliderType.SPHERE && b.type === ColliderType.BOX) {
      return b.intersectsSphere(a)
    }

    if (a.type === ColliderType.BOX && b.type === ColliderType.CAPSULE) {
      // Improved: Check capsule segment against box
      const feetPos = b.worldPosition.clone().add(new THREE.Vector3(0, -b.height / 2 + b.radius, 0))
      const hitFeet = a.intersectsSphere({
        worldPosition: feetPos,
        radius: b.radius
      })
      if (hitFeet) return true

      return a.intersectsSphere({
        worldPosition: b.worldPosition,
        radius: b.radius,
      })
    }

    if (a.type === ColliderType.CAPSULE && b.type === ColliderType.BOX) {
      // Improved: Check capsule segment against box
      // For now, let's check the bottom sphere (feet) which is most important for ramps
      const feetPos = a.worldPosition.clone().add(new THREE.Vector3(0, -a.height / 2 + a.radius, 0))
      const hitFeet = b.intersectsSphere({
        worldPosition: feetPos,
        radius: a.radius
      })
      if (hitFeet) return true

      // Check center just in case
      return b.intersectsSphere({
        worldPosition: a.worldPosition,
        radius: a.radius,
      })
    }

    return false
  }

  /**
   * Obtiene la respuesta de colisión entre dos colisionadores
   */
  getCollisionResponse(a, b) {
    a.updateWorldPosition()
    b.updateWorldPosition()

    if (a.type === ColliderType.SPHERE) {
      if (b.type === ColliderType.SPHERE) {
        return a.getCollisionResponse(b)
      }
      if (b.type === ColliderType.BOX) {
        const response = b.getCollisionResponseForSphere(a)
        return response
      }
    }

    if (a.type === ColliderType.CAPSULE) {
      return a.getCollisionResponse(b)
    }

    if (a.type === ColliderType.CAPSULE && b.type === ColliderType.BOX) {
      // Check if feet are colliding using simplified check
      const feetPos = a.worldPosition.clone().add(new THREE.Vector3(0, -a.height / 2 + a.radius, 0))
      const hitFeet = b.intersectsSphere({ worldPosition: feetPos, radius: a.radius })

      if (hitFeet) {
        return b.getCollisionResponseForSphere({ worldPosition: feetPos, radius: a.radius })
      }
      // Fallback to center
      return b.getCollisionResponseForSphere({ worldPosition: a.worldPosition, radius: a.radius })
    }

    if (a.type === ColliderType.BOX && b.type === ColliderType.CAPSULE) {
      const feetPos = b.worldPosition.clone().add(new THREE.Vector3(0, -b.height / 2 + b.radius, 0))
      const hitFeet = a.intersectsSphere({ worldPosition: feetPos, radius: b.radius })

      if (hitFeet) {
        const response = a.getCollisionResponseForSphere({ worldPosition: feetPos, radius: b.radius })
        // Invert normal/direction since a is Box, b is Capsule (we want push for a?)
        // Wait, getCollisionResponse assumes returns correction for A relative to B?
        // The interface usually returns: "How to move A out of B".
        // intersectsSphere returns "Box vs Sphere".
        // getCollisionResponseForSphere returns "How to move SPHERE out of BOX".
        // Here, Sphere is B. Box is A.
        // So response is "How to move B".
        // We need to return "How to move A" -> Invert.
        return {
          direction: response.direction.clone().negate(),
          overlap: response.overlap,
          normal: response.normal.clone().negate()
        }
      }

      const response = a.getCollisionResponseForSphere({ worldPosition: b.worldPosition, radius: b.radius })
      return {
        direction: response.direction.clone().negate(),
        overlap: response.overlap,
        normal: response.normal.clone().negate()
      }
    }

    // Fallback: usar dirección simple
    const direction = new THREE.Vector3().subVectors(a.worldPosition, b.worldPosition).normalize()

    return {
      direction: direction,
      overlap: 0.1,
      normal: direction.clone(),
    }
  }

  /**
   * Resuelve la colisión empujando los objetos
   */
  resolveCollision(a, b, response) {
    // No resolver si alguno es trigger o si ambos son estáticos
    if (a.isTrigger || b.isTrigger) return
    if (a.isStatic && b.isStatic) return
    if (a.manualResolution || b.manualResolution) return

    const pushVector = response.direction.clone().multiplyScalar(response.overlap)

    if (a.isStatic) {
      // Solo mover B
      if (b.parent) {
        b.parent.position.sub(pushVector)
      }
    } else if (b.isStatic) {
      // Solo mover A
      if (a.parent) {
        a.parent.position.add(pushVector)
      }
    } else {
      // Mover ambos a la mitad
      const halfPush = pushVector.multiplyScalar(0.5)
      if (a.parent) {
        a.parent.position.add(halfPush)
      }
      if (b.parent) {
        b.parent.position.sub(halfPush)
      }
    }
  }

  /**
   * Actualiza el sistema de colisiones
   */
  update() {
    const startTime = performance.now()
    this.stats.totalChecks = 0
    this.stats.collisionsDetected = 0

    const collidersArray = Array.from(this.colliders.values())
    const currentCollisions = new Map() // Map<string, {a, b}>

    // Actualizar posiciones y debug meshes
    for (const collider of collidersArray) {
      collider.updateWorldPosition()
      if (this.debugMode) {
        collider.updateDebugMesh()
      }
    }

    // Verificar todas las combinaciones de colisiones
    for (let i = 0; i < collidersArray.length; i++) {
      for (let j = i + 1; j < collidersArray.length; j++) {
        const a = collidersArray[i]
        const b = collidersArray[j]

        if (this.checkCollision(a, b)) {
          this.stats.collisionsDetected++

          const pairKey = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`
          currentCollisions.set(pairKey, { a, b })

          // Determinar si es una nueva colisión o continua
          const wasCollidingA = a.activeCollisions.has(b.id)
          const wasCollidingB = b.activeCollisions.has(a.id)

          // Resolver colisión física
          const response = this.getCollisionResponse(a, b)

          if (!wasCollidingA) {
            a.activeCollisions.add(b.id)
            b.activeCollisions.add(a.id)

            // Callback onCollisionEnter
            if (a.onCollisionEnter) a.onCollisionEnter(b, response)
            // Para B, la normal es invertida
            const responseForB = { ...response, normal: response.normal.clone().negate(), direction: response.direction.clone().negate() }
            if (b.onCollisionEnter) b.onCollisionEnter(a, responseForB)
          } else {
            // Callback onCollisionStay
            if (a.onCollisionStay) a.onCollisionStay(b, response)
            // Para B, la normal es invertida
            const responseForB = { ...response, normal: response.normal.clone().negate(), direction: response.direction.clone().negate() }
            if (b.onCollisionStay) b.onCollisionStay(a, responseForB)
          }

          this.resolveCollision(a, b, response)
        }
      }
    }

    // Detectar colisiones que terminaron
    for (const collider of collidersArray) {
      const toRemove = []

      for (const otherId of collider.activeCollisions) {
        const other = this.colliders.get(otherId)
        if (!other) {
          toRemove.push(otherId)
          continue
        }

        const pairKey = collider.id < otherId ? `${collider.id}:${otherId}` : `${otherId}:${collider.id}`

        if (!currentCollisions.has(pairKey)) {
          toRemove.push(otherId)

          // Callback onCollisionExit
          if (collider.onCollisionExit) collider.onCollisionExit(other)
        }
      }

      for (const id of toRemove) {
        collider.activeCollisions.delete(id)
      }
    }

    this.stats.lastUpdateTime = performance.now() - startTime
  }

  /**
   * Raycast contra todos los colisionadores
   */
  raycast(origin, direction, maxDistance = Number.POSITIVE_INFINITY, layerMask = CollisionLayer.ALL) {
    const results = []
    const ray = new THREE.Ray(origin, direction.normalize())

    for (const collider of this.colliders.values()) {
      if (!collider.enabled) continue
      if ((collider.layer & layerMask) === 0) continue

      collider.updateWorldPosition()

      let intersection = null

      if (collider.type === ColliderType.SPHERE) {
        const sphere = new THREE.Sphere(collider.worldPosition, collider.radius)
        const target = new THREE.Vector3()
        intersection = ray.intersectSphere(sphere, target)
      } else if (collider.type === ColliderType.BOX) {
        collider.updateBounds()
        const box = new THREE.Box3(collider.min, collider.max)
        const target = new THREE.Vector3()
        intersection = ray.intersectBox(box, target)
      }

      if (intersection) {
        const distance = origin.distanceTo(intersection)
        if (distance <= maxDistance) {
          let normal = new THREE.Vector3(0, 1, 0)

          if (collider.type === ColliderType.SPHERE) {
            normal.subVectors(intersection, collider.worldPosition).normalize()
          } else if (collider.type === ColliderType.BOX) {
            // Calculate normal for box (approximated for AABB/OBB needs)
            // For a rotated box, we need to bring the point to local space, find the face, apply rotation.

            // 1. World to Local
            const invRotation = collider.rotation.clone() // Euler
            const quit = new THREE.Quaternion().setFromEuler(invRotation).invert()

            // Local point relative to center
            const localPoint = intersection.clone().sub(collider.worldPosition).applyQuaternion(quit)

            // 2. Find closest face
            const halfSize = collider.size.clone().multiplyScalar(0.5)
            const bias = 0.001

            if (Math.abs(localPoint.x - halfSize.x) < bias) normal.set(1, 0, 0)
            else if (Math.abs(localPoint.x + halfSize.x) < bias) normal.set(-1, 0, 0)
            else if (Math.abs(localPoint.y - halfSize.y) < bias) normal.set(0, 1, 0)
            else if (Math.abs(localPoint.y + halfSize.y) < bias) normal.set(0, -1, 0)
            else if (Math.abs(localPoint.z - halfSize.z) < bias) normal.set(0, 0, 1)
            else if (Math.abs(localPoint.z + halfSize.z) < bias) normal.set(0, 0, -1)
            else {
              // Fallback: use direction from center?
              // Or just Up if inside?
              normal.set(0, 1, 0)
            }

            // 3. Local Normal to World
            normal.applyEuler(collider.rotation).normalize()
          }

          results.push({
            collider: collider,
            point: intersection,
            distance: distance,
            normal: normal
          })
        }
      }
    }

    // Ordenar por distancia
    results.sort((a, b) => a.distance - b.distance)

    return results
  }

  /**
   * Obtiene todos los colisionadores en un radio
   */
  overlapSphere(center, radius, layerMask = CollisionLayer.ALL) {
    const results = []

    for (const collider of this.colliders.values()) {
      if (!collider.enabled) continue
      if ((collider.layer & layerMask) === 0) continue

      collider.updateWorldPosition()

      const distance = center.distanceTo(collider.worldPosition)
      const effectiveRadius = radius + (collider.radius || 0)

      if (distance <= effectiveRadius) {
        results.push(collider)
      }
    }

    return results
  }

  /**
   * Limpia todos los colisionadores
   */
  dispose() {
    for (const collider of this.colliders.values()) {
      if (collider.debugMesh) {
        this.scene.remove(collider.debugMesh)
      }
      collider.dispose()
    }
    this.colliders.clear()
  }
}
