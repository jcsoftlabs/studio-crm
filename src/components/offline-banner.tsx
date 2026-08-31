'use client';

import { useCallback, useEffect, useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { pending, remove, type ReplayOutcome } from '@/lib/offline-queue';

export function OfflineBanner() {
  const t = useTranslations('offline');
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [conflicts, setConflicts] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      setQueued((await pending()).length);
    } catch {
      setQueued(0);
    }
  }, []);

  const sync = useCallback(async () => {
    const items = await pending();
    if (items.length === 0) return;

    setSyncing(true);
    try {
      const response = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map((item) => ({ id: item.id, operation: item.operation })) }),
      });
      if (!response.ok) return;

      const { outcomes } = (await response.json()) as { outcomes: ReplayOutcome[] };
      // Une opération rejouée sort de la file, appliquée ou non : la garder
      // reviendrait à la retenter indéfiniment.
      for (const outcome of outcomes) await remove(outcome.id);
      setConflicts(outcomes.filter((outcome) => outcome.status !== 'applied').length);
      router.refresh();
    } finally {
      setSyncing(false);
      await refreshCount();
    }
  }, [refreshCount, router]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refreshCount();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    const goOnline = () => {
      setOnline(true);
      void sync();
    };
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const timer = setInterval(refreshCount, 5000);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(timer);
    };
  }, [refreshCount, sync]);

  if (online && queued === 0 && conflicts === 0) return null;

  return (
    <div
      role="status"
      className={
        online
          ? 'flex flex-wrap items-center gap-3 border-b border-border bg-muted px-4 py-2 text-sm'
          : 'flex flex-wrap items-center gap-3 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm'
      }
    >
      {!online ? <CloudOff className="size-4 shrink-0" aria-hidden /> : null}
      <span className="flex-1">
        {!online ? t('offline') : queued > 0 ? t('queued', { count: queued }) : t('conflicts', { count: conflicts })}
      </span>
      {online && queued > 0 ? (
        <Button size="sm" variant="outline" disabled={syncing} onClick={() => void sync()}>
          <RefreshCw className="size-4" aria-hidden />
          {syncing ? t('syncing') : t('sync')}
        </Button>
      ) : null}
    </div>
  );
}
