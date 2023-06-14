import {
    Box3,
    CanvasTexture,
    Group,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    PlaneGeometry,
    Vector3,
} from 'three'
import { FontLoader } from '../loaders/font-loaders'
import { FontGentilis } from '../fonts/gentilis_bold.typeface'
import { createTextWithMaxWidth } from './utils'
import { Projects } from '@youwol/vsf-core'

const fontLoader = new FontLoader(undefined)
const font = fontLoader.parse(FontGentilis)
const macroSvgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<!-- Font Awesome Pro 5.15.4 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) -->
<path fill="midnightblue" d="M416 48v416c0 26.51-21.49 48-48 48H144c-26.51 0-48-21.49-48-48V48c0-26.51 21.49-48 48-48h224c26.51 0 48 21.49 48 48zm96 58v12a6 6 0 0 1-6 6h-18v6a6 6 0 0 1-6 6h-42V88h42a6 6 0 0 1 6 6v6h18a6 6 0 0 1 6 6zm0 96v12a6 6 0 0 1-6 6h-18v6a6 6 0 0 1-6 6h-42v-48h42a6 6 0 0 1 6 6v6h18a6 6 0 0 1 6 6zm0 96v12a6 6 0 0 1-6 6h-18v6a6 6 0 0 1-6 6h-42v-48h42a6 6 0 0 1 6 6v6h18a6 6 0 0 1 6 6zm0 96v12a6 6 0 0 1-6 6h-18v6a6 6 0 0 1-6 6h-42v-48h42a6 6 0 0 1 6 6v6h18a6 6 0 0 1 6 6zM30 376h42v48H30a6 6 0 0 1-6-6v-6H6a6 6 0 0 1-6-6v-12a6 6 0 0 1 6-6h18v-6a6 6 0 0 1 6-6zm0-96h42v48H30a6 6 0 0 1-6-6v-6H6a6 6 0 0 1-6-6v-12a6 6 0 0 1 6-6h18v-6a6 6 0 0 1 6-6zm0-96h42v48H30a6 6 0 0 1-6-6v-6H6a6 6 0 0 1-6-6v-12a6 6 0 0 1 6-6h18v-6a6 6 0 0 1 6-6zm0-96h42v48H30a6 6 0 0 1-6-6v-6H6a6 6 0 0 1-6-6v-12a6 6 0 0 1 6-6h18v-6a6 6 0 0 1 6-6z"/>
</svg>
`
export class HeaderObject3d extends Group {
    public readonly boundingBox = new Box3()
    public readonly bbSize = new Vector3()

    constructor(params: {
        id: string
        type: string
        toolbox: Projects.ToolBox
        padding: number
        width: number
        height: number
    }) {
        super()
        const z = 0.51

        const textMaterial = new MeshBasicMaterial({ color: 0x050505 })
        const width = params.width - 2 * params.padding
        const height = params.height - 2 * params.padding
        const wSnippet = (1 / 3) * params.width - params.padding
        const imgPlane = new PlaneGeometry(0.6 * wSnippet, 0.6 * height)
        if (
            params.toolbox.icon?.svgString ||
            params.toolbox.uid == Projects.ProjectState.macrosToolbox
        ) {
            createSnippetFromSvg({
                imgPlane,
                width,
                wSnippet,
                z,
                svgString: params.toolbox.icon?.svgString || macroSvgString,
                group: this,
                height: params.height,
                textMaterial,
                text: params.toolbox.name,
            })
        } else {
            createSnippetFromText({
                imgPlane,
                width,
                wSnippet,
                z,
                height: params.height,
                textMaterial,
                text: params.toolbox.name,
                group: this,
            })
        }
        const wText = (2 / 3) * params.width - 2 * params.padding
        Array.from([params.id, params.type]).forEach((text, i) => {
            const mesh = createTextWithMaxWidth({
                font,
                material: textMaterial,
                text,
                preferredSize: params.height / 4,
                maxWidth: wText,
            })
            const { size } = getCenterAndSize(mesh)
            mesh.position.x = -width / 6 + params.padding
            mesh.position.y = i == 0 ? size.y / 2 : -height / 2 + params.padding
            mesh.position.z = z
            this.add(mesh)
        })
    }
}

function getCenterAndSize(object: Object3D) {
    const bbox = new Box3()
    bbox.setFromObject(object)
    const center = new Vector3()
    bbox.getCenter(center)
    const size = new Vector3()
    bbox.getSize(size)
    return { size, center }
}

function createSnippetFromSvg({
    imgPlane,
    width,
    wSnippet,
    z,
    svgString,
    group,
    text,
    textMaterial,
    height,
}) {
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 100
    const context = canvas.getContext('2d')
    const image = new Image()
    image.src =
        'data:image/svg+xml;base64,' +
        btoa(unescape(encodeURIComponent(svgString)))

    image.onload = () => {
        // Draw the image onto the canvas
        context.drawImage(image, 0, 0)

        // Create a canvas texture
        const texture = new CanvasTexture(canvas)

        // Add the mesh to the scene
        const objectThumbnail = new Mesh(
            imgPlane,
            new MeshBasicMaterial({
                map: texture,
                transparent: true,
            }),
        )
        objectThumbnail.userData.originalMaterial = {
            transparent: true,
        }
        objectThumbnail.rotation.z = 0
        objectThumbnail.position.x = -width / 6 - wSnippet / 2
        objectThumbnail.position.z = z
        const toolboxMesh = createTextWithMaxWidth({
            font,
            material: textMaterial,
            text,
            preferredSize: height / 6,
            maxWidth: wSnippet,
        })
        const { size, center } = getCenterAndSize(toolboxMesh)
        toolboxMesh.position.copy(center).negate()
        const thumbnailCenter = getCenterAndSize(objectThumbnail).center
        toolboxMesh.position.z = z + 0.1
        toolboxMesh.position.x = thumbnailCenter.x - size.x / 2
        toolboxMesh.position.y = -height / 2 + height / 12
        group.add(objectThumbnail, toolboxMesh)
    }
}

function createSnippetFromText({
    imgPlane,
    width,
    height,
    wSnippet,
    z,
    text,
    textMaterial,
    group,
}) {
    const objectThumbnail = new Mesh(
        imgPlane,
        new MeshBasicMaterial({
            color: 0xa5a5a5,
        }),
    )
    const toolboxMesh = createTextWithMaxWidth({
        font,
        material: textMaterial,
        text,
        preferredSize: height / 4,
        maxWidth: wSnippet,
    })
    objectThumbnail.rotation.z = 0
    objectThumbnail.position.x = -width / 6 - wSnippet / 2
    objectThumbnail.position.z = z
    toolboxMesh.position.z = z + 0.1
    toolboxMesh.position.x = -width / 6 - wSnippet
    group.add(objectThumbnail, toolboxMesh)
}
