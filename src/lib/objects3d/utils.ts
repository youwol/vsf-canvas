import {
    AnimationAction,
    AnimationClip,
    AnimationMixer,
    Color,
    DirectionalLight,
    Group,
    Material,
    Mesh,
    Object3D,
    SphereGeometry,
    Vector3,
    VectorKeyframeTrack,
} from 'three'
import { Immutable, Projects, Modules } from '@youwol/vsf-core'
import { InterLayerConnection, Macro } from '../models'
import { Environment3D } from '../environment3d'
import * as THREE from 'three'
import { getBoundingBox } from '../utils'
import { Dynamic3dContent } from '../dynamic-content'
import { TextGeometry } from '../geometries/text-geometry'
import { Font } from '../loaders/font-loaders'
import { ConnectionAcrossLayersObject3d } from './connection-across-layers.object3d'
import { LayerBackgroundObject3d } from './layer-background.object3d'
import { BehaviorSubject, Observable } from 'rxjs'
import { take } from 'rxjs/operators'

function macroSlotStatus(
    macro: Immutable<Macro>,
    index: number,
    type: 'parent->child' | 'child->parent',
) {
    const status$ = new BehaviorSubject('connected')
    const s =
        type == 'parent->child'
            ? macro.model.inputs[index]
            : macro.model.outputs[index]
    const innerModule = macro.instance.instancePool$.value.modules.find(
        (m) => m.uid == s.moduleId,
    )
    const obs$: Observable<unknown> =
        type == 'parent->child'
            ? Object.values(innerModule.inputSlots)[s.slotId].rawMessage$
            : Object.values(innerModule.outputSlots)[s.slotId].observable$

    obs$.pipe(take(1)).subscribe(() => status$.next('started'))
    const noOp = () => {
        /*no  op*/
    }
    obs$.subscribe(noOp, noOp, () => status$.next('completed'))
    return status$
}
export function macroInterConnections(
    parentLayer: Immutable<Dynamic3dContent>,
    childLayer: Immutable<Dynamic3dContent>,
    macro: Immutable<Macro>,
) {
    const getDynamicLayer = (organizer, from) => {
        return from.layerOrganizer == organizer
            ? from
            : getDynamicLayer(organizer, from.parent)
    }

    const toConnectionModel = (
        i: number,
        slotInside: Immutable<{ slotId: number | string; moduleId: string }>,
        type: 'parent->child' | 'child->parent',
    ) => {
        const p2c = type == 'parent->child'
        const slotMacro = {
            slotId: i,
            moduleId: macro.uid,
        }
        const finder = parentLayer.layerOrganizer
        const relative = finder.findRelative(slotMacro, p2c ? 'end' : 'start')
        // the status of the 'equivalent' connection found in 'relative' is not necessarily the actual one,
        // e.g. for instance if the macro is used within a 'switchMap' or equivalent.
        // The following logic is more robust.
        const instance = {
            ...relative.connection.instance,
            status$: macroSlotStatus(macro, i, type),
        }
        return {
            parentLayer: getDynamicLayer(relative.layer, parentLayer),
            childLayer,
            connection: new InterLayerConnection({
                instance: instance,
                startLayerId: p2c ? relative.layer.layerId : childLayer.uid,
                endLayerId: p2c ? childLayer.uid : relative.layer.layerId,
                model: {
                    uid: relative.connection.uid,
                    start: p2c ? relative.slot : slotInside,
                    end: p2c ? slotInside : relative.slot,
                    configuration: {},
                },
            }),
        }
    }
    const c0 = macro.model.inputs.map((output, i) =>
        toConnectionModel(i, output, 'parent->child'),
    )
    const c1 = macro.model.outputs.map((output, i) =>
        toConnectionModel(i, output, 'child->parent'),
    )
    return [...c0, ...c1].map((d) => {
        return new ConnectionAcrossLayersObject3d(d)
    })
}

