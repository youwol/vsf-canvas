import {
    GridHelper,
    Group,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    ShadowMaterial,
    Vector3,
} from 'three'
import { SelectableObject3D } from '../models'
import * as THREE from 'three'
import { Environment3D } from '../environment3d'

export class GroundObject3d extends Mesh {
    public readonly name = 'ground'
    public readonly selectables: Mesh[]
    public readonly rootGroup: Group
    public readonly environment3d: Environment3D

    constructor(params: {
        rootGroup: Group
        selectables: SelectableObject3D[]
        environment3d: Environment3D
    }) {
        super()
        Object.assign(this, params)
        if (this.selectables.length == 0) {
            this.add(new GridHelper(10, 10))
            return
        }

        const bbox = new THREE.Box3()
        bbox.setFromObject(this.rootGroup)
        const size = new Vector3()
        bbox.getSize(size)
        const maxSize = 1.25 * Math.max(size.x, size.y, size.z)

        const center = new Vector3()
        bbox.getCenter(center)

        const planeGeometry = new PlaneGeometry(maxSize, maxSize)
        planeGeometry.rotateX(-Math.PI / 2)
        const planeMaterial = new MeshBasicMaterial({
            color: 0xb9b9b9,
        })
        const plane = new Mesh(planeGeometry, planeMaterial)
        plane.position.set(center.x, bbox.min.y - 0.2 * size.y, center.z)
        const planeShadowMaterial = new ShadowMaterial({
            color: 0xa0a0a0,
        })
        const planeShadow = new Mesh(planeGeometry, planeShadowMaterial)
        planeShadow.position.set(center.x, bbox.min.y - 0.2 * size.y, center.z)
        planeShadow.receiveShadow = true

        this.add(plane)
        this.environment3d.ownSubscriptions(
            this.environment3d.configuration$.subscribe((conf) => {
                this.remove(planeShadow)
                if (conf.lights) {
                    this.add(planeShadow)
                }
            }),
        )
    }
}
