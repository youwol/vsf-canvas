import {
    EventDispatcher,
    MOUSE,
    Quaternion,
    Spherical,
    TOUCH,
    Vector2,
    Vector3,
} from 'three'
import { Environment3D } from '../environment3d'

// OrbitControls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

const _changeEvent = { type: 'change' }
const _startEvent = { type: 'start' }
const _endEvent = { type: 'end' }

const STATE = {
    NONE: -1,
    ROTATE: 0,
    DOLLY: 1,
    PAN: 2,
    TOUCH_ROTATE: 3,
    TOUCH_PAN: 4,
    TOUCH_DOLLY_PAN: 5,
    TOUCH_DOLLY_ROTATE: 6,
}

class MouseControls extends EventDispatcher {
    camera
    state
    domElement: HTMLElement
    environment: Environment3D
    enabled: boolean
    target: Vector3
    minDistance: number
    maxDistance: number
    minZoom: number
    maxZoom: number
    minPolarAngle: number
    maxPolarAngle: number
    minAzimuthAngle: number
    maxAzimuthAngle: number
    enableDamping = false
    dampingFactor = 0.05

    // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
    // Set to false to disable zooming
    enableZoom = true
    zoomSpeed = 1.0

    // Set to false to disable rotating
    enableRotate = true
    rotateSpeed = 1.0

    // Set to false to disable panning
    enablePan = true
    panSpeed = 1.0
    screenSpacePanning = true // if false, pan orthogonal to world-space direction camera.up
    keyPanSpeed = 7.0 // pixels moved per arrow key push

    // Set to true to automatically rotate around the target
    // If auto-rotate is enabled, you must call controls.update() in your animation loop
    autoRotate = false
    autoRotateSpeed = 2.0 // 30 seconds per orbit when fps is 60

    // The four arrow keys
    keys = {
        LEFT: 'ArrowLeft',
        UP: 'ArrowUp',
        RIGHT: 'ArrowRight',
        BOTTOM: 'ArrowDown',
    }

