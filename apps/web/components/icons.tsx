import type { ReactNode, SVGProps } from "react";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "viewBox"> & Readonly<{
  size?: number;
}>;

type IconBaseProps = IconProps & Readonly<{
  children: ReactNode;
}>;

function IconBase({ children, size = 16, ...props }: IconBaseProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></IconBase>;
}

export function FilterIcon(props: IconProps) {
  return <IconBase {...props}><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></IconBase>;
}

export function ServerIcon(props: IconProps) {
  return <IconBase {...props}><rect x="4" y="4" width="16" height="6" rx="2" /><rect x="4" y="14" width="16" height="6" rx="2" /><path d="M8 7h.01" /><path d="M8 17h.01" /></IconBase>;
}

export function ToolIcon(props: IconProps) {
  return <IconBase {...props}><path d="m14.5 5.5 4 4" /><path d="m16.5 3.5 4 4-11 11-5 1 1-5 11-11Z" /></IconBase>;
}

export function ShieldIcon(props: IconProps) {
  return <IconBase {...props}><path d="M12 3 5 6v5c0 4.5 2.9 8 7 10 4.1-2 7-5.5 7-10V6l-7-3Z" /></IconBase>;
}

export function KeyIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8" /><path d="m15 8 3 3" /><path d="m17 6 2 2" /></IconBase>;
}

export function SettingsIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="3" /><path d="M12 3v3" /><path d="M12 18v3" /><path d="m4.2 7.5 2.6 1.5" /><path d="m17.2 15 2.6 1.5" /><path d="m4.2 16.5 2.6-1.5" /><path d="m17.2 9 2.6-1.5" /></IconBase>;
}

export function ActivityIcon(props: IconProps) {
  return <IconBase {...props}><path d="M3 12h4l2-6 4 12 2-6h6" /></IconBase>;
}

export function AlertTriangleIcon(props: IconProps) {
  return <IconBase {...props}><path d="M12 4 3 20h18L12 4Z" /><path d="M12 9v5" /><path d="M12 17h.01" /></IconBase>;
}

export function CheckCircleIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></IconBase>;
}

export function XCircleIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6" /><path d="m15 9-6 6" /></IconBase>;
}

export function ClockIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></IconBase>;
}

export function CopyIcon(props: IconProps) {
  return <IconBase {...props}><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></IconBase>;
}

export function ExternalLinkIcon(props: IconProps) {
  return <IconBase {...props}><path d="M14 4h6v6" /><path d="m10 14 10-10" /><path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" /></IconBase>;
}

export function ChevronDownIcon(props: IconProps) {
  return <IconBase {...props}><path d="m6 9 6 6 6-6" /></IconBase>;
}

export function ChevronRightIcon(props: IconProps) {
  return <IconBase {...props}><path d="m9 6 6 6-6 6" /></IconBase>;
}

export function UserIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></IconBase>;
}

export function LogOutIcon(props: IconProps) {
  return <IconBase {...props}><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" /><path d="M14 16l4-4-4-4" /><path d="M18 12H9" /></IconBase>;
}

export function MoonIcon(props: IconProps) {
  return <IconBase {...props}><path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" /></IconBase>;
}

export function SunIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.9 4.9 1.4 1.4" /><path d="m17.7 17.7 1.4 1.4" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m4.9 19.1 1.4-1.4" /><path d="m17.7 6.3 1.4-1.4" /></IconBase>;
}

export function TerminalIcon(props: IconProps) {
  return <IconBase {...props}><path d="m4 7 5 5-5 5" /><path d="M12 17h8" /></IconBase>;
}

export function CodeIcon(props: IconProps) {
  return <IconBase {...props}><path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" /><path d="m14 4-4 16" /></IconBase>;
}

export function DatabaseIcon(props: IconProps) {
  return <IconBase {...props}><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5" /><path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" /></IconBase>;
}

export function LockIcon(props: IconProps) {
  return <IconBase {...props}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></IconBase>;
}

export function UnlockIcon(props: IconProps) {
  return <IconBase {...props}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-2" /></IconBase>;
}

export function PlusIcon(props: IconProps) {
  return <IconBase {...props}><path d="M12 5v14" /><path d="M5 12h14" /></IconBase>;
}

export function TrashIcon(props: IconProps) {
  return <IconBase {...props}><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1 14h10l1-14" /><path d="M9 7V4h6v3" /></IconBase>;
}

export function PowerIcon(props: IconProps) {
  return <IconBase {...props}><path d="M12 3v9" /><path d="M7 6.5a8 8 0 1 0 10 0" /></IconBase>;
}

export function EyeIcon(props: IconProps) {
  return <IconBase {...props}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></IconBase>;
}

export function EditIcon(props: IconProps) {
  return <IconBase {...props}><path d="M4 20h4l11-11-4-4L4 16v4Z" /><path d="m13 7 4 4" /></IconBase>;
}
