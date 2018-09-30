import Long from 'long'
import { IDuplex } from '../api/IDuplex'
import INode from '../api/INode'
import INodeQuery from '../api/INodeQuery'
import IPoint from '../api/IPoint'
import IPointData from '../api/IPointData'
import ITree from '../api/ITree'
import AbstractSingleTreeIO from './AbstractSingleTreeIO'
import { add, gt, sub } from './long'

function ignoreError () {
  return
}

export interface IRange {
  start: number | Long
  numPoints: number
}

export interface INodeLimit {
  nodeLimit: number
}

interface IRangesAndNodes {
  nodes: INode[]
  ranges: { [nodeId: string]: IRange }
}

export function calculateEqualNodes <Tree extends ITree> (tree: Tree, limit: number = Number.MAX_SAFE_INTEGER): IRangesAndNodes {
  if (limit > Number.MAX_SAFE_INTEGER) {
    throw new Error('Limit needs to be a safe-to-compute integer value')
  }
  if (limit <= 0) {
    throw new Error('Limit needs to be a positive number.')
  }
  const nodes: INode[] = []
  const ranges: { [nodeId: string]: IRange } = {}
  let start: number | Long = 0

  function addNode (numPoints) {
    const node = {
      treeId: tree.id,
      id: nodes.length.toString(),
      bounds: tree.bounds,
      numPoints
    }
    nodes.push(node)
    ranges[node.id] = {
      start,
      numPoints
    }
  }

  let leftOver = tree.numPoints
  while (gt(leftOver, limit)) {
    leftOver = sub(leftOver, limit)
    addNode(limit)
    start = add(start, limit)
  }
  if (gt(leftOver, 0)) {
    addNode(typeof leftOver === 'number' ? leftOver : leftOver.toNumber())
  }
  return { ranges, nodes }
}

export default abstract class AbstractVirtualNodesIO<
  Tree extends ITree & INodeLimit,
  Point extends IPoint = IPoint,
> extends AbstractSingleTreeIO<Tree, INode, Point> {
  rangesAndNodesP: PromiseLike<IRangesAndNodes>

  constructor (treeP: PromiseLike<Tree>) {
    super(treeP)
    this.rangesAndNodesP = treeP.then(tree => this.calculateRangesAndNodes(tree))
  }

  calculateRangesAndNodes (tree: Tree): IRangesAndNodes {
    return calculateEqualNodes(tree, tree.nodeLimit)
  }

  async _getNodes (output: IDuplex<INode>, query?: INodeQuery) {
    // TODO: Implement filtering based on query here.
    for (const node of (await this.rangesAndNodesP).nodes) {
      await output.write(node)
    }
  }

  async _getPoints (node: INode, tree: Tree): Promise<IPointData<Point>> {
    const ranges = (await this.rangesAndNodesP).ranges
    const data = await this._getRangePoints(node, ranges[node.id])
    return data
  }

  abstract _getRangePoints (node: INode, range: IRange): PromiseLike<IPointData<Point>>
}