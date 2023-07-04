import { attr$, child$, VirtualDOM } from '@youwol/flux-view'
import {
    Immutable$,
    Immutable,
    Immutables,
    HtmlTrait,
    Projects,
    Modules,
} from '@youwol/vsf-core'
import { ConfigurationEnv3D, Environment3D } from './environment3d'
import { BehaviorSubject, from, of, ReplaySubject } from 'rxjs'
import { delay, map, mergeMap, shareReplay, skip } from 'rxjs/operators'
import { install } from '@youwol/cdn-client'
import { setup } from '../auto-generated'
import Stats from 'stats.js'

type TStats = typeof Stats

export type Selectable = Modules.ImplementationTrait | Modules.Connection

export interface StateTrait {
    select(entities: Immutables<Selectable>)
    displayModuleView(
        module: Immutable<Modules.ImplementationTrait & HtmlTrait>,
    )
    displayModuleJournal(module: Immutable<Modules.ImplementationTrait>)
    displayModuleDocumentation(module: Immutable<Modules.ImplementationTrait>)
    displayWorkerEnvironment(
        workerEnv: Immutable<Projects.Workers.WorkerEnvironmentTrait>,
    )
}

export class Renderer3DView {
    public readonly class = 'h-100 w-100'
    public readonly style = {
        position: 'relative',
    }
    public readonly project$: Immutable$<Projects.ProjectState>
    public readonly state: Immutable<StateTrait>
    public readonly children: VirtualDOM[]
    public environment3D$: ReplaySubject<Environment3D>
    public readonly configuration$ = new BehaviorSubject({
        antialias: false,
        resolution: 1,
    })
    private environment3D: Environment3D

    constructor(params: {
        project$: Immutable$<Projects.ProjectState>
        workflowId: string
        state: Immutable<StateTrait>
    }) {
        Object.assign(this, params)

        this.environment3D$ = new ReplaySubject<Environment3D>(1)
        this.children = [
            {
                class: 'h-100 w-100',
                style: { position: 'relative' },
                children: [
                    child$(
                        this.environment3D$,
                        (env3d) =>
                            new StatsView({
                                environment3D: env3d,
                                configuration$: this.configuration$,
                            }),
                    ),
                ],
                disconnectedCallback: () => {
                    this.environment3D.disconnect()
                },
                connectedCallback: (htmlElement: HTMLDivElement) => {
                    setTimeout(() => {
                        const observerResize = new window['ResizeObserver'](
                            () => {
                                const { clientWidth, clientHeight } =
                                    htmlElement
                                if (
                                    !this.environment3D &&
                                    clientWidth > 0 &&
                                    clientHeight > 0
                                ) {
                                    this.environment3D = new Environment3D({
                                        htmlElementContainer: htmlElement,
                                        project$: this.project$,
                                        state: this.state,
                                        workflowId: params.workflowId,
                                        selected$: new ReplaySubject<unknown>(
                                            1,
                                        ),
                                        configuration$: this.configuration$,
                                    })
                                    this.environment3D$.next(this.environment3D)
                                    observerResize.disconnect()
                                }
                            },
                        )
                        observerResize.observe(htmlElement)

                        const observerDisplayed = new IntersectionObserver(
                            (entries, _observer) => {
                                const intersecting = entries.reduce(
                                    (acc, entry) => acc || entry.isIntersecting,
                                    false,
                                )
                                intersecting
                                    ? this.environment3D.connect()
                                    : this.environment3D.disconnect()
                            },
                            { root: htmlElement.parentElement },
                        )
                        observerDisplayed.observe(htmlElement)
                    })
                },
            },
        ]
    }
}

/**
 * @category View
 */
export class StatsView implements VirtualDOM {
    /**
     * Immutable DOM Constants
     */
    public readonly children: Immutables<VirtualDOM>

    /**
     * Observable on the 'stats.js' module.
     *
     * @group Observables
     */
    static Stats$: Immutable$<TStats> = of(undefined).pipe(
        delay(3000),
        mergeMap(() =>
            from(
                install({
                    modules: [
                        `stats.js#${setup.runTimeDependencies.externals['stats.js']}`,
                    ],
                    aliases: {
                        Stats: setup.externals['stats.js'].root,
                    },
                }) as unknown as Promise<{ Stats: TStats }>,
            ),
        ),
        map(({ Stats }) => Stats),
        shareReplay({ bufferSize: 1, refCount: true }),
    )

    constructor({
        environment3D,
        configuration$,
    }: {
        environment3D: Environment3D
        configuration$: BehaviorSubject<ConfigurationEnv3D>
    }) {
        this.children = [
            child$(StatsView.Stats$, (Stats) => {
                return {
                    connectedCallback: (elem: HTMLDivElement) => {
                        const stats = Stats['default']()
                        stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
                        const dom = stats.dom
                        dom.style.position = 'absolute'
                        dom.style.zIndex = '0'
                        dom.style.padding = '5px'
                        elem.appendChild(stats.dom)
                        environment3D.registerRenderLoopAction('stats.js', {
                            action: () => stats.update(),
                        })
                    },
                }
            }),
            child$(StatsView.Stats$, () => {
                return new ConfigView(configuration$)
            }),
        ]
    }
}

/**
 * @category View
 */
export class ConfigView implements VirtualDOM {
    /**
     * Immutable DOM Constants
     */
    public readonly children: Immutables<VirtualDOM>

    /**
     * Immutable DOM Constants
     */
    public readonly style = {
        position: 'absolute',
        top: '50px',
        padding: '5px',
        zIndex: 1,
        fontSize: 'smaller',
    }
    /**
     * Immutable DOM Constants
     */
    public readonly class = 'd-flex justify-content-left'

    private readonly antiAliasing$: BehaviorSubject<boolean>

    constructor(config$: BehaviorSubject<ConfigurationEnv3D>) {
        this.antiAliasing$ = new BehaviorSubject<boolean>(
            config$.value.antialias,
        )
        const toggle = ({ faClass, obs }) => {
            return {
                class: attr$(
                    obs,
                    (activated): string =>
                        activated ? `fv-text-focus` : `fv-text-primary`,
                    {
                        wrapper: (d) =>
                            `fas p-1 rounded ${faClass} ${d} fv-pointer fv-hover-bg-background`,
                    },
                ),
                onclick: () => obs.next(!obs.value),
            }
        }
        this.children = [
            toggle({ faClass: 'fa-signature', obs: this.antiAliasing$ }),
        ]
        this.antiAliasing$
            .pipe(
                // first emission is the original configuration
                skip(1),
            )
            .subscribe((antialias) => {
                config$.next({ ...config$.value, antialias })
            })
    }
}
