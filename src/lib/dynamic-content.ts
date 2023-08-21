import {
    ConnectionObject3d,
    moduleObject3d,
    groupObject3d,
    macroObject3d,
    nestedObject3d,
} from './objects3d'
import { Color, Group, Mesh, Object3D, Vector3 } from 'three'
import { computeCoordinates } from './dag'
import {
    NestedModule,
    IntraLayerConnection,
    Layer,
    Macro,
    Module,
    SelectableObject3D,
} from './models'
import { Environment3D } from './environment3d'
import {
    Immutable,
    Immutables,
    Projects,
    Deployers,
    Workflows,
    Connections,
    Modules,
} from '@youwol/vsf-core'
import {
    collapseGroupAnimation,
    expandGroupAnimation,
    groupInterConnections,
    macroInterConnections,
    nestedModuleInterConnections,
    setOpacity,
} from './objects3d/utils'
import { LayerBackgroundObject3d } from './objects3d/layer-background.object3d'
import { ConnectionAcrossLayersObject3d } from './objects3d/connection-across-layers.object3d'
import { BehaviorSubject } from 'rxjs'
import { ModuleBaseObject3d } from './objects3d/module-base.object3d'

const colors = [0x3399ff, 0x9933ff, 0xff9933, 0xff3399, 0x33ff99, 0x99ff33]
type ExpandParams<TParams> = {
    from:
        | ModuleBaseObject3d<NestedModule>
        | ModuleBaseObject3d<Macro>
        | ModuleBaseObject3d<Layer>
    instancePool: Immutable<Deployers.InstancePool>
    workflow: Immutable<Workflows.WorkflowModel>
    layerId?: string
    connectionsGenerator: (
        parent,
        child,
        arg: TParams,
    ) => ConnectionAcrossLayersObject3d[]
    args: TParams
}

export class Dynamic3dContent {
    public readonly uid: string
    public readonly isRunning: boolean
    public readonly parent?: Dynamic3dContent
    public readonly environment3d: Environment3D
    public readonly project: Immutable<Projects.ProjectState>
    public readonly layerOrganizer: Immutable<LayerOrganizer>
    public readonly instancePool: Immutable<Deployers.InstancePool>
    public readonly layerId: string
    public readonly workflow: Immutable<Workflows.WorkflowModel>
    public readonly modules: Immutables<ModuleBaseObject3d<Module>>
    public readonly groups: Immutables<ModuleBaseObject3d<Layer>>
    public readonly macros: Immutables<ModuleBaseObject3d<Macro>>
    public readonly nestedModules: Immutables<ModuleBaseObject3d<NestedModule>>
    public readonly intraConnection: ConnectionObject3d[]
    public readonly layerBackground: LayerBackgroundObject3d
    public readonly encapsulatingGroup: Group
    public readonly entitiesPosition: Immutable<{ [k: string]: Vector3 }>
    public readonly modulesStore: { [k: string]: Mesh } = {}
    public readonly depthIndex: number = 0
    public readonly baseColor: number
    public readonly onCollapsed?: () => void
    public readonly isFrontLayer$ = new BehaviorSubject(true)

