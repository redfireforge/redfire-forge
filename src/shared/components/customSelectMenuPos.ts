export type CustomSelectMenuPlacement = 'below' | 'end';
export type CustomSelectMenuAlign = 'start' | 'auto';

export type SelectMenuBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
};

export type SelectMenuPos = {
  left?: number;
  right?: number;
  minWidth: number;
  width?: number;
  maxWidth?: number;
  top?: number;
  bottom?: number;
  openUp: boolean;
};

const GAP = 6;
const VIEW_PAD = 8;
const END_MENU_HEIGHT = 400;
const SEARCHABLE_MIN_WIDTH = 280;
const END_MIN_WIDTH = 420;

export function computeSelectMenuPos(opts: {
  rect: SelectMenuBox;
  viewport: { width: number; height: number };
  placement?: CustomSelectMenuPlacement;
  menuAlign?: CustomSelectMenuAlign;
  menuMinWidth?: number;
  menuMaxWidth?: number;
  menuMatchTriggerWidth?: boolean;
  searchable?: boolean;
}): SelectMenuPos {
  const {
    rect,
    viewport,
    placement = 'below',
    menuAlign = 'auto',
    menuMinWidth,
    menuMaxWidth,
    menuMatchTriggerWidth = false,
    searchable = false,
  } = opts;

  let minWidth = Math.max(rect.width, menuMinWidth ?? 0);
  if (searchable) minWidth = Math.max(minWidth, SEARCHABLE_MIN_WIDTH);
  if (placement === 'end') minWidth = Math.max(minWidth, menuMinWidth ?? END_MIN_WIDTH);

  let width: number | undefined;
  let maxWidth: number | undefined;
  if (menuMatchTriggerWidth) {
    minWidth = rect.width;
    width = rect.width;
    maxWidth = rect.width;
  } else if (menuMaxWidth != null) {
    maxWidth = menuMaxWidth;
    minWidth = Math.min(minWidth, menuMaxWidth);
  } else if (placement === 'end') {
    width = minWidth;
    maxWidth = Math.min(Math.max(minWidth, END_MIN_WIDTH), viewport.width - VIEW_PAD * 2);
  }

  if (placement === 'end') {
    return endPlacement(rect, viewport, minWidth, width, maxWidth);
  }
  return belowPlacement(rect, viewport, minWidth, width, maxWidth, menuAlign);
}

function belowPlacement(
  rect: SelectMenuBox,
  viewport: { width: number; height: number },
  minWidth: number,
  width: number | undefined,
  maxWidth: number | undefined,
  menuAlign: CustomSelectMenuAlign,
): SelectMenuPos {
  const spaceBelow = viewport.height - rect.bottom;
  const openUp = spaceBelow < 200;
  const overflowRight = rect.left + minWidth > viewport.width - VIEW_PAD;
  const alignEnd = menuAlign === 'start'
    ? overflowRight
    : rect.left + rect.width / 2 > viewport.width / 2;
  const hPos = alignEnd
    ? { right: viewport.width - rect.right }
    : { left: rect.left };
  const vPos = openUp
    ? { bottom: viewport.height - rect.top + GAP }
    : { top: rect.bottom + GAP };
  return { ...hPos, minWidth, ...(width != null ? { width } : {}), ...(maxWidth != null ? { maxWidth } : {}), ...vPos, openUp };
}

function endPlacement(
  rect: SelectMenuBox,
  viewport: { width: number; height: number },
  minWidth: number,
  width: number | undefined,
  maxWidth: number | undefined,
): SelectMenuPos {
  const needed = width ?? minWidth;
  const spaceRight = viewport.width - rect.right - GAP - VIEW_PAD;
  const spaceLeft = rect.left - GAP - VIEW_PAD;
  const openRight = spaceRight >= needed || spaceRight >= spaceLeft;
  const hPos = openRight
    ? { left: rect.right + GAP }
    : { right: viewport.width - rect.left + GAP };
  const top = Math.max(
    VIEW_PAD,
    Math.min(rect.top, viewport.height - VIEW_PAD - END_MENU_HEIGHT),
  );
  return {
    ...hPos,
    minWidth,
    ...(width != null ? { width } : {}),
    ...(maxWidth != null ? { maxWidth } : {}),
    top,
    openUp: false,
  };
}
