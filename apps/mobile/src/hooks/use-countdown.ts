/**
 * use-countdown.ts — un compte à rebours en secondes (lot auth mobile).
 * =====================================================================
 * Les écrans OTP tiennent TROIS compteurs (expiration du code, cooldown de
 * renvoi, verrou serveur) : le hook compte depuis une ÉCHÉANCE absolue
 * (`Date.now() + n×1000`), pas en décréments — un `setInterval` gelé par un
 * passage en arrière-plan retombe juste au moment du réveil.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useCountdown(initialSeconds = 0): [number, (seconds: number) => void] {
  const deadline = useRef(Date.now() + initialSeconds * 1000);
  const [seconds, setSeconds] = useState(initialSeconds);

  const restart = useCallback((next: number) => {
    deadline.current = Date.now() + next * 1000;
    setSeconds(next);
  }, []);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setSeconds(left);
      if (left <= 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [seconds]);

  return [seconds, restart];
}

/** `754` → `12:34` — l'affichage des trois compteurs OTP. */
export function formatMMSS(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
