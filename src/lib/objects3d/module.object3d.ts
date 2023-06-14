import { Immutable } from '@youwol/vsf-core'

import { Module } from '../models'
import { Dynamic3dContent } from '../dynamic-content'

import { ModuleBaseObject3d } from './module-base.object3d'

export function moduleObject3d({
    entity,
    parentLayer,
}: {
    entity: Immutable<Module>
    parentLayer: Immutable<Dynamic3dContent>
}) {
    return new ModuleBaseObject3d<Module>({
        parentLayer: parentLayer,
        entity: entity,
        inputSlots: entity.instance.inputSlots,
        outputSlots: entity.instance.outputSlots,
        instancePool$: entity.instance.instancePool$,
        title: entity.uid,
        subTitle: entity.model.typeId,
        toolbox: parentLayer.project.getToolbox(entity.instance.toolboxId),
        customActions: [],
    })
}