    constructor(params: {
        isRunning: boolean
        project: Immutable<Projects.ProjectState>
        instancePool: Immutable<Deployers.InstancePool>
        layerId: string
        workflow: Immutable<Workflows.WorkflowModel>
        environment3d: Environment3D
        parent?: Dynamic3dContent
        depthIndex: number
        onCollapsed?: () => void
    }) {
        Object.assign(this, params)
        this.uid = this.layerId
        this.encapsulatingGroup = new Group()
        this.baseColor = colors[this.depthIndex]
        this.layerOrganizer = new LayerOrganizer({
            instancePool: this.instancePool,
            project: this.project,
            layerId: this.layerId,
            workflow: this.workflow,
            parent: this.parent && this.parent.layerOrganizer,
        })
        const dagData = this.layerOrganizer.dagData()
        this.entitiesPosition = computeCoordinates(
            dagData,
            this.depthIndex == 0 ? 0 : 100,
        )
        // next 'this as unknown as Immutable<Dynamic3dContent>" is for intellij only, TS is not complaining
        this.modules = this.layerOrganizer.modules.map((module) => {
            return moduleObject3d({
                entity: module,
                parentLayer: this as unknown as Immutable<Dynamic3dContent>,
            })
        })
        this.macros = this.layerOrganizer.macros.map((macro) => {
            return macroObject3d({
                entity: macro,
                parentLayer: this as unknown as Immutable<Dynamic3dContent>,
            })
        })
        this.groups = this.layerOrganizer.groups.map((group) => {
            return groupObject3d({
                entity: group,
                parentLayer: this as unknown as Immutable<Dynamic3dContent>,
            })
        })
        this.nestedModules = this.layerOrganizer.nestedModules.map(
            (nestedModule) => {
                return nestedObject3d({
                    entity: nestedModule,
                    parentLayer: this as unknown as Immutable<Dynamic3dContent>,
                })
            },
        )

        this.intraConnection = this.layerOrganizer.intraConnections.map((c) => {
            return new ConnectionObject3d({
                parentLayer: this as unknown as Immutable<Dynamic3dContent>,
                connection: c,
            })
        })

        this.modulesStore = [
            ...this.modules,
            ...this.groups,
            ...this.macros,
            ...this.nestedModules,
        ].reduce((acc, e) => ({ ...acc, [e.entity.uid]: e }), {})

        if (Object.keys(this.modulesStore).length == 0) {
            return
        }
        this.encapsulatingGroup.add(
            ...Object.values(this.modulesStore),
            ...this.intraConnection,
        )
        this.layerBackground = new LayerBackgroundObject3d({
            // next 'this as unknown as Immutable<Environment3D>" is for intellij only, TS is not complaining
            environment3d: this
                .environment3d as unknown as Immutable<Environment3D>,
            entity: this,
            group: this.encapsulatingGroup,
            color: this.baseColor,
        })
        this.encapsulatingGroup.add(this.layerBackground)
    }

    getSelectables() {
        return [
            ...this.modules,
            ...this.intraConnection,
            ...this.macros,
            ...this.groups,
            ...this.nestedModules,
            this.layerBackground,
        ]
            .filter((obj) => obj != undefined)
            .map((m) => m.children)
            .flat() as SelectableObject3D[]
    }

    getConnectedSlot(
        connection: Immutable<Connections.ConnectionModel>,
        toExtremity: 'start' | 'end',
    ): Object3D {
        const other = toExtremity == 'start' ? 'end' : 'start'
        const slotId = connection[other].slotId
        const module = [
            ...this.modules,
            ...this.macros,
            ...this.nestedModules,
            ...this.groups,
        ].find((m) => {
            return m.entity.uid == connection[other].moduleId
        })
        if (!module) {
            console.error('Can not find module', {
                target: connection[other].moduleId,
                layer: this,
            })
            return undefined
        }
        if (typeof slotId == 'string') {
            return toExtremity == 'end'
                ? module.getOutputSlot(slotId)
                : module.getInputSlot(slotId)
        }
        const slots = Object.values(
            toExtremity == 'end' ? module.outputSlots : module.inputSlots,
        )
        const slot = slots[connection[other].slotId]
        if (!slot) {
            console.error('Can not find slot', {
                target: connection[other].slotId,
                layer: this,
                module,
                slots,
                toExtremity,
            })
            return undefined
        }
        return toExtremity == 'end'
            ? module.getOutputSlot(slot.slotId)
            : module.getInputSlot(slot.slotId)
    }

    expandMacro(from: ModuleBaseObject3d<Macro>) {
        const instancePool = from.entity.instance.instancePool$.value
        const workflow = from.entity.model

        this.expandBase({
            from,
            instancePool,
            workflow,
            connectionsGenerator: macroInterConnections,
            args: from.entity,
        })
    }

