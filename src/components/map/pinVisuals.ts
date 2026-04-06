export const MAP_PIN_VISUALS = {
  providerLocations: {
    colorClassName: 'text-clinic',
    colorValue: 'hsl(var(--clinic))',
    size: 14,
  },
  servicePresence: {
    colorClassName: 'text-service-presence',
    colorValue: 'hsl(var(--service-presence))',
    size: 14,
  },
  behavioralHealth: {
    colorClassName: 'text-behavioral-health',
    colorValue: 'hsl(var(--behavioral-health))',
    size: 14,
  },
} as const;

type SharedPinName = keyof typeof MAP_PIN_VISUALS;

export const getSharedPinSvgMarkup = (
  pin: SharedPinName,
  size?: number,
  options?: { color?: string; opacity?: number },
) => {
  const resolvedSize = size ?? MAP_PIN_VISUALS[pin].size;
  const color = options?.color ?? MAP_PIN_VISUALS[pin].colorValue;
  const opacity = options?.opacity ?? 1;

  // Use a larger wrapper div for reliable click target (min 28×28),
  // while keeping the visual SVG at the requested size, centered.
  const hitSize = Math.max(resolvedSize, 28);
  const offset = (hitSize - resolvedSize) / 2;

  return `
    <div style="width:${hitSize}px;height:${hitSize}px;position:relative;cursor:pointer;">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${resolvedSize}"
        height="${resolvedSize}"
        viewBox="0 0 24 24"
        fill="transparent"
        stroke="${color}"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        style="display:block;opacity:${opacity};overflow:visible;position:absolute;top:${offset}px;left:${offset}px;"
        aria-hidden="true"
      >
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
    </div>
  `.trim();
};
