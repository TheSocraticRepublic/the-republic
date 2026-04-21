import type { PublicBody } from '../types'

// VERIFY: FOI contact addresses change. Verify current addresses before use.
// Last reviewed: training data (not independently verified).

export const abPublicBodies: PublicBody[] = [
  {
    name: 'City of Edmonton',
    foiAddress: 'FOIP Coordinator, City of Edmonton, 10th Floor, City Hall, 1 Sir Winston Churchill Square, Edmonton, AB T5J 2R7', // VERIFY
    jurisdiction: 'edmonton',
    email: 'foip@edmonton.ca', // VERIFY
  },
  {
    name: 'City of Calgary',
    foiAddress: 'FOIP Coordinator, City of Calgary, P.O. Box 2100, Station M, Calgary, AB T2P 2M5', // VERIFY
    jurisdiction: 'calgary',
    email: 'foip@calgary.ca', // VERIFY
  },
  {
    name: 'City of Red Deer',
    foiAddress: 'FOIP Coordinator, City of Red Deer, City Hall, 4914 48th Avenue, Red Deer, AB T4N 3T4', // VERIFY
    jurisdiction: 'red-deer',
  },
  {
    name: 'City of Lethbridge',
    foiAddress: 'FOIP Coordinator, City of Lethbridge, City Hall, 910 4th Avenue South, Lethbridge, AB T1J 0P6', // VERIFY
    jurisdiction: 'lethbridge',
  },
  {
    name: 'Government of Alberta',
    foiAddress: 'Access and Privacy, Service Alberta and Red Tape Reduction, Provincial Archives Building, 8555 Roper Road, Edmonton, AB T6E 5W1', // VERIFY
    jurisdiction: 'ab-provincial',
  },
  {
    name: 'Alberta Energy Regulator',
    foiAddress: 'FOIP Coordinator, Alberta Energy Regulator, Suite 1000, 250 - 5th Street SW, Calgary, AB T2P 0R4', // VERIFY
    jurisdiction: 'ab-provincial',
  },
  {
    name: 'Alberta Environment and Protected Areas',
    foiAddress: 'FOIP Coordinator, Alberta Environment and Protected Areas, Information Management, 9920 - 108 Street, Edmonton, AB T5K 2M4', // VERIFY
    jurisdiction: 'ab-provincial',
  },
  {
    name: 'Alberta Utilities Commission',
    foiAddress: 'FOIP Coordinator, Alberta Utilities Commission, Suite 2200, 10423 101 Street NW, Edmonton, AB T5H 0E7', // VERIFY
    jurisdiction: 'ab-provincial',
  },
  {
    name: 'Natural Resources Conservation Board',
    foiAddress: 'FOIP Coordinator, Natural Resources Conservation Board, Suite 801, 1229 91 Street SW, Edmonton, AB T6X 1E9', // VERIFY
    jurisdiction: 'ab-provincial',
  },
  {
    name: 'City of Fort McMurray (Regional Municipality of Wood Buffalo)',
    foiAddress: 'FOIP Coordinator, Regional Municipality of Wood Buffalo, 9909 Franklin Avenue, Fort McMurray, AB T9H 2K4', // VERIFY
    jurisdiction: 'wood-buffalo',
  },
]
