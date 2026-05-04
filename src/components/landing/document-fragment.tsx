export function DocumentFragment() {
  return (
    <div
      className="relative mx-auto mt-12 max-w-md overflow-hidden rounded-lg border border-border-strong bg-surface-1 p-6 shadow-sm"
      style={{ opacity: 0.65 }}
      data-scroll-parallax
      aria-hidden="true"
    >
      <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
        <div className="h-2 w-2 rounded-full bg-text-faint" />
        <span
          className="text-[10px] font-medium uppercase tracking-widest text-text-faint"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Ministry of Forests — Cutting Permit CP-2024-0312
        </span>
      </div>

      <div
        className="space-y-2 text-text-secondary"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          lineHeight: 1.35,
        }}
      >
        <p>
          <span className="font-semibold">RE:</span> Application for Cutting
          Permit under Forest Stewardship Plan #847 — Timber Supply Area 38,
          Block CH-4417, Chilliwack Forest District
        </p>
        <p>
          Pursuant to Section 22 of the Forest and Range Practices Act (SBC
          2002, c.69) and the Forest Planning and Practices Regulation (B.C. Reg.
          14/2004), the licensee applies for a cutting permit within the
          Chilliwack Defined Forest Area. The proposed harvest area comprises
          approximately 64.2 hectares of second-growth Douglas fir and western red
          cedar within Landscape Unit #42.
        </p>
        <p>
          The Forest Stewardship Plan establishes landscape-level biodiversity
          objectives per Section 9.1 of FPPR, including retention targets for
          wildlife tree patches (6% minimum) and riparian management areas
          consistent with Sections 47-53 of FPPR. Visual Quality Class is
          designated as "Modification" under the Visual Landscape Inventory.
        </p>

        {/* Redacted/blurred section */}
        <div className="relative mt-3 overflow-hidden rounded bg-surface-2 p-3">
          <p className="select-none blur-[3px]">
            The Watershed Assessment (Appendix D, prepared by Kerr Wood Leidal
            Associates, dated September 2023) concludes that cumulative
            equivalent clear-cut area within the watershed does not exceed the
            established threshold of 25%. Current ECA is calculated at 22.8%,
            within acceptable hydrological parameters for peak flow sensitivity.
          </p>
        </div>
      </div>
    </div>
  )
}