export function nestedModuleInterConnections(
    parent: Immutable<Dynamic3dContent>,
    child: Immutable<Dynamic3dContent>,
    nestedModule: Immutable<Modules.ImplementationTrait>,
) {
    if (
        !['switchMapMacro', 'mergeMapMacro', 'concatMapMacro'].includes(
            nestedModule.factory.declaration.typeId,
        )
    ) {
        // the general case of nested module is not handled for now as we don't know within nestedModule.instancePool
        // which modules serve as IO
        return []
    }
    const instancePool = nestedModule.instancePool$.value
    // Below a 'fake' MacroModel is constructed, each instance of nestedModule.instancePool serves as both input &
    // output
    const modules = instancePool.modules.map(
        (
            m: Modules.ImplementationTrait,
        ): Projects.ModuleModel & { inputSlotId; outputSlotId } => {
            return {
                uid: m.uid,
                typeId: m.factory['typeId'],
                toolboxId: m.toolboxId,
                toolboxVersion: m.toolboxVersion,
                configuration: { uid: m.uid },
                inputSlotId: Object.values(m.inputSlots)[0]?.slotId,
                outputSlotId: Object.values(m.outputSlots)[0].slotId,
            }
        },
    )
    const macroModule = instancePool.modules[0]
    const hasInput = Object.keys(macroModule.inputSlots).length > 0
    const maybeInput = {
        slotId: 0,
        moduleId: macroModule.uid,
    }
    const macro: Macro = {
        uid: nestedModule.uid,
        model: {
            uid: nestedModule.uid,
            typeId: nestedModule.factory.declaration.typeId,
            toolboxId: nestedModule.toolboxId,
            toolboxVersion: nestedModule.toolboxVersion,
            modules: modules,
            connections: [],
            rootLayer: new Projects.Layer({
                uid: `layer_${nestedModule.uid}`,
                moduleIds: modules.map((m) => m.uid),
            }),
            inputs: hasInput ? [maybeInput] : [],
            outputs: modules.map((m) => ({
                slotId: 0,
                moduleId: m.uid,
            })),
        },
        instance: nestedModule,
    }
    return macroInterConnections(parent, child, macro)
}

export function groupInterConnections(
    parentLayer: Immutable<Dynamic3dContent>,
    childLayer: Immutable<Dynamic3dContent>,
    arg: {
        layer: Immutable<Projects.Layer>
        workflow: Immutable<Projects.WorkflowModel>
        instancePool: Immutable<Projects.InstancePool>
    },
) {
    const { downStreamConnections, upStreamConnections } =
        parentLayer.layerOrganizer.equivalentGroupConnections(arg.layer.uid)
    const findReal = (eqConnection) =>
        arg.workflow.connections.find((c) => c.uid == eqConnection.uid)

    const toConnectionModel = (
        connection: Immutable<Projects.ConnectionModel>,
    ) => {
        const p2c = upStreamConnections.find((c) => c.uid == connection.uid)
        return {
            parentLayer,
            childLayer,
            connection: new InterLayerConnection({
                instance: arg.instancePool.connections.find(
                    (c) => c.uid == connection.uid,
                ),
                startLayerId: p2c ? parentLayer.layerId : childLayer.layerId,
                endLayerId: p2c ? childLayer.layerId : parentLayer.layerId,
                model: {
                    uid: connection.uid,
                    start: connection.start,
                    end: connection.end,
                    configuration: {},
                },
            }),
        }
    }
    return [...upStreamConnections, ...downStreamConnections]
        .map(findReal)
        .map((connection: Immutable<Projects.ConnectionModel>) => {
            const model = toConnectionModel(connection)
            return new ConnectionAcrossLayersObject3d({
                parentLayer,
                childLayer,
                connection: model.connection,
            })
        })
}

export function expandGroupAnimation({
    group,
    onDone,
    duration,
    environment3d,
}: {
    group: Group
    onDone: () => void
    duration: number
    environment3d: Environment3D
}) {
    const posRoot = environment3d.rootGroup.position
    const aabb = new THREE.Box3()
    aabb.setFromObject(group)
    const middle = aabb.min.add(aabb.max).multiplyScalar(0.5)
    middle.z = 100
    groupAnimation(
        [0, 0, 0, 1, 1, 1],
        [...posRoot.toArray(), ...posRoot.sub(middle).toArray()],
        duration,
        group,
        environment3d,
        onDone,
    )
}

export function collapseGroupAnimation({
    group,
    parentGroup,
    onDone,
    duration,
    environment3d,
}: {
    group: Group
    parentGroup: Group
    onDone: () => void
    duration: number
    environment3d: Environment3D
}) {
    const posRoot = environment3d.rootGroup.position
    const toFit = parentGroup.children
        .map((c) => c.children)
        .flat()
        .filter((c) => c != group)
    const aabb = getBoundingBox(toFit)
    const middle = aabb.min.add(aabb.max).multiplyScalar(0.5)

    groupAnimation(
        [1, 1, 1, 0, 0, 0],
        [...posRoot.toArray(), ...posRoot.sub(middle).toArray()],
        duration,
        group,
        environment3d,
        onDone,
    )
}

