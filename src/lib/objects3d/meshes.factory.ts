import {
    BoxGeometry,
    IcosahedronGeometry,
    Mesh,
    MeshStandardMaterial,
} from 'three'
import { CSS3DObject } from '../renderers'
import { constants } from '../constants'

type Key = string
function key(value) {
    return JSON.stringify(value)
}

export class MeshesFactory {
    static meshStandardMaterials: Map<Key, MeshStandardMaterial> = new Map()
    static icosahedronBufferGeometries: Map<Key, IcosahedronGeometry> =
        new Map()
    static moduleBoxBufferGeometries: Map<Key, BoxGeometry> = new Map()
    static icosahedronMesh(
        {
            color,
            opacity,
            radius,
        }: {
            color: number
            opacity?: number
            radius: number
        },
        { shareMaterial }: { shareMaterial?: boolean },
    ) {
        return new Mesh(
            MeshesFactory.icosahedronBufferGeometry({
                radius: radius,
                detail: 1,
            }),
            MeshesFactory.meshStandardMaterial(
                { color, opacity },
                { shareMaterial },
            ),
        )
    }

    static icosahedronBufferGeometry(
        params: { radius?: number; detail?: number } = {},
    ) {
        const paramsGeom = [params?.radius || 4, params?.detail || 1] // radius, detail
        const keyGeom = key(paramsGeom)
        if (!MeshesFactory.icosahedronBufferGeometries.has(keyGeom)) {
            MeshesFactory.icosahedronBufferGeometries.set(
                keyGeom,
                new IcosahedronGeometry(...paramsGeom),
            )
        }
        return MeshesFactory.icosahedronBufferGeometries.get(keyGeom)
    }

    static meshStandardMaterial(
        params: {
            color?: number
            opacity?: number
            emissiveIntensity?: number
        },
        { shareMaterial }: { shareMaterial?: boolean },
    ) {
        const opacity = params.opacity || 1
        const paramsMat = {
            roughness: 0.2,
            metalness: 0.3,
            color: params.color,
            opacity,
            transparent: opacity != 1,
            emissive: params.color,
            emissiveIntensity: params.emissiveIntensity || 0.2,
            flatShading: true,
        }
        if (!shareMaterial) {
            return new MeshStandardMaterial(paramsMat)
        }
        const keyMat = key(paramsMat)
        if (!MeshesFactory.meshStandardMaterials.has(keyMat)) {
            MeshesFactory.meshStandardMaterials.set(
                keyMat,
                new MeshStandardMaterial(paramsMat),
            )
        }
        return MeshesFactory.meshStandardMaterials.get(keyMat)
    }

    static label(params: {
        text: string
        fontSize?: string
        position?: [number, number, number]
    }) {
        const labelDiv = document.createElement('div')
        labelDiv.className = 'label'
        labelDiv.textContent = params.text
        labelDiv.style.marginTop = '-1em'
        labelDiv.style.fontSize = params?.fontSize || '4px'
        const label = new CSS3DObject(labelDiv)
        label.position.set(...(params?.position || [0, 0, 0]))
        label.layers.set(0)
        return label
    }

    static moduleBox(
        {
            color,
            opacity,
            depth,
        }: {
            color: number
            opacity?: number
            depth?: number
        },
        { shareMaterial }: { shareMaterial?: boolean },
    ) {
        return new Mesh(
            MeshesFactory.moduleBoxBufferGeometry({
                width: constants.moduleWidth,
                height: constants.moduleHeight,
                depth,
            }),
            MeshesFactory.meshStandardMaterial(
                { color, opacity },
                { shareMaterial },
            ),
        )
    }
    static moduleBoxBufferGeometry(
        params: { width?: number; height?: number; depth?: number } = {},
    ) {
        const paramsGeom = [
            params?.width || 4,
            params?.height || 4,
            params.depth || 1,
        ] // radius, detail
        const keyGeom = key(paramsGeom)
        if (!MeshesFactory.moduleBoxBufferGeometries.has(keyGeom)) {
            MeshesFactory.moduleBoxBufferGeometries.set(
                keyGeom,
                new BoxGeometry(...paramsGeom),
            )
        }
        return MeshesFactory.moduleBoxBufferGeometries.get(keyGeom)
    }
}
