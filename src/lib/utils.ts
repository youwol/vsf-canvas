import { PerspectiveCamera, Group, Box3, Vector3, Object3D } from 'three'
import { MouseControls } from './controls/mouse.controls'

import { Projects, Immutable, Workflows, Deployers } from '@youwol/vsf-core'
import { from, of } from 'rxjs'
import { map } from 'rxjs/operators'

export function getChildrenGeometries(children) {
    const geometries = children
        .filter((child) => child instanceof Group || child['geometry'])
        .map((child) => {
            if (child instanceof Group) {
                return getChildrenGeometries(child.children).reduce(
                    (acc, e) => acc.concat(e),
                    [child],
                )
            }
            return [child]
        })
    return geometries.reduce((acc, e) => acc.concat(e), [])
}

export function getSceneBoundingBox(scene) {
    const selection = getChildrenGeometries(scene.children)
    const box = new Box3()

    selection.forEach((mesh) => {
        box.expandByObject(mesh)
    })

    return box
}

export function getBoundingBox(selection: Object3D[]) {
    const box = new Box3()

    selection.forEach((mesh) => {
        box.expandByObject(mesh)
    })

    return box
}

export function fitSceneToContent(
    scene: Object3D,
    camera: PerspectiveCamera,
    controls: MouseControls,
) {
    const bbox = getSceneBoundingBox(scene)
    const size = bbox.getSize(new Vector3())
    const center = bbox.getCenter(new Vector3())

    if (size.length() == 0) {
        return
    }

    const fitRatio = 1
    const pcamera = camera

    const maxSize = Math.max(size.x, size.y, size.z)
    const fitHeightDistance =
        maxSize / (2 * Math.atan((Math.PI * pcamera.fov) / 360))
    const fitWidthDistance = fitHeightDistance / pcamera.aspect
    const distance = fitRatio * Math.max(fitHeightDistance, fitWidthDistance)

    const direction = controls.target
        .clone()
        .sub(camera.position)
        .normalize()
        .multiplyScalar(distance)

    controls.maxDistance = distance * 10
    controls.target.copy(center)
    pcamera.near = distance / 100
    pcamera.far = distance * 100
    pcamera.updateProjectionMatrix()
    camera.position.copy(controls.target).sub(direction)

    controls.update()
}

async function createSupportingMacroInstancePool({
    workflow,
    environment,
}: {
    workflow: Immutable<Workflows.WorkflowModel>
    environment: Immutable<Projects.Environment>
}) {
    await environment.installDependencies({ modules: workflow.modules })
    const instances = await Promise.all(
        workflow.modules.map((module) => {
            return environment.instantiateModule({
                typeId: module.typeId,
                moduleId: module.uid,
                configuration: module.configuration,
                scope: {},
            })
        }),
    )
    return new Deployers.InstancePool({
        modules: instances,
        parentUid: workflow.uid,
    })
}

export function prepareWorkflowAndInstancePool(
    project: Projects.ProjectState,
    workflowId: string,
) {
    const workflow =
        workflowId == 'main'
            ? project.main
            : project.macros.find((m) => m.uid == workflowId)

    return workflowId == 'main'
        ? of({
              workflow,
              project,
              instancePool: project.instancePool,
          })
        : from(
              createSupportingMacroInstancePool({
                  workflow,
                  environment: project.environment,
              }),
          ).pipe(
              map((instancePool) => ({
                  workflow,
                  project,
                  instancePool,
              })),
          )
}
