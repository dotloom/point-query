import { pdrf0Parts } from './pdrf_0'
import { gpsTime } from './pdrf_1'
import { rgb } from './pdrf_2'
import { extended } from './pdrf_4'
import { readerForFixedFeatures } from '../../../reader/readerForReaders'
import IPoint from '../../../api/IPoint'

export default readerForFixedFeatures<IPoint>(
  pdrf0Parts
    .concat(gpsTime)
    .concat(rgb)
    .concat(extended)
)
