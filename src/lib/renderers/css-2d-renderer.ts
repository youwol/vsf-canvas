import { Matrix4, Object3D, Vector3, Scene, Camera } from 'three'

class CSS2DObject extends Object3D {
    public element = document.createElement('div')
    public isCSS2DObject = true
    public position: Vector3 // coming from Object3D
    public layers
    constructor(element = document.createElement('div')) {
        super()
        this.element = element
        this.element.style.position = 'absolute'
        this.element.style.userSelect = 'none'
        this.element.setAttribute('draggable', 'false')
        this.element.classList.add('css-2d-object')
        this['addEventListener']('removed', function () {
            this.traverse(function (object) {
                if (
                    object.element instanceof Element &&
                    object.element.parentNode !== null
                ) {
                    object.element.parentNode.removeChild(object.element)
                }
            })
        })
    }

    copy(source, recursive) {
        super.copy(source, recursive)
        this.element = source.element.cloneNode(true)

        return this
    }
}

//

const _vector = new Vector3()
const _viewMatrix = new Matrix4()
const _viewProjectionMatrix = new Matrix4()
const _a = new Vector3()
const _b = new Vector3()

class CSS2DRenderer {
    public domElement: HTMLElement
    public _width
    public _height
    public _widthHalf
    public _heightHalf
    public cache

    getSize() {
        return {
            width: this._width,
            height: this._height,
        }
    }
    setSize(width, height) {
        this._width = width
        this._height = height

        this._widthHalf = this._width / 2
        this._heightHalf = this._height / 2

        this.domElement.style.width = width + 'px'
        this.domElement.style.height = height + 'px'
    }
    renderObject(object, scene, camera) {
        if (object.isCSS2DObject) {
            _vector.setFromMatrixPosition(object.matrixWorld)
            _vector.applyMatrix4(_viewProjectionMatrix)

            const visible =
                object.visible === true &&
                _vector.z >= -1 &&
                _vector.z <= 1 &&
                object.layers.test(camera.layers) === true
            object.element.style.display = visible === true ? '' : 'none'

            if (visible === true) {
                object.onBeforeRender(this, scene, camera)

                const element = object.element

                element.style.transform =
                    'translate(-50%,-50%) translate(' +
                    (_vector.x * this._widthHalf + this._widthHalf) +
                    'px,' +
                    (-_vector.y * this._heightHalf + this._heightHalf) +
                    'px)'

                if (element.parentNode !== this.domElement) {
                    this.domElement.appendChild(element)
                }

                object.onAfterRender(this, scene, camera)
            }

            const objectData = {
                distanceToCameraSquared: this.getDistanceToSquared(
                    camera,
                    object,
                ),
            }

            this.cache.objects.set(object, objectData)
        }

        for (let i = 0, l = object.children.length; i < l; i++) {
            this.renderObject(object.children[i], scene, camera)
        }
    }

    render(scene: Scene, camera: Camera) {
        if (scene['matrixWorldAutoUpdate'] === true) {
            scene.updateMatrixWorld()
        }
        if (
            camera.parent === null &&
            camera['matrixWorldAutoUpdate'] === true
        ) {
            camera.updateMatrixWorld()
        }

        _viewMatrix.copy(camera.matrixWorldInverse)
        _viewProjectionMatrix.multiplyMatrices(
            camera.projectionMatrix,
            _viewMatrix,
        )

        this.renderObject(scene, scene, camera)
        this.zOrder(scene)
    }

    getDistanceToSquared(object1, object2) {
        _a.setFromMatrixPosition(object1.matrixWorld)
        _b.setFromMatrixPosition(object2.matrixWorld)

        return _a.distanceToSquared(_b)
    }

    zOrder(scene) {
        const sorted = this.filterAndFlatten(scene).sort((a, b) => {
            if (a.renderOrder !== b.renderOrder) {
                return b.renderOrder - a.renderOrder
            }

            const distanceA = this.cache.objects.get(a).distanceToCameraSquared
            const distanceB = this.cache.objects.get(b).distanceToCameraSquared

            return distanceA - distanceB
        })

        const zMax = sorted.length

        for (let i = 0, l = sorted.length; i < l; i++) {
            sorted[i].element.style.zIndex = zMax - i
        }
    }

    filterAndFlatten(scene) {
        const result = []

        scene.traverse(function (object) {
            if (object.isCSS2DObject) {
                result.push(object)
            }
        })

        return result
    }

    constructor(parameters: { element?: HTMLElement } = {}) {
        this.cache = {
            objects: new WeakMap(),
        }

        this.domElement =
            parameters.element !== undefined
                ? parameters.element
                : document.createElement('div')

        this.domElement.style.overflow = 'hidden'
    }
}

export { CSS2DObject, CSS2DRenderer }
