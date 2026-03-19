import React from "react";
import WaveLogo from "./WaveLogo";

/**
 * Legacy name — the old pill animation was removed. Renders WaveLogo so existing
 * imports still typecheck. Prefer importing WaveLogo directly in new code.
 */
export default function VoicePills({
  active = true,
  size = 120,
}: {
  active?: boolean;
  size?: number;
}) {
  return <WaveLogo fill="#FFFFFF" animated={active} size={size} />;
}
