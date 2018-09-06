import INodeQuery from '../api/INodeQuery'
import INode from '../api/INode'
import INodeTree from './INodeTree'
import ITree from '../api/ITree'
import { Frustum, Matrix4, PerspectiveCamera, Sphere } from 'three'
import boxIntersectsOneBox from './boxIntersectsBox'
import boxIntersectsOneFrustum from './boxIntersectsOneFrustum'
import distancePointPoint from './distancePointPoint'
import IPerspectiveCamera from '../api/IPerspectiveCamera'
import boundingSphere from './boundingSphere'
import IBox3 from '../api/IBox3'
import IRange from '../api/IRange'
import { getMaxListeners } from 'cluster'
import inRange from './inRange'
import IDisplay from '../api/IDisplay'
import ILongRange from '../api/ILongRange'
import Long from 'long'
import IDensityRange from '../api/IDensityRange'
import IFrustum from './IFrustum'
import isNodeVisible from './isNodeVisible'

function getPerspectiveCamera (input: IPerspectiveCamera): PerspectiveCamera {
  if (input instanceof PerspectiveCamera) {
    return input
  }
  const camera = new PerspectiveCamera()
  // https://stackoverflow.com/a/29223836
  camera.matrix.fromArray(input.matrix.elements as number[])
  camera.matrix.decompose(camera.position, camera.quaternion, camera.scale)
  return camera
}

function getMatrix4 (cam: IPerspectiveCamera): Matrix4 {
  if (cam.matrix instanceof Matrix4) {
    return cam.matrix
  }
  const matrix = new Matrix4()
  const elem = matrix.elements
  matrix.set(
    elem[ 0], elem[ 1], elem[ 2], elem[ 3],
    elem[ 4], elem[ 5], elem[ 6], elem[ 7],
    elem[ 8], elem[ 9], elem[10], elem[11],
    elem[12], elem[13], elem[14], elem[15]
  )
  return matrix
}

function getFrustumFromCam (cam: IPerspectiveCamera) {
  const f = new Frustum()
  f.setFromMatrix(getMatrix4(cam))
  return f
}

function getScreenPixelRatio (f: number, radius: number, distance: number): number {
  return (radius * f) / distance
}

function getWeight (node: INodeTree, fDisplays?: IFrustumDisplay[]): number {
  let weight = 0
  for (const fDisplay of fDisplays) {
    const distance = distancePointPoint(node.boundingSphere.center, fDisplay.cam.position)
    const screenPixelRatio = getScreenPixelRatio(
      fDisplay.f,
      node.boundingSphere.radius,
      distance
    )
    if (fDisplay.normalDensity && !inRange(fDisplay.normalDensity, screenPixelRatio)) {
      continue
    }
    if (distance < node.boundingSphere.radius) {
      // Definitely load items within the sphere
      return Number.MAX_VALUE
    } else if (weight < screenPixelRatio) {
      // The biggest screenPixelRadius wins
      weight = screenPixelRatio
    }
  }
  return weight
}

interface IOutput {
  write: (node: INode) => any,
  isEndingOrEnded: () => boolean,
  end: (error?: Error) => void
}

interface IFrustumDisplay {
  cam: PerspectiveCamera,
  display: IDisplay,
  f: number,
  normalDensity?: IRange
}

interface IWeightedNode {
  weight: number,
  node: INodeTree
}

function sortByWeight (a: IWeightedNode, b: IWeightedNode): number {
  if (a.weight > b.weight) return 1
  if (a.weight < b.weight) return -1
  return 0
}

function normalizeDensity (density?: IDensityRange): IRange | null {
  if (!density) {
    return null
  }
  if (isNaN(density.height)) {
    return density
  }
  let min = density.min
  if (!isNaN(min)) {
    min = min / density.height
  }
  return {
    min,
    max: density.max / density.height
  }
}

function getFrustumDisplays (display?: IDisplay[]): IFrustumDisplay[] | undefined {
  if (!display) {
    return undefined
  }

  return display.map(display => {
    const cam = getPerspectiveCamera(display.cam)
    const slope = Math.tan(cam.fov * Math.PI / 180)
    const f = 1 / slope
    return {
      f,
      cam,
      display,
      normalDensity: normalizeDensity(display.density)
    }
  })
}

function filterAndSortByWeight (nodeList: INodeTree[], fDisplays: IFrustumDisplay[]): INodeTree[] {
  return nodeList.map(node => {
    return {
      weight: getWeight(node, fDisplays),
      node
    }
  })
    .filter(weightedNode => weightedNode.weight > 0)
    .sort(sortByWeight)
    .map(weightedNode => weightedNode.node)
}

function allChildren (nodeList: INodeTree[]): INodeTree[] | null {
  const childrenList = nodeList.map(node => node.children).filter(Boolean)
  if (childrenList.length === 0) {
    return null
  }
  // flatten
  return [].concat.apply([], childrenList)
}

function minLong (range?: ILongRange): Long | number {
  if (!range) {
    return 0
  }
  if (range.min === null || range.min === undefined) {
    return 0
  }
  return range.min
}

function getFrustumsForDisplays (fDisplays?: IFrustumDisplay[]) {
  if (!fDisplays) {
    return null
  }
  return fDisplays.map(fDisplay => getFrustumFromCam(fDisplay.cam))
}

export default async function selectNodes (query: INodeQuery, treeNodeList: INodeTree[], output: IOutput): Promise<boolean> {
  const fDisplays = getFrustumDisplays(query.display)
  const frustums = getFrustumsForDisplays(fDisplays)
  const nodeVisible = isNodeVisible(query.cut, frustums)
  let totalPoints: Long = new Long(0)
  const min: Long | number = minLong(query.pointRange)

  while (treeNodeList) {
    if (nodeVisible !== null) {
      treeNodeList = treeNodeList.filter(({ node }) => nodeVisible(node))
    }
    if (fDisplays !== null) {
      treeNodeList = filterAndSortByWeight(treeNodeList, fDisplays)
    }
    for (const node of treeNodeList) {
      if (output.isEndingOrEnded()) {
        return false
      }
      if (query.pointRange) {
        totalPoints = totalPoints.add(node.node.numPoints)
        if (totalPoints.greaterThan(query.pointRange.max)) {
          output.end()
          return true
        }
        if (totalPoints.lessThan(min)) {
          continue
        }
      }
      output.write(node.node)
    }
    treeNodeList = allChildren(treeNodeList)
  }
  output.end()
  return true
}
