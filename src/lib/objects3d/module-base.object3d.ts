import {
    DirectionalLight,
    Group,
    Mesh,
    MeshPhongMaterial,
    MeshStandardMaterial,
    Vector3,
} from 'three'
import { Immutable, Modules, HtmlTrait, Projects } from '@youwol/vsf-core'
import { constants } from '../constants'
import {
    defaultSelector,
    SelectableTrait,
    Selector,
    SlotsTrait,
    SpotTrait,
} from './traits'
import { Layer, Macro, Module, NestedModule } from '../models'
import { Environment3D } from '../environment3d'
import { moduleSpot, putBulletsInLine, whiten } from './utils'
import { MeshesFactory } from './meshes.factory'
import { HeaderObject3d } from './header.object3d'
import { ConnectivesObject3d } from './connectives.object3d'
import { Dynamic3dContent } from '../dynamic-content'
import {
    ActionsRowObject3d,
    DisplayDocumentationAction,
    DisplayJournalAction,
    DisplayViewAction,
} from './actions-row.object3d'
import { VirtualDOM } from '@youwol/flux-view'
import { CustomHtmlObject3d } from './custom-html.object3d'

export class ModuleBaseObject3d<
        TEntity extends Module | Layer | NestedModule | Macro,
    >
    extends Group
    implements SelectableTrait<TEntity>, SpotTrait, SlotsTrait
{
    public readonly environment3d: Immutable<Environment3D>
    public readonly parentLayer: Immutable<Dynamic3dContent>
    public readonly entity: Immutable<TEntity>

    public readonly mesh: Mesh
    public readonly material: MeshStandardMaterial
    public readonly spot: DirectionalLight
    public readonly selector: Selector<TEntity>
    public readonly connectives: ConnectivesObject3d

    public readonly inputSlots: { [k: string]: Modules.SlotTrait }
    public readonly outputSlots: { [k: string]: Modules.SlotTrait }
    public readonly height = 10

    constructor(params: {
        parentLayer: Immutable<Dynamic3dContent>
        entity: Immutable<TEntity>
        entitiesPositions?: { [k: string]: Vector3 }
        customActions?: VirtualDOM[]
        inputSlots: { [k: string]: Modules.SlotTrait }
        outputSlots: { [k: string]: Modules.SlotTrait }
        instancePool$?
        toolbox: Projects.ToolBox
        title: string
        subTitle: string
    }) {
        super()
        Object.assign(this, params)
        this.environment3d = this.parentLayer.environment3d
        this.name = this.entity.uid
        const entitiesPosition =
            params.entitiesPositions || this.parentLayer.entitiesPosition
        this.name = this.entity.uid
        const position = entitiesPosition[this.entity.uid]
        this.position.set(position.x, position.y, position.z)
        const header = new HeaderObject3d({
            id: params.title,
            type: params.subTitle,
            toolbox: params.toolbox,
            padding: constants.modulePadding,
            width: constants.moduleWidth,
            height: constants.moduleHeight,
        })

        const actionsRow = new ActionsRowObject3d({
            actions: [
                this.entity.instance?.html
                    ? new DisplayViewAction({
                          state: this.parentLayer.environment3d.state,
                          module: this.entity.instance as Immutable<
                              Modules.ImplementationTrait & HtmlTrait
                          >,
                      })
                    : undefined,
                this.parentLayer.isRunning
                    ? new DisplayJournalAction({
                          state: this.parentLayer.environment3d.state,
                          module: this.entity.instance,
                      })
                    : undefined,
                this.entity.instance?.factory.declaration.documentation
                    ? new DisplayDocumentationAction({
                          state: this.parentLayer.environment3d.state,
                          module: this.entity.instance,
                      })
                    : undefined,
                ...(params.customActions || []),
            ].filter((d) => d != undefined),
            visible$: this.parentLayer.isFrontLayer$,
        })
        actionsRow.position.y = 0.5 * (this.height + actionsRow.height)

        this.mesh = MeshesFactory.moduleBox(
            {
                color: 0xf5f5f5,
                depth: 1,
            },
            { shareMaterial: false },
        )
        this.connectives = new ConnectivesObject3d({
            inputSlots: params.inputSlots,
            outputSlots: params.outputSlots,
            supportingGroup: this.mesh,
            color: whiten(0x0000ff, 0.5).getHex(),
        })
        this.add(header, this.connectives, actionsRow)
        const instancePool$ = params.instancePool$
        if (instancePool$) {
            const groupPool = new Group()
            instancePool$.subscribe((pool) => {
                groupPool.clear()
                putBulletsInLine({
                    parentGroup: groupPool,
                    material: new MeshPhongMaterial({ color: 0x00ff00 }),
                    width: constants.moduleWidth - 2 * constants.modulePadding,
                    bulletRadius: 0.7,
                    pool,
                })
            })
            groupPool.position.z = 1
            groupPool.position.y = -this.height / 2 - 1
            this.add(groupPool)
        }

        this.material = this.mesh.material as MeshStandardMaterial
        this.spot = moduleSpot(this)
        this.add(this.mesh)
        this.selector = defaultSelector<TEntity>(this, {
            onSelected: () =>
                this.entity.instance &&
                this.environment3d.state.select([this.entity.instance]),
        })
        if (!this.entity.instance) {
            return
        }
        const canvasView = this.parentLayer.project.canvasViews
            .filter((elem) => elem.selector(this.entity.instance))
            .map((elem) => elem.view(this.entity.instance))
        const defaultCanvasView =
            this.entity.instance.canvas &&
            this.entity.instance.canvas(this.entity.instance)
        const children = [...canvasView, defaultCanvasView].filter(
            (d) => d != undefined,
        )
        if (children.length > 0) {
            const customHtml = new CustomHtmlObject3d({
                children,
                visible$: this.parentLayer.isFrontLayer$,
            })
            customHtml.position.y = -this.height / 2 - 3
            this.add(customHtml)
        }
    }

    getInputSlot(slotId: string): Mesh {
        return this.connectives.inputSlots[slotId]
    }
    getOutputSlot(slotId: string): Mesh {
        return this.connectives.outputSlots[slotId]
    }
}
