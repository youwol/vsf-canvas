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
        return []
    }
    return instancePool.modules
        .filter((m) => instancePool.connectionsHint[m.uid] != undefined)
        .map((m: Modules.ImplementationTrait) => {
            return [
                createConnectionP2C(instancePool, m, parent, child),
                createConnectionC2P(instancePool, m, parent, child),
            ]
        })
        .flat()
        .filter((c) => c != undefined)
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
    parentLayer: Immutable<Dynamic3dContent>,
    childLayer: Immutable<Dynamic3dContent>,
) {
    const hints = instancePool.connectionsHint[m.uid]
    if (hints.inputSlot == undefined) {
        return undefined
    }
    const uid = `${instancePool.parentUid}>>${m.uid}`
    const start = {
        slotId: hints.parent.from,
        moduleId: instancePool.parentUid,
    }
    const finder = parentLayer.layerOrganizer
    const relative = finder.findRelative(start, 'end')
    const end = Object.values(m.inputSlots)[hints.inputSlot]
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
                status$: slotStatus(m, hints.inputSlot, 'inputSlots'),
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
    parentLayer: Immutable<Dynamic3dContent>,
    childLayer: Immutable<Dynamic3dContent>,
) {
    const hints = instancePool.connectionsHint[m.uid]
    const uid = `${m.uid}>>${instancePool.parentUid}`
    const start = Object.values(m.outputSlots)[hints.outputSlot]
    const end = {
        slotId: hints.parent.to,
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
                status$: slotStatus(m, hints.outputSlot, 'outputSlots'),
                start,
                end: relative.slot,
                ...baseInstance,
            },
        }),
    })
}
