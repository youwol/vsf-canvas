import { Group } from 'three'
import { CSS3DObject } from '../renderers'
import { attr$, render, VirtualDOM } from '@youwol/flux-view'
import { Observable } from 'rxjs'

export class CustomHtmlObject3d extends Group {
    public readonly height = 5
    private readonly object: CSS3DObject

    constructor(params: {
        children: VirtualDOM[]
        visible$: Observable<boolean>
    }) {
        super()
        const vDOM = {
            style: {
                fontSize: '3px',
            },
            class: attr$(
                params.visible$,
                (d): string => (d ? 'd-flex flex-column' : 'd-none'),
                {
                    wrapper: (d) => `${d} align-items-center`,
                },
            ),
            children: params.children,
        }
        const htmlElement = render(vDOM) as unknown as HTMLDivElement
        this.object = new CSS3DObject(htmlElement)
        this.add(this.object)
        this.object.layers.set(0)
    }
}