    // Mouse buttons
    mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }

    // Touch fingers
    touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }

    // for reset
    target0
    position0
    zoom0

    // the target DOM element for key events
    _domElementKeyEvents: HTMLElement = null

    getPolarAngle
    getAzimuthalAngle
    getDistance
    listenToKeyEvents
    stopListenToKeyEvents
    saveState
    reset

    rotateStart = new Vector2()
    rotateEnd = new Vector2()
    rotateDelta = new Vector2()

    panStart = new Vector2()
    panEnd = new Vector2()
    panDelta = new Vector2()

    dollyStart = new Vector2()
    dollyEnd = new Vector2()
    dollyDelta = new Vector2()

    onKeyDownCb
    onContextMenuCb
    onPointerDownCb
    onMouseWheelCb
    onPointerMoveCb
    onPointerUpCb

    EPS = 0.000001

    // current position in spherical coordinates
    spherical = new Spherical()
    sphericalDelta = new Spherical()

    scale = 1
    panOffset = new Vector3()
    zoomChanged = false

    pointers = []
    pointerPositions = {}

    constructor(params: {
        camera
        domElement: HTMLElement
        environment: Environment3D
    }) {
        super()
        Object.assign(this, params)
        this.state = STATE.NONE
        this.domElement.style.touchAction = 'none' // disable touch scroll

        // Set to false to disable this control
        this.enabled = true

        // "target" sets the location of focus, where the object orbits around
        this.target = new Vector3()

        // How far you can dolly in and out ( PerspectiveCamera only )
        this.minDistance = 0
        this.maxDistance = Infinity

        // How far you can zoom in and out ( OrthographicCamera only )
        this.minZoom = 0
        this.maxZoom = Infinity

        // How far you can orbit vertically, upper and lower limits.
        // Range is 0 to Math.PI radians.
        this.minPolarAngle = 0 // radians
        this.maxPolarAngle = Math.PI // radians

        // How far you can orbit horizontally, upper and lower limits.
        // If set, the interval [ min, max ] must be a sub-interval of [ - 2 PI, 2 PI ], with ( max - min < 2 PI )
        this.minAzimuthAngle = -Infinity // radians
        this.maxAzimuthAngle = Infinity // radians

        // Set to true to enable damping (inertia)
        // If damping is enabled, you must call controls.update() in your animation loop
        this.enableDamping = false
        this.dampingFactor = 0.05

        // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
        // Set to false to disable zooming
        this.enableZoom = true
        this.zoomSpeed = 1.0

        // Set to false to disable rotating
        this.enableRotate = true
        this.rotateSpeed = 1.0

        // Set to false to disable panning
        this.enablePan = true
        this.panSpeed = 1.0
        this.screenSpacePanning = true // if false, pan orthogonal to world-space direction camera.up
        this.keyPanSpeed = 7.0 // pixels moved per arrow key push

        // Set to true to automatically rotate around the target
        // If auto-rotate is enabled, you must call controls.update() in your animation loop
        this.autoRotate = false
        this.autoRotateSpeed = 2.0 // 30 seconds per orbit when fps is 60

        // The four arrow keys
        this.keys = {
            LEFT: 'ArrowLeft',
            UP: 'ArrowUp',
            RIGHT: 'ArrowRight',
            BOTTOM: 'ArrowDown',
        }

        // Mouse buttons
        this.mouseButtons = {
            LEFT: MOUSE.ROTATE,
            MIDDLE: MOUSE.DOLLY,
            RIGHT: MOUSE.PAN,
        }

        // Touch fingers
        this.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }

        // for reset
        this.target0 = this.target.clone()
        this.position0 = this.camera.position.clone()
        this.zoom0 = this.camera.zoom

        // the target DOM element for key events
        this._domElementKeyEvents = null

        //
        // public methods
        //

        this.getPolarAngle = function () {
            return this.spherical.phi
        }

        this.getAzimuthalAngle = function () {
            return this.spherical.theta
        }

        this.getDistance = function () {
            return this.camera.position.distanceTo(this.target)
        }

        this.onKeyDownCb = (ev) => this.onKeyDown(ev)
        this.listenToKeyEvents = function (domElement) {
            domElement.addEventListener('keydown', this.onKeyDownCb)
            this._domElementKeyEvents = domElement
        }

        this.stopListenToKeyEvents = function () {
            this._domElementKeyEvents.removeEventListener(
                'keydown',
                this.onKeydownCb,
            )
            this._domElementKeyEvents = null
        }

        this.saveState = () => {
            this.target0.copy(this.target)
            this.position0.copy(this.camera.position)
            this.zoom0 = this.camera.zoom
        }

        this.reset = () => {
            this.target.copy(this.target0)
            this.camera.position.copy(this.position0)
            this.camera.zoom = this.zoom0

            this.camera.updateProjectionMatrix()
            this.dispatchEvent(_changeEvent)

            this.update()

            this.state = STATE.NONE
        }

        //
        // internals
        //

        //
        // event callbacks - update the object state
        //
        this.onPointerDownCb = (ev) => this.onPointerDown(ev)
        this.onPointerUpCb = (ev) => this.onPointerUp(ev)
        this.onMouseWheelCb = (ev) => this.onMouseWheel(ev)
        this.domElement.addEventListener('pointerdown', this.onPointerDownCb)
        this.domElement.addEventListener('pointercancel', this.onPointerUpCb)

        this.domElement.addEventListener('wheel', this.onMouseWheelCb, {
            passive: false,
        })
        this.onPointerMoveCb = (ev) => this.onPointerMove(ev)
        // force an update at start

        this.update()
    }

    vPanLeft = new Vector3()
    panLeft(distance, objectMatrix) {
        this.vPanLeft.setFromMatrixColumn(objectMatrix, 0) // get X column of objectMatrix
        this.vPanLeft.multiplyScalar(-distance)

        this.panOffset.add(this.vPanLeft)
    }

    vPanUp = new Vector3()
    panUp(distance, objectMatrix) {
        if (this.screenSpacePanning === true) {
            this.vPanUp.setFromMatrixColumn(objectMatrix, 1)
        } else {
            this.vPanUp.setFromMatrixColumn(objectMatrix, 0)
            this.vPanUp.crossVectors(this.camera.up, this.vPanUp)
        }

        this.vPanUp.multiplyScalar(distance)

        this.panOffset.add(this.vPanUp)
    }

    offsetPan = new Vector3()
    pan(deltaX, deltaY) {
        const element = this.domElement

        if (this.camera.isPerspectiveCamera) {
            // perspective
            const position = this.camera.position
            this.offsetPan.copy(position).sub(this.target)
            let targetDistance = this.offsetPan.length()

            // half of the fov is center to top of screen
            targetDistance *= Math.tan(
                ((this.camera.fov / 2) * Math.PI) / 180.0,
            )

            // we use only clientHeight here so aspect ratio does not distort speed
            this.panLeft(
                (2 * deltaX * targetDistance) / element.clientHeight,
                this.camera.matrix,
            )
            this.panUp(
                (2 * deltaY * targetDistance) / element.clientHeight,
                this.camera.matrix,
            )
        } else if (this.camera.isOrthographicCamera) {
            // orthographic
            this.panLeft(
                (deltaX * (this.camera.right - this.camera.left)) /
                    this.camera.zoom /
                    element.clientWidth,
                this.camera.matrix,
            )
            this.panUp(
                (deltaY * (this.camera.top - this.camera.bottom)) /
                    this.camera.zoom /
                    element.clientHeight,
                this.camera.matrix,
            )
        } else {
            // camera neither orthographic nor perspective
            console.warn(
                'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.',
            )
            this.enablePan = false
        }
    }
    update() {
        const offset = new Vector3()

        // so camera.up is the orbit axis
        const quat = new Quaternion().setFromUnitVectors(
            this.camera.up,
            new Vector3(0, 1, 0),
        )
        const quatInverse = quat.clone().invert()

        const lastPosition = new Vector3()
        const lastQuaternion = new Quaternion()

        const twoPI = 2 * Math.PI

        return (() => {
            const position = this.camera.position

            offset.copy(position).sub(this.target)

            // rotate offset to "y-axis-is-up" space
            offset.applyQuaternion(quat)

            // angle from z-axis around y-axis
            this.spherical.setFromVector3(offset)

            if (this.autoRotate && this.state === STATE.NONE) {
                this.rotateLeft(this.getAutoRotationAngle())
            }

            if (this.enableDamping) {
                this.spherical.theta +=
                    this.sphericalDelta.theta * this.dampingFactor
                this.spherical.phi +=
                    this.sphericalDelta.phi * this.dampingFactor
            } else {
                this.spherical.theta += this.sphericalDelta.theta
                this.spherical.phi += this.sphericalDelta.phi
            }

            // restrict theta to be between desired limits

            let min = this.minAzimuthAngle
            let max = this.maxAzimuthAngle

            if (isFinite(min) && isFinite(max)) {
                if (min < -Math.PI) {
                    min += twoPI
                } else if (min > Math.PI) {
                    min -= twoPI
                }

                if (max < -Math.PI) {
                    max += twoPI
                } else if (max > Math.PI) {
                    max -= twoPI
                }

                if (min <= max) {
                    this.spherical.theta = Math.max(
                        min,
                        Math.min(max, this.spherical.theta),
                    )
                } else {
                    this.spherical.theta =
                        this.spherical.theta > (min + max) / 2
                            ? Math.max(min, this.spherical.theta)
                            : Math.min(max, this.spherical.theta)
                }
            }

            // restrict phi to be between desired limits
            this.spherical.phi = Math.max(
                this.minPolarAngle,
                Math.min(this.maxPolarAngle, this.spherical.phi),
            )

            this.spherical.makeSafe()

            this.spherical.radius *= this.scale

            // restrict radius to be between desired limits
            this.spherical.radius = Math.max(
                this.minDistance,
                Math.min(this.maxDistance, this.spherical.radius),
            )

            // move target to panned location

            if (this.enableDamping === true) {
                this.target.addScaledVector(this.panOffset, this.dampingFactor)
            } else {
                this.target.add(this.panOffset)
            }

            offset.setFromSpherical(this.spherical)

            // rotate offset back to "camera-up-vector-is-up" space
            offset.applyQuaternion(quatInverse)

            position.copy(this.target).add(offset)

            this.camera.lookAt(this.target)

            if (this.enableDamping === true) {
                this.sphericalDelta.theta *= 1 - this.dampingFactor
                this.sphericalDelta.phi *= 1 - this.dampingFactor

                this.panOffset.multiplyScalar(1 - this.dampingFactor)
            } else {
                this.sphericalDelta.set(0, 0, 0)

                this.panOffset.set(0, 0, 0)
            }

            this.scale = 1

            // update condition is:
            // min(camera displacement, camera rotation in radians)^2 > EPS
            // using small-angle approximation cos(x/2) = 1 - x^2 / 8

            if (
                this.zoomChanged ||
                lastPosition.distanceToSquared(this.camera.position) >
                    this.EPS ||
                8 * (1 - lastQuaternion.dot(this.camera.quaternion)) > this.EPS
            ) {
                this.dispatchEvent(_changeEvent)

                lastPosition.copy(this.camera.position)
                lastQuaternion.copy(this.camera.quaternion)
                this.zoomChanged = false

                return true
            }

            return false
        })()
    }

    onMouseWheel(event) {
        const handleMouseWheel = (event) => {
            if (event.ctrlKey && event.deltaY < 0) {
                this.environment.scene.fog['far'] *= 1.01
                return
            }
            if (event.ctrlKey && event.deltaY > 0) {
                this.environment.scene.fog['far'] *= 0.99
                if (
                    this.environment.scene.fog['far'] -
                        this.environment.scene.fog['near'] <
                    50
                ) {
                    this.environment.scene.fog['far'] =
                        this.environment.scene.fog['near'] + 50
                }
                return
            }
            if (event.deltaY < 0) {
                this.dollyIn(this.getZoomScale())
            } else if (event.deltaY > 0) {
                this.dollyOut(this.getZoomScale())
            }
            const deltaFog =
                this.environment.scene.fog['far'] -
                this.environment.scene.fog['near']
            this.environment.scene.fog['near'] = this.camera.position.z
            this.environment.scene.fog['far'] =
                this.camera.position.z + deltaFog
            this.update()
        }

        if (
            this.enabled === false ||
            this.enableZoom === false ||
            this.state !== STATE.NONE
        ) {
            return
        }

        event.preventDefault()

        this.dispatchEvent(_startEvent)

        handleMouseWheel(event)

        this.dispatchEvent(_endEvent)
    }

    dollyOut(dollyScale) {
        if (this.camera.isPerspectiveCamera) {
            this.scale /= dollyScale
        } else if (this.camera.isOrthographicCamera) {
            this.camera.zoom = Math.max(
                this.minZoom,
                Math.min(this.maxZoom, this.camera.zoom * dollyScale),
            )
            this.camera.updateProjectionMatrix()
            this.zoomChanged = true
        } else {
            console.warn(
                'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.',
            )
            this.enableZoom = false
        }
    }

    dollyIn(dollyScale) {
        if (this.camera.isPerspectiveCamera) {
            this.scale *= dollyScale
        } else if (this.camera.isOrthographicCamera) {
            this.camera.zoom = Math.max(
                this.minZoom,
                Math.min(this.maxZoom, this.camera.zoom / dollyScale),
            )
            this.camera.updateProjectionMatrix()
            this.zoomChanged = true
        } else {
            console.warn(
                'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.',
            )
            this.enableZoom = false
        }
    }
    getZoomScale() {
        return Math.pow(0.95, this.zoomSpeed)
    }

    handleMouseDownRotate(event) {
        this.rotateStart.set(event.clientX, event.clientY)
    }

    handleMouseDownDolly(event) {
        this.dollyStart.set(event.clientX, event.clientY)
    }

    handleMouseDownPan(event) {
        this.panStart.set(event.clientX, event.clientY)
    }

    handleMouseMoveRotate(event) {
        this.rotateEnd.set(event.clientX, event.clientY)

        this.rotateDelta
            .subVectors(this.rotateEnd, this.rotateStart)
            .multiplyScalar(this.rotateSpeed)

        const element = this.domElement

        this.rotateLeft(
            (2 * Math.PI * this.rotateDelta.x) / element.clientHeight,
        ) // yes, height

        this.rotateUp((2 * Math.PI * this.rotateDelta.y) / element.clientHeight)

        this.rotateStart.copy(this.rotateEnd)

        this.update()
    }

    handleMouseMoveDolly(event) {
        this.dollyEnd.set(event.clientX, event.clientY)

        this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart)

        if (this.dollyDelta.y > 0) {
            this.dollyOut(this.getZoomScale())
        } else if (this.dollyDelta.y < 0) {
            this.dollyIn(this.getZoomScale())
        }

        this.dollyStart.copy(this.dollyEnd)
        this.update()
    }

    handleMouseMovePan(event) {
        this.panEnd.set(event.clientX, event.clientY)

        this.panDelta
            .subVectors(this.panEnd, this.panStart)
            .multiplyScalar(this.panSpeed)

        this.pan(this.panDelta.x, this.panDelta.y)

        this.panStart.copy(this.panEnd)

        this.update()
    }

    handleKeyDown(event) {
        let needsUpdate = false

        switch (event.code) {
            case this.keys.UP:
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    this.rotateUp(
                        (2 * Math.PI * this.rotateSpeed) /
                            this.domElement.clientHeight,
                    )
                } else {
                    this.pan(0, this.keyPanSpeed)
                }

                needsUpdate = true
                break

            case this.keys.BOTTOM:
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    this.rotateUp(
                        (-2 * Math.PI * this.rotateSpeed) /
                            this.domElement.clientHeight,
                    )
                } else {
                    this.pan(0, -this.keyPanSpeed)
                }

                needsUpdate = true
                break

            case this.keys.LEFT:
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    this.rotateLeft(
                        (2 * Math.PI * this.rotateSpeed) /
                            this.domElement.clientHeight,
                    )
                } else {
                    this.pan(this.keyPanSpeed, 0)
                }

                needsUpdate = true
                break

            case this.keys.RIGHT:
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    this.rotateLeft(
                        (-2 * Math.PI * this.rotateSpeed) /
                            this.domElement.clientHeight,
                    )
                } else {
                    this.pan(-this.keyPanSpeed, 0)
                }

                needsUpdate = true
                break
        }

        if (needsUpdate) {
            // prevent the browser from scrolling on cursor keys
            event.preventDefault()

            this.update()
        }
    }

    //
    // event handlers - FSM: listen for events and reset state
    //

    onPointerDown(event) {
        if (this.enabled === false) {
            return
        }

        if (this.pointers.length === 0) {
            //this.domElement.setPointerCapture(event.pointerId)

            this.domElement.addEventListener(
                'pointermove',
                this.onPointerMoveCb,
            )
            this.domElement.addEventListener('pointerup', this.onPointerUpCb)
        }
        this.addPointer(event)
        this.onMouseDown(event)
    }

    onPointerMove(event) {
        if (this.enabled === false) {
            return
        }

        this.onMouseMove(event)
    }

    onPointerUp(event) {
        this.removePointer(event)

        if (this.pointers.length === 0) {
            this.domElement.releasePointerCapture(event.pointerId)

            this.domElement.removeEventListener(
                'pointermove',
                this.onPointerMoveCb,
            )
            this.domElement.removeEventListener('pointerup', this.onPointerUpCb)
        }

        this.dispatchEvent(_endEvent)

        this.state = STATE.NONE
    }

    onMouseDown(event) {
        let mouseAction

        switch (event.button) {
            case 0:
                mouseAction = this.mouseButtons.LEFT
                break

            case 1:
                mouseAction = this.mouseButtons.MIDDLE
                break

            case 2:
                mouseAction = this.mouseButtons.RIGHT
                break

            default:
                mouseAction = -1
        }
        switch (mouseAction) {
            case MOUSE.DOLLY:
                if (this.enableZoom === false) {
                    return
                }

                this.handleMouseDownDolly(event)

                this.state = STATE.DOLLY

                break

            case MOUSE.ROTATE:
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    if (this.enablePan === false) {
                        return
                    }

                    this.handleMouseDownPan(event)

                    this.state = STATE.PAN
                } else {
                    if (this.enableRotate === false) {
                        return
                    }

                    this.handleMouseDownRotate(event)

                    this.state = STATE.ROTATE
                }

                break

            case MOUSE.PAN:
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    if (this.enableRotate === false) {
                        return
                    }

                    this.handleMouseDownRotate(event)

                    this.state = STATE.ROTATE
                } else {
                    if (this.enablePan === false) {
                        return
                    }

                    this.handleMouseDownPan(event)

                    this.state = STATE.PAN
                }

                break

            default:
                this.state = STATE.NONE
        }

        if (this.state !== STATE.NONE) {
            this.dispatchEvent(_startEvent)
        }
    }

    onMouseMove(event) {
        switch (this.state) {
            case STATE.ROTATE:
                if (this.enableRotate === false) {
                    return
                }

                this.handleMouseMoveRotate(event)

                break

            case STATE.DOLLY:
                if (this.enableZoom === false) {
                    return
                }

                this.handleMouseMoveDolly(event)

                break

            case STATE.PAN:
                if (this.enablePan === false) {
                    return
                }

                this.handleMouseMovePan(event)

                break
        }
    }

    onKeyDown(event) {
        if (this.enabled === false || this.enablePan === false) {
            return
        }

        this.handleKeyDown(event)
    }

    getAutoRotationAngle() {
        return ((2 * Math.PI) / 60 / 60) * this.autoRotateSpeed
    }

    rotateLeft(angle) {
        this.sphericalDelta.theta -= angle
    }

    rotateUp(angle) {
        this.sphericalDelta.phi -= angle
    }

    addPointer(event) {
        this.pointers.push(event)
    }

    removePointer(event) {
        delete this.pointerPositions[event.pointerId]

        for (let i = 0; i < this.pointers.length; i++) {
            if (this.pointers[i].pointerId == event.pointerId) {
                this.pointers.splice(i, 1)
                return
            }
        }
    }

    trackPointer(event) {
        let position = this.pointerPositions[event.pointerId]

        if (position === undefined) {
            position = new Vector2()
            this.pointerPositions[event.pointerId] = position
        }

        position.set(event.pageX, event.pageY)
    }

    getSecondPointerPosition(event) {
        const pointer =
            event.pointerId === this.pointers[0].pointerId
                ? this.pointers[1]
                : this.pointers[0]

        return this.pointerPositions[pointer.pointerId]
    }
    dispose() {
        this.domElement.removeEventListener('contextmenu', this.onContextMenuCb)

        this.domElement.removeEventListener('pointerdown', this.onPointerDownCb)
        this.domElement.removeEventListener('pointercancel', this.onPointerUpCb)
        this.domElement.removeEventListener('wheel', this.onMouseWheelCb)

        this.domElement.removeEventListener('pointermove', this.onPointerMoveCb)
        this.domElement.removeEventListener('pointerup', this.onPointerUpCb)

        if (this._domElementKeyEvents !== null) {
            this._domElementKeyEvents.removeEventListener(
                'keydown',
                this.onKeyDownCb,
            )
            this._domElementKeyEvents = null
        }

        //scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?
    }
}

export { MouseControls }
