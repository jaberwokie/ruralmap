import { Phone, PhoneCall } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

/** Format a phone string to (###) ###-#### when possible, otherwise return as-is. */
export const formatPhone = (raw: string): string => {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
};

const cleanTel = (phone: string) => phone.replace(/[^\d+]/g, '');

type Variant = 'inline' | 'button' | 'detail';

interface ContactPhoneActionProps {
  phone: string | undefined | null;
  /** 'inline' = compact icon/text in lists, 'button' = action row pill, 'detail' = detail panel row with icon */
  variant?: Variant;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Shared phone contact action.
 * - Mobile: icon/button with tap-to-call
 * - Desktop: formatted phone number as text (still a tel: link)
 */
export const ContactPhoneAction = ({ phone, variant = 'inline', className = '', onClick }: ContactPhoneActionProps) => {
  const isMobile = useIsMobile();

  if (!phone) return null;

  const formatted = formatPhone(phone);
  const href = `tel:${cleanTel(phone)}`;
  const stop = (e: React.MouseEvent) => { e.stopPropagation(); onClick?.(e); };

  if (variant === 'detail') {
    // Detail panels: always show icon + number text
    return (
      <div className={`flex items-center gap-2 text-xs text-muted-foreground mb-1 ${className}`}>
        <Phone className="w-3 h-3 flex-shrink-0" />
        <a href={href} className="text-primary hover:underline" onClick={stop}>{formatted}</a>
      </div>
    );
  }

  if (variant === 'button') {
    // Action row button style
    if (isMobile) {
      return (
        <a
          href={href}
          className={`inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-2 py-1 text-[10px] font-medium text-foreground hover:bg-secondary transition-colors ${className}`}
          title={formatted}
          onClick={stop}
        >
          <PhoneCall className="w-3 h-3" />
          Call
        </a>
      );
    }
    // Desktop: show number as pill
    return (
      <a
        href={href}
        className={`inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-2 py-1 text-[10px] font-medium text-foreground hover:bg-secondary transition-colors ${className}`}
        title={formatted}
        onClick={stop}
      >
        <Phone className="w-2.5 h-2.5" />
        {formatted}
      </a>
    );
  }

  // variant === 'inline' — compact list items
  if (isMobile) {
    return (
      <a
        href={href}
        className={`flex-shrink-0 p-0.5 rounded hover:bg-secondary text-primary ${className}`}
        title={formatted}
        onClick={stop}
      >
        <Phone className="w-2.5 h-2.5" />
      </a>
    );
  }

  // Desktop inline: show number text
  return (
    <a
      href={href}
      className={`flex-shrink-0 text-[9px] text-primary hover:underline whitespace-nowrap ${className}`}
      onClick={stop}
    >
      {formatted}
    </a>
  );
};
