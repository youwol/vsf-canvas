import { Immutable } from '@youwol/vsf-core'
import { NestedModule } from '../models'
import { Dynamic3dContent } from '../dynamic-content'
import { ExpandAction } from './actions-row.object3d'
import { ModuleBaseObject3d } from './module-base.object3d'

export function nestedObject3d({
    entity,
    parentLayer,
}: {
    entity: Immutable<NestedModule>
    parentLayer: Immutable<Dynamic3dContent>
}) {
    const expandAction = new ExpandAction({
        onExpand: () => parentLayer.expandNestedModule(object),
        instancePool$: entity.instance.instancePool$,
    })
    const object = new ModuleBaseObject3d<NestedModule>({
        parentLayer: parentLayer,
        entity: entity,
        inputSlots: entity.instance.inputSlots,
        outputSlots: entity.instance.outputSlots,
        instancePool$: entity.instance.instancePool$,
        title: entity.uid,
        subTitle: entity.model.typeId,
        toolbox: parentLayer.project.getToolbox(entity.instance.toolboxId),
        customActions: parentLayer.isRunning ? [expandAction] : [],
    })
    return object
}
