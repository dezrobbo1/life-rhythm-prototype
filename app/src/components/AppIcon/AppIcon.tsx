import {
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  ClipboardList,
  Archive,
  Dumbbell,
  Heart,
  Home,
  Info,
  Leaf,
  Moon,
  Plus,
  RefreshCcw,
  RotateCcw,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Upload,
  Users,
  Utensils,
  Waves,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const iconMap = {
  add: Plus,
  admin: ClipboardList,
  antiDrift: Smartphone,
  backup: Upload,
  complete: CheckCircle2,
  default: Circle,
  delete: Trash2,
  emotion: Heart,
  food: Utensils,
  health: ShieldCheck,
  home: Home,
  info: Info,
  library: BookOpen,
  money: CircleDollarSign,
  movement: Dumbbell,
  plan: CalendarDays,
  pool: Archive,
  reset: RefreshCcw,
  restart: RotateCcw,
  sensory: Waves,
  setup: Settings,
  sleep: Moon,
  social: Users,
  startBoost: Sparkles,
  task: Target,
  today: Sun,
  windDown: Leaf,
  work: BriefcaseBusiness,
  x: X,
} satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof iconMap;

type AppIconProps = {
  className?: string;
  decorative?: boolean;
  name: AppIconName;
  size?: number;
  title?: string;
};

export function AppIcon({
  className = '',
  decorative = true,
  name,
  size = 20,
  title,
}: AppIconProps) {
  const Icon = iconMap[name];

  return (
    <Icon
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={!decorative ? title : undefined}
      className={`app-icon ${className}`.trim()}
      focusable="false"
      role={!decorative ? 'img' : undefined}
      size={size}
      strokeWidth={2.15}
    />
  );
}
