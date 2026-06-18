'use client';

import { useEffect, useState, Fragment } from 'react';
import { api } from '../../services/api';
import { Log } from '../../types';

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  const loadLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getLogs(100, 0); // retrieve last 100 logs
      setLogs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve system logs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const getLogBadgeStyles = (event: string) => {
    switch (event) {
      case 'LEAD_RECEIVED':
        return 'text-blue-400 bg-blue-950/20 border-blue-950';
      case 'LEAD_QUALIFIED':
        return 'text-emerald-400 bg-emerald-950/20 border-emerald-950';
      case 'LEAD_DISQUALIFIED':
        return 'text-zinc-400 bg-zinc-900/40 border-zinc-900';
      case 'DUPLICATE_DETECTED':
        return 'text-yellow-400 bg-yellow-950/20 border-yellow-950';
      case 'VALIDATION_ERROR':
      case 'OLLAMA_UNAVAILABLE':
        return 'text-red-400 bg-red-950/20 border-red-950';
      default:
        return 'text-zinc-400 bg-zinc-900 border-zinc-850';
    }
  };

  const toggleExpandLog = (id: number) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden max-w-6xl mx-auto w-full p-8 space-y-6">
      {/* Top Header */}
      <header className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">System Events & Logs</h2>
          <p className="text-xs text-zinc-500 font-mono">Trace execution, LLM inputs/outputs, and exceptions</p>
        </div>
        <button
          onClick={loadLogs}
          className="border border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition duration-200 cursor-pointer select-none flex items-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh Logs
        </button>
      </header>

      {/* Main List */}
      <div className="flex-1 overflow-hidden bg-zinc-950 border border-zinc-900 rounded-xl flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {isLoading && logs.length === 0 ? (
            <div className="p-8 space-y-4">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="h-10 bg-zinc-900/50 border border-zinc-900 rounded animate-pulse"></div>
              ))}
            </div>
          ) : error ? (
            <div className="p-12 text-center text-zinc-500">
              <p className="text-sm text-red-400 font-medium">Failed to Retrieve Logs</p>
              <p className="text-xs text-zinc-600 mt-1">{error}</p>
              <button
                onClick={loadLogs}
                className="mt-3 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs px-3 py-1.5 rounded-lg border border-zinc-800 select-none"
              >
                Retry
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-16 text-center text-zinc-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10 mx-auto text-zinc-700 mb-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <p className="text-xs">No event logs available.</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Activities will be logged here upon lead submission.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-900/60 border-b border-zinc-900 text-[10px] font-mono text-zinc-500 uppercase select-none sticky top-0 backdrop-blur">
                  <th className="py-3 px-4 font-semibold w-12 text-center">ID</th>
                  <th className="py-3 px-4 font-semibold w-40">Timestamp</th>
                  <th className="py-3 px-4 font-semibold w-40">Event Type</th>
                  <th className="py-3 px-4 font-semibold w-40">Linked Lead ID</th>
                  <th className="py-3 px-4 font-semibold">Message / Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/50">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const logDate = new Date(log.timestamp).toLocaleString();
                  const message = typeof log.details === 'string' ? log.details : JSON.stringify(log.details);

                  return (
                    <Fragment key={log.id}>
                      <tr
                        onClick={() => toggleExpandLog(log.id)}
                        className={`hover:bg-zinc-900/30 cursor-pointer transition-colors duration-150 ${
                          isExpanded ? 'bg-zinc-900/25' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center font-mono text-zinc-600">{log.id}</td>
                        <td className="py-3.5 px-4 font-mono text-zinc-400">{logDate}</td>
                        <td className="py-3.5 px-4">
                          <span className={`font-mono text-[9px] uppercase px-2 py-0.5 rounded border font-medium ${getLogBadgeStyles(log.event)}`}>
                            {log.event}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-zinc-500">
                          {log.lead_id ? `${log.lead_id.slice(0, 8)}...` : 'None'}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-300 font-normal truncate max-w-xs">
                          {message}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-zinc-950 border-t border-zinc-900/40">
                          <td colSpan={5} className="p-4 bg-zinc-900/10">
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Payload Details</h4>
                              <pre className="bg-zinc-900 border border-zinc-850 rounded-lg p-3 text-[10px] font-mono text-zinc-400 overflow-x-auto max-h-48 leading-relaxed">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
