import type { FOIFramework } from '../types'

export const abFoiFramework: FOIFramework = {
  name: 'FOIP',
  fullCitation: 'Freedom of Information and Protection of Privacy Act, RSA 2000, c F-25',
  verified: true,
  sections: {
    rightOfAccess: 's. 6(1)',
    dutyToAssist: 's. 10(1)',
    timeLimit: { section: 's. 11', days: 30 },
    feeWaiver: 's. 93(4)',
    review: 's. 65',
  },
  letterTemplate: `Dear FOIP Coordinator,

Under the Freedom of Information and Protection of Privacy Act, RSA 2000, c F-25, s. 6(1), I request access to the following records:

{records_description}

Pursuant to s. 10(1), I ask that you provide every reasonable effort to assist me with this request. Under s. 11, the public body must make every reasonable effort to respond within 30 days of receipt.

I request a fee waiver under s. 93(4) on the basis that disclosure of the information would benefit public health or safety or the environment.

If any records are withheld, I request that the public body identify the specific exception under the Act that applies to each withheld record, and provide the severed portions of any records that can be disclosed.

If this request is refused in whole or in part, I intend to request a review by the Information and Privacy Commissioner of Alberta under s. 65.`,
  responseTimeline: '30 days',
}
