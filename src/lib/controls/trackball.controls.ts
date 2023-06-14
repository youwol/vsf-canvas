/**
 * !! This version has been patched manually, regarding catching event from the renderer !!
 *
 * @author Eberhard Graether / http://egraether.com/
 * @author Mark Lundin 	/ http://mark-lundin.com
 * @author Simone Manini / http://daron1337.github.io
 * @author Luca Antiga 	/ http://lantiga.github.io

 ** three-trackballcontrols module
 ** @author Jon Lim / http://jonlim.ca
 */
import * as THREE from 'three'
const STATE = {
    NONE: -1,
    ROTATE: 0,
    ZOOM: 1,
    PAN: 2,
    TOUCH_ROTATE: 3,
    TOUCH_ZOOM_PAN: 4,
}

export class TrackballControls extends THREE.EventDispatcher {
    public object
    public domElement: HTMLElement | HTMLDocument
    public enabled = true
    public screen = { left: 0, top: 0, width: 0, height: 0 }

    public rotateSpeed = 1.5
    public zoomSpeed = 1.2
    public panSpeed = 0.3

    public noRotate = false
    public noZoom = false
    public noPan = false

    public staticMoving = false
    public dynamicDampingFactor = 0.2

    public minDistance = 0
    public maxDistance = Infinity

    /**
     * `KeyboardEvent.keyCode` values which should trigger the different
     * interaction states. Each element can be a single code or an array
     * of codes. All elements are required.
     */
    public keys = [65 /*A*/, 83 /*S*/, 68 /*D*/]

    // internals

    public target = new THREE.Vector3()

    public readonly EPS = 0.000001

    public lastPosition = new THREE.Vector3()

    _state = STATE.NONE
    _prevState = STATE.NONE

    _eye = new THREE.Vector3()
    _movePrev = new THREE.Vector2()
    _moveCurr = new THREE.Vector2()
    _lastAxis = new THREE.Vector3()
    _zoomStart = new THREE.Vector2()
    _zoomEnd = new THREE.Vector2()
    _panStart = new THREE.Vector2()
    _panEnd = new THREE.Vector2()

    _lastAngle = 0
    _touchZoomDistanceStart = 0
    _touchZoomDistanceEnd = 0

    // events

    changeEvent = { type: 'change' }
    startEvent = { type: 'start' }
    endEvent = { type: 'end' }

    target0: THREE.Vector3
    position0: THREE.Vector3
    up0: THREE.Vector3

    rotateCamera
    panCamera
    getMouseOnScreen
    getMouseOnCircle

    contextmenuCb: (ev) => void
    mousedownCb: (ev) => void
    mouseupCb: (ev) => void
    mousemoveCb: (ev) => void
    mousewheelCb: (ev) => void
    touchstartCb: (ev) => void
    touchendCb: (ev) => void
    touchmoveCb: (ev) => void
    keyupCb: (ev) => void
    keydownCb: (ev) => void

    constructor(object: THREE.Camera, domElement: HTMLElement) {
        super()
        this.object = object
        this.domElement = domElement !== undefined ? domElement : document
        this.target0 = this.target.clone()
        this.position0 = this.object.position.clone()
        this.up0 = this.object.up.clone()

        this.rotateCamera = this._rotateCamera()
        this.panCamera = this._panCamera()
        this.getMouseOnCircle = this._getMouseOnCircle()
        this.getMouseOnScreen = this._getMouseOnScreen()

        this.contextmenuCb = (ev) => this.contextmenu(ev)
        this.mousedownCb = (ev) => this.mousedown(ev)
        this.mousemoveCb = (ev) => this.mousemove(ev)
        this.mouseupCb = (ev) => this.mouseup(ev)
        this.mousewheelCb = (ev) => this.mousewheel(ev)
        this.touchstartCb = (ev) => this.touchstart(ev)
        this.touchendCb = (ev) => this.touchend(ev)
        this.touchmoveCb = (ev) => this.touchmove(ev)
        this.keydownCb = (ev) => this.keydown(ev)
        this.keyupCb = () => this.keyup()
        this.domElement.addEventListener(
            'contextmenu',
            this.contextmenuCb,
            false,
        )
        this.domElement.addEventListener('mousedown', this.mousedownCb, false)
        //this.domElement.onmousedown = (ev) => this.mousedown(ev)
        this.domElement.addEventListener('wheel', this.mousewheelCb, false)

        this.domElement.addEventListener('touchstart', this.touchstartCb, false)
        this.domElement.addEventListener('touchend', this.touchendCb, false)
        this.domElement.addEventListener('touchmove', this.touchmoveCb, false)

        window.addEventListener('keydown', this.keydownCb, false)
        window.addEventListener('keyup', this.keyupCb, false)

        this.handleResize()

        // force an update at start
        this.update()
    }

