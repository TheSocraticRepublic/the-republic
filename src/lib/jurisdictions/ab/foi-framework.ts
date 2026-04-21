import type { FOIFramework } from '../types'

// VERIFY: All section citations in this file are from training data and have NOT been
// verified against current Alberta legislation. Do not rely on these for legal advice.
// A legal professional should confirm citations before setting verified: true.

export const abFoiFramework: FOIFramework = {
  name: 'FOIP',
  fullCitation: 'Freedom of Information and Protection of Privacy Act, RSA 2000, c F-25', // VERIFY
  verified: false,
  sections: {
    rightOfAccess: 's. 6(1)', // VERIFY
    dutyToAssist: 's. 10(1)', // VERIFY
    timeLimit: { section: 's. 11', days: 30 }, // VERIFY: 30 business days
    feeWaiver: 's. 93(4)', // VERIFY
    review: 's. 65', // VERIFY: Information and Privacy Commissioner of Alberta
  },
  letterTemplate: `Dear FOI Coordinator,

Under the Freedom of Information and Protection of Privacy Act, RSA 2000, c F-25, s. 6(1), I request access to the following records:

{records_description}

Pursuant to s. 10(1), I ask that you provide reasonable assistance to complete my request. Under s. 11, the public body must respond within 30 business days of receipt.

I request a fee waiver under s. 93(4) on the basis that disclosure of the information would benefit public health or safety or the environment.

If any records are withheld, I request that the public body identify the specific exception under the Act that applies to each withheld record, and provide the severed portions of any records that can be disclosed.

If this request is refused in whole or in part, I intend to request a review by the Information and Privacy Commissioner of Alberta under s. 65.`,
  responseTimeline: '30 business days',
}
