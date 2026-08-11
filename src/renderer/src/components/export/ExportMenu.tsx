import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { Button } from '../ui/Button';
import { exportCsv } from '../../lib/exportCsv';
import { exportJson } from '../../lib/exportJson';
import {
  videoExportHeaders,
  videoExportObject,
  videoExportRow,
} from '../../lib/videoExport';
import type { VideoDetail } from '@shared/types';

interface ExportMenuProps {
  /** Videos to export — already filtered/sorted by the calling page. */
  items: VideoDetail[];
  /** Filename prefix, e.g. `biblioteca` → `biblioteca-2026-08-11.csv`. */
  filePrefix: string;
  /** Goes into the JSON metadata wrapper as `origem`. */
  origin: string;
  className?: string;
}

/**
 * "Exportar" dropdown with CSV and JSON options. CSV is spreadsheet-friendly
 * (pt-BR Excel conventions); JSON is lossless with native types and a metadata
 * wrapper. Shared by the Biblioteca and Vídeos pages. Exports exactly what the
 * page currently shows (respecting active filters).
 */
export function ExportMenu({ items, filePrefix, origin, className }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const empty = items.length === 0;

  function handleCsv() {
    setOpen(false);
    exportCsv(filePrefix, videoExportHeaders, items.map(videoExportRow));
  }

  function handleJson() {
    setOpen(false);
    exportJson(
      filePrefix,
      {
        exportadoEm: new Date().toISOString(),
        origem: origin,
        total: items.length,
        videos: items.map(videoExportObject),
      },
      items.length
    );
  }

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        disabled={empty}
        title={empty ? 'Nada pra exportar' : `Exportar ${items.length} vídeo(s)`}
      >
        <Download className="h-4 w-4" />
        Exportar
        <ChevronDown className="h-3 w-3 opacity-60" />
      </Button>

      {open && !empty && (
        <div className="absolute right-0 z-40 mt-1 min-w-[220px] overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <button
            type="button"
            onClick={handleCsv}
            className="flex w-full items-start gap-2.5 px-3 py-2 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <span className="block font-medium">CSV (planilha)</span>
              <span className="block text-[11px] text-zinc-500">
                Abre no Excel / Google Sheets
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={handleJson}
            className="flex w-full items-start gap-2.5 px-3 py-2 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <FileJson className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <span className="block font-medium">JSON (dados completos)</span>
              <span className="block text-[11px] text-zinc-500">
                Todos os campos, sem perda
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
