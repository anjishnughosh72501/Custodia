import React, { useState } from 'react';
import type { EvidenceConfidenceMap, DimensionConfidence } from '../types';
import { ShieldCheck, AlertTriangle, XCircle, Info, ChevronDown, ChevronUp, Scale, CheckCircle2 } from 'lucide-react';

interface Props {
  confidenceMap?: EvidenceConfidenceMap | null;
}

const DIMENSION_LABELS: Record<string, string> = {
  metric: 'Target Metric',
  value: 'Numeric Value',
  unit: 'Measurement Unit',
  population: 'Cohort / Audience',
  time_window: 'Time Horizon',
  conditions: 'Prerequisites & Setting',
  strength: 'Statement Strength',
};

export const EvidenceConfidenceMapCard: React.FC<Props> = ({ confidenceMap }) => {
  const [showFormula, setShowFormula] = useState(false);
  const [expandedDim, setExpandedDim] = useState<string | null>(null);

  if (!confidenceMap) {
    return null;
  }

  const {
    overall_percentage,
    overall_score,
    verdict,
    dimensions,
    supported_dimensions,
    contradicted_dimensions,
    unknown_dimensions,
    missing_qualifiers,
    decision_reasons,
  } = confidenceMap;

  const isSupported = verdict === 'SUPPORTED_BY_SUPPLIED_EVIDENCE';
  const isContradicted = verdict === 'NOT_SUPPORTED';

  const badgeColor = isSupported
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 ring-emerald-500/20'
    : isContradicted
    ? 'bg-rose-50 text-rose-800 border-rose-200 ring-rose-500/20'
    : 'bg-amber-50 text-amber-800 border-amber-200 ring-amber-500/20';

  const progressBg = isSupported
    ? 'bg-emerald-500'
    : isContradicted
    ? 'bg-rose-500'
    : 'bg-amber-500';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      {/* Header bar */}
      <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/60">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${badgeColor}`}>
            {isSupported ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            ) : isContradicted ? (
              <XCircle className="w-5 h-5 text-rose-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 text-base">Evidence Confidence Map</h3>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${badgeColor}`}>
                {isSupported ? 'Verified Grounding' : isContradicted ? 'Refuted / Contradicted' : 'Human Review Required'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Auditable 7-dimension deterministic verification breakdown (no black-box scoring)
            </p>
          </div>
        </div>

        {/* Confidence Gauge */}
        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-lg border border-slate-200">
          <div className="text-right">
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Deterministic Score</div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {overall_percentage}%
            </div>
          </div>
          <div className="w-24 bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressBg}`}
              style={{ width: `${Math.max(4, overall_percentage)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 text-center text-xs py-2.5 bg-slate-50/30">
        <div>
          <span className="text-emerald-700 font-semibold">{supported_dimensions.length}</span>{' '}
          <span className="text-slate-500">Dimensions Supported</span>
        </div>
        <div>
          <span className="text-rose-700 font-semibold">{contradicted_dimensions.length}</span>{' '}
          <span className="text-slate-500">Contradicted</span>
        </div>
        <div>
          <span className="text-amber-700 font-semibold">{unknown_dimensions.length}</span>{' '}
          <span className="text-slate-500">Requires Review</span>
        </div>
      </div>

      {/* Dimension breakdown list */}
      <div className="p-5 space-y-3">
        <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>7-Dimension Evidence Evaluation</span>
          <button
            type="button"
            onClick={() => setShowFormula(!showFormula)}
            className="text-indigo-600 hover:text-indigo-800 text-xs font-medium flex items-center gap-1 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            <span>{showFormula ? 'Hide Scoring Logic' : 'How Score is Calculated'}</span>
          </button>
        </div>

        {showFormula && (
          <div className="p-3.5 bg-indigo-50/60 rounded-lg border border-indigo-100 text-xs text-indigo-900 space-y-1.5 mb-4">
            <div className="font-semibold flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-indigo-600" />
              <span>Transparent Weighting Invariants</span>
            </div>
            <p>
              • <strong>Value (25%)</strong> &amp; <strong>Metric (20%)</strong> carry primary weight.
            </p>
            <p>
              • <strong>Unit (15%)</strong> &amp; <strong>Cohort/Population (15%)</strong> enforce audience bounds.
            </p>
            <p>
              • <strong>Invariance Cap:</strong> Any contradiction caps overall score at ≤ 30%. Any unverified dimension caps at ≤ 45%. Approval is never granted unless all 7 dimensions pass deterministically.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {dimensions.map((dim) => {
            const isDimSup = dim.status === 'supported';
            const isDimCon = dim.status === 'contradicted';
            const isExpanded = expandedDim === dim.dimension;

            const dimBg = isDimSup
              ? 'border-emerald-200/80 bg-emerald-50/30'
              : isDimCon
              ? 'border-rose-200/80 bg-rose-50/30'
              : 'border-amber-200/80 bg-amber-50/30';

            const statusText = isDimSup ? 'Supported' : isDimCon ? 'Contradicted' : 'Needs Review';
            const statusBadge = isDimSup
              ? 'text-emerald-700 bg-emerald-100/70 border-emerald-300'
              : isDimCon
              ? 'text-rose-700 bg-rose-100/70 border-rose-300'
              : 'text-amber-800 bg-amber-100/70 border-amber-300';

            return (
              <div
                key={dim.dimension}
                className={`border rounded-lg p-3 transition-colors ${dimBg}`}
              >
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedDim(isExpanded ? null : dim.dimension)}
                >
                  <div className="flex items-center gap-2">
                    {isDimSup ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : isDimCon ? (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-slate-800 text-xs">
                        {DIMENSION_LABELS[dim.dimension] || dim.dimension}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1.5">
                        (Weight: {Math.round(dim.weight * 100)}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${statusBadge}`}>
                      {statusText}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Quick explanation preview */}
                <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                  {dim.explanation}
                </p>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 text-xs space-y-1.5">
                    <div className="grid grid-cols-2 gap-2 bg-white/80 p-2 rounded border border-slate-200/40">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Claim Quote</div>
                        <div className="text-slate-800 italic mt-0.5">{dim.claim_raw || 'Not stated'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Evidence Quote</div>
                        <div className="text-slate-800 italic mt-0.5">{dim.evidence_raw || 'Not stated'}</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      <strong>Reason Code:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">{dim.reason_code}</code>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Missing qualifiers notice if any */}
        {missing_qualifiers.length > 0 && (
          <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
            <div className="font-semibold flex items-center gap-1.5 mb-1 text-amber-950">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Missing Qualifier Warnings ({missing_qualifiers.length})</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-amber-800 text-[11px]">
              {missing_qualifiers.map((mq, idx) => (
                <li key={idx}>{mq}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
