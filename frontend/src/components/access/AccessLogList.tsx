'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { useLocale } from '@/i18n/context';
import { accessApi } from '@/services/access.api';
import { AccessEventView, AccessLogsFilters } from '@/types';
import AccessLogFilters from './AccessLogFilters';
import AccessLogTable from './AccessLogTable';
import AccessLogDetailsDrawer from './AccessLogDetailsDrawer';

const PAGE_SIZE = 25;

interface AccessLogListProps {
  showStaffFilter: boolean;
  showRawMetadata: boolean;
}

export default function AccessLogList({ showStaffFilter, showRawMetadata }: AccessLogListProps) {
  const { t } = useLocale();
  const [filters, setFilters] = useState<AccessLogsFilters>({ skip: 0, take: PAGE_SIZE });
  const [events, setEvents] = useState<AccessEventView[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedAccessLogId, setSelectedAccessLogId] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    try {
      const page = await accessApi.getAccessLogs(filters);
      if (id !== requestId.current) return;
      setEvents(page.data);
      setTotal(page.total);
    } catch {
      if (id !== requestId.current) return;
      setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

  const page = Math.floor((filters.skip ?? 0) / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToPage = (p: number) => {
    setFilters((f) => ({ ...f, skip: (p - 1) * PAGE_SIZE }));
  };

  return (
    <div>
      <AccessLogFilters
        value={filters}
        onChange={(next) => setFilters({ ...next, take: PAGE_SIZE, skip: 0 })}
        showStaffFilter={showStaffFilter}
      />

      {loading ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">{t('access_logs_loading')}</p>
          <div className="h-64 rounded-xl border border-slate-700/50 bg-slate-800/30 animate-pulse" />
        </div>
      ) : error ? (
        <div className="text-center py-12 border border-slate-700/50 rounded-xl text-slate-500">
          <p className="mb-3">{t('access_logs_load_error')}</p>
          <button onClick={load} className="text-sm text-teal-400 hover:text-teal-300 font-medium">
            {t('access_logs_reset')}
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 border border-slate-700/50 rounded-xl text-slate-500">
          <Inbox size={32} className="mx-auto mb-3 opacity-30" />
          <p>{t('access_logs_empty')}</p>
        </div>
      ) : (
        <>
          <AccessLogTable events={events} onSelect={setSelectedAccessLogId} />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-slate-500 font-mono">{page} / {totalPages}</span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}

      <AccessLogDetailsDrawer
        accessLogId={selectedAccessLogId}
        onClose={() => setSelectedAccessLogId(null)}
        showRawMetadata={showRawMetadata}
      />
    </div>
  );
}
