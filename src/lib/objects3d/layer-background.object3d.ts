import { Group, Mesh } from 'three'
import * as THREE from 'three'
import { SelectableTrait, Selector } from './traits'
import { Immutable } from '@youwol/vsf-core'
import { Environment3D } from '../environment3d'
import { Dynamic3dContent } from '../dynamic-content'
import { whiten } from './utils'

export class LayerBackgroundObject3d
    extends Mesh
    implements SelectableTrait<Dynamic3dContent>
{
    public readonly name = 'layer-background'
    public readonly environment3d: Immutable<Environment3D>
    public readonly group: Group
    public readonly color: number
    public readonly entity: Immutable<Dynamic3dContent>
    public readonly selector: Selector<Dynamic3dContent>

    constructor(params: {
        environment3d: Immutable<Environment3D>
        entity: Dynamic3dContent
        group: Group
        color: number
    }) {
        super()
        Object.assign(this, params)
        const aabb = new THREE.Box3()
        aabb.setFromObject(this.group)
        const minLocal = this.group.worldToLocal(aabb.min)
        const maxLocal = this.group.worldToLocal(aabb.max)
        const geometry = new THREE.PlaneGeometry(
            5,
            maxLocal.y - minLocal.y + 0.1 * (maxLocal.y - minLocal.y),
        )
        const material = new THREE.MeshBasicMaterial({
            color: whiten(this.color, 0.5),
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide,
        })
        const plane = new THREE.Mesh(geometry, material)
        plane.translateX(minLocal.x - 5)
        plane.translateY(0.5 * (minLocal.y + maxLocal.y))
        plane.translateZ(minLocal.z)
        this.add(plane)

        this.selector = new Selector<Dynamic3dContent>({
            entity: this.entity,
            environment3d: this.environment3d,
            selectables: [plane],
            onHovered: () => (material.color = whiten(this.color, 0.6)),
            onSelected: () => (material.color = whiten(this.color, 0.7)),
            onRestored: () => (material.color = whiten(this.color, 0.5)),
        })
    }
}
