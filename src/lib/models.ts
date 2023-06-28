import {
    Immutable,
    Immutable$,
    Modules,
    Projects,
    UidTrait,
} from '@youwol/vsf-core'
import { Object3D } from 'three'
import { Selector } from './objects3d'

export type Module = {
    uid: string
    model: Projects.ModuleModel
    instance?: Modules.ImplementationTrait
}

export type SelectableObject3D = Object3D & {
    userData: { selector: Selector<UidTrait> }
}

export class InterLayersConnection {
    connection: {
        start: string
        end: string
    }
    constructor(params: {
        connection: {
            start: string
            end: string
        }
    }) {
        Object.assign(this, params)
    }
}

export class IntraLayerConnection {
    uid: string
    model: Immutable<Projects.ConnectionModel>
    instance?: Immutable<Modules.ConnectionTrait>
    constructor(params: {
        model: Immutable<Projects.ConnectionModel>
        instance?: Immutable<Modules.ConnectionTrait>
    }) {
        Object.assign(this, params)
        this.uid = this.model.uid
    }
}

export class InterLayerConnection {
    uid: string
    startLayerId: string
    endLayerId: string
    model: Immutable<Projects.ConnectionModel>
    instance?: Immutable<Modules.ConnectionTrait>
    constructor(params: {
        startLayerId: string
        endLayerId: string
        model: Immutable<Projects.ConnectionModel>
        instance?: Immutable<Modules.ConnectionTrait>
    }) {
        Object.assign(this, params)
        this.uid = this.model.uid
    }
}
export type Macro = {
    uid: string
    model: Immutable<Projects.MacroModel>
    instance?: Immutable<Modules.ImplementationTrait>
}

export type Layer = {
    uid: string
    model: Immutable<Projects.Layer>
    workflow: Immutable<Projects.WorkflowModel>
    instance?: Immutable<Modules.ImplementationTrait>
}

export type NestedModule = Module & {
    instancePool$?: Immutable$<Projects.InstancePool>
}
