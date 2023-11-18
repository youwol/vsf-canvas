import { Group } from 'three'
import { CSS3DObject } from '../renderers'
import { render, AnyVirtualDOM } from '@youwol/rx-vdom'
import { Observable } from 'rxjs'

export class CustomHtmlObject3d extends Group {
    public readonly height = 5
    private readonly object: CSS3DObject

    constructor(params: {
        children: AnyVirtualDOM[]
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
                vdomMap: (d): string => (d ? 'd-flex flex-column' : 'd-none'),
                wrapper: (d) => `${d} align-items-center`,
            },
            children: params.children,
        }
        const htmlElement = render(vDOM) as unknown as HTMLDivElement
        this.object = new CSS3DObject(htmlElement)
        this.add(this.object)
        this.object.layers.set(0)
    }
}
