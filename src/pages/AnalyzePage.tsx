import React, { useState, useRef } from 'react'
import { api } from '@/lib/api'
import type { PredictionResult } from '@/types'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { formatDurationUs } from '@/lib/utils'
import {
  SAMPLE_CSV_CICIDS2017_DDOS,
  SAMPLE_CSV_CICIDS2017_PORTSCAN,
  SAMPLE_CSV_CICIDS2017_BENIGN,
} from '@/lib/mockData'
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  Search,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react'

export const AnalyzePage: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<PredictionResult[] | null>(null)
  const [summary, setSummary] = useState<{ total: number; attacks: number; benign: number } | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [classFilter, setClassFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const processCsvText = async (text: string, name: string) => {
    setIsAnalyzing(true)
    setFileName(name)
    try {
      const res = await api.analyzeCsv(text)
      setResults(res.results)
      setSummary(res.summary)
    } catch (err) {
      console.error('Failed to parse and analyze CSV:', err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          processCsvText(event.target.result as string, file.name)
        }
      }
      reader.readAsText(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          processCsvText(event.target.result as string, file.name)
        }
      }
      reader.readAsText(file)
    }
  }

  const loadSample = (sampleText: string, sampleName: string) => {
    processCsvText(sampleText, sampleName)
  }

  const handleExportCsv = () => {
    if (!results || results.length === 0) return
    const headers = [
      'Row ID',
      'Source IP',
      'Source Port',
      'Destination IP',
      'Destination Port',
      'Protocol',
      'Flow Duration (us)',
      'Flow Packets/s',
      'Prediction',
      'Confidence',
      'Severity',
      'Anomaly Tag',
    ]

    const rows = results.map((r) => [
      r.rowId,
      r.flow.srcIp,
      r.flow.srcPort,
      r.flow.dstIp,
      r.flow.dstPort,
      r.flow.protocol,
      r.flow.flowDuration,
      r.flow.flowPacketsPerSec,
      r.prediction,
      (r.confidence * 100).toFixed(1) + '%',
      r.severity,
      r.isAnomaly ? 'MALICIOUS' : 'BENIGN',
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `tidewatch_analyzed_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredResults = (results || []).filter((r) => {
    if (classFilter !== 'ALL' && r.prediction !== classFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        r.flow.srcIp.toLowerCase().includes(q) ||
        r.flow.dstIp.toLowerCase().includes(q) ||
        r.prediction.toLowerCase().includes(q) ||
        String(r.flow.dstPort).includes(q)
      )
    }
    return true
  })

  return (
    <div className="space-y-8">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#E2EBE5] pb-5">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#0F3D2E] tracking-tight">
            Batch Telemetry Analysis
          </h1>
          <p className="text-sm text-[#526D61] mt-1">
            Evaluate captured flow records against the 78-feature CICIDS2017 trained model.
          </p>
        </div>

        {results && (
          <button
            onClick={() => {
              setResults(null)
              setSummary(null)
              setFileName('')
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#526D61] hover:text-[#0F3D2E] hover:bg-[#EBF3EF] transition-colors border border-[#E2EBE5] self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset file</span>
          </button>
        )}
      </div>

      {/* Drag & Drop Upload Zone or Quick Samples */}
      {!results && (
        <div className="space-y-6">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`editorial-card p-12 text-center cursor-pointer border-2 border-dashed transition-all ${
              isDragging
                ? 'border-[#10B981] bg-[#F2FBF6]'
                : 'border-[#CBDAD1] hover:border-[#10B981] bg-white'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="w-12 h-12 rounded-full bg-[#EBF4F0] text-[#0F3D2E] flex items-center justify-center mx-auto mb-4 border border-[#D5E3DC]">
              <UploadCloud className="w-6 h-6 text-[#10B981]" />
            </div>
            <h3 className="font-display text-lg font-semibold text-[#0F3D2E]">
              {isAnalyzing ? 'Extracting features and classifying...' : 'Drop your CICIDS2017 CSV file here'}
            </h3>
            <p className="text-xs text-[#526D61] max-w-md mx-auto mt-1 mb-4 leading-relaxed">
              Supports standard CICFlowMeter and Wireshark bidirectional flow exports. Zero packet payload required.
            </p>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#0F3D2E] text-white hover:bg-[#16533F] transition-colors shadow-2xs">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#10B981]" />
              Browse local file
            </span>
          </div>

          {/* 1-Click Sample Datasets for instant testing */}
          <div className="editorial-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#10B981]" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#405B50]">
                Or test with pre-calibrated sample captures
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() =>
                  loadSample(SAMPLE_CSV_CICIDS2017_DDOS, 'cicids2017_ddos_loic_sample.csv')
                }
                className="p-4 rounded-xl text-left border border-[#E2EBE5] bg-[#FAFBF8] hover:bg-white hover:border-[#10B981] transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0F3D2E] group-hover:text-[#10B981]">
                    DDoS-LOIC Attack Flood
                  </span>
                  <Play className="w-3.5 h-3.5 text-[#A7C4B5] group-hover:text-[#10B981]" />
                </div>
                <p className="text-[11px] text-[#637D72] mt-1">
                  High packet rate volumetric flood against HTTP port 80.
                </p>
              </button>

              <button
                onClick={() =>
                  loadSample(SAMPLE_CSV_CICIDS2017_PORTSCAN, 'cicids2017_portscan_sweep.csv')
                }
                className="p-4 rounded-xl text-left border border-[#E2EBE5] bg-[#FAFBF8] hover:bg-white hover:border-[#10B981] transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0F3D2E] group-hover:text-[#10B981]">
                    SYN PortScan Sweep
                  </span>
                  <Play className="w-3.5 h-3.5 text-[#A7C4B5] group-hover:text-[#10B981]" />
                </div>
                <p className="text-[11px] text-[#637D72] mt-1">
                  Stealth reconnaissance probe across low-range service ports.
                </p>
              </button>

              <button
                onClick={() =>
                  loadSample(SAMPLE_CSV_CICIDS2017_BENIGN, 'cicids2017_benign_traffic.csv')
                }
                className="p-4 rounded-xl text-left border border-[#E2EBE5] bg-[#FAFBF8] hover:bg-white hover:border-[#10B981] transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0F3D2E] group-hover:text-[#10B981]">
                    Benign Web Telemetry
                  </span>
                  <Play className="w-3.5 h-3.5 text-[#A7C4B5] group-hover:text-[#10B981]" />
                </div>
                <p className="text-[11px] text-[#637D72] mt-1">
                  Regular HTTPS TLS 1.3 handshakes and recursive DNS lookups.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results View */}
      {results && summary && (
        <div className="space-y-6">
          {/* Summary Strip */}
          <div className="editorial-card p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EEF4F0]">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#637D72] block">
                Source File
              </span>
              <span className="font-mono text-sm font-semibold text-[#0F3D2E] mt-1 block truncate">
                {fileName || 'cicids2017_capture.csv'}
              </span>
            </div>

            <div className="pt-3 sm:pt-0 sm:pl-4">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#637D72] block">
                Total Evaluated Flows
              </span>
              <span className="font-display text-2xl font-bold text-[#0F3D2E] mt-0.5 block">
                {summary.total}
              </span>
            </div>

            <div className="pt-3 sm:pt-0 sm:pl-4">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#637D72] block">
                Attacks Detected
              </span>
              <span className="font-display text-2xl font-bold text-[#DC2626] mt-0.5 block">
                {summary.attacks}
              </span>
              <span className="text-[10px] text-[#637D72]">
                {((summary.attacks / summary.total) * 100).toFixed(1)}% threat ratio
              </span>
            </div>

            <div className="pt-3 sm:pt-0 sm:pl-4">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#637D72] block">
                Benign Traffic
              </span>
              <span className="font-display text-2xl font-bold text-[#10B981] mt-0.5 block">
                {summary.benign}
              </span>
              <span className="text-[10px] text-[#637D72]">Clean flows</span>
            </div>
          </div>

          {/* Filter, Search & Export Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-[#637D72] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by IP, port, or attack..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#E2EBE5] bg-white text-xs text-[#0F3D2E] placeholder-[#637D72] focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                />
              </div>

              {/* Class Filter */}
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[#E2EBE5] bg-white text-xs text-[#0F3D2E] focus:outline-none focus:ring-1 focus:ring-[#10B981]"
              >
                <option value="ALL">All Classes ({results.length})</option>
                <option value="BENIGN">Benign Only</option>
                <option value="DDoS-LOIC">DDoS-LOIC</option>
                <option value="PortScan">PortScan</option>
                <option value="DoS-GoldenEye">DoS-GoldenEye</option>
                <option value="Botnet">Botnet</option>
                <option value="DoS-Slowloris">DoS-Slowloris</option>
              </select>
            </div>

            {/* Export CSV button */}
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#0F3D2E] text-white hover:bg-[#16533F] transition-all shadow-2xs self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Export Analyzed CSV</span>
            </button>
          </div>

          {/* Results Table */}
          <div className="editorial-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFBF8] border-b border-[#E2EBE5] text-[11px] text-[#526D61]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Row #</th>
                    <th className="py-3 px-4 font-semibold">Endpoints (5-Tuple)</th>
                    <th className="py-3 px-4 font-semibold">Duration</th>
                    <th className="py-3 px-4 font-semibold">Throughput</th>
                    <th className="py-3 px-4 font-semibold">Classification</th>
                    <th className="py-3 px-4 font-semibold">Confidence</th>
                    <th className="py-3 px-4 font-semibold text-right">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF4F0]">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-[#637D72]">
                        No rows matched your search or class filter.
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((item) => (
                      <tr
                        key={item.rowId}
                        className={`hover:bg-[#F8FAF9] transition-colors ${
                          item.isAnomaly ? 'bg-red-50/20' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono text-[#526D61]">
                          #{item.rowId}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono text-[#0F3D2E] font-medium">
                            {item.flow.srcIp} → {item.flow.dstIp}:{item.flow.dstPort}
                          </div>
                          <span className="text-[10px] text-[#637D72] font-mono">
                            {item.flow.protocol} • SYN:{item.flow.synFlagCount} RST:{item.flow.rstFlagCount}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[#526D61]">
                          {formatDurationUs(item.flow.flowDuration)}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#526D61]">
                          {item.flow.flowPacketsPerSec.toLocaleString()} pkts/s
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold ${
                              item.isAnomaly ? 'text-[#DC2626]' : 'text-[#0F3D2E]'
                            }`}
                          >
                            {item.prediction}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[#E2EBE5] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  item.isAnomaly ? 'bg-[#DC2626]' : 'bg-[#10B981]'
                                }`}
                                style={{ width: `${item.confidence * 100}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] text-[#526D61]">
                              {(item.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <SeverityBadge severity={item.severity} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-[#FAFBF8] border-t border-[#E2EBE5] text-[11px] text-[#526D61] flex items-center justify-between">
              <span>Showing {filteredResults.length} of {results.length} total rows</span>
              <span className="font-mono text-[#0F3D2E]">Ensemble XGBoost Model</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
