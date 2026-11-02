import React, { useState, useRef } from 'react';
import type { ParsedDocument, SourceRecord } from '../types';
import { uploadDocument, searchConnectors } from '../api';
import { Upload, FileText, Search, Database, Check, Loader2, AlertCircle, ExternalLink, Layers } from 'lucide-react';

interface Props {
  onSelectEvidence: (combinedText: string, sourceIds: string[], chunkIds: string[]) => void;
  isVerifying?: boolean;
}

export const MultiSourceUploader: React.FC<Props> = ({ onSelectEvidence, isVerifying = false }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'registry'>('upload');
  
  // Document state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<ParsedDocument[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedChunkIds, setSelectedChunkIds] = useState<Set<string>>(new Set());

  // Registry search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SourceRecord[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const file = files[0];
      const parsed = await uploadDocument(file);
      setUploadedDocs((prev) => [parsed, ...prev]);
      
      // Auto-select first few chunks
      const newSelected = new Set(selectedChunkIds);
      parsed.chunks.slice(0, 3).forEach((c) => newSelected.add(c.chunk_id));
      setSelectedChunkIds(newSelected);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload and parse document.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError(null);

    try {
      const res = await searchConnectors(searchQuery.trim());
      setSearchResults(res.records || []);
      if ((res.records || []).length === 0) {
        setSearchError('No matching literature, clinical trials, or fact-checks found.');
      }
    } catch (err: any) {
      setSearchError(err.message || 'Failed to search external evidence registries.');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleChunk = (chunkId: string) => {
    const next = new Set(selectedChunkIds);
    if (next.has(chunkId)) next.delete(chunkId);
    else next.add(chunkId);
    setSelectedChunkIds(next);
  };

  const toggleSource = (sourceId: string) => {
    const next = new Set(selectedSourceIds);
    if (next.has(sourceId)) next.delete(sourceId);
    else next.add(sourceId);
    setSelectedSourceIds(next);
  };

  const applySelectedEvidence = () => {
    const texts: string[] = [];
    const sourceIds: string[] = [];
    const chunkIds: string[] = [];

    // Collect chunks
    uploadedDocs.forEach((doc) => {
      doc.chunks.forEach((chunk) => {
        if (selectedChunkIds.has(chunk.chunk_id)) {
          const prov = `${chunk.filename} (p.${chunk.page_number || 1})`;
          texts.push(`[Source: ${prov}]\n${chunk.text}`);
          chunkIds.push(chunk.chunk_id);
        }
      });
    });

    // Collect external records
    searchResults.forEach((record) => {
      if (selectedSourceIds.has(record.source_id)) {
        texts.push(`[Source: ${record.source_name} - ${record.title}]\n${record.snippet}`);
        sourceIds.push(record.source_id);
      }
    });

    if (texts.length === 0) {
      alert('Please select at least one document passage or registry source.');
      return;
    }

    onSelectEvidence(texts.join('\n\n---\n\n'), sourceIds, chunkIds);
  };

  const totalSelected = selectedChunkIds.size + selectedSourceIds.size;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      {/* Tab bar */}
      <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 pt-3 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-t border-x -mb-px cursor-pointer ${
            activeTab === 'upload'
              ? 'bg-white border-slate-200 text-indigo-700 shadow-xs'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Evidence Documents</span>
          <span className="text-[10px] text-slate-400 font-normal">PDF, DOCX, XLSX, CSV, TXT</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('registry')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-t border-x -mb-px cursor-pointer ${
            activeTab === 'registry'
              ? 'bg-white border-slate-200 text-indigo-700 shadow-xs'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Live External Registries</span>
          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-medium">5 APIs</span>
        </button>
      </div>

      <div className="p-5">
        {activeTab === 'upload' ? (
          <div>
            {/* Drag & drop upload box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20 rounded-xl p-6 text-center cursor-pointer transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.csv,.txt"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-slate-200 shadow-xs mx-auto mb-3 text-indigo-600">
                {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              </div>
              <div className="text-sm font-semibold text-slate-800">
                {isUploading ? 'Validating Magic Bytes & Parsing Passages...' : 'Upload Evidence Document'}
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Upload benchmarks, clinical study reports, or data spreadsheets. Offsets and section coordinates are automatically indexed.
              </p>
              <div className="flex items-center justify-center gap-2 mt-3 text-[11px] text-slate-400 font-mono">
                <span className="px-1.5 py-0.5 bg-slate-100 rounded">PDF</span>
                <span className="px-1.5 py-0.5 bg-slate-100 rounded">DOCX</span>
                <span className="px-1.5 py-0.5 bg-slate-100 rounded">XLSX</span>
                <span className="px-1.5 py-0.5 bg-slate-100 rounded">CSV</span>
                <span className="px-1.5 py-0.5 bg-slate-100 rounded">TXT</span>
              </div>
            </div>

            {uploadError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Uploaded Documents List */}
            {uploadedDocs.length > 0 && (
              <div className="mt-5 space-y-4">
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Extracted Document Passages</span>
                  <span className="text-indigo-600 font-normal">
                    {selectedChunkIds.size} passage(s) selected
                  </span>
                </div>

                {uploadedDocs.map((doc) => (
                  <div key={doc.document_id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/40">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 text-xs font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <span>{doc.filename}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded uppercase">
                          {doc.file_type}
                        </span>
                      </div>
                      <span className="text-slate-500 font-normal text-[11px]">
                        {doc.total_chunks} passage(s) extracted
                      </span>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {doc.chunks.map((chunk) => {
                        const isSelected = selectedChunkIds.has(chunk.chunk_id);
                        return (
                          <div
                            key={chunk.chunk_id}
                            onClick={() => toggleChunk(chunk.chunk_id)}
                            className={`p-2.5 rounded border text-xs cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950'
                                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-semibold text-indigo-600 uppercase">
                                {chunk.page_number ? `Page ${chunk.page_number}` : ''}
                                {chunk.paragraph_index ? ` · Paragraph ${chunk.paragraph_index}` : ''}
                                {chunk.cell_reference ? ` · Cell ${chunk.cell_reference}` : ''}
                              </span>
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                                  isSelected
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3" />}
                              </div>
                            </div>
                            <p className="line-clamp-2 leading-relaxed">{chunk.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Live Registry Search form */}
            <form onSubmit={handleSearch} className="mb-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search DOI, PMID, NCT trial number, or topic (e.g. pembrolizumab oncology)..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Search Registries</span>
                </button>
              </div>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                <span>Integrated live:</span>
                <span className="font-medium text-slate-700">Crossref (DOI)</span>
                <span>•</span>
                <span className="font-medium text-slate-700">PubMed (PMID)</span>
                <span>•</span>
                <span className="font-medium text-slate-700">OpenAlex</span>
                <span>•</span>
                <span className="font-medium text-slate-700">ClinicalTrials.gov (NCT)</span>
                <span>•</span>
                <span className="font-medium text-slate-700">Google Fact Check</span>
              </div>
            </form>

            {searchError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}

            {/* Results list */}
            {searchResults.length > 0 && (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {searchResults.map((rec) => {
                  const isSelected = selectedSourceIds.has(rec.source_id);
                  return (
                    <div
                      key={rec.source_id}
                      onClick={() => toggleSource(rec.source_id)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-slate-900">{rec.title}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200">
                              {rec.source_name}
                            </span>
                            {rec.peer_reviewed && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-medium">
                                Peer-Reviewed
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {rec.authors.slice(0, 3).join(', ')} {rec.authors.length > 3 ? 'et al.' : ''} · {rec.publication_date || 'Registry Record'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={rec.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-400 hover:text-indigo-600"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 bg-slate-50/70 p-1.5 rounded border border-slate-100">
                        {rec.snippet}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Action button to load selected evidence into verification flow */}
        {totalSelected > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-600 font-medium">
              <strong>{totalSelected}</strong> source item(s) selected
            </span>
            <button
              type="button"
              onClick={applySelectedEvidence}
              disabled={isVerifying}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Use Selected Sources as Evidence</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
