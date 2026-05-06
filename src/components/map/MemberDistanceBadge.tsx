import { Navigation, Route } from 'lucide-react';
import { haversineKm as haversineKmLocal, getMemberTierLabel } from '@/lib/operational';
import { checkHighwayAccess } from '@/utils/highwayProximity';

const TIER_LABEL_COLOR: Record<string, string> = {
  'Local Access': 'text-green-600',
  'Managed Access': 'text-amber-600',
  'High Friction': 'text-red-500',
  'Non-Viable': 'text-muted-foreground',
};

export const MemberDistanceBadge = ({
  memberLocation,
  targetLat,
  targetLng,
}: {
  memberLocation: { lat: number; lng: number };
  targetLat: number;
  targetLng: number;
}) => {
  const km = haversineKmLocal(memberLocation.lat, memberLocation.lng, targetLat, targetLng);
  const mi = Math.round(km * 0.621371 * 10) / 10;
  const tier = getMemberTierLabel(mi);
  const memberHw = checkHighwayAccess(memberLocation.lat, memberLocation.lng);
  const targetHw = checkHighwayAccess(targetLat, targetLng);
  const sharedCorridor = memberHw.hasAccess && targetHw.hasAccess && memberHw.corridor?.id === targetHw.corridor?.id;
  const targetOnHighway = targetHw.hasAccess;
  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 rounded bg-muted/50 px-2 py-1 text-[10px]">
        <Navigation className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <span className="font-medium text-foreground">{mi.toFixed(1)} mi from member</span>
        <span className="text-muted-foreground">·</span>
        <span className={`font-medium ${TIER_LABEL_COLOR[tier]}`}>{tier}</span>
      </div>
      {sharedCorridor && (
        <div className="flex items-center gap-1 mt-1 px-2 text-[9px] text-muted-foreground/70">
          <Route className="w-2.5 h-2.5 flex-shrink-0" />
          <span>Direct {targetHw.corridor?.label} highway access improves travel reliability</span>
        </div>
      )}
      {!sharedCorridor && targetOnHighway && (
        <div className="flex items-center gap-1 mt-1 px-2 text-[9px] text-muted-foreground/70">
          <Route className="w-2.5 h-2.5 flex-shrink-0" />
          <span>Accessible via {targetHw.corridor?.label}</span>
        </div>
      )}
    </div>
  );
};

export default MemberDistanceBadge;
