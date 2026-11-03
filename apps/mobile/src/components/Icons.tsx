/** Набор иконок из прототипа. Подключается один раз, используется через <Icon name="..." />. */
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <symbol id="i-home" viewBox="0 0 24 24"><path d="M3.5 11 12 3.8 20.5 11v8.2a1.3 1.3 0 0 1-1.3 1.3H15v-5.6H9v5.6H4.8a1.3 1.3 0 0 1-1.3-1.3z" /></symbol>
      <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></symbol>
      <symbol id="i-bag" viewBox="0 0 24 24"><path d="M5.5 8h13l1 11.6a1.4 1.4 0 0 1-1.4 1.5H5.9a1.4 1.4 0 0 1-1.4-1.5z" /><path d="M8.8 8V6.8a3.2 3.2 0 0 1 6.4 0V8" /></symbol>
      <symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 20.5s-7.7-4.6-9.4-9.6C1.4 7.5 3.5 4.6 6.7 4.6c2 0 3.6 1.1 5.3 3 1.7-1.9 3.3-3 5.3-3 3.2 0 5.3 2.9 4.1 6.3C19.7 15.9 12 20.5 12 20.5z" /></symbol>
      <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8.2" r="4" /><path d="M4.5 20.5c.6-4 3.8-6.3 7.5-6.3s6.9 2.3 7.5 6.3" /></symbol>
      <symbol id="i-mach" viewBox="0 0 24 24"><rect x="4.5" y="3.5" width="15" height="17" rx="2.5" /><path d="M8 7.5h8" /><path d="M9.5 20.5v-5h5v5" /><path d="M12 10.5V13" /></symbol>
      <symbol id="i-chev" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></symbol>
      <symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14" /></symbol>
      <symbol id="i-cup" viewBox="0 0 24 24"><path d="M5 9.5h13l-1.4 8a2.5 2.5 0 0 1-2.5 2H8.9a2.5 2.5 0 0 1-2.5-2z" /><path d="M18 11.5h1.2a2.3 2.3 0 0 1 0 4.6h-1.7" /><path d="M9 6c0-1 1-1 1-2.2M13 6c0-1 1-1 1-2.2" /></symbol>
      <symbol id="i-bell" viewBox="0 0 24 24"><path d="M10 5a2 2 0 1 1 4 0 7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></symbol>
      <symbol id="i-gear" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37 1 .608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></symbol>
      <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></symbol>
      <symbol id="i-x" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></symbol>
      <symbol id="i-phone" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></symbol>
    </svg>
  );
}

export type IconName = 'home' | 'grid' | 'bag' | 'heart' | 'user' | 'mach' | 'chev' | 'minus' | 'cup' | 'bell' | 'gear' | 'search' | 'plus' | 'check' | 'x' | 'phone';

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className ? `ic ${className}` : 'ic'} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
