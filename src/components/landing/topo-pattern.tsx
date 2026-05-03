export function TopoPattern({ color = '#9333EA' }: { color?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg
        className="h-full w-full"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g fill="none" stroke={color} strokeWidth="0.8" opacity="0.05">
          <path d="M50 580 Q200 520 350 540 Q500 560 650 500 Q750 460 800 480" />
          <path d="M0 520 Q150 440 300 470 Q450 500 600 430 Q700 380 800 410" />
          <path d="M30 460 Q180 380 330 400 Q480 420 630 350 Q730 300 800 330" />
          <path d="M0 390 Q140 320 280 340 Q420 360 560 290 Q680 240 800 260" />
          <path d="M60 320 Q190 260 320 280 Q460 300 580 240 Q700 190 800 200" />
          <path d="M0 260 Q130 200 270 220 Q410 240 540 180 Q670 130 800 150" />
          <path d="M40 200 Q170 150 310 160 Q450 180 570 130 Q690 80 800 100" />
          <path d="M0 140 Q120 100 260 110 Q400 120 530 80 Q660 40 800 50" />
          <path d="M50 80 Q180 50 310 60 Q440 70 560 40 Q680 10 800 20" />
        </g>
      </svg>
    </div>
  )
}
