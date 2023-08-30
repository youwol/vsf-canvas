import {
    ConnectionObject3d,
    moduleObject3d,
    groupObject3d,
    macroObject3d,
    nestedObject3d,
} from './objects3d'
import { Color, Group, Vector3 } from 'three'
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
    Configurations,
    Projects,
    Deployers,
    Workflows,
    Modules,
} from '@youwol/vsf-core'
import {
    collapseGroupAnimation,
    expandGroupAnimation,
    groupInterConnections,
    macroInterConnections,
    setOpacity,
} from './objects3d/utils'
import { nestedInterConnections } from './objects3d/nested-inter-connections'
import { LayerBackgroundObject3d } from './objects3d/layer-background.object3d'
import { ConnectionAcrossLayersObject3d } from './objects3d/connection-across-layers.object3d'
import { BehaviorSubject, Subscription } from 'rxjs'
import { ModuleBaseObject3d } from './objects3d/module-base.object3d'
import { skip } from 'rxjs/operators'

const colors = [0x3399ff, 0x9933ff, 0xff9933, 0xff3399, 0x33ff99, 0x99ff33]
type ExpandParams<TParams> = {
    from:
        | ModuleBaseObject3d<NestedModule>
        | ModuleBaseObject3d<Macro>
        | ModuleBaseObject3d<Layer>
    instancePool$: BehaviorSubject<Immutable<Deployers.InstancePool>>
    workflow: Immutable<Workflows.WorkflowModel>
    layerId?: string
    connectionsGenerator: (
        parent,
        child,
        arg: TParams,
    ) => ConnectionAcrossLayersObject3d[]
    args: TParams
}

function clear(g: Group) {
    g.children.forEach((c) => {
        c instanceof Group && clear(c)
    })
    g.clear()
}

function toFlatWorkflowModel(
    instancePool: Deployers.DeployerTrait,
    layerId: string,
): Workflows.WorkflowModel {
    const flattened = instancePool.inspector().flat()
    return {
        uid: '',
        modules: flattened.modules.map((m) => ({
            uid: m.uid,
            typeId: m.typeId,
            toolboxId: m.toolboxId,
            toolboxVersion: m.toolboxVersion,
        })),
        connections: flattened.connections.map((c) => {
            return {
                ...c,
                configuration: Configurations.extractConfigWith({
                    configuration: c.configuration,
                    values: {},
                }),
            }
        }),
        rootLayer: new Workflows.Layer({
            uid: layerId,
            moduleIds: instancePool.modules.map((m) => m.uid),
        }),
    }
}

export type ModulesStore = {
    [k: string]: ModuleBaseObject3d<Module | NestedModule | Layer | Macro>
}
export type PositionsStore = { [k: string]: Vector3 }

export type Dynamic3dContentState = {
    workflow: Immutable<Workflows.WorkflowModel>
    modules: Immutables<ModuleBaseObject3d<Module>>
    groups: Immutables<ModuleBaseObject3d<Layer>>
    macros: Immutables<ModuleBaseObject3d<Macro>>
    nestedModules: Immutables<ModuleBaseObject3d<NestedModule>>
    intraConnection: ConnectionObject3d[]
    layerBackground: LayerBackgroundObject3d
    entitiesPositions: Immutable<PositionsStore>
    modulesStore: Immutable<ModulesStore>
    layerOrganizer: Immutable<LayerOrganizer>
    instancePool: Immutable<Deployers.InstancePool>
}

export class Dynamic3dContent {
    public readonly uid: string
    public readonly isRunning: boolean
    public readonly parent?: Dynamic3dContent
    public readonly environment3d: Environment3D
    public readonly project: Immutable<Projects.ProjectState>
    public readonly state$: BehaviorSubject<Dynamic3dContentState>
    public readonly instancePool$: BehaviorSubject<
        Immutable<Deployers.InstancePool>
    >
    public readonly layerId: string
    public readonly encapsulatingGroup: Group
    public readonly depthIndex: number = 0
    public readonly baseColor: number
    public readonly onCollapsed?: () => void
    public readonly isFrontLayer$ = new BehaviorSubject(true)

    private readonly subscriptions: Subscription[] = []

