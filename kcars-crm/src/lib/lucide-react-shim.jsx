import React from 'react'

const Icon = React.forwardRef(function Icon({ size = 24, color = 'currentColor', strokeWidth = 2, children, ...props }, ref) {
  return (
    <svg
      {...props}
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={props['aria-label'] ? undefined : true}
    >
      {children}
    </svg>
  )
})

const makeIcon = (children) => React.forwardRef(function LucideShimIcon(props, ref) {
  return <Icon ref={ref} {...props}>{children}</Icon>
})

const circle = <circle cx="12" cy="12" r="9" />
const box = <rect x="4" y="4" width="16" height="16" rx="2" />

export const AlertCircle = makeIcon(<><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></>)
export const AlertTriangle = makeIcon(<><path d="M12 3 22 20H2L12 3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>)
export const BarChart2 = makeIcon(<><path d="M6 20V10" /><path d="M12 20V4" /><path d="M18 20v-7" /></>)
export const Bell = makeIcon(<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>)
export const Calendar = makeIcon(<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4" /><path d="M16 2v4" /><path d="M3 10h18" /></>)
export const Car = makeIcon(<><path d="M5 12 7 6h10l2 6" /><path d="M3 12h18v6H3z" /><path d="M7 18v2" /><path d="M17 18v2" /></>)
export const CheckCircle2 = makeIcon(<><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>)
export const ChevronDown = makeIcon(<path d="m6 9 6 6 6-6" />)
export const CircleDollarSign = makeIcon(<><circle cx="12" cy="12" r="9" /><path d="M12 6v12" /><path d="M15 9.5A3 3 0 0 0 12 8c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2a4 4 0 0 1-3-1.5" /></>)
export const ClipboardList = makeIcon(<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6" /><path d="M9 11h6" /><path d="M9 15h6" /></>)
export const Clock = makeIcon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)
export const Columns3 = makeIcon(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d="M15 4v16" /></>)
export const DollarSign = makeIcon(<><path d="M12 3v18" /><path d="M16 7a4 4 0 0 0-4-2c-3 0-4 2-4 3s1 3 4 3 4 1 4 3-1 3-4 3a5 5 0 0 1-5-2" /></>)
export const Download = makeIcon(<><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>)
export const FileText = makeIcon(<><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4" /><path d="M8 12h8" /><path d="M8 16h8" /></>)
export const LayoutDashboard = makeIcon(<><rect x="3" y="3" width="7" height="8" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="15" width="7" height="6" rx="1" /></>)
export const MessageCircle = makeIcon(<><path d="M21 11.5a8.5 8.5 0 0 1-12 7.8L3 21l1.7-5.5A8.5 8.5 0 1 1 21 11.5Z" /></>)
export const Package = makeIcon(<><path d="m12 3 8 4-8 4-8-4 8-4Z" /><path d="M4 7v10l8 4 8-4V7" /><path d="M12 11v10" /></>)
export const Pencil = makeIcon(<><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13 7 4 4" /></>)
export const Phone = makeIcon(<><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1Z" /></>)
export const Plus = makeIcon(<><path d="M12 5v14" /><path d="M5 12h14" /></>)
export const Printer = makeIcon(<><path d="M6 9V3h12v6" /><rect x="6" y="14" width="12" height="7" rx="1" /><rect x="3" y="9" width="18" height="7" rx="2" /></>)
export const RefreshCw = makeIcon(<><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /></>)
export const RotateCcw = makeIcon(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>)
export const Search = makeIcon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>)
export const Trash2 = makeIcon(<><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 15h10l1-15" /><path d="M10 11v6" /><path d="M14 11v6" /></>)
export const TrendingUp = makeIcon(<><path d="m3 17 6-6 4 4 7-8" /><path d="M14 7h6v6" /></>)
export const Trophy = makeIcon(<><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H4a4 4 0 0 0 4 4" /><path d="M16 6h4a4 4 0 0 1-4 4" /><path d="M12 13v5" /><path d="M9 21h6" /></>)
export const User = makeIcon(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>)
export const UserPlus = makeIcon(<><circle cx="10" cy="8" r="4" /><path d="M3 21a7 7 0 0 1 14 0" /><path d="M19 8v6" /><path d="M16 11h6" /></>)
export const Users = makeIcon(<><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M17 11a4 4 0 0 0 0-6" /><path d="M22 21a7 7 0 0 0-5-6.7" /></>)
export const Wrench = makeIcon(<><path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-3 3-3-3 3-3Z" /></>)
export const X = makeIcon(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>)
export const XCircle = makeIcon(<><circle cx="12" cy="12" r="9" /><path d="M15 9 9 15" /><path d="m9 9 6 6" /></>)
export const Zap = makeIcon(<path d="M13 2 4 14h7l-1 8 10-13h-7l1-7Z" />)

export const Folder = makeIcon(box)
export const Circle = makeIcon(circle)
