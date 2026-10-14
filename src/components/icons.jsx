// 선 아이콘. 색은 글자색(currentColor)을 따른다.
function Svg({ size = 22, children, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const IconBack = (p) => <Svg {...p}><path d="M15 18l-6-6 6-6" /></Svg>;
export const IconClose = (p) => <Svg {...p}><path d="M18 6L6 18M6 6l12 12" /></Svg>;
export const IconPlus = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconSearch = (p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>;
export const IconChevron = (p) => <Svg {...p}><path d="M9 18l6-6-6-6" /></Svg>;
export const IconDown = (p) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>;
export const IconLock = (p) => (
  <Svg {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>
);
export const IconSheet = (p) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" /></Svg>
);
export const IconCalendar = (p) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>
);
export const IconChart = (p) => <Svg {...p}><path d="M4 19h16" /><path d="M5 15l4-4 4 3 6-7" /></Svg>;
export const IconCopy = (p) => (
  <Svg {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></Svg>
);
export const IconTrash = (p) => (
  <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>
);
export const IconImage = (p) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></Svg>
);
export const IconAlert = (p) => (
  <Svg {...p}><path d="M12 3l9 17H3z" /><path d="M12 10v4M12 17h.01" /></Svg>
);
export const IconCheck = (p) => <Svg {...p}><path d="M5 12l5 5 9-10" /></Svg>;
