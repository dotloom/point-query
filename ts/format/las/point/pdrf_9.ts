import { pdrf6Parts } from './pdrf_6'
import { extended } from './pdrf_4'
import readerForReaders from '../../../reader/readerForReaders'
import flattenReader from '../../../reader/util/flatReader'

export default flattenReader(readerForReaders(
  pdrf6Parts
    .concat(extended)
))