    _rotateCamera() {
        const axis = new THREE.Vector3(),
            quaternion = new THREE.Quaternion(),
            eyeDirection = new THREE.Vector3(),
            objectUpDirection = new THREE.Vector3(),
            objectSidewaysDirection = new THREE.Vector3(),
            moveDirection = new THREE.Vector3()
        let angle

        return () => {
            moveDirection.set(
                this._moveCurr.x - this._movePrev.x,
                this._moveCurr.y - this._movePrev.y,
                0,
            )
            angle = moveDirection.length()

            if (angle) {
                this._eye.copy(this.object.position).sub(this.target)

                eyeDirection.copy(this._eye).normalize()
                objectUpDirection.copy(this.object.up).normalize()
                objectSidewaysDirection
                    .crossVectors(objectUpDirection, eyeDirection)
                    .normalize()

                objectUpDirection.setLength(this._moveCurr.y - this._movePrev.y)
                objectSidewaysDirection.setLength(
                    this._moveCurr.x - this._movePrev.x,
                )

                moveDirection.copy(
                    objectUpDirection.add(objectSidewaysDirection),
                )

                axis.crossVectors(moveDirection, this._eye).normalize()

                angle *= this.rotateSpeed
                quaternion.setFromAxisAngle(axis, angle)

                this._eye.applyQuaternion(quaternion)
                this.object.up.applyQuaternion(quaternion)

                this._lastAxis.copy(axis)
                this._lastAngle = angle
            } else if (!this.staticMoving && this._lastAngle) {
                this._lastAngle *= Math.sqrt(1.0 - this.dynamicDampingFactor)
                this._eye.copy(this.object.position).sub(this.target)
                quaternion.setFromAxisAngle(this._lastAxis, this._lastAngle)
                this._eye.applyQuaternion(quaternion)
                this.object.up.applyQuaternion(quaternion)
            }

            this._movePrev.copy(this._moveCurr)
        }
    }

    zoomCamera() {
        let factor

        if (this._state === STATE.TOUCH_ZOOM_PAN) {
            factor = this._touchZoomDistanceStart / this._touchZoomDistanceEnd
            this._touchZoomDistanceStart = this._touchZoomDistanceEnd
            this._eye.multiplyScalar(factor)
        } else {
            factor =
                1.0 + (this._zoomEnd.y - this._zoomStart.y) * this.zoomSpeed

            if (factor !== 1.0 && factor > 0.0) {
                this._eye.multiplyScalar(factor)
            }

            if (this.staticMoving) {
                this._zoomStart.copy(this._zoomEnd)
            } else {
                this._zoomStart.y +=
                    (this._zoomEnd.y - this._zoomStart.y) *
                    this.dynamicDampingFactor
            }
        }
    }

    _panCamera() {
        const mouseChange = new THREE.Vector2(),
            objectUp = new THREE.Vector3(),
            pan = new THREE.Vector3()

        return () => {
            mouseChange.copy(this._panEnd).sub(this._panStart)

            if (mouseChange.lengthSq()) {
                mouseChange.multiplyScalar(this._eye.length() * this.panSpeed)

                pan.copy(this._eye)
                    .cross(this.object.up)
                    .setLength(mouseChange.x)
                pan.add(objectUp.copy(this.object.up).setLength(mouseChange.y))

                this.object.position.add(pan)
                this.target.add(pan)

                if (this.staticMoving) {
                    this._panStart.copy(this._panEnd)
                } else {
                    this._panStart.add(
                        mouseChange
                            .subVectors(this._panEnd, this._panStart)
                            .multiplyScalar(this.dynamicDampingFactor),
                    )
                }
            }
        }
    }

    _getMouseOnCircle() {
        const vector = new THREE.Vector2()

        return (pageX, pageY) => {
            vector.set(
                (pageX - this.screen.width * 0.5 - this.screen.left) /
                    (this.screen.width * 0.5),
                (this.screen.height + 2 * (this.screen.top - pageY)) /
                    this.screen.width, // screen.width intentional
            )

            return vector
        }
    }

    _getMouseOnScreen() {
        const vector = new THREE.Vector2()

        return (pageX, pageY) => {
            vector.set(
                (pageX - this.screen.left) / this.screen.width,
                (pageY - this.screen.top) / this.screen.height,
            )

            return vector
        }
    }