    constructor(params: {
        isRunning: boolean
        project: Immutable<Projects.ProjectState>
        instancePool$: BehaviorSubject<Immutable<Deployers.InstancePool>>
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
        const state = this.createState({
            instancePool: params.instancePool$.value,
            workflow: params.workflow,
        })
        this.state$ = new BehaviorSubject<Dynamic3dContentState>(state)
        const sub = this.instancePool$
            .pipe(skip(1))
            .subscribe((instancePool) => {
                // When here, it is because the layer represent the instance pool of a Modules.Implementation
                // with a dynamic instance pool => there is no Workflow.Models associated => a flat one is generated
                const workflow = toFlatWorkflowModel(instancePool, this.layerId)
                const gatherBelowLayers = (m: Immutable<Dynamic3dContent>) => {
                    return m == this ? [] : [m, ...gatherBelowLayers(m.parent)]
                }
                const layers = gatherBelowLayers(this.environment3d.frontLayer)

                if (instancePool.modules.length == 0) {
                    layers.push(this)
                }
                Promise.all(layers.map((l) => l.collapse())).then(() => {
                    clear(this.encapsulatingGroup)
                    const crossingConnections =
                        this.environment3d.rootGroup.children.filter((obj) => {
                            return (
                                obj.userData?.type == 'CrossingConnections' &&
                                obj.userData.to == this.uid
                            )
                        })
                    crossingConnections.forEach((c) =>
                        this.environment3d.rootGroup.remove(c),
                    )
                    const state = this.createState({ instancePool, workflow })
                    this.state$.next(state)
                    const groupConnectionsWorld = new Group()
                    groupConnectionsWorld.userData = {
                        type: 'CrossingConnections',
                        from: this.parent.uid,
                        to: this.uid,
                    }
                    const module =
                        this.parent.layerOrganizer.nestedModules.find(
                            (m) => m.uid == instancePool.parentUid,
                        )
                    const connections = nestedInterConnections(
                        this.parent,
                        this,
                        module.instance,
                    )
                    connections.length > 0 &&
                        groupConnectionsWorld.add(...connections)
                    this.environment3d.rootGroup.add(groupConnectionsWorld)
                })
            })
        this.subscriptions.push(sub)
    }

    getSelectables() {
        const state = this.state$.value
        return [
            ...state.modules,
            ...state.intraConnection,
            ...state.macros,
            ...state.groups,
            ...state.nestedModules,
            state.layerBackground,
        ]
            .filter((obj) => obj != undefined)
            .map((m) => m.children)
            .flat() as SelectableObject3D[]
    }

    expandMacro(from: ModuleBaseObject3d<Macro>) {
        const workflow = from.entity.model

        this.expandBase({
            from,
            instancePool$: from.entity.instance.instancePool$,
            workflow,
            connectionsGenerator: macroInterConnections,
            args: from.entity,
        })
    }

    expandGroup(from: ModuleBaseObject3d<Layer>) {
        const workflow = from.entity.workflow
        this.expandBase({
            from,
            instancePool$: this.instancePool$,
            workflow,
            layerId: from.entity.uid,
            connectionsGenerator: groupInterConnections,
            args: {
                workflow,
                layer: from.entity.model,
                instancePool: this.instancePool$.value,
            },
        })
    }

    expandNestedModule(from: ModuleBaseObject3d<NestedModule>) {
        const instancePool = from.entity.instance.instancePool$.value
        const workflow = toFlatWorkflowModel(instancePool, from.entity.uid) //instancePool.inspector().toFlatWorkflowModel()
        this.expandBase({
            from,
            instancePool$: from.entity.instance.instancePool$,
            workflow,
            layerId: from.entity.uid,
            connectionsGenerator: nestedInterConnections,
            args: from.entity.instance,
        })
    }

    async collapse() {
        return new Promise<void>((resolve) => {
            const onDone = () => {
                this.onCollapsed && this.onCollapsed()
                const toRemove = [
                    ...this.getSelectables(),
                    this.encapsulatingGroup,
                ]
                toRemove.forEach((obj) => obj.parent.remove(obj))
                this.environment3d.removeSelectables(...this.getSelectables())
                this.subscriptions.forEach((sub) => sub.unsubscribe())
                resolve()
            }
            this.environment3d.frontLayer = this.parent
            const crossingConnections =
                this.environment3d.rootGroup.children.find((obj) => {
                    return (
                        obj.userData?.type == 'CrossingConnections' &&
                        obj.userData.to == this.uid
                    )
                })
            this.environment3d.rootGroup.remove(crossingConnections)
            collapseGroupAnimation({
                group: this.encapsulatingGroup,
                parentGroup: this.parent.encapsulatingGroup,
                onDone,
                duration: 2,
                environment3d: this.environment3d,
            })
        })
    }

    get layerOrganizer() {
        return this.state$.value.layerOrganizer
    }

    get state() {
        return this.state$.value
    }

    private transparent = false

    toggleTransparent() {
        setOpacity(this.encapsulatingGroup, this.transparent ? 1 : 0.3)
        this.transparent = !this.transparent
    }

    private expandBase<TParams>({
        from,
        instancePool$,
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
            instancePool$,
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
            ...this.state$.value.intraConnection.filter(
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

    private createState({
        instancePool,
        workflow,
    }: {
        instancePool: Immutable<Deployers.InstancePool>
        workflow: Workflows.WorkflowModel
    }): Dynamic3dContentState {
        const layerOrganizer = new LayerOrganizer({
            instancePool,
            project: this.project,
            layerId: this.layerId,
            workflow: workflow,
            parent: this.parent && this.parent.layerOrganizer,
        })
        const dagData = layerOrganizer.dagData()
        const entitiesPositions = computeCoordinates(
            dagData,
            this.depthIndex == 0 ? 0 : 100,
        )
        // next 'this as unknown as Immutable<Dynamic3dContent>" is for intellij only, TS is not complaining
        const modules = layerOrganizer.modules.map((module) => {
            return moduleObject3d({
                entity: module,
                parentLayer: this as unknown as Immutable<Dynamic3dContent>,
                entitiesPositions,
            })
        })
        const macros = layerOrganizer.macros.map((macro) => {
            return macroObject3d({
                entity: macro,
                parentLayer: this as unknown as Immutable<Dynamic3dContent>,
                entitiesPositions,
            })
        })
        const groups = layerOrganizer.groups.map((group) => {
            return groupObject3d({
                entity: group,
                parentLayer: this as unknown as Immutable<Dynamic3dContent>,
                entitiesPositions,
                layerOrganizer,
            })
        })
        const nestedModules = layerOrganizer.nestedModules.map(
            (nestedModule) => {
                return nestedObject3d({
                    entity: nestedModule,
                    parentLayer: this as unknown as Immutable<Dynamic3dContent>,
                    entitiesPositions,
                })
            },
        )

        const modulesStore: ModulesStore = [
            ...modules,
            ...groups,
            ...macros,
            ...nestedModules,
        ].reduce((acc, e) => ({ ...acc, [e.entity.uid]: e }), {})

        const intraConnection = layerOrganizer.intraConnections.map((c) => {
            return new ConnectionObject3d({
                parentLayer: this as unknown as Immutable<Dynamic3dContent>,
                connection: c,
                modulesStore,
            })
        })

        let layerBackground
        if (Object.keys(modulesStore).length != 0) {
            this.encapsulatingGroup.add(
                ...Object.values(modulesStore),
                ...intraConnection,
            )
            layerBackground = new LayerBackgroundObject3d({
                environment3d: this
                    .environment3d as unknown as Immutable<Environment3D>,
                entity: this,
                group: this.encapsulatingGroup,
                color: this.baseColor,
            })
            this.encapsulatingGroup.add(layerBackground)
        }

        return {
            instancePool,
            workflow,
            modules,
            groups,
            macros,
            nestedModules,
            intraConnection,
            layerBackground,
            entitiesPositions: entitiesPositions,
            modulesStore,
            layerOrganizer,
        }
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
        const target =
            typeof slot.slotId == 'number'
                ? slot
                : getSlot(slot, fromExtremity, [
                      ...this.modules,
                      ...this.macros,
                      ...this.nestedModules,
                  ])
        const connection = this.intraConnections.find(
            (c) =>
                c.model[fromExtremity].slotId == target.slotId &&
                c.model[fromExtremity].moduleId == target.moduleId,
        )
        if (!connection) {
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
        if (!this.instancePool.connectionsHint) {
            console.error(
                'No connections hint available to determine connection to parent',
                {
                    fromExtremity,
                    slot,
                },
            )
            throw Error('Can not determine relative of given slot')
        }
        if (!this.instancePool.connectionsHint[slot.moduleId]) {
            console.error(
                `No connections hint available for target module '${slot.moduleId}' to determine connection to parent`,
                {
                    fromExtremity,
                    slot,
                },
            )
            throw Error('Can not determine relative of given slot')
        }
        const hint = this.instancePool.connectionsHint[slot.moduleId]
        // here we have either a NestedModule or a MacroModule
        // In case of nested Module we need one nested module with one input (practical case of *MapMacro)
        return organizer.findRelative(
            {
                slotId:
                    fromExtremity == 'end' ? hint.parent.from : hint.parent.to,
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

function getSlot(
    slot: { slotId: number | string; moduleId: string },
    fromExtremity: 'end' | 'start',
    modules: Immutables<Module | Macro | NestedModule>,
) {
    if (typeof slot.slotId == 'number') {
        return slot
    }
    const impl = modules.find((m) => m.instance.uid == slot.moduleId)
    const slots =
        fromExtremity == 'end'
            ? impl.instance.inputSlots
            : impl.instance.outputSlots
    const t = Object.entries(slots)
        .map(([k, _], i) => [k, i])
        .find(([k, _]) => k == slot.slotId)
    return { moduleId: slot.moduleId, slotId: t[1] }
}
