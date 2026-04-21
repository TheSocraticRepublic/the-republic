import type { AssessmentFramework } from '../types'

// VERIFY: All statutory citations and registry URLs are from training data and have NOT
// been verified against current Ontario legislation. Confirm with the Ministry of the
// Environment, Conservation and Parks before relying on these references.

export const onAssessmentFramework: AssessmentFramework = {
  name: 'Ontario Environmental Assessment',
  authority: 'Environmental Assessment Act, RSO 1990, c E.18', // VERIFY
  registryUrl: 'https://ero.ontario.ca/', // VERIFY
  documentTypes: [
    {
      type: 'Terms of Reference',
      description: 'The approved terms of reference describing how the proponent will conduct the individual EA study — scope, methodology, and consultation process. Approved by the Minister before the EA begins',
      access: 'public',
      typicalLocation: 'Environmental Registry of Ontario (ERO) at ero.ontario.ca',
    },
    {
      type: 'Environmental Assessment Document',
      description: 'The full EA document covering the undertaking description, alternative solutions, assessment of environmental effects, consultation record, and proposed mitigation',
      access: 'public',
      typicalLocation: 'Environmental Registry of Ontario and the proponent\'s project website',
    },
    {
      type: 'Class Environmental Assessment Study Report',
      description: 'The less comprehensive report for projects subject to a Class EA (municipal roads, transit, electricity projects). Must still be publicly available during the 30-day Part II Order request period',
      access: 'public',
      typicalLocation: 'Proponent website, municipal website, or provincial ministry website. Notice posted on ERO',
    },
    {
      type: 'Ministry Review',
      description: 'The Ministry of the Environment, Conservation and Parks review of the EA document for completeness and adequacy, including government and public comment summaries',
      access: 'public',
      typicalLocation: 'Environmental Registry of Ontario',
    },
    {
      type: 'Part II Order Request',
      description: 'A request by a member of the public or agency that a Class EA project be "bumped up" to a full individual EA. Must be submitted within 30 days of the EA completion notice',
      access: 'public',
      typicalLocation: 'Submitted to the Minister of the Environment, Conservation and Parks. Posted on ERO',
    },
    {
      type: 'Environmental Assessment Approval',
      description: 'The Minister\'s approval decision, including any conditions. For individual EAs, the Board of Negotiation or Hearing Officer may be involved if objections are filed',
      access: 'public',
      typicalLocation: 'Environmental Registry of Ontario',
    },
  ],
  processStages: [
    {
      stage: 'Terms of Reference Preparation',
      description: 'Proponent prepares Terms of Reference describing how the EA study will be conducted and submits to the Ministry for approval',
      publicInput: true,
      typicalDuration: '6–12 months',
    },
    {
      stage: 'Terms of Reference Review and Approval',
      description: 'Ministry reviews and approves Terms of Reference. Public can comment during the ERO posting period',
      publicInput: true,
      typicalDuration: '60–90 days',
    },
    {
      stage: 'EA Study and Document Preparation',
      description: 'Proponent conducts the EA study per the Terms of Reference, including consultation with the public, Indigenous communities, and agencies',
      publicInput: true,
      typicalDuration: '1–3 years',
    },
    {
      stage: 'EA Submission and Ministry Review',
      description: 'Proponent submits the EA document. Ministry reviews for completeness and adequacy. Public and agencies can comment during the ERO posting period',
      publicInput: true,
      typicalDuration: '6–12 months',
    },
    {
      stage: 'Decision',
      description: 'Minister decides whether to approve the EA with or without conditions, refuse approval, or refer to a hearing. Objectors may request a hearing under the Environmental Assessment Act',
      publicInput: false,
      typicalDuration: '30–180 days',
    },
    {
      stage: 'Post-Approval Compliance',
      description: 'Proponent implements EA commitments and approval conditions. Ministry monitors compliance',
      publicInput: false,
      typicalDuration: 'Duration of project',
    },
  ],
  publicParticipation: [
    {
      type: 'public_comment',
      stage: 'Terms of Reference Review and Approval',
      howToParticipate: 'Submit comments through the Environmental Registry of Ontario (ero.ontario.ca) during the Terms of Reference comment period',
      typicalDeadline: '30 days from ERO posting',
    },
    {
      type: 'public_comment',
      stage: 'EA Study and Document Preparation',
      howToParticipate: 'Participate in proponent-led public consultation events (open houses, public meetings) as announced in the public notification plan',
      typicalDeadline: 'As scheduled and announced by the proponent',
    },
    {
      type: 'public_comment',
      stage: 'EA Submission and Ministry Review',
      howToParticipate: 'Submit written comments on the EA document through the Environmental Registry of Ontario during the Ministry review comment period',
      typicalDeadline: '30 days from ERO posting of the EA document',
    },
    {
      type: 'public_hearing',
      stage: 'Decision',
      howToParticipate: 'If the Minister refers the EA to a hearing, participate through the Environmental and Land Tribunals Ontario process',
      typicalDeadline: 'As scheduled by the Tribunal',
    },
  ],
  keyStatutes: [
    'Environmental Assessment Act, RSO 1990, c E.18', // VERIFY
    'Environmental Protection Act, RSO 1990, c E.19', // VERIFY
    'Municipal Class Environmental Assessment, Ontario Municipal Council', // VERIFY
    'Transit Project Assessment Process Regulation, O Reg 231/08', // VERIFY
    'Electricity Projects Regulation, O Reg 116/01', // VERIFY
  ],
}
