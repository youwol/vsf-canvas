import { Group, Line } from 'three'
import { Immutable } from '@youwol/vsf-core'
import { SelectableTrait, Selector } from './traits'
import { InterLayerConnection } from '../models'
import { Dynamic3dContent } from '../dynamic-content'
import { transformPosition } from './utils'
import { connection } from './connection.object3d'

export class ConnectionAcrossLayersObject3d
    extends Group
    implements SelectableTrait<InterLayerConnection>
{
    public readonly parentLayer: Immutable<Dynamic3dContent>
    public readonly childLayer: Immutable<Dynamic3dContent>
    public readonly connection: Immutable<InterLayerConnection>
    public readonly line: Line

    public readonly selector: Selector<InterLayerConnection>

    /**
     *
     * @param params.parentLayer layer containing the macro module
     * @param params.childLayer layer of the macro's instance pool
     * @param params.connection the 'equivalent' macro connection to display (in the parentLayer)
     */
    constructor(params: {
        parentLayer: Immutable<Dynamic3dContent>
        childLayer: Immutable<Dynamic3dContent>
        connection: Immutable<InterLayerConnection>
        options?: { findStartUpstream: boolean; findEndDownstream: boolean }
    }) {
        super()
        Object.assign(this, params)

        this.name = this.connection.uid
        const startMesh =
            this.connection.startLayerId == this.parentLayer.layerId
                ? this.parentLayer.getConnectedSlot(
                      this.connection.model,
                      'end',
                  )
                : this.childLayer.getConnectedSlot(this.connection.model, 'end')
        const endMesh =
            this.connection.startLayerId == this.parentLayer.layerId
                ? this.childLayer.getConnectedSlot(
                      this.connection.model,
                      'start',
                  )
                : this.parentLayer.getConnectedSlot(
                      this.connection.model,
                      'start',
                  )

        if (!startMesh || !endMesh) {
            console.error('Can not connect', params)
            return
        }
        const start = transformPosition(
            startMesh,
            this.parentLayer.environment3d.rootGroup,
        )
        const end = transformPosition(
            endMesh,
            this.parentLayer.environment3d.rootGroup,
        )
        const objects = connection(
            start,
            end,
            this.connection,
            this.parentLayer.project.canvasViews,
            this.parentLayer.environment3d,
        )
        this.add(...objects)
    }
}