    expandGroup(from: ModuleBaseObject3d<Layer>) {
        const workflow = from.entity.workflow
        const instancePool = this.instancePool
        this.expandBase({
            from,
            instancePool,
            workflow,
            layerId: from.entity.uid,
            connectionsGenerator: groupInterConnections,
            args: { workflow, layer: from.entity.model, instancePool },
        })
    }

    expandNestedModule(from: ModuleBaseObject3d<NestedModule>) {
        const instancePool = from.entity.instance.instancePool$.value
        const workflow = instancePool.inspector().toFlatWorkflowModel()
        this.expandBase({
            from,
            instancePool,
            workflow,
            connectionsGenerator: nestedModuleInterConnections,
            args: from.entity.instance,
        })
    }

    collapse() {
        const onDone = () => {
            this.onCollapsed && this.onCollapsed()
            const toRemove = [...this.getSelectables(), this.encapsulatingGroup]
            toRemove.forEach((obj) => obj.parent.remove(obj))
            this.environment3d.removeSelectables(...this.getSelectables())
        }
        this.environment3d.frontLayer = this.parent
        const crossingConnections = this.environment3d.rootGroup.children.find(
            (obj) => {
                return (
                    obj.userData?.type == 'CrossingConnections' &&
                    obj.userData.to == this.uid
                )
            },
        )
        this.environment3d.rootGroup.remove(crossingConnections)
        collapseGroupAnimation({
            group: this.encapsulatingGroup,
            parentGroup: this.parent.encapsulatingGroup,
            onDone,
            duration: 2,
            environment3d: this.environment3d,
        })
    }
    private transparent = false

    toggleTransparent() {
        setOpacity(this.encapsulatingGroup, this.transparent ? 1 : 0.3)
        this.transparent = !this.transparent
    }

    private expandBase<TParams>({
        from,
        instancePool,
        workflow,
        layerId,
        connectionsGenerator,
        args,
    }: ExpandParams<TParams>) {
        this.isFrontLayer$.next(false)
        const dynamicContent3d = new Dynamic3dContent({
            isRunning: this.isRunning,
            project: this.project,
            environment3d: this.environment3d,
            instancePool,
            workflow,
            layerId: layerId || workflow.rootLayer.uid,
            depthIndex: this.depthIndex + 1,
            parent: this,
            onCollapsed: () => {
                this.isFrontLayer$.next(true)
                setOpacity([from, ...connections], 1)
                from.material.color = originalColor
                this.environment3d.setFrontLayer(this)
            },
        })
        const group = dynamicContent3d.encapsulatingGroup
        const originalColor = from.material.color
        const uid = from.entity.uid
        const connections = [
            ...this.intraConnection.filter(
                (c) =>
                    c.connection.model.start.moduleId == uid ||
                    c.connection.model.end.moduleId == uid,
            ),
            // inter-connections
            ...this.environment3d.rootGroup.children
                .map((c) => c.children)
                .flat()
                .filter((c) => {
                    return c instanceof ConnectionAcrossLayersObject3d
                })
                .filter((c: ConnectionAcrossLayersObject3d) => {
                    return (
                        c.connection.startLayerId == this.layerId ||
                        c.connection.endLayerId == this.layerId
                    )
                })
                .filter((c: ConnectionAcrossLayersObject3d) => {
                    return (
                        c.connection.model.start.moduleId == uid ||
                        c.connection.model.end.moduleId == uid
                    )
                }),
        ]
        setOpacity([from, ...connections], 0.2)
        from.material.color = new Color(colors[this.depthIndex + 1])
        from.add(group)

        expandGroupAnimation({
            group: group,
            onDone: () => {
                const groupConnectionsWorld = new Group()
                groupConnectionsWorld.userData = {
                    type: 'CrossingConnections',
                    from: from.entity.uid,
                    to: dynamicContent3d.uid,
                }
                const connections = connectionsGenerator(
                    this,
                    dynamicContent3d,
                    args,
                )
                connections.length > 0 &&
                    groupConnectionsWorld.add(...connections)
                this.environment3d.rootGroup.add(groupConnectionsWorld)
            },
            duration: 2,
            environment3d: this.environment3d,
        })
        this.environment3d.setFrontLayer(dynamicContent3d)
    }
}

