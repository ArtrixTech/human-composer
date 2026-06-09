import {
  BarChart3,
  FlaskConical,
  Folder,
  Palette,
  Rocket,
  Target,
  Wrench,
  Zap,
  type LucideProps,
} from "lucide-react";

import { normalizeProjectIcon, type ProjectIconKey } from "../../utils/projectUtils";

const ICON_MAP: Record<ProjectIconKey, React.ComponentType<LucideProps>> = {
  folder: Folder,
  rocket: Rocket,
  target: Target,
  zap: Zap,
  flask: FlaskConical,
  palette: Palette,
  chart: BarChart3,
  wrench: Wrench,
};

export function ProjectIcon({
  name,
  size = 14,
  ...props
}: { name: string } & LucideProps) {
  const key = normalizeProjectIcon(name);
  const Icon = ICON_MAP[key];
  return <Icon size={size} strokeWidth={1.75} aria-hidden {...props} />;
}
