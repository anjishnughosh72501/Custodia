import React, { useState } from 'react';
import type { RewriteResult } from '../types';
import { Copy, Check, Sparkles, ShieldCheck, ArrowRight, ArrowLeftRight } from 'lucide-react';

interface Props {
  originalClaim: string;
  rewrite: RewriteResult | null;
  onApplyRewrite?: (newClaimText: string) => void;
}

export const ClaimComparisonView: React.FC<Props> = ({ originalClaim, rewrite, onApplyRewrite }) => {
  const [copied, setCopied] = useState(false);

  if (!rewrite || !rewrite.text) {
    return null;
  }

  const handleCopy = () => {
    if (rewrite.text) {
      navigator.clipboard.writeText(rewrite.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isReverified = rewrite.passes_recheck && rewrite.verdict?.status === 'SUPPORTED_BY_SUPPLIED_EVIDENCE';

  return (
    <div className="bg-white rounded-xl border border-indigo-200/80 shadow-xs overflow-hidden mb-6">
      <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-slate-900 text-sm">Deterministic Claim Alignment Comparison</h3>
        </div>

        <div className="flex items-center gap-2">
          {isReverified ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Re-Verified Against Rules</span>
            </span>
          ) : (
            <span className="text-[11px] font-medium bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200">
              Candidate Draft
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Original Claim Draft */}
          <div className="border border-rose-200 rounded-lg p-3.5 bg-rose-50/20">
            <div className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Original Draft (Contradicts / Stretches)</span>
              <span className="text-rose-500 font-mono text-[10px]">Unverified</span>
            </div>
            <p className="text-xs text-slate-800 leading-relaxed font-serif bg-white p-3 rounded border border-rose-100">
              {originalClaim}
            </p>
          </div>

          {/* Safer Verified Rewrite */}
          <div className="border border-emerald-200 rounded-lg p-3.5 bg-emerald-50/20">
            <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Faithful Evidence-Backed Rewrite</span>
              <span className="text-emerald-600 font-mono text-[10px]">Compliant</span>
            </div>
            <p className="text-xs text-slate-900 leading-relaxed font-serif bg-white p-3 rounded border border-emerald-100">
              {rewrite.text}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Generated via <span className="font-semibold text-slate-700">{rewrite.source}</span> and reverified across 7 dimensions.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Rewrite'}</span>
            </button>

            {onApplyRewrite && (
              <button
                type="button"
                onClick={() => onApplyRewrite(rewrite.text!)}
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Replace Draft</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
