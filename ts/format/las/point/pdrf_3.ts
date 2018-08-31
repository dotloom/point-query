import { pdrf0Parts } from './pdrf_0'
import { gpsTime } from './pdrf_1'
import { rgb } from './pdrf_2'
import readerForReaders from '../../../reader/readerForReaders'
import flattenReader from '../../../reader/util/flatReader'

export default flattenReader(readerForReaders(
  pdrf0Parts
    .concat(gpsTime)
    .concat(rgb)
))