    handleResize() {
        if (this.domElement instanceof HTMLDocument) {
            this.screen.left = 0
            this.screen.top = 0
            this.screen.width = window.innerWidth
            this.screen.height = window.innerHeight
        } else {
            const box = this.domElement.getBoundingClientRect()
            // adjustments come from similar code in the jquery offset() function
            const d = this.domElement.ownerDocument.documentElement
            this.screen.left = box.left + window.pageXOffset - d.clientLeft
            this.screen.top = box.top + window.pageYOffset - d.clientTop
            this.screen.width = box.width
            this.screen.height = box.height
        }
    }

    handleEvent(event) {
        if (typeof this[event.type] == 'function') {
            this[event.type](event)
        }
    }

    checkDistances() {
        if (!this.noZoom || !this.noPan) {
            if (this._eye.lengthSq() > this.maxDistance * this.maxDistance) {
                this.object.position.addVectors(
                    this.target,
                    this._eye.setLength(this.maxDistance),
                )
                this._zoomStart.copy(this._zoomEnd)
            }

            if (this._eye.lengthSq() < this.minDistance * this.minDistance) {
                this.object.position.addVectors(
                    this.target,
                    this._eye.setLength(this.minDistance),
                )
                this._zoomStart.copy(this._zoomEnd)
            }
        }
    }

    update() {
        this._eye.subVectors(this.object.position, this.target)

        if (!this.noRotate) {
            this.rotateCamera()
        }

        if (!this.noZoom) {
            this.zoomCamera()
        }

        if (!this.noPan) {
            this.panCamera()
        }

        this.object.position.addVectors(this.target, this._eye)

        this.checkDistances()

        this.object.lookAt(this.target)

        if (
            this.lastPosition.distanceToSquared(this.object.position) > this.EPS
        ) {
            this.dispatchEvent(this.changeEvent)

            this.lastPosition.copy(this.object.position)
        }
    }

    reset() {
        this._state = STATE.NONE
        this._prevState = STATE.NONE

        this.target.copy(this.target0)
        this.object.position.copy(this.position0)
        this.object.up.copy(this.up0)

        this._eye.subVectors(this.object.position, this.target)

        this.object.lookAt(this.target)

        this.dispatchEvent(this.changeEvent)

        this.lastPosition.copy(this.object.position)
    }

    containsKey(keys, key) {
        if (Array.isArray(keys)) {
            return keys.indexOf(key) !== -1
        } else {
            return keys === key
        }
    }

    // listeners

    keydown(event) {
        if (this.enabled === false) {
            return
        }

        window.removeEventListener('keydown', this.keydownCb)

        this._prevState = this._state

        if (this._state !== STATE.NONE) {
            return
        } else if (
            this.containsKey(this.keys[STATE.ROTATE], event.keyCode) &&
            !this.noRotate
        ) {
            this._state = STATE.ROTATE
        } else if (
            this.containsKey(this.keys[STATE.ZOOM], event.keyCode) &&
            !this.noZoom
        ) {
            this._state = STATE.ZOOM
        } else if (
            this.containsKey(this.keys[STATE.PAN], event.keyCode) &&
            !this.noPan
        ) {
            this._state = STATE.PAN
        }
    }

    keyup() {
        if (this.enabled === false) {
            return
        }

        this._state = this._prevState

        window.addEventListener('keydown', this.keydownCb, false)
    }

    mousedown(event) {
        if (this.enabled === false) {
            return
        }

        event.preventDefault()
        event.stopPropagation()

        if (this._state === STATE.NONE) {
            this._state = event.button
        }

        if (this._state === STATE.ROTATE && !this.noRotate) {
            this._moveCurr.copy(this.getMouseOnCircle(event.pageX, event.pageY))
            this._movePrev.copy(this._moveCurr)
        } else if (this._state === STATE.ZOOM && !this.noZoom) {
            this._zoomStart.copy(
                this.getMouseOnScreen(event.pageX, event.pageY),
            )
            this._zoomEnd.copy(this._zoomStart)
        } else if (this._state === STATE.PAN && !this.noPan) {
            this._panStart.copy(this.getMouseOnScreen(event.pageX, event.pageY))
            this._panEnd.copy(this._panStart)
        }

        document.addEventListener('mousemove', this.mousemoveCb, false)
        document.addEventListener('mouseup', this.mouseupCb, false)
        this.dispatchEvent(this.startEvent)
    }

    mousemove(event) {
        if (this.enabled === false) {
            return
        }

        event.preventDefault()
        event.stopPropagation()

        if (this._state === STATE.ROTATE && !this.noRotate) {
            this._movePrev.copy(this._moveCurr)
            this._moveCurr.copy(this.getMouseOnCircle(event.pageX, event.pageY))
        } else if (this._state === STATE.ZOOM && !this.noZoom) {
            this._zoomEnd.copy(this.getMouseOnScreen(event.pageX, event.pageY))
        } else if (this._state === STATE.PAN && !this.noPan) {
            this._panEnd.copy(this.getMouseOnScreen(event.pageX, event.pageY))
        }
        this.update()
    }

