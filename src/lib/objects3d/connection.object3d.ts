import {
    Group,
    Vector3,
    LineBasicMaterial,
    BufferGeometry,
    Line,
    IcosahedronGeometry,
    MeshStandardMaterial,
    ArrowHelper,
    Mesh,
    LineDashedMaterial,
    CubicBezierCurve3,
    Material,
} from 'three'
import { Immutable } from '@youwol/vsf-core'
import { SelectableTrait, Selector } from './traits'
import { render } from '@youwol/flux-view'
import { CSS3DObject } from '../renderers'
import { IntraLayerConnection } from '../models'
import { Dynamic3dContent, ModulesStore } from '../dynamic-content'
import { getConnectedSlot, transformPosition } from './utils'
import { takeUntil } from 'rxjs/operators'
import { Environment3D } from '../environment3d'

export class ConnectionObject3d
    extends Group
    implements SelectableTrait<IntraLayerConnection>
{
    public readonly parentLayer: Immutable<Dynamic3dContent>
    public readonly connection: Immutable<IntraLayerConnection>
    public readonly line: Line
    public readonly selector: Selector<IntraLayerConnection>

    constructor(params: {
        parentLayer: Immutable<Dynamic3dContent>
        connection: Immutable<IntraLayerConnection>
        modulesStore: ModulesStore
    }) {
        super()
        Object.assign(this, params)
        this.name = this.connection.uid
        const startMesh = getConnectedSlot(
            params.modulesStore,
            this.connection.model,
            'end',
        )
        const start = transformPosition(
            startMesh,
            this.parentLayer.encapsulatingGroup,
        )
        const endMesh = getConnectedSlot(
            params.modulesStore,
            this.connection.model,
            'start',
        )
        const end = transformPosition(
            endMesh,
            this.parentLayer.encapsulatingGroup,
        )
        if (!start || !end) {
            console.error('Can not connect', params)
            return
        }
        const objects = connection(
            start,
            end,
            this.connection,
            this.parentLayer.project.canvasViews,
            this.parentLayer.environment3d,
        )
        this.add(...objects)
        // this.selector = new Selector<IntraLayerConnection>({
        //     environment3d: this.parentLayer.environment3d,
        //     entity: this.connection,
        //     selectables: [this.line],
        //     onHovered: () => (this.lineMaterial.linewidth = 4),
        //     onSelected: () => (this.lineMaterial.linewidth = 6),
        //     onRestored: () => (this.lineMaterial.linewidth = 2),
        // })
    }
}

export class AdaptorObject3D extends Mesh {
    public readonly connection: Immutable<IntraLayerConnection>
    public readonly start: Vector3
    public readonly end: Vector3

    constructor(params: {
        connection: Immutable<IntraLayerConnection>
        start: Vector3
        end: Vector3
    }) {
        super()
        Object.assign(this, params)
        const dir = new Vector3().subVectors(this.end, this.start).normalize()

        this.geometry = new IcosahedronGeometry(1)
        this.material = new MeshStandardMaterial({
            color: 0xffff00,
            emissive: 0xffcc00,
            roughness: 0.3,
            metalness: 0.3,
        })
        const pos = this.end.clone().add(dir.clone().multiplyScalar(-4))
        this.position.set(pos.x, pos.y, pos.z)
        this.castShadow = true
    }
}

export function connection(
    start: Vector3,
    end: Vector3,
    connection: Immutable<IntraLayerConnection>,
    canvasView,
    environment: Immutable<Environment3D>,
) {
    const linewidth = 2
    const dash = {
        dashSize: 1,
        gapSize: 1,
    }
    const materials = {
        completed: new LineBasicMaterial({
            color: 0xcccccc,
            linewidth,
        }),
        started: new LineBasicMaterial({ color: 0x00ff00, linewidth }),
        connected: new LineDashedMaterial({
            color: 0x00ff00,
            linewidth,
            ...dash,
        }),
        unconnected: new LineDashedMaterial({
            color: 0xcccccc,
            linewidth,
            ...dash,
        }),
        disconnected: new LineBasicMaterial({
            color: 0xcccccc,
            linewidth,
        }),
    }

    const l = start.distanceTo(end)
    const dir = new Vector3().subVectors(end, start).normalize()

    const p1 = start.clone()
    p1.x += 10
    const p2 = end.clone()
    p2.x -= 10
    const curve = new CubicBezierCurve3(start, p1, p2, end)
    const segments = 20
    const points = curve.getPoints(segments)
    const geometry = new BufferGeometry().setFromPoints(points)

    const line = new Line(
        geometry,
        (connection.instance
            ? materials.connected
            : materials.unconnected) as Material,
    )
    line.computeLineDistances()
    const arrowHelper = new ArrowHelper(
        dir,
        start.clone().add(dir.clone().multiplyScalar(l / 2)),
        1,
        0xffff00,
        2,
        1,
    )
    let canvas
    if (canvasView.length > 0) {
        const vDOM = {
            children: canvasView,
        }
        const dir = new Vector3().subVectors(end, start).normalize()
        const pos = start.clone().add(dir.clone().multiplyScalar(l * 0.5))
        const htmlElement = render(vDOM) as unknown as HTMLDivElement
        htmlElement.style.fontSize = '3px'
        const obj = new CSS3DObject(htmlElement)
        obj.position.set(pos.x, pos.y + 2, pos.z)
        canvas = obj
        obj.layers.set(0)
    }
    let adaptor
    if (connection.model.configuration.adaptor) {
        adaptor = new AdaptorObject3D({
            start,
            end,
            connection: connection,
        })
    }
    connection.instance &&
        connection.instance.status$
            .pipe(takeUntil(environment.projectSwitch$))
            .subscribe((status) => {
                const { transparent, opacity } = line.material
                line.material = materials[status]
                line.material.transparent = transparent
                line.material.opacity = opacity
            })
    return [line, adaptor, arrowHelper, canvas].filter(
        (obj) => obj != undefined,
    )
}
