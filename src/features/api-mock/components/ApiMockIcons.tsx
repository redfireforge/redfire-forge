/**
 * Inline Lucide-equivalent icons for the API Mock Studio (mockups 01-08).
 * Local SVGs follow the existing per-feature convention (see GraphqlCollectionsIcons)
 * and avoid the emoji glyphs that broke visual parity with the mockups.
 */
interface IconProps {
  className?: string;
  size?: number;
}

function Svg({ className = 'am-icon', size = 15, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** lucide: copy — copy server address */
export const CopyIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Svg>
);

/** lucide: check */
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>
);

/** lucide: settings-2 — server settings */
export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 7h-9" /><path d="M14 17H5" />
    <circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
  </Svg>
);

/** lucide: plus */
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5 12h14" /><path d="M12 5v14" /></Svg>
);

/** lucide: folder-plus */
export const FolderPlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 10v6" /><path d="M9 13h6" />
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </Svg>
);

/** lucide: list-filter — rule filters */
export const FilterIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 6h18" /><path d="M7 12h10" /><path d="M10 18h4" /></Svg>
);

/** lucide: wand-sparkles — pattern toolbox */
export const WandIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3 21 9-9" /><path d="M15 4V2" /><path d="M15 16v-2" />
    <path d="M8 9h2" /><path d="M20 9h2" /><path d="M17.8 11.8 19 13" />
    <path d="M15 9h.01" /><path d="M17.8 6.2 19 5" /><path d="m12.2 6.2-1.4-1.2" />
  </Svg>
);

/** lucide: pencil — edit pattern */
export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497Z" />
  </Svg>
);

/** lucide: trash-2 — remove row */
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);

/** lucide: x — close */
export const XIcon = (p: IconProps) => (
  <Svg {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Svg>
);

/** lucide: flask-conical — simulate */
export const FlaskIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 2v7.31a1 1 0 0 1-.17.55L4.2 18.4A2 2 0 0 0 5.87 21h12.26a2 2 0 0 0 1.67-2.6l-5.63-8.54a1 1 0 0 1-.17-.55V2" />
    <path d="M8.5 2h7" /><path d="M7 16h10" />
  </Svg>
);

/** lucide: rotate-cw — restart */
export const RestartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 1 1-3.36-7" /><path d="M21 3v6h-6" />
  </Svg>
);

/** lucide: square — stop */
export const StopIcon = (p: IconProps) => (
  <Svg {...p}><rect width="14" height="14" x="5" y="5" rx="2" /></Svg>
);

/** lucide: play — start */
export const PlayIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6 3l14 9-14 9V3z" /></Svg>
);

/** lucide: triangle-alert — conflict warning */
export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" /><path d="M12 17h.01" />
  </Svg>
);

/** lucide: download — import */
export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
  </Svg>
);

/** lucide: upload — export */
export const UploadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5" /><path d="M12 3v12" />
  </Svg>
);

/** lucide: maximize-2 / minimize-2 — dock expand */
export const MaximizeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 3h6v6" /><path d="M9 21H3v-6" />
    <path d="M21 3l-7 7" /><path d="M3 21l7-7" />
  </Svg>
);
export const MinimizeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 14h6v6" /><path d="M20 10h-6V4" />
    <path d="M14 10l7-7" /><path d="M3 21l7-7" />
  </Svg>
);

/** lucide: chevron-down / chevron-up / chevron-right — folder + dock disclosure */
export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
);
export const ChevronUpIcon = (p: IconProps) => (
  <Svg {...p}><path d="m18 15-6-6-6 6" /></Svg>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>
);

/** lucide: panel-left — open rules drawer on narrow viewports */
export const PanelLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" />
  </Svg>
);

/** lucide: arrow-up-down — adjust priority */
export const ArrowUpDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m21 16-4 4-4-4" /><path d="M17 20V4" />
    <path d="m3 8 4-4 4 4" /><path d="M7 4v16" />
  </Svg>
);

/** lucide: calendar — expiry date picker */
export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
  </Svg>
);
