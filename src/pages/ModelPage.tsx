import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ConfusionMatrixHeatmap } from '@/components/charts/ConfusionMatrixHeatmap'
import { FeatureImportanceChart } from '@/components/charts/FeatureImportanceChart'
import { CardSkeleton } from '@/components/common/Skeleton'
import {
  Cpu,
  Database,
  ShieldCheck,
} from 'lucide-react'

export const ModelPage: React.FC = () => {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['modelMetrics'],
    queryFn: () => api.getModelMetrics(),
  })

  if (isLoading || !metrics) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#E2EBE5] pb-5">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#0F3D2E] tracking-tight">
            Classifier Architecture & Validation
          </h1>
          <p className="text-sm text-[#526D61] mt-1">
            Performance metrics, feature importance rankings, and validation confusion matrix.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-white border border-[#D5E3DC] text-[#405B50] font-mono shadow-2xs">
            {metrics.version}
          </span>
        </div>
      </div>

      {/* Model Spec & Headline Metrics Card */}
      <div className="editorial-card p-6 sm:p-8 bg-gradient-to-br from-white via-[#FAFBF8] to-white border border-[#D5E3DC]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#EBF4F0] text-[11px] font-mono text-[#0F3D2E] border border-[#D5E3DC]">
              <Cpu className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Multi-Stage Gradient Boosted Trees Ensemble</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#0F3D2E] tracking-tight">
              Tidewatch Multi-Stage Ensemble v2.4
            </h2>
            <p className="text-xs sm:text-sm text-[#3E574B] leading-relaxed max-w-xl">
              Trained on Canadian Institute for Cybersecurity CICIDS2017 benchmark dataset comprising 2.8 million bidirectional network flows across 5 days of benign and adversarial traffic.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-[#526D61]">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#10B981]" />
                78 Extracted Vector Dimensions
              </span>
              <span className="text-[#A7C4B5]">•</span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                0.03% False Positive Rate
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-white border border-[#E2EBE5] shadow-2xs">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#637D72] block">
                Overall Accuracy
              </span>
              <span className="font-display text-2xl font-bold text-[#0F3D2E] mt-1 block">
                {(metrics.overallAccuracy * 100).toFixed(2)}%
              </span>
              <span className="text-[10px] text-[#10B981] font-medium mt-0.5 block">
                Held-out test split
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#E2EBE5] shadow-2xs">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#637D72] block">
                Macro F1-Score
              </span>
              <span className="font-display text-2xl font-bold text-[#0F3D2E] mt-1 block">
                {(metrics.macroF1 * 100).toFixed(2)}%
              </span>
              <span className="text-[10px] text-[#526D61] mt-0.5 block">
                Across all rare classes
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#E2EBE5] shadow-2xs">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#637D72] block">
                Weighted F1-Score
              </span>
              <span className="font-display text-2xl font-bold text-[#0F3D2E] mt-1 block">
                {(metrics.weightedF1 * 100).toFixed(2)}%
              </span>
              <span className="text-[10px] text-[#526D61] mt-0.5 block">
                Volume weighted
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#E2EBE5] shadow-2xs">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#637D72] block">
                Avg Inference Time
              </span>
              <span className="font-display text-2xl font-bold text-[#0F3D2E] mt-1 block">
                {metrics.averageInferenceTimeMs} ms
              </span>
              <span className="text-[10px] text-[#10B981] font-medium mt-0.5 block">
                Line-rate capability
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Confusion Matrix Heatmap */}
      <ConfusionMatrixHeatmap data={metrics.confusionMatrix} />

      {/* Feature Importance Bar Chart */}
      <FeatureImportanceChart data={metrics.features} />

      {/* Per-Class Performance Breakdown Table */}
      <div className="editorial-card overflow-hidden">
        <div className="p-6 border-b border-[#E2EBE5] bg-[#FAFBF8]">
          <h3 className="font-display text-lg font-semibold text-[#0F3D2E] tracking-tight">
            Per-Class Validation Performance Metrics
          </h3>
          <p className="text-xs text-[#637D72] mt-0.5">
            Precision, Recall, F1, and Area Under the ROC Curve evaluated on test telemetry
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAFBF8] border-b border-[#E2EBE5] text-[11px] text-[#526D61]">
              <tr>
                <th className="py-3 px-4 font-semibold">Traffic Class</th>
                <th className="py-3 px-4 font-semibold">Precision</th>
                <th className="py-3 px-4 font-semibold">Recall</th>
                <th className="py-3 px-4 font-semibold">F1-Score</th>
                <th className="py-3 px-4 font-semibold">ROC-AUC</th>
                <th className="py-3 px-4 font-semibold text-right">Test Support</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF4F0]">
              {metrics.classes.map((cls) => (
                <tr key={cls.className} className="hover:bg-[#F8FAF9] transition-colors">
                  <td className="py-3 px-4 font-medium text-[#0F3D2E]">
                    {cls.className}
                  </td>
                  <td className="py-3 px-4 font-mono text-[#526D61]">
                    {(cls.precision * 100).toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 font-mono text-[#526D61]">
                    {(cls.recall * 100).toFixed(2)}%
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[#E2EBE5] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#10B981] rounded-full"
                          style={{ width: `${cls.f1Score * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-[#0F3D2E]">
                        {(cls.f1Score * 100).toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[#526D61]">
                    {(cls.rocAuc * 100).toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 font-mono text-[#526D61] text-right">
                    {cls.support.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
