import type { PublicBody } from '../types'

// VERIFY: FOI contact addresses change. Verify current addresses before use.
// Last reviewed: training data (not independently verified).

export const onPublicBodies: PublicBody[] = [
  {
    name: 'City of Toronto',
    foiAddress: 'Freedom of Information and Privacy, City Clerk\'s Office, City Hall, 100 Queen Street West, Toronto, ON M5H 2N2', // VERIFY
    jurisdiction: 'toronto',
    email: 'foi@toronto.ca', // VERIFY
  },
  {
    name: 'City of Ottawa',
    foiAddress: 'Access to Information and Privacy Coordinator, City of Ottawa, 110 Laurier Avenue West, Ottawa, ON K1P 1J1', // VERIFY
    jurisdiction: 'ottawa',
  },
  {
    name: 'City of Mississauga',
    foiAddress: 'Freedom of Information Coordinator, City of Mississauga, 300 City Centre Drive, Mississauga, ON L5B 3C1', // VERIFY
    jurisdiction: 'mississauga',
  },
  {
    name: 'City of Hamilton',
    foiAddress: 'Freedom of Information Coordinator, City of Hamilton, 71 Main Street West, Hamilton, ON L8P 4Y5', // VERIFY
    jurisdiction: 'hamilton',
  },
  {
    name: 'Government of Ontario',
    foiAddress: 'Freedom of Information Coordinator, Cabinet Office, Whitney Block, Room 6630, 99 Wellesley Street West, Toronto, ON M7A 1A1', // VERIFY
    jurisdiction: 'on-provincial',
  },
  {
    name: 'Ontario Ministry of the Environment, Conservation and Parks',
    foiAddress: 'Freedom of Information Coordinator, Ministry of the Environment, Conservation and Parks, 135 St. Clair Avenue West, Toronto, ON M4V 1P5', // VERIFY
    jurisdiction: 'on-provincial',
  },
  {
    name: 'Metrolinx',
    foiAddress: 'Freedom of Information Coordinator, Metrolinx, 20 Bay Street, Suite 600, Toronto, ON M5J 2W3', // VERIFY
    jurisdiction: 'on-provincial',
  },
  {
    name: 'Ontario Energy Board',
    foiAddress: 'Freedom of Information Coordinator, Ontario Energy Board, 2300 Yonge Street, Suite 2700, Toronto, ON M4P 1E4', // VERIFY
    jurisdiction: 'on-provincial',
  },
  {
    name: 'City of Brampton',
    foiAddress: 'Freedom of Information Coordinator, City of Brampton, 2 Wellington Street West, Brampton, ON L6Y 4R2', // VERIFY
    jurisdiction: 'brampton',
  },
  {
    name: 'City of London',
    foiAddress: 'Freedom of Information Coordinator, City of London, 300 Dufferin Avenue, London, ON N6B 1Z2', // VERIFY
    jurisdiction: 'london',
  },
]
