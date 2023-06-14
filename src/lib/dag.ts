import {
    Dag,
    dagStratify,
    decrossOpt,
    layeringLongestPath,
    sugiyama,
} from 'd3-dag'
import { Projects, Modules, Immutable } from '@youwol/vsf-core'
import { Vector3 } from 'three'
import { constants } from './constants'

const expansionFactor = constants.dagExpansionFactor

export function renderDag(
    project: Immutable<Projects.ProjectState>,
    layer: Immutable<Projects.Layer>,
) {
    const layerModules = layer.moduleIds
    const allIds = [...layerModules, ...layer.children.map((l) => l.uid)]
    function getStartingEntityId(connection: Immutable<Modules.Connection>) {
        if (layerModules.includes(connection.start.moduleId)) {
            return connection.start.moduleId
        }
        // should be recursive
        const targetLayer = layer.filter(({ moduleIds }) =>
            moduleIds.includes(connection.start.moduleId),
        )
        return targetLayer[0].uid
    }
    const data = allIds.map((uid) => {
        if (layerModules.includes(uid)) {
            const connections = project.instancePool.connections.filter(
                (connection) => {
                    return connection.end.moduleId == uid
                },
            )
            return {
                id: uid,
                parentIds: connections.map((connection) =>
                    getStartingEntityId(connection),
                ),
            }
        }
        const targetLayer = layer.children.find((l) => l.uid == uid)
        const allChildren = targetLayer.reduce(
            (acc, e) => [...acc, ...e.moduleIds],
            [],
        )
        const connections = project.instancePool.connections.filter(
            (connection) => {
                return (
                    allChildren.includes(connection.end.moduleId) &&
                    layerModules.includes(connection.start.moduleId)
                )
            },
        )

        return {
            id: uid,
            parentIds: connections.map((connection) =>
                getStartingEntityId(connection),
            ),
        }
    })
    const dag = dagStratify()(data)

    const layout = sugiyama()
        .layering(layeringLongestPath())
        // minimize number of crossings
        .decross(decrossOpt())
        // set node size instead of constraining to fit
        .nodeSize((n) => [
            (n ? 3.6 : 0.25) * 10 * expansionFactor,
            20 * expansionFactor,
        ])

    layout(dag as Dag<never, never>)

    const positions = dag['proots']
        ? dag['proots']
              .reduce((acc, e) => [...acc, extractPosition(e)], [])
              .flat()
        : extractPosition(dag)
    const result: { [k: string]: { x: number; y: number } } = positions.reduce(
        (acc, e) => ({ ...acc, [e.id]: e }),
        {},
    )

    const values = Object.values(result)
    const count = values.length
    const average = values.reduce(
        (acc, e) => ({ x: acc.x + e.x / count, y: acc.y + e.y / count }),
        { x: 0, y: 0 },
    )
    Object.values(result).forEach((p) => {
        p.x = p.x - average.x
        p.y = p.y - average.y
    })
    return Object.entries(result).reduce((acc, [k, v]) => {
        return { ...acc, [k]: new Vector3(v.x, v.y, 0) }
    }, {})
}

export function computeCoordinates(dagData, z = 0) {
    if (dagData.length == 0) {
        return {}
    }
    const dag = dagStratify()(dagData)

    const layout = sugiyama()
        .layering(layeringLongestPath())
        // minimize number of crossings
        .decross(decrossOpt())
        // set node size instead of constraining to fit
        .nodeSize((n) => [
            (n ? 3.6 : 0.25) * 10 * expansionFactor,
            20 * expansionFactor,
        ])

    layout(dag as Dag<never, never>)

    const positions = dag['proots']
        ? dag['proots']
              .reduce((acc, e) => [...acc, extractPosition(e)], [])
              .flat()
        : extractPosition(dag)
    const result: { [k: string]: { x: number; y: number } } = positions.reduce(
        (acc, e) => ({ ...acc, [e.id]: e }),
        {},
    )

    const values = Object.values(result)
    const count = values.length
    const average = values.reduce(
        (acc, e) => ({ x: acc.x + e.x / count, y: acc.y + e.y / count }),
        { x: 0, y: 0 },
    )
    Object.values(result).forEach((p) => {
        p.x = p.x - average.x
        p.y = p.y - average.y
    })
    return Object.entries(result).reduce((acc, [k, v]) => {
        return { ...acc, [k]: new Vector3(v.x, v.y, z) }
    }, {})
}
export function extractPosition(level) {
    const pos = { id: level.data.id, x: level.y, y: level.x }
    const children = level.dataChildren.map((child) => {
        return extractPosition(child.child)
    })
    return [[pos], ...children].flat()
}