    mouseup(event) {
        if (this.enabled === false) {
            return
        }

        event.preventDefault()
        event.stopPropagation()

        this._state = STATE.NONE

        document.removeEventListener('mousemove', this.mousemoveCb)
        document.removeEventListener('mouseup', this.mouseupCb)
        this.dispatchEvent(this.endEvent)
    }

    mousewheel(event) {
        if (this.enabled === false) {
            return
        }

        event.preventDefault()
        event.stopPropagation()

        switch (event.deltaMode) {
            case 2:
                // Zoom in pages
                this._zoomStart.y -= event.deltaY * 0.025
                break

            case 1:
                // Zoom in lines
                this._zoomStart.y -= event.deltaY * 0.01
                break

            default:
                // undefined, 0, assume pixels
                this._zoomStart.y -= event.deltaY * 0.00025
                break
        }

        this.dispatchEvent(this.startEvent)
        this.dispatchEvent(this.endEvent)
        this.update()
    }

    touchstart(event) {
        if (this.enabled === false) {
            return
        }

        switch (event.touches.length) {
            case 1:
                this._state = STATE.TOUCH_ROTATE
                this._moveCurr.copy(
                    this.getMouseOnCircle(
                        event.touches[0].pageX,
                        event.touches[0].pageY,
                    ),
                )
                this._movePrev.copy(this._moveCurr)
                break

            default: {
                // 2 or more
                this._state = STATE.TOUCH_ZOOM_PAN
                const dx = event.touches[0].pageX - event.touches[1].pageX
                const dy = event.touches[0].pageY - event.touches[1].pageY
                this._touchZoomDistanceEnd = this._touchZoomDistanceStart =
                    Math.sqrt(dx * dx + dy * dy)

                const x = (event.touches[0].pageX + event.touches[1].pageX) / 2
                const y = (event.touches[0].pageY + event.touches[1].pageY) / 2
                this._panStart.copy(this.getMouseOnScreen(x, y))
                this._panEnd.copy(this._panStart)
                break
            }
        }

        this.dispatchEvent(this.startEvent)
    }

    touchmove(event) {
        if (this.enabled === false) {
            return
        }

        event.preventDefault()
        event.stopPropagation()

        switch (event.touches.length) {
            case 1:
                this._movePrev.copy(this._moveCurr)
                this._moveCurr.copy(
                    this.getMouseOnCircle(
                        event.touches[0].pageX,
                        event.touches[0].pageY,
                    ),
                )
                break

            default: {
                // 2 or more
                const dx = event.touches[0].pageX - event.touches[1].pageX
                const dy = event.touches[0].pageY - event.touches[1].pageY
                this._touchZoomDistanceEnd = Math.sqrt(dx * dx + dy * dy)

                const x = (event.touches[0].pageX + event.touches[1].pageX) / 2
                const y = (event.touches[0].pageY + event.touches[1].pageY) / 2
                this._panEnd.copy(this.getMouseOnScreen(x, y))
                break
            }
        }
        this.update()
    }

    touchend(event) {
        if (this.enabled === false) {
            return
        }

        switch (event.touches.length) {
            case 0:
                this._state = STATE.NONE
                break

            case 1:
                this._state = STATE.TOUCH_ROTATE
                this._moveCurr.copy(
                    this.getMouseOnCircle(
                        event.touches[0].pageX,
                        event.touches[0].pageY,
                    ),
                )
                this._movePrev.copy(this._moveCurr)
                break
        }

        this.dispatchEvent(this.endEvent)
    }

    contextmenu(event) {
        if (this.enabled === false) {
            return
        }

        event.preventDefault()
    }

    dispose() {
        this.domElement.removeEventListener(
            'contextmenu',
            this.contextmenuCb,
            false,
        )
        this.domElement.removeEventListener(
            'mousedown',
            this.mousedownCb,
            false,
        )
        this.domElement.removeEventListener('wheel', this.mousewheelCb, false)

        this.domElement.removeEventListener(
            'touchstart',
            this.touchstart,
            false,
        )
        this.domElement.removeEventListener('touchend', this.touchendCb, false)
        this.domElement.removeEventListener(
            'touchmove',
            this.touchmoveCb,
            false,
        )

        document.removeEventListener('mousemove', this.mousemoveCb, false)
        document.removeEventListener('mouseup', this.mousemoveCb, false)

        window.removeEventListener('keydown', this.keydownCb, false)
        window.removeEventListener('keyup', this.keyupCb, false)
    }
}
