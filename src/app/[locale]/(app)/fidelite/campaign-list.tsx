'use client';

import { useState } from 'react';
import { Check, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export type CampaignRow = {
  id: string;
  name: string;
  detail: string;
  phone: string;
  /// Message déjà rempli côté serveur, dans la langue de la cliente.
  message: string;
  link: string | null;
};

export function CampaignList({ rows, template }: { rows: CampaignRow[]; template: string }) {
  const t = useTranslations('fidelite');
  const [draft, setDraft] = useState(template);
  const [sent, setSent] = useState<Set<string>>(new Set());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="campaign-message">{t('message')}</Label>
        <Textarea
          id="campaign-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t('campaignHint')}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          // Le message affiché suit les retouches faites ici, sans perdre le nom déjà substitué.
          const custom = draft === template ? row.message : draft.replace(/\{client\}/g, row.name);
          const link = row.link
            ? `${row.link.split('?text=')[0]}?text=${encodeURIComponent(custom)}`
            : null;

          return (
            <li key={row.id}>
              <Card className={sent.has(row.id) ? 'opacity-60' : ''}>
                <CardContent className="flex flex-wrap items-start gap-3 pt-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-sm text-muted-foreground">{row.detail}</p>
                  </div>
                  {link ? (
                    <Button
                      asChild
                      variant={sent.has(row.id) ? 'ghost' : 'outline'}
                      onClick={() => setSent((prev) => new Set(prev).add(row.id))}
                    >
                      <a href={link} target="_blank" rel="noopener noreferrer">
                        {sent.has(row.id) ? (
                          <Check className="size-4" aria-hidden />
                        ) : (
                          <MessageCircle className="size-4" aria-hidden />
                        )}
                        {sent.has(row.id) ? t('sent') : t('send')}
                      </a>
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">{t('noPhone')}</span>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
