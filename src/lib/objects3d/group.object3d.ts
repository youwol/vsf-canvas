import { Immutable, Deployers } from '@youwol/vsf-core'
import { Layer } from '../models'
import {
    Dynamic3dContent,
    LayerOrganizer,
    PositionsStore,
} from '../dynamic-content'
import { BehaviorSubject } from 'rxjs'
import { ModuleBaseObject3d } from './module-base.object3d'
import { ExpandAction } from './actions-row.object3d'

export function groupObject3d({
    entity,
    parentLayer,
    entitiesPositions,
    layerOrganizer,
}: {
    entity: Immutable<Layer>
    parentLayer: Immutable<Dynamic3dContent>
    entitiesPositions: PositionsStore
    layerOrganizer: Immutable<LayerOrganizer>
}) {
    const { downStreamConnections, upStreamConnections } =
        layerOrganizer.equivalentGroupConnections(entity.uid)
    const inputSlots = upStreamConnections
        .map((c) => {
            return c.model.end
        })
        .reduce((acc, e) => ({ ...acc, [e.slotId]: e }), {})
    const outputSlots = downStreamConnections
        .map((c) => {
            return c.model.start
        })
        .reduce((acc, e) => ({ ...acc, [e.slotId]: e }), {})

    const toolbox = {
        uid: '',
        name: 'Groups',
        origin: {
            packageName: 'fake',
            version: 'fake',
        },
        icon: {
            svgString: `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                    <!-- Font Awesome Pro 5.15.4 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) -->
                    <path d="M480 128V96h20c6.627 0 12-5.373 12-12V44c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v20H64V44c0-6.627-5.373-12-12-12H12C5.373 32 0 37.373 0 44v40c0 6.627 5.373 12 12 12h20v320H12c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12v-20h384v20c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12v-40c0-6.627-5.373-12-12-12h-20V128zM96 276V140c0-6.627 5.373-12 12-12h168c6.627 0 12 5.373 12 12v136c0 6.627-5.373 12-12 12H108c-6.627 0-12-5.373-12-12zm320 96c0 6.627-5.373 12-12 12H236c-6.627 0-12-5.373-12-12v-52h72c13.255 0 24-10.745 24-24v-72h84c6.627 0 12 5.373 12 12v136z"/></svg>
`,
        },
        modules: [],
    }
    const pool = new Deployers.InstancePool({
        modules: parentLayer.project.instancePool.modules.filter((m) =>
            entity.model.moduleIds.includes(m.uid),
        ),
        parentUid: entity.uid,
    })
    const instancePool$ = new BehaviorSubject(pool)
    const expandAction = new ExpandAction({
        onExpand: () => parentLayer.expandGroup(object),
        instancePool$,
    })
    const object = new ModuleBaseObject3d<Layer>({
        parentLayer: parentLayer,
        entity: entity,
        entitiesPositions,
        inputSlots: inputSlots,
        outputSlots: outputSlots,
        instancePool$,
        title: entity.uid,
        subTitle: 'group',
        toolbox,
        customActions: [expandAction],
    })
    return object
}
