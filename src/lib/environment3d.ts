import {
    Camera,
    Fog,
    Group,
    HemisphereLight,
    PerspectiveCamera,
    Raycaster,
    Scene,
    Vector2,
    WebGLRenderer,
} from 'three'
import { implementsGrouperTraitObject3D, Selector } from './objects3d'

import { Projects, Immutable, Immutable$ } from '@youwol/vsf-core'
import { CSS3DRenderer } from './renderers'
import * as THREE from 'three'
import { fitSceneToContent, prepareWorkflowAndInstancePool } from './utils'
import { BehaviorSubject, ReplaySubject, Subject, Subscription } from 'rxjs'
import { Module, SelectableObject3D } from './models'
import { Dynamic3dContent } from './dynamic-content'
import { focusOnGroupAnimation } from './objects3d/utils'
import { MouseControls } from './controls/mouse.controls'
import { StateTrait } from './renderer3d.view'
import { filter, mergeMap, tap } from 'rxjs/operators'

interface RendererTrait {
    setSize: (w: number, h: number) => void
    domElement: HTMLElement
    render: (scene: Scene, camera: Camera) => void
}
export interface ConfigurationEnv3D {
    antialias: boolean
    resolution: number
}
export class Environment3D {
    public readonly configuration$: Immutable$<ConfigurationEnv3D>
    public readonly project$: Immutable$<Projects.ProjectState>
    public readonly projectSwitch$ = new Subject<boolean>()
    public readonly state: Immutable<StateTrait>
    public readonly workflowId: Immutable<string>
    public readonly htmlElementContainer: HTMLDivElement

    public readonly rayCaster = new Raycaster()
    public readonly scene = new Scene()
    public readonly fog = new Fog(0x262626, 100, 400)
    public readonly pointer = new Vector2()
    private renderer: WebGLRenderer
    private htmlRendered3D: CSS3DRenderer
    private renderers: RendererTrait[] = []

    public readonly camera: PerspectiveCamera
    public readonly controls: MouseControls

    public selectables: SelectableObject3D[] = []
    public hovered: SelectableObject3D
    public readonly selected$: ReplaySubject<unknown>
    public readonly rootGroup = new Group()
    public frontLayer: Immutable<Dynamic3dContent>
    private subscriptions: Subscription[] = []
    private animationFrameHandle: number
    private renderLoopActions: Record<string, { action: () => void }> = {}

    constructor(params: {
        htmlElementContainer: HTMLDivElement
        project$: Immutable$<Projects.ProjectState>
        selected$: ReplaySubject<unknown>
        workflowId: string
        configuration$: Immutable$<ConfigurationEnv3D>
        state: Immutable<StateTrait>
    }) {
        Object.assign(this, params)
        this.scene.add(this.rootGroup)
        this.scene.background = new THREE.Color(0x262626)
        this.scene.add(
            new HemisphereLight(0xffffff, 0x000000, 1),
            new THREE.AmbientLight(0x404040),
        )
        const { clientWidth, clientHeight } = this.htmlElementContainer
        this.configuration$.subscribe((conf) => {
            this.initializeRenderers(conf)
        })

        this.camera = new PerspectiveCamera(
            27,
            clientWidth / clientHeight,
            1,
            3500,
        )
        this.camera.position.z = 2750
        this.scene.fog = this.fog

        this.controls = new MouseControls({
            camera: this.camera,
            domElement: this.htmlElementContainer,
            environment: this,
        })
        this.controls.enableRotate = true
        this.controls.enablePan = true
        this.controls.zoomSpeed = 0.8
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN, // Use pan for left mouse button (translate mode)
            MIDDLE: THREE.MOUSE.DOLLY, // Use dolly for middle mouse button (zoom mode)
            RIGHT: THREE.MOUSE.ROTATE, // Use rotate for right mouse button (rotate mode)
        }
        setTimeout(() => {
            const observer = new window['ResizeObserver'](() => {
                this.resize()
            })
            observer.observe(this.htmlElementContainer)
            fitSceneToContent(this.scene, this.camera, this.controls)
        })

