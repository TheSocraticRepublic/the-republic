import type { AssessmentFramework } from '../types'

// VERIFY: All statutory citations and registry URLs are from training data and have NOT
// been verified against current Alberta legislation. Confirm with Alberta Environment
// and Protected Areas before relying on these references.

export const abAssessmentFramework: AssessmentFramework = {
  name: 'Alberta Environmental Assessment',
  authority: 'Environmental Protection and Enhancement Act, RSA 2000, c E-12 (EPEA)', // VERIFY
  registryUrl: 'https://environment.alberta.ca/apps/EIAR/', // VERIFY
  documentTypes: [
    {
      type: 'Project Registration',
      description: 'The proponent\'s initial registration of a proposed project under Schedule 1 or 2 of the Activities Designation Regulation',
      access: 'public',
      typicalLocation: 'Alberta Environmental Assessment Registry (AEAR)',
    },
    {
      type: 'Environmental Impact Assessment Report',
      description: 'The full EIA prepared by the proponent covering all significant environmental effects. Mandatory for Schedule 1 (mandatory) projects; may be required for Schedule 2 at Director\'s discretion',
      access: 'public',
      typicalLocation: 'Alberta Environmental Assessment Registry (AEAR)',
    },
    {
      type: 'Public Participation Program',
      description: 'The proponent-designed program for engaging the public and stakeholders in the EIA process, approved by the Director',
      access: 'public',
      typicalLocation: 'Alberta Environmental Assessment Registry and the proponent\'s project website',
    },
    {
      type: 'Government Review',
      description: 'Review of the EIA Report by provincial government departments, identifying deficiencies and required revisions',
      access: 'public',
      typicalLocation: 'Alberta Environmental Assessment Registry',
    },
    {
      type: 'Terms and Conditions',
      description: 'The conditions attached to the Environmental Assessment Decision, legally binding on the proponent through the project approval',
      access: 'public',
      typicalLocation: 'Alberta Environmental Assessment Registry',
    },
    {
      type: 'Approval under EPEA',
      description: 'The regulatory approval for the project issued under EPEA, incorporating EA terms and conditions and operational requirements',
      access: 'public',
      typicalLocation: 'Alberta Environment and Protected Areas, Approvals Management',
    },
  ],
  processStages: [
    {
      stage: 'Project Registration',
      description: 'Proponent registers the project with Alberta Environment and Protected Areas. Director determines whether a mandatory EIA (Schedule 1) or discretionary review applies',
      publicInput: false,
      typicalDuration: '30–90 days',
    },
    {
      stage: 'Public Participation Program Approval',
      description: 'Proponent designs and submits a Public Participation Program for Director approval. Defines how and when public will be engaged',
      publicInput: false,
      typicalDuration: '30–60 days',
    },
    {
      stage: 'Draft EIA and Public Review',
      description: 'Proponent prepares draft EIA Report. Public and agencies have an opportunity to review and submit comments through the approved PPP',
      publicInput: true,
      typicalDuration: '60–180 days',
    },
    {
      stage: 'Government Review',
      description: 'Provincial departments review the final EIA Report for completeness and adequacy. Proponent must address deficiencies',
      publicInput: false,
      typicalDuration: '60–120 days',
    },
    {
      stage: 'Decision',
      description: 'Director of Environmental Assessment issues an Environmental Assessment Decision, approving the project with terms and conditions or rejecting it',
      publicInput: false,
      typicalDuration: '30–60 days',
    },
    {
      stage: 'Regulatory Approval',
      description: 'Project proceeds to approval under EPEA, AER, or other applicable regulatory bodies incorporating EA terms and conditions',
      publicInput: false,
      typicalDuration: 'Varies by regulator',
    },
  ],
  publicParticipation: [
    {
      type: 'public_comment',
      stage: 'Draft EIA and Public Review',
      howToParticipate: 'Submit written comments to the proponent during the public review period as specified in the approved Public Participation Program',
      typicalDeadline: 'As specified in the Public Participation Program (minimum 30 days typical)',
    },
    {
      type: 'open_house',
      stage: 'Draft EIA and Public Review',
      howToParticipate: 'Attend open houses or public meetings held by the proponent as part of their Public Participation Program',
      typicalDeadline: 'As scheduled and announced in the Public Participation Program',
    },
    {
      type: 'public_comment',
      stage: 'Project Registration',
      howToParticipate: 'Contact Alberta Environment and Protected Areas to express interest in being notified of projects in your area',
      typicalDeadline: 'No standard deadline — register interest proactively',
    },
  ],
  keyStatutes: [
    'Environmental Protection and Enhancement Act, RSA 2000, c E-12 (EPEA)', // VERIFY
    'Activities Designation Regulation, Alta Reg 276/2003', // VERIFY
    'Environmental Assessment Exemption Regulation, Alta Reg 111/1993', // VERIFY
    'Oil Sands Conservation Act, RSA 2000, c O-7', // VERIFY
    'Water Act, RSA 2000, c W-3', // VERIFY
  ],
}
