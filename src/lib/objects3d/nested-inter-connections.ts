import { Connections, Deployers, Immutable, Modules } from '@youwol/vsf-core'
import { Dynamic3dContent } from '../dynamic-content'
import { ConnectionAcrossLayersObject3d } from './connection-across-layers.object3d'
import { InterLayerConnection } from '../models'
import { BehaviorSubject, Observable } from 'rxjs'
import { take } from 'rxjs/operators'

export function nestedInterConnections(
    parent: Immutable<Dynamic3dContent>,
    child: Immutable<Dynamic3dContent>,
    nestedModule: Immutable<Modules.ImplementationTrait>,
) {
    const instancePool = nestedModule.instancePool$.value
    if (!instancePool.connectionsHint) {
        // We can no draw connections if no connections hints
        console.warn('No connections hints available')
        return []
    }
    return instancePool.connectionsHint.map((hint) => {
        const m = instancePool.inspector().getModule(hint.child.moduleId)
        return hint.type === 'input'
            ? createConnectionP2C(instancePool, m, hint, parent, child)
            : createConnectionC2P(instancePool, m, hint, parent, child)
    })
}

const baseInstance = {
    // next attributes should not be used
    journal: undefined,
    configuration: { schema: {} },
    configurationInstance: {},
    start$: undefined,
    end$: undefined,
    connect: undefined,
    disconnect: undefined,
}
function slotStatus(
    module: Immutable<Modules.ImplementationTrait>,
    index: number | string,
    type: 'inputSlots' | 'outputSlots',
): BehaviorSubject<Connections.ConnectionStatus> {
    const status$ = new BehaviorSubject<Connections.ConnectionStatus>(
        'connected',
    )
    const obs$: Observable<unknown> =
        type == 'inputSlots'
            ? Modules.getInputSlot(module, index).rawMessage$
            : Modules.getOutputSlot(module, index).observable$

    obs$.pipe(take(1)).subscribe(() => status$.next('started'))
    const noOp = () => {
        /*no  op*/
    }
    obs$.subscribe(noOp, noOp, () => status$.next('completed'))
    return status$
}

function createConnectionP2C(
    instancePool: Immutable<Deployers.InstancePool>,
    m: Immutable<Modules.ImplementationTrait>,
    hints: Immutable<Deployers.ConnectionsHint>,
    parentLayer: Immutable<Dynamic3dContent>,
    childLayer: Immutable<Dynamic3dContent>,
) {
    const uid = `${instancePool.parentUid}>>${m.uid}`
    const start = {
        slotId: hints.parent,
        moduleId: instancePool.parentUid,
    }
    const finder = parentLayer.layerOrganizer
    const relative = finder.findRelative(start, 'end')
    const end = Object.values(m.inputSlots)[hints.child.slotId]
    return new ConnectionAcrossLayersObject3d({
        parentLayer,
        childLayer,
        connection: new InterLayerConnection({
            startLayerId: parentLayer.layerId,
            endLayerId: childLayer.layerId,
            model: {
                uid,
                start: relative.slot,
                end,
                configuration: {},
            },
            instance: {
                uid,
                status$: slotStatus(m, hints.child.slotId, 'inputSlots'),
                start: relative.slot,
                end,
                ...baseInstance,
            },
        }),
    })
}

function createConnectionC2P(
    instancePool: Immutable<Deployers.InstancePool>,
    m: Immutable<Modules.ImplementationTrait>,
    hints: Immutable<Deployers.ConnectionsHint>,
    parentLayer: Immutable<Dynamic3dContent>,
    childLayer: Immutable<Dynamic3dContent>,
) {
    const uid = `${m.uid}>>${instancePool.parentUid}`
    const start = Object.values(m.outputSlots)[hints.child.slotId]
    const end = {
        slotId: hints.parent,
        moduleId: instancePool.parentUid,
    }
    const relative = parentLayer.layerOrganizer.findRelative(end, 'start')

    return new ConnectionAcrossLayersObject3d({
        parentLayer,
        childLayer,
        connection: new InterLayerConnection({
            startLayerId: childLayer.layerId,
            endLayerId: parentLayer.layerId,
            model: {
                uid,
                start,
                end: relative.slot,
                configuration: {},
            },
            instance: {
                uid,
                status$: slotStatus(m, hints.child.slotId, 'outputSlots'),
                start,
                end: relative.slot,
                ...baseInstance,
            },
        }),
    })
}
