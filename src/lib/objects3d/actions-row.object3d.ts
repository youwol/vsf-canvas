import { Group } from 'three'
import { render, VirtualDOM } from '@youwol/rx-vdom'
import { CSS3DObject } from '../renderers'
import { Observable } from 'rxjs'
import {
    Immutable,
    Immutable$,
    Deployers,
    Modules,
    HtmlTrait,
} from '@youwol/vsf-core'
import { WorkersPoolTypes } from '@youwol/webpm-client'
import { StateTrait } from '../renderer3d.view'

export class ActionsRowObject3d extends Group {
    public readonly height = 5
    private readonly object: CSS3DObject

    constructor(params: {
        actions: VirtualDOM<'div'>[]
        visible$: Observable<boolean>
    }) {
        super()
        const vDOM = {
            tag: 'div' as const,
            style: {
                fontSize: '3px',
            },
            class: {
                source$: params.visible$,
                vdomMap: (d): string => (d ? 'd-flex' : 'd-none'),
                wrapper: (d) => `${d} align-items-center`,
            },
            children: params.actions,
        }
        const htmlElement = render(vDOM) as unknown as HTMLDivElement
        this.object = new CSS3DObject(htmlElement)
        this.add(this.object)
        this.object.layers.set(0)
    }
}

const baseClass = 'fas fv-pointer fv-hover-text-focus'
const baseStyle = {
    margin: '1px',
}
export class ExpandAction implements VirtualDOM<'div'> {
    public readonly tag = 'div'
    public readonly class
    public readonly onclick: (ev: MouseEvent) => void
    public readonly style = baseStyle
    constructor({
        onExpand,
        instancePool$,
    }: {
        onExpand
        instancePool$: Immutable$<Deployers.InstancePool>
    }) {
        this.class = {
            source$: instancePool$,
            vdomMap: (pool): string =>
                pool.modules.length > 0 ? '' : 'd-none',
            wrapper: (d) => `${d} fa-expand ${baseClass}`,
        }
        this.onclick = () => onExpand()
    }
}

export class DisplayViewAction implements VirtualDOM<'div'> {
    public readonly tag = 'div'
    public readonly class = `fa-eye ${baseClass}`
    public readonly style = baseStyle
    public readonly onclick: (ev: MouseEvent) => void
    constructor({
        state,
        module,
    }: {
        state: Immutable<StateTrait>
        module: Immutable<Modules.ImplementationTrait & HtmlTrait>
    }) {
        this.onclick = () => state.displayModuleView(module)
    }
}

export class DisplayJournalAction implements VirtualDOM<'div'> {
    public readonly tag = 'div'
    public readonly class = `fa-newspaper ${baseClass}`
    public readonly style = baseStyle
    public readonly onclick: (ev: MouseEvent) => void

    constructor({
        state,
        module,
    }: {
        state: Immutable<StateTrait>
        module: Immutable<Modules.ImplementationTrait>
    }) {
        this.onclick = () => state.displayModuleJournal(module)
    }
}

export class DisplayDocumentationAction implements VirtualDOM<'div'> {
    public readonly tag = 'div'
    public readonly class = `fa-question ${baseClass}`
    public readonly style = baseStyle
    public readonly onclick: (ev: MouseEvent) => void

    constructor({
        state,
        module,
    }: {
        state: Immutable<StateTrait>
        module: Immutable<Modules.ImplementationTrait>
    }) {
        this.onclick = () => state.displayModuleDocumentation(module)
    }
}

export class InspectWorkerAction implements VirtualDOM<'div'> {
    public readonly tag = 'div'
    public readonly class
    public readonly onclick: (ev: MouseEvent) => void
    public readonly style = baseStyle
    constructor({
        state,
        workersPool,
        workerId,
    }: {
        state: Immutable<StateTrait>
        workersPool: Immutable<WorkersPoolTypes.WorkersPool>
        workerId: string
    }) {
        this.class = `fa-microchip ${baseClass}`
        this.onclick = () =>
            state.displayWorkerEnvironment({ workersPool, workerId })
    }
}
