import { Box3, Group, Mesh, Vector3 } from 'three'
import { Modules } from '@youwol/vsf-core'
import { MeshesFactory } from './meshes.factory'

export class ConnectivesObject3d extends Group {
    public readonly inputSlots: { [k: string]: Mesh } = {}
    public readonly outputSlots: { [k: string]: Mesh } = {}

    constructor(params: {
        inputSlots: { [k: string]: Modules.SlotTrait }
        outputSlots: { [k: string]: Modules.SlotTrait }
        supportingGroup: Mesh
        color: number
    }) {
        super()
        params.supportingGroup.geometry.computeBoundingBox()
        const inputs = Object.keys(params.inputSlots)
        const outputs = Object.keys(params.outputSlots)
        const bbox = new Box3()
        bbox.setFromObject(params.supportingGroup)
        const bboxSize = new Vector3()
        bbox.getSize(bboxSize)
        const matParams = { color: params.color, radius: 0.75, opacity: 1 }
        const xPadding = 1
        const yPadding = 1

        const createMeshes = (
            ios: string[],
            x: number,
            dict: { [k: string]: Mesh },
        ) => {
            const delta = (bboxSize.y - yPadding) / ios.length
            return ios.map((slotId, i) => {
                const mesh = MeshesFactory.icosahedronMesh(matParams, {
                    shareMaterial: false,
                })
                mesh.position.x = x
                mesh.position.y = -(i - (ios.length - 1) / 2) * delta
                dict[slotId] = mesh
                return mesh
            })
        }

        const meshesIn = createMeshes(
            inputs,
            bbox.min.x - xPadding,
            this.inputSlots,
        )
        const meshesOut = createMeshes(
            outputs,
            bbox.max.x + xPadding,
            this.outputSlots,
        )
        if (meshesIn.length != 0 || meshesOut.length) {
            this.add(...meshesIn, ...meshesOut)
        }
    }
}
