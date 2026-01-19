'use client';

interface ImportSummaryProps {
  data: {
    games_processed: number;
    games_inserted: number;
    games_updated: number;
    games_skipped: number;
    games_failed: number;
    date_range: {
      start: string;
      end: string;
    };
    processing_time_ms: number;
    failures: Array<{
      game_id: string;
      date: string;
      error: string;
    }>;
  };
}

export function ImportSummary({ data }: ImportSummaryProps) {
  const successRate =
    data.games_processed > 0
      ? ((data.games_inserted + data.games_skipped) / data.games_processed) * 100
      : 0;

  return (
    <div className="space-y-3">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-50 border border-blue-200 rounded p-2">
          <div className="text-xs font-medium text-blue-600 uppercase">
            Processed
          </div>
          <div className="text-xl font-bold text-blue-900">
            {data.games_processed}
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded p-2">
          <div className="text-xs font-medium text-green-600 uppercase">
            Inserted
          </div>
          <div className="text-xl font-bold text-green-900">
            {data.games_inserted}
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded p-2">
          <div className="text-xs font-medium text-gray-600 uppercase">
            Skipped
          </div>
          <div className="text-xl font-bold text-gray-900">
            {data.games_skipped}
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded p-2">
          <div className="text-xs font-medium text-red-600 uppercase">
            Failed
          </div>
          <div className="text-xl font-bold text-red-900">
            {data.games_failed}
          </div>
        </div>
      </div>

      {/* Success Rate */}
      <div className="bg-white border border-gray-200 rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Success Rate
          </span>
          <span className="text-sm font-bold text-gray-900">
            {successRate.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              successRate >= 90
                ? 'bg-green-600'
                : successRate >= 70
                ? 'bg-yellow-600'
                : 'bg-red-600'
            }`}
            style={{ width: `${successRate}%` }}
          ></div>
        </div>
      </div>

      {/* Date Range */}
      <div className="text-xs text-gray-600">
        <strong>Date Range:</strong>{' '}
        {new Date(data.date_range.start).toLocaleDateString()} -{' '}
        {new Date(data.date_range.end).toLocaleDateString()}
        <span className="ml-3">
          <strong>Processing Time:</strong> {data.processing_time_ms}ms
        </span>
      </div>

      {/* Failures */}
      {data.failures.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <div className="text-sm font-semibold text-red-800 mb-2">
            Failed Games ({data.failures.length})
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {data.failures.map((failure, idx) => (
              <div key={idx} className="text-xs text-red-700">
                <strong>{failure.game_id}</strong> ({failure.date}):{' '}
                {failure.error}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
