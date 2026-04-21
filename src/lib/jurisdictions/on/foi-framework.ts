import type { FOIFramework } from '../types'

// VERIFY: All section citations in this file are from training data and have NOT been
// verified against current Ontario legislation. Do not rely on these for legal advice.
// A legal professional should confirm citations before setting verified: true.

export const onFoiFramework: FOIFramework = {
  name: 'FIPPA',
  fullCitation: 'Freedom of Information and Protection of Privacy Act, RSO 1990, c F.31', // VERIFY
  verified: false,
  sections: {
    rightOfAccess: 's. 4(1)', // VERIFY
    dutyToAssist: 's. 24', // VERIFY: obligation to assist
    timeLimit: { section: 's. 26', days: 30 }, // VERIFY: 30 calendar days
    feeWaiver: 's. 57(4)', // VERIFY
    review: 's. 50', // VERIFY: Information and Privacy Commissioner of Ontario
  },
  letterTemplate: `Dear Freedom of Information Coordinator,

Under the Freedom of Information and Protection of Privacy Act, RSO 1990, c F.31, s. 4(1), I request access to the following records:

{records_description}

Under s. 24, I ask that you assist me in identifying the records that fall within the scope of this request. Under s. 26, the institution must respond within 30 calendar days of receipt.

I request a fee waiver under s. 57(4) on the basis that the records relate to a matter of public health or safety, or that the requester's financial circumstances are such that the fee would be a barrier to access.

If any records are withheld, I request that the institution identify the specific exemption under the Act that applies to each withheld record, provide access to any severable portions that can be disclosed, and provide the information required under s. 28 where personal information exemptions are claimed.

If this request is refused in whole or in part, I intend to seek review by the Information and Privacy Commissioner of Ontario under s. 50.`,
  responseTimeline: '30 calendar days',
}