        this.project$
            .pipe(
                tap(() => {
                    this.projectSwitch$.next(true)
                }),
                mergeMap((project) => {
                    return prepareWorkflowAndInstancePool(
                        project,
                        this.workflowId,
                    )
                }),
                filter((data) => data !== undefined),
            )
            .subscribe(({ workflow, project, instancePool, isRunning }) => {
                this.clear()
                const dynamicContent3d = new Dynamic3dContent({
                    isRunning,
                    project: project,
                    instancePool$: new BehaviorSubject(instancePool),
                    layerId: workflow.rootLayer.uid,
                    workflow,
                    environment3d: this,
                    depthIndex: 0,
                })
                const group = dynamicContent3d.encapsulatingGroup
                this.rootGroup.add(group)
                this.frontLayer = dynamicContent3d
                this.setSelectables()
                fitSceneToContent(this.scene, this.camera, this.controls)
                this.fog.near = this.camera.position.z
                this.fog.far = this.camera.position.z + 150
            })
    }

    connect() {
        this.connectEvents()
        this.animate()
    }

    disconnect() {
        if (!this.renderer) {
            return
        }
        cancelAnimationFrame(this.animationFrameHandle)
        this.renderer.forceContextLoss()
        this.renderer.dispose()
        this.renderer.domElement.remove()
        this.controls.dispose()
        this.renderer = null
    }

    setFrontLayer(layer: Immutable<Dynamic3dContent>) {
        this.frontLayer = layer
        this.setSelectables()
    }

    render() {
        this.applyRenderLoopActions()
        this.controls.update()
        this.renderers.forEach((renderer) => {
            renderer.render(this.scene, this.camera)
        })
    }

    removeSelectables(...objects: SelectableObject3D[]) {
        this.selectables = this.selectables.filter(
            (obj) => !objects.includes(obj),
        )
    }

    fitSceneToContent(content?: Dynamic3dContent) {
        const group =
            content?.encapsulatingGroup.children.filter(
                (c) => !implementsGrouperTraitObject3D(c),
            ) || this.rootGroup.children
        focusOnGroupAnimation({
            focus: group,
            toTranslate: [this.rootGroup],
            environment3d: this,
            duration: 1,
        })
    }

    ownSubscriptions(...subscriptions: Subscription[]) {
        this.subscriptions = [...this.subscriptions, ...subscriptions]
    }

    registerRenderLoopAction(id: string, elem: { action: () => void }) {
        this.renderLoopActions[id] = elem
    }

    unregisterRenderLoopAction(id: string) {
        delete this.renderLoopActions[id]
    }

    applyRenderLoopActions() {
        Object.values(this.renderLoopActions).forEach(({ action }) => {
            action()
        })
    }

    private initializeRenderers(configuration: ConfigurationEnv3D) {
        /**
         * The CSS 3D renderer is not configurable => the initial version is kept during the apps life-cycle.
         * Also, regenerating this renderer leads to multiple display of dynamic elements; not sure why.
         */
        const { clientWidth, clientHeight } = this.htmlElementContainer
        if (this.renderer) {
            this.renderer.domElement.remove()
        }

        this.renderer = new WebGLRenderer({
            antialias: configuration.antialias,
        })
        this.renderer.setSize(clientWidth, clientHeight)
        this.htmlElementContainer.appendChild(this.renderer.domElement)

        this.renderer.setPixelRatio(
            window.devicePixelRatio * configuration.resolution,
        )
        if (!this.htmlRendered3D) {
            this.htmlRendered3D = new CSS3DRenderer()
            this.htmlRendered3D.domElement.style.position = 'absolute'
            this.htmlRendered3D.domElement.style.top = '0px'
            this.htmlRendered3D.domElement.classList.add('h-100', 'w-100')
            this.htmlRendered3D.setSize(clientWidth, clientHeight)
            this.htmlElementContainer.appendChild(
                this.htmlRendered3D.domElement,
            )
        }
        this.renderers = [this.renderer, this.htmlRendered3D]
    }

    private clear() {
        this.selected$.next(undefined)
        this.rootGroup.clear()
        this.rootGroup.position.set(0, 0, 0)
        this.subscriptions.forEach((s) => {
            s.unsubscribe()
        })
        this.subscriptions = []
        this.selectables = []
        this.htmlElementContainer
            .querySelectorAll('.css-3d-object, .css-2d-object')
            .forEach((e) => e.remove())
    }

    private resize() {
        if (
            this.htmlElementContainer.clientWidth == 0 ||
            this.htmlElementContainer.clientHeight == 0
        ) {
            return
        }
        this.renderers.forEach((renderer) =>
            renderer.setSize(
                this.htmlElementContainer.clientWidth,
                this.htmlElementContainer.clientHeight,
            ),
        )
        this.camera.aspect =
            this.htmlElementContainer.clientWidth /
            this.htmlElementContainer.clientHeight
        this.camera.updateProjectionMatrix()
    }

    private connectEvents() {
        this.htmlElementContainer.onpointermove = (event) => {
            const target = event.target as HTMLDivElement
            this.pointer.x = (event.offsetX / target.clientWidth) * 2 - 1
            this.pointer.y = -(event.offsetY / target.clientHeight) * 2 + 1
            this.handleRayCaster()
        }
        this.htmlElementContainer.onclick = (ev) => {
            if (ev.shiftKey && this.frontLayer.parent) {
                this.frontLayer.collapse()
                this.state.select([])
                return
            }
            if (!this.hovered) {
                this.selected$.next(undefined)
                this.state.select([])
                return
            }
            if (ev.ctrlKey) {
                const selector = this.hovered.userData
                    .selector as Selector<Module>
                const entity = selector?.getEntity()
                if (entity instanceof Dynamic3dContent) {
                    this.fitSceneToContent(entity)
                }
                return
            }
            if (!ev.ctrlKey && this.hovered.userData.selector) {
                const entity = this.hovered.userData.selector.getEntity()
                if (entity instanceof Dynamic3dContent) {
                    entity.toggleTransparent()
                    return
                }
                this.selected$.next(entity)
                return
            }
            this.state.select([])
        }
        // this.htmlElementContainer.ondblclick = () => {
        //     const entity =
        //         this.hovered &&
        //         this.hovered.userData.selector.getEntity() instanceof
        //             Dynamic3dContent
        //             ? (this.hovered.userData.selector.getEntity() as Dynamic3dContent)
        //             : undefined
        //     this.fitSceneToContent(entity)
        // }
    }

    private setSelectables() {
        const bgdSelectables = (layer: Immutable<Dynamic3dContent>) =>
            layer.parent
                ? [layer.state.layerBackground, ...bgdSelectables(layer.parent)]
                : [layer.state.layerBackground]
        this.selectables = [
            ...this.frontLayer.getSelectables(),
            ...bgdSelectables(this.frontLayer),
        ].filter((e) => e != undefined)
    }

    private animate() {
        this.animationFrameHandle = requestAnimationFrame(() => this.animate())
        this.render()
    }

    private handleRayCaster() {
        this.rayCaster.setFromCamera(this.pointer, this.camera)
        const intersects = this.rayCaster.intersectObjects(this.selectables)

        if (intersects.length > 0) {
            const obj = intersects[0].object as unknown as SelectableObject3D
            if (this.hovered && this.hovered == obj) {
                return
            }

            if (this.hovered && this.hovered != obj) {
                this.hovered.userData.selector?.onRestored()
                this.hovered = obj
            }
            this.hovered = intersects[0].object as unknown as SelectableObject3D
            this.hovered.userData.selector?.onHovered()
        }
        if (
            intersects.length == 0 &&
            this.hovered &&
            this.hovered.userData.selector
        ) {
            this.hovered.userData.selector.onRestored()
            this.hovered = undefined
        }
    }
}