export class LayerOrganizer {
    public readonly project: Immutable<Projects.ProjectState>
    public readonly instancePool: Immutable<Deployers.InstancePool>
    public readonly workflow: Immutable<Workflows.WorkflowModel>
    public readonly parent: Immutable<LayerOrganizer>
    public readonly layerId: string
    public readonly intraConnections: IntraLayerConnection[]
    public readonly layersChildren: { [_key: string]: string[] }
    public readonly modules: Immutables<Module>
    public readonly groups: Immutables<Layer>
    public readonly macros: Immutables<Macro>
    public readonly nestedModules: Immutables<NestedModule>
    public readonly moduleIds: Immutables<string>
    public readonly allChildrenModuleIds: Immutables<string>
    public readonly groupIds: Immutables<string>
    public readonly entitiesId: Immutables<string>

    constructor(params: {
        instancePool: Immutable<Deployers.InstancePool>
        project: Immutable<Projects.ProjectState>
        workflow: Immutable<Workflows.WorkflowModel>
        parent?: Immutable<LayerOrganizer>
        layerId: string
    }) {
        Object.assign(this, params)
        const layer = this.workflow.rootLayer.filter(
            (l) => l.uid == this.layerId,
        )[0]
        this.moduleIds = layer.moduleIds
        const moduleModels = this.moduleIds.map((uid) => {
            return this.workflow.modules.find((m) => m.uid == uid)
        })
        const isMacro = (model: Modules.ModuleModel) => {
            const env = this.project.environment
            const macroTb = env.macrosToolbox
            return macroTb.modules.find(
                (m) => m.declaration.typeId == model.typeId,
            )
        }
        this.nestedModules = moduleModels
            .filter((model) => !isMacro(model))
            .map((model) => ({
                model,
                instance: this.instancePool.modules.find(
                    (m) => m.uid == model.uid,
                ),
            }))
            .filter(
                ({ instance }) =>
                    instance != undefined &&
                    instance.instancePool$ != undefined,
            )
            .map(({ model, instance }) => {
                return {
                    uid: model.uid,
                    model,
                    instance,
                    instancePool$: instance.instancePool$,
                }
            })
        this.modules = moduleModels
            .filter((model) => !isMacro(model))
            .map((model) => {
                const instance = this.instancePool.modules.find(
                    (m) => m.uid == model.uid,
                )
                return {
                    uid: model.uid,
                    model,
                    instance,
                }
            })
            .filter(
                ({ uid }) =>
                    this.nestedModules.find((m) => m.uid == uid) == undefined,
            )
        this.macros = moduleModels
            .filter((model) => isMacro(model))
            .map((model) => {
                const instance = this.instancePool.modules.find(
                    (m) => m.uid == model.uid,
                )
                const modelMacro = this.project.macros.find(
                    (macro) => macro.uid == model.typeId,
                )
                return {
                    uid: model.uid,
                    model: modelMacro,
                    instance,
                }
            })
        this.groups = layer.children.map((l) => ({
            uid: l.uid,
            model: l,
            workflow: this.workflow,
        }))

        this.groupIds = this.groups.map((l) => l.uid)
        this.entitiesId = [
            ...this.modules,
            ...this.groups,
            ...this.macros,
            ...this.nestedModules,
        ].map((m) => m.uid)

        const moduleConnections = this.workflow.connections
            .filter(
                (connection) =>
                    this.moduleIds.includes(connection.start.moduleId) &&
                    this.moduleIds.includes(connection.end.moduleId),
            )
            .map((model) => {
                const instance = this.instancePool.connections.find(
                    (c) => c.uid == model.uid,
                )
                return new IntraLayerConnection({ model, instance })
            })
        const groupConnections = this.groups
            .map((grp) => {
                const { downStreamConnections, upStreamConnections } =
                    this.equivalentGroupConnections(grp.uid)
                return [...downStreamConnections, ...upStreamConnections]
            })
            .flat()
        this.intraConnections = [...moduleConnections, ...groupConnections]

        this.layersChildren = layer.children.reduce((acc, l) => {
            const moduleIds = l.reduce((acc, e) => [...acc, ...e.moduleIds], [])
            return { ...acc, [l.uid]: moduleIds }
        }, {})
        this.allChildrenModuleIds = Object.values(this.layersChildren).flat()
    }

