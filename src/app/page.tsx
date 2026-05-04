import { ScrollOrchestrator } from '@/components/landing/scroll-orchestrator'
import { GrainOverlay } from '@/components/landing/grain-overlay'
import { LandingHeader } from '@/components/landing/landing-header'
import { Hero } from '@/components/landing/hero'
import { ActConfusion } from '@/components/landing/act-confusion'
import { ActUnderstanding } from '@/components/landing/act-understanding'
import { ActAction } from '@/components/landing/act-action'
import { ActAgency } from '@/components/landing/act-agency'
import { LandingCta } from '@/components/landing/landing-cta'
import { LandingFooter } from '@/components/landing/landing-footer'

export default function LandingPage() {
  return (
    <ScrollOrchestrator>
      <GrainOverlay />
      <LandingHeader />
      <main>
        <Hero />
        <ActConfusion />
        <ActUnderstanding />
        <ActAction />
        <ActAgency />
        <LandingCta />
      </main>
      <LandingFooter />
    </ScrollOrchestrator>
  )
}
