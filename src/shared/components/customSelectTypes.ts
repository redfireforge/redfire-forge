export interface CustomSelectOption {
  value: string;
  label: string;
  detail?: string;
  /** Colored method/status dot — also tints the label, matching Requests. */
  swatch?: string;
  disabled?: boolean;
}

export interface CustomSelectGroup {
  label: string;
  options: CustomSelectOption[];
}

export type CustomSelectItems = CustomSelectOption[] | CustomSelectGroup[];
