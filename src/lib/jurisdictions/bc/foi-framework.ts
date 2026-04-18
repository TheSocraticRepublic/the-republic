import type { FOIFramework } from '../types'

export const bcFoiFramework: FOIFramework = {
  name: 'FIPPA',
  fullCitation: 'Freedom of Information and Protection of Privacy Act, RSBC 1996, c. 165',
  sections: {
    rightOfAccess: 's. 4',
    dutyToAssist: 's. 6',
    timeLimit: { section: 's. 7', days: 30 },
    feeWaiver: 's. 75(5)(a)',
    review: 's. 52',
  },
  letterTemplate: `Dear FOI Coordinator,

Under the Freedom of Information and Protection of Privacy Act, RSBC 1996, c. 165, s. 4, I request access to the following records:

{records_description}

Pursuant to s. 6, I ask that you provide reasonable assistance to complete my request. Under s. 7, the public body must respond within 30 calendar days.

I request a fee waiver under s. 75(5)(a) on the basis that the records relate to a matter of public interest.

If any records are withheld, I request that the public body identify the specific exception under the Act that applies to each withheld record.

If this request is refused in whole or in part, I intend to request a review by the Information and Privacy Commissioner under s. 52.`,
  responseTimeline: '30 calendar days',
}
