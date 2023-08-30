import { Immutable } from '@youwol/vsf-core'

import { Module } from '../models'
import { Dynamic3dContent, PositionsStore } from '../dynamic-content'

import { ModuleBaseObject3d } from './module-base.object3d'

export function moduleObject3d({
    entity,
    parentLayer,
    entitiesPositions,
}: {
    entity: Immutable<Module>
    parentLayer: Immutable<Dynamic3dContent>
    entitiesPositions: PositionsStore
}) {
    return new ModuleBaseObject3d<Module>({
        parentLayer: parentLayer,
        entity: entity,
        entitiesPositions,
        inputSlots: entity.instance.inputSlots,
        outputSlots: entity.instance.outputSlots,
        instancePool$: entity.instance.instancePool$,
        title: entity.uid,
        subTitle: entity.model.typeId,
        toolbox: parentLayer.project.getToolbox(entity.instance.toolboxId),
        customActions: [],
    })
}