    dagData() {
        return this.entitiesId.map((uid) => {
            const intraConnections = this.intraConnections
                .filter((c) => c.model.end.moduleId == uid)
                .map((c) => c.model.start.moduleId)
            return {
                id: uid,
                parentIds: [...new Set([...intraConnections])],
            }
        })
    }

    getConnectionFromSlot(
        slot: { moduleId: string; slotId: string | number },
        fromExtremity: 'end' | 'start',
    ) {
        const connection = this.intraConnections.find(
            (c) =>
                c.model[fromExtremity].slotId == slot.slotId &&
                c.model[fromExtremity].moduleId == slot.moduleId,
        )
        if (!connection) {
            console.error('Can not find connection', {
                target: slot,
                fromExtremity,
                layerOrganizer: this,
            })
            return undefined
        }

        return connection
    }

    findRelative(
        slot: { moduleId: string; slotId: number | string },
        fromExtremity: 'end' | 'start',
    ) {
        const connection = this.getConnectionFromSlot(slot, fromExtremity)

        if (connection) {
            return {
                connection,
                layer: this,
                slot:
                    fromExtremity == 'end'
                        ? connection.model.start
                        : connection.model.end,
            }
        }
        if (!this.parent) {
            console.error('Relative not Found, no more parents to check', {
                slot,
                fromExtremity,
                layer: this,
            })
            return undefined
        }
        const organizer = this.parent
        const parentModule = [
            ...organizer.macros,
            ...organizer.nestedModules,
        ].find((maybeParent) => {
            return maybeParent.uid == this.instancePool.parentUid
        })
        if (!parentModule) {
            console.error('Can not find parentModule in parent layer', {
                organizer,
                fromExtremity,
                slot,
            })
        }
        // here we have either a NestedModule or a MacroModule
        // In case of nested Module we need one nested module with one input (practical case of *MapMacro)
        return organizer.findRelative(
            {
                // 0 is only OK for Nested *MapMacro
                slotId: 0,
                moduleId: parentModule.uid,
            },
            fromExtremity,
        )
    }

    equivalentGroupConnections(groupId: string): {
        downStreamConnections: IntraLayerConnection[]
        upStreamConnections: IntraLayerConnection[]
    } {
        const groupLayer = this.workflow.rootLayer
            .flat()
            .find((l) => l.uid == groupId)
        const thisLayer = this.workflow.rootLayer
            .flat()
            .find((l) => l.uid == this.layerId)
        const modules = groupLayer.reduce(
            (acc, e) => [...acc, ...e.moduleIds],
            [],
        )
        const downStreamConnections = this.workflow.connections
            .filter((c) => {
                return (
                    modules.includes(c.start.moduleId) &&
                    thisLayer.moduleIds.includes(c.end.moduleId)
                )
            })
            .map((connection, i) => {
                const instance = this.instancePool.connections.find(
                    (c) => c.uid == connection.uid,
                )
                const model = {
                    ...connection,
                    start: {
                        moduleId: groupId,
                        slotId: `output_${i}`,
                    },
                }
                return new IntraLayerConnection({ model, instance })
            })
        const upStreamConnections = this.workflow.connections
            .filter((c) => {
                return (
                    thisLayer.moduleIds.includes(c.start.moduleId) &&
                    modules.includes(c.end.moduleId)
                )
            })
            .map((connection, i) => {
                const instance = this.instancePool.connections.find(
                    (c) => c.uid == connection.uid,
                )
                const model = {
                    ...connection,
                    end: { moduleId: groupId, slotId: `input_${i}` },
                }
                return new IntraLayerConnection({ model, instance })
            })
        return {
            downStreamConnections,
            upStreamConnections,
        }
    }
}
