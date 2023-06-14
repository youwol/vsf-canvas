import { DirectionalLight, Mesh, MeshStandardMaterial, Object3D } from 'three'

import { Immutable, Modules, UidTrait } from '@youwol/vsf-core'
import { Environment3D } from '../environment3d'
import { throttleTime } from 'rxjs/operators'
import { Subscription } from 'rxjs'
import { Layer, Macro, NestedModule } from '../models'
import { Dynamic3dContent } from '../dynamic-content'

export interface SelectableTrait<TEntity extends UidTrait> {
    selector: Selector<TEntity>
}

export class Selector<TEntity> {
    public readonly entity: Immutable<TEntity>
    public readonly selectables: Object3D[]
    public readonly _onHovered: () => void
    public readonly _onSelected: () => void
    public readonly _onRestored: () => void
    private selected = false
    public readonly subscription: Subscription
    constructor(params: {
        environment3d: Immutable<Environment3D>
        entity: Immutable<TEntity>
        selectables: Object3D[]
        onHovered: () => void
        onSelected: () => void
        onRestored: () => void
    }) {
        this.entity = params.entity
        this.selectables = params.selectables
        this._onHovered = params.onHovered
        this._onSelected = params.onSelected
        this._onRestored = params.onRestored
        this.subscription = params.environment3d.selected$
            .pipe(throttleTime(10))
            .subscribe((selected) => {
                if (selected != this.entity) {
                    this.selected = false
                    this.onRestored()
                    return
                }
                this.onSelected()
            })
        params.environment3d.ownSubscriptions(this.subscription)
        this.selectables.forEach((obj) => (obj.userData.selector = this))
        this.selectables.forEach((obj) => {
            obj.addEventListener('removed', () => {
                this.subscription.unsubscribe()
            })
        })
    }

    getEntity(): Immutable<TEntity> {
        return this.entity
    }

    getSelectables() {
        return this.selectables
    }

    onHovered() {
        document.body.style.cursor = 'pointer'
        this._onHovered()
    }
    onRestored() {
        if (this.selected) {
            return
        }
        document.body.style.cursor = 'default'
        this._onRestored()
    }
    onSelected() {
        this.selected = true
        document.body.style.cursor = 'default'
        this._onSelected()
    }
}

export function defaultSelector<T>(
    object: {
        environment3d: Immutable<Environment3D>
        entity: Immutable<T>
        mesh: Mesh
        material: MeshStandardMaterial
    },
    params: { onSelected?: () => void } = {},
) {
    return new Selector<T>({
        environment3d: object.environment3d,
        entity: object.entity,
        selectables: [object.mesh],
        onHovered: () => (object.material.emissiveIntensity = 0.4),
        onSelected: () => {
            object.material.emissiveIntensity = 0.6
            params.onSelected && params.onSelected()
        },
        onRestored: () => (object.material.emissiveIntensity = 0.2),
    })
}
export interface SpotTrait {
    mesh: Mesh
    spot: DirectionalLight
    environment3d: Immutable<Environment3D>
}

export function plugSpot(obj: SpotTrait & Object3D) {
    obj.environment3d.ownSubscriptions(
        obj.environment3d.configuration$.subscribe((conf) => {
            obj.remove(obj.spot)
            obj.mesh.castShadow = conf.lights
            if (conf.lights) {
                obj.add(obj.spot)
            }
        }),
    )
}

export interface GrouperTraitObject3D<Entity = Macro | Layer | NestedModule> {
    grouperType: 'macro' | 'group' | 'nested'
    entity: Immutable<Entity>
    parentLayer: Immutable<Dynamic3dContent>
    material: MeshStandardMaterial
}

export function implementsGrouperTraitObject3D(
    obj: unknown,
): obj is GrouperTraitObject3D {
    const casted = obj as GrouperTraitObject3D
    return (
        casted.grouperType &&
        ['macro', 'group', 'nested'].includes(casted.grouperType)
    )
}

export interface SlotsTrait {
    inputSlots: { [k: string]: Modules.SlotTrait }
    outputSlots: { [k: string]: Modules.SlotTrait }
    getInputSlot(slotId: string): Mesh
    getOutputSlot(slotId: string): Mesh
}
