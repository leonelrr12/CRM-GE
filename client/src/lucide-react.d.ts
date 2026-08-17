declare module 'lucide-react' {
  import type { FC, SVGAttributes } from 'react';
  interface IconProps extends SVGAttributes<SVGSVGElement> {
    size?: number | string;
  }
  type Icon = FC<IconProps>;
  export const ArrowLeft: Icon;
  export const Save: Icon;
  export const Trash2: Icon;
  export const MessageSquarePlus: Icon;
  export const Plus: Icon;
  export const Search: Icon;
  export const Download: Icon;
  export const Filter: Icon;
  export const Columns2: Icon;
  export const Shield: Icon;
  export const ShieldOff: Icon;
  export const Pencil: Icon;
  export const LogOut: Icon;
  export const User: Icon;
  export const LayoutDashboard: Icon;
  export const Users: Icon;
  export const Building2: Icon;
  export const TrendingUp: Icon;
  export const UserPlus: Icon;
  export const Activity: Icon;
  export const Clock: Icon;
  export const Mail: Icon;
  export const MessageCircle: Icon;
  export const RefreshCw: Icon;
  export const Send: Icon;
  export const Bell: Icon;
  export const CheckCheck: Icon;
  export const Webhook: Icon;
  export const KeyRound: Icon;
}
