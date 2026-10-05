'use client';

import { useEffect, useState } from 'react';
import { formatClock } from '@/lib/clock';

/** Cuenta regresiva de referencia para el panel (el reloj válido es siempre el del servidor). */
export function Remaining({ deadlineAt, serverNow }: { deadlineAt: string; serverNow: string }) {
  const [offset] = useState(() => Date.parse(serverNow) - Date.now());
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, Date.parse(deadlineAt) - (Date.now() + offset));
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatClock(ms)}</span>;
}
