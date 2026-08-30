'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { guessMapping, parseCsv, type CsvTable } from '@/lib/csv';
import { importClients, type ImportResult } from './actions';

const FIELDS = ['firstName', 'lastName', 'phone', 'email', 'birthDate', 'notes'] as const;
type Field = (typeof FIELDS)[number];

export function ImportWizard() {
  const t = useTranslations('clients.import');
  const tf = useTranslations('clients.fields');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const router = useRouter();

  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(file: File) {
    const parsed = parseCsv(await file.text());
    setTable(parsed);
    setMapping(guessMapping(parsed.headers));
    setResult(null);
  }

  function run() {
    if (!table) return;
    if (mapping.firstName === null && mapping.lastName === null) {
      setResult({ error: 'firstNameRequired' });
      return;
    }

    const rows = table.rows.map((row) =>
      Object.fromEntries(
        FIELDS.map((field) => {
          const index = mapping[field];
          return [field, index === null || index === undefined ? '' : (row[index] ?? '')];
        }),
      ),
    );

    startTransition(async () => {
      const outcome = await importClients(rows);
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  const preview = table?.rows.slice(0, 5) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-5">
          <input
            id="csv-input"
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
          <Button type="button" onClick={() => document.getElementById('csv-input')?.click()}>
            {t('chooseFile')}
          </Button>
          {table ? (
            <span className="text-sm text-muted-foreground">
              {t('rowsDetected', { count: table.rows.length })}
            </span>
          ) : null}
        </CardContent>
      </Card>

      {table && table.headers.length > 0 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('mapping')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <div key={field} className="flex flex-col gap-1.5">
                  <Label htmlFor={`map-${field}`}>{tf(field as Field)}</Label>
                  <Select
                    id={`map-${field}`}
                    value={mapping[field] === null || mapping[field] === undefined ? '' : String(mapping[field])}
                    onChange={(event) =>
                      setMapping((prev) => ({
                        ...prev,
                        [field]: event.target.value === '' ? null : Number(event.target.value),
                      }))
                    }
                  >
                    <option value="">{t('ignore')}</option>
                    {table.headers.map((header, index) => (
                      <option key={`${header}-${index}`} value={index}>
                        {header === '' ? `#${index + 1}` : header}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('preview')}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {FIELDS.map((field) => (
                      <th key={field} className="whitespace-nowrap px-2 py-1.5 font-medium">
                        {tf(field as Field)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-border last:border-0">
                      {FIELDS.map((field) => {
                        const index = mapping[field];
                        const value = index === null || index === undefined ? '' : (row[index] ?? '');
                        return (
                          <td key={field} className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                            {value === '' ? '—' : value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="lg" onClick={run} disabled={pending}>
              {pending ? t('running') : t('run')}
            </Button>
            {result?.ok ? (
              <span className="text-sm text-muted-foreground">
                {t('done', { imported: result.imported ?? 0, skipped: result.skipped ?? 0 })}
              </span>
            ) : null}
            {result?.error ? (
              <span role="alert" className="text-sm text-destructive">
                {result.error === 'firstNameRequired'
                  ? t('firstNameRequired')
                  : te(result.error as 'generic')}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{t('skippedReason')}</p>
          {result?.ok ? (
            <Button type="button" variant="outline" onClick={() => router.push('/clients')}>
              {tc('back')}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
