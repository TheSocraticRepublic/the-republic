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

export const revalidate = 3600

export default function LandingPage() {
  return (
    <ScrollOrchestrator>
      <GrainOverlay />
      <LandingHeader />
      {/*
        The Ascent — six movements, dark -> light (D2). Each wrapper carries its
        journey ground (globals.css .movement-*); the color transition happens in
        the empty band at the top of each section, never under text. The two light
        movements add .light-scope so their token-driven text flips to ink — the
        resolution inverts from light-on-dark to dark-on-paper.
        Movement CONTENT is still the pre-D2 acts; batches 2-3 rewrite each in place.
      */}
      <main>
        <div className="movement-cave" data-movement="cave">
          <Hero />
        </div>
        <div className="movement-shadows" data-movement="shadows">
          <ActConfusion />
        </div>
        <div className="movement-turning" data-movement="turning">
          <ActUnderstanding />
        </div>
        <div className="movement-ascent" data-movement="ascent">
          <ActAction />
        </div>
        <div className="light-scope movement-light" data-movement="light">
          <ActAgency />
        </div>
        <div className="light-scope movement-return" data-movement="return">
          <LandingCta />
          <LandingFooter />
        </div>
      </main>
    </ScrollOrchestrator>
  )
}