function groupAnimation(
    scales,
    positions,
    duration,
    group,
    environment3d,
    onDone,
) {
    const scaleKF = new VectorKeyframeTrack('.scale', [0, duration], scales)
    const positionKF = new VectorKeyframeTrack(
        '.position',
        [0, duration],
        positions,
    )
    const mixerScale = new AnimationMixer(group)
    const mixerTranslation = new AnimationMixer(environment3d.scene.children[0])
    const actionScale = mixerScale.clipAction(
        new AnimationClip('expand', 3, [scaleKF]),
    )
    const actionTranslate = mixerTranslation.clipAction(
        new AnimationClip('translate', 3, [positionKF]),
    )
    const animators: [string, AnimationMixer, AnimationAction][] = [
        ['expand', mixerScale, actionScale],
        ['translate', mixerTranslation, actionTranslate],
    ]
    let done = false
    animators.forEach(([name, mixer, action]) => {
        action.clampWhenFinished = true
        action.loop = THREE.LoopOnce
        mixer.addEventListener('finished', () => {
            !done && onDone()
            done = true
            environment3d.unregisterRenderLoopAction(name)
        })
        action.play()
        environment3d.registerRenderLoopAction(name, {
            action: () => {
                mixer.update(0.1)
            },
        })
    })
}
export function focusOnGroupAnimation({
    focus,
    toTranslate,
    duration,
    environment3d,
}: {
    focus: Object3D[]
    toTranslate: Object3D[]
    duration: number
    environment3d: Environment3D
}) {
    const aabb = getBoundingBox(focus)
    const middle = aabb.min.add(aabb.max).multiplyScalar(0.5)

    const animators: [string, AnimationMixer, AnimationAction][] =
        toTranslate.map((obj, i) => {
            const positionKF = new VectorKeyframeTrack(
                '.position',
                [0, duration],
                [
                    ...obj.position.toArray(),
                    ...obj.position.sub(middle).toArray(),
                ],
            )
            const mixer = new AnimationMixer(obj)
            const action = mixer.clipAction(
                new AnimationClip('expand', 3, [positionKF]),
            )
            return [`trans_${i}`, mixer, action]
        })

    animators.forEach(([name, mixer, action]) => {
        action.clampWhenFinished = true
        action.loop = THREE.LoopOnce
        mixer.addEventListener('finished', () => {
            environment3d.unregisterRenderLoopAction(name)
        })
        action.play()
        environment3d.registerRenderLoopAction(name, {
            action: () => {
                mixer.update(0.1)
            },
        })
    })
}

export function moduleSpot(module: Object3D) {
    const light = new DirectionalLight(0xffffff, 0.1)
    light.position.set(0, 5, 0)
    light.target = module
    light.castShadow = true
    return light
}

export function whiten(color: number, factor: number) {
    return new Color(color).lerp(new Color('#FFF'), factor)
}

export function putBulletsInLine({
    parentGroup,
    material,
    width,
    bulletRadius,
    pool,
}: {
    parentGroup: Object3D
    width: number
    bulletRadius: number
    pool: Immutable<Projects.InstancePool>
    material: Material
}) {
    const bulletsCount = pool.modules.length
    if (bulletsCount == 0) {
        return
    }
    const sphereGeom = new SphereGeometry(bulletRadius, 4, 4)
    const sphereMat = material
    if (bulletsCount == 1) {
        parentGroup.add(new Mesh(sphereGeom, sphereMat))
        return
    }
    const delta = width / (bulletsCount - 1)
    for (let i = 0; i < bulletsCount; i++) {
        const bullet = new Mesh(sphereGeom, sphereMat)
        bullet.position.x = -width / 2 + i * delta
        parentGroup.add(bullet)
    }
}

export function createTextWithMaxWidth({
    font,
    material,
    text,
    preferredSize,
    maxWidth,
}: {
    font: Font
    material: Material
    text: string
    preferredSize: number
    maxWidth: number
}) {
    const geom = new TextGeometry(text, {
        font: font,
        size: preferredSize,
        height: 0,
        curveSegments: 12,
        bevelEnabled: false,
    })
    geom.computeBoundingBox()
    const textWidth = geom.boundingBox.max.x - geom.boundingBox.min.x
    if (textWidth < maxWidth) {
        return new Mesh(geom, material)
    }
    const scaleFactor = maxWidth / textWidth
    const geomScaled = new TextGeometry(text, {
        font: font,
        size: preferredSize * scaleFactor,
        height: 0,
        curveSegments: 12,
        bevelEnabled: false,
    })
    return new Mesh(geomScaled, material)
}

export function transformPosition(
    object: Immutable<Object3D>,
    toGroup?: Immutable<Object3D>,
) {
    const world = new Vector3()
    object.getWorldPosition(world)
    return toGroup ? toGroup.worldToLocal(world) : world
}

export function setOpacity(objects, opacity, level = 0) {
    objects = Array.isArray(objects) ? objects : [objects]
    objects.forEach((obj) => {
        const isLayer =
            level > 0 &&
            obj.children.find(
                (child) => child instanceof LayerBackgroundObject3d,
            )
        !isLayer &&
            obj.children.forEach((child) => {
                setOpacity(child, opacity, level + 1)
            })
        if (obj.material && opacity != 1) {
            obj.material.transparent = true
            obj.material.opacity = opacity
        }
        if (obj.material && opacity == 1) {
            obj.material.transparent =
                obj.userData.originalMaterial?.transparent || false
            obj.material.opacity = 1
        }
        obj.material && (obj.material.needsUpdate = true)
    })
}
