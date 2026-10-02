import type { FOIFramework } from '../types'

export const bcFoiFramework: FOIFramework = {
  name: 'FIPPA',
  fullCitation: 'Freedom of Information and Protection of Privacy Act, RSBC 1996, c. 165',
  verified: true,
  sections: {
    rightOfAccess: 's. 4',
    dutyToAssist: 's. 6',
    timeLimit: { section: 's. 7', days: 30 },
    // s. 75(5)(b) is the public-interest ground; (a) is inability to pay / fairness.
    feeWaiver: 's. 75(5)(b)',
    review: 's. 52',
  },
  letterTemplate: `Dear FOI Coordinator,

Under the Freedom of Information and Protection of Privacy Act, RSBC 1996, c. 165, s. 4, I request access to the following records:

{records_description}

Pursuant to s. 6, I ask that you provide reasonable assistance to complete my request. Under s. 7, the public body must respond within 30 days. Under Schedule 1, a day does not include a Saturday or a holiday.

I request a fee waiver under s. 75(5)(b) on the basis that the records relate to a matter of public interest.

If any records are withheld, I request that the public body identify the specific exception under the Act that applies to each withheld record.

If this request is refused in whole or in part, I intend to request a review by the Information and Privacy Commissioner under s. 52.`,
  // Schedule 1: "day" does not include a holiday or a Saturday.
  responseTimeline: '30 days, not counting Saturdays or holidays, per Schedule 1',
}
