import { Building2, Car, HeartPulse, Home, Users, type LucideIcon } from "lucide-react";

import type { LineId } from "@/lib/hub/types";

export const LINE_ICONS: Record<LineId, LucideIcon> = {
  auto: Car,
  home: Home,
  medicare: HeartPulse,
  commercial: Building2,
  life: Users,
};
