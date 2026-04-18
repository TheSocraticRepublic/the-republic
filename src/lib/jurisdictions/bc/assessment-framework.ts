import type { AssessmentFramework } from '../types'

export const bcAssessmentFramework: AssessmentFramework = {
  name: 'BC Environmental Assessment Office',
  authority: 'Environmental Assessment Act, SBC 2018, c. 51',
  registryUrl: 'https://projects.eao.gov.bc.ca',
  documentTypes: [
    { type: 'Initial Project Description', description: 'Proponents first filing describing the project', access: 'public', typicalLocation: 'EAO EPIC project page' },
    { type: 'Detailed Project Description', description: 'Expanded description after Early Engagement', access: 'public', typicalLocation: 'EAO EPIC project page' },
    { type: 'Application Information Requirements', description: 'What the proponent must study — the scope of assessment', access: 'public', typicalLocation: 'EAO EPIC project page' },
    { type: 'Effects Assessment', description: 'Full assessment of environmental, social, economic, health, and cultural effects', access: 'public', typicalLocation: 'EAO EPIC project page' },
    { type: 'Referral Package', description: 'EAO staff recommendation to Ministers', access: 'public', typicalLocation: 'EAO EPIC project page' },
    { type: 'Environmental Assessment Certificate', description: 'The approval document with legally binding conditions', access: 'public', typicalLocation: 'EAO EPIC project page' },
  ],
  processStages: [
    { stage: 'Early Engagement', description: 'Initial phase where EAO notifies Indigenous nations, public, and agencies', publicInput: true, typicalDuration: '90 days' },
    { stage: 'Process Planning', description: 'EAO and participants design the assessment process', publicInput: false, typicalDuration: '120 days' },
    { stage: 'Application Development and Review', description: 'Proponent prepares the Application, EAO and participants review', publicInput: true, typicalDuration: '180 days' },
    { stage: 'Effects Assessment and Recommendation', description: 'EAO assesses effects and prepares recommendation', publicInput: true, typicalDuration: '150 days' },
    { stage: 'Decision', description: 'Ministers decide whether to issue an Environmental Assessment Certificate', publicInput: false, typicalDuration: '30 days' },
    { stage: 'Post-Certificate', description: 'Compliance and enforcement monitoring of certificate conditions', publicInput: false, typicalDuration: 'Ongoing' },
  ],
  publicParticipation: [
    { type: 'public_comment', stage: 'Early Engagement', howToParticipate: 'Submit comments through the EAO EPIC project page during the comment period', typicalDeadline: '30 days from notice' },
    { type: 'public_comment', stage: 'Application Development and Review', howToParticipate: 'Submit comments on the Application through the EAO EPIC project page', typicalDeadline: '30 days from notice' },
    { type: 'public_comment', stage: 'Effects Assessment and Recommendation', howToParticipate: 'Submit comments on the draft Assessment Report', typicalDeadline: '30 days from notice' },
    { type: 'public_hearing', stage: 'Application Development and Review', howToParticipate: 'Attend community open houses or public hearings announced on EAO EPIC', typicalDeadline: 'As scheduled' },
  ],
  keyStatutes: [
    'Environmental Assessment Act, SBC 2018, c. 51',
    'Declaration on the Rights of Indigenous Peoples Act, SBC 2019, c. 44',
    'Reviewable Projects Regulation, BC Reg 243/2019',
  ],
}
