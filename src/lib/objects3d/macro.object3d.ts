import { Immutable, Projects } from '@youwol/vsf-core'
import { Macro } from '../models'
import { Dynamic3dContent } from '../dynamic-content'
import { ModuleBaseObject3d } from './module-base.object3d'
import { ExpandAction, InspectWorkerAction } from './actions-row.object3d'

export function macroObject3d({
    entity,
    parentLayer,
}: {
    entity: Immutable<Macro>
    parentLayer: Immutable<Dynamic3dContent>
}) {
    const instancePool$ = entity.instance.instancePool$
    const expandAction = new ExpandAction({
        onExpand: () => parentLayer.expandMacro(object),
        instancePool$,
    })
    const workerAction = Projects.Workers.implementWorkerEnvironmentTrait(
        instancePool$.value,
    )
        ? new InspectWorkerAction({
              state: parentLayer.environment3d.state,
              workerId: instancePool$.value.workerId,
              workersPool: instancePool$.value.workersPool,
          })
        : undefined

    const object = new ModuleBaseObject3d<Macro>({
        parentLayer: parentLayer,
        entity: entity,
        inputSlots: entity.instance.inputSlots,
        outputSlots: entity.instance.outputSlots,
        instancePool$: entity.instance.instancePool$,
        title: entity.uid,
        subTitle: entity.model.typeId,
        toolbox: parentLayer.project.getToolbox(entity.instance.toolboxId),
        customActions: [expandAction, workerAction].filter(
            (action) => action != undefined,
        ),
    })
    return object
}
