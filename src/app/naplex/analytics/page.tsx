'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, ClipboardList, Layers } from 'lucide-react'

import { useToast } from '@/hooks/use-toast'
import { getNaplexAnalytics, type NaplexAnalyticsResponse } from '@/lib/naplexApi'
import Link from 'next/link'

function bandColor(band: string): string {
  if (band === 'high') return 'text-green-700'
  if (band === 'medium') return 'text-orange-700'
  return 'text-red-700'
}

export default function NaplexAnalyticsPage() {
  const { toast } = useToast()
  const [data, setData] = useState<NaplexAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setData(await getNaplexAnalytics())
      } catch (e: any) {
        toast({
          title: 'Failed to load analytics',
          description: e?.message || 'Please try again.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  const readiness = data?.readiness_score ?? 0
  const accuracyPct = Math.round((data?.accuracy ?? 0) * 100)
  const attempts = data?.total_attempts ?? 0
  const band = data?.band ?? 'low'

  const domains = useMemo(() => (data?.domains ?? []).slice(0, 5), [data])
  const modules = useMemo(() => (data?.modules ?? []).slice(0, 4), [data])

  return (
    <div className="pt-2">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-[#344895]" />
        <h1 className="text-2xl sm:text-3xl font-montserrat font-bold text-[#344895]">
          Analytics
        </h1>
      </div>
      <p className="mt-1 text-sm sm:text-base font-lato text-gray-700">
        Track readiness and target weak areas.
      </p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white border-2 border-[#3DD6D0] rounded-[20px] sm:rounded-[33px] p-6 shadow-sm">
          <div className="text-sm font-montserrat font-bold text-gray-600">Readiness</div>
          <div className="mt-2 text-5xl font-montserrat font-extrabold text-[#1A1F71]">
            {loading ? '—' : readiness.toFixed(1)}
          </div>
          <div className="mt-2 text-sm font-lato text-gray-700">
            Band:{' '}
            <span className={`font-montserrat font-bold ${bandColor(band)}`}>{band}</span>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#3DD6D0] to-[#344895]"
              style={{ width: `${Math.min(100, Math.max(0, readiness))}%` }}
            />
          </div>
        </div>

        <div className="bg-white border-2 border-[#3DD6D0] rounded-[20px] sm:rounded-[33px] p-6 shadow-sm">
          <div className="text-sm font-montserrat font-bold text-gray-600">Last 30 days</div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border-2 border-gray-200 p-4">
              <div className="text-xs font-montserrat font-bold text-gray-500">Attempts</div>
              <div className="mt-1 text-2xl font-montserrat font-extrabold text-[#344895]">
                {loading ? '—' : attempts}
              </div>
            </div>
            <div className="rounded-2xl border-2 border-gray-200 p-4">
              <div className="text-xs font-montserrat font-bold text-gray-500">Accuracy</div>
              <div className="mt-1 text-2xl font-montserrat font-extrabold text-[#344895]">
                {loading ? '—' : `${accuracyPct}%`}
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <Link
              href="/naplex/practice"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 font-montserrat font-bold bg-[#344895] text-white hover:bg-[#1A1F71] transition-colors"
            >
              <ClipboardList className="h-4 w-4" />
              Practice
            </Link>
            <Link
              href="/naplex/decks"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 font-montserrat font-bold bg-white border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white transition-colors"
            >
              <Layers className="h-4 w-4" />
              Decks
            </Link>
          </div>
        </div>

        <div className="bg-white border-2 border-[#3DD6D0] rounded-[20px] sm:rounded-[33px] p-6 shadow-sm">
          <div className="text-sm font-montserrat font-bold text-gray-600">NAPLEX blueprint</div>
          <div className="mt-3 space-y-2">
            {loading ? (
              <div className="text-sm font-lato text-gray-600">Loading...</div>
            ) : domains.length === 0 ? (
              <div className="text-sm font-lato text-gray-600">No attempts yet. Start a quiz.</div>
            ) : (
              domains.map((d) => (
                <div key={d.domain_id} className="rounded-2xl border-2 border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-montserrat font-bold text-black">{d.domain}</div>
                    <div className="text-sm font-montserrat font-extrabold text-[#344895]">
                      {Math.round(d.accuracy * 100)}%
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#3DD6D0] to-[#344895]"
                      style={{ width: `${Math.min(100, Math.max(0, d.accuracy * 100))}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs font-lato text-gray-500">
                    {d.correct}/{d.attempts} correct
                  </div>
                </div>
              ))
            )}
          </div>

          {!loading && modules.length > 0 ? (
            <div className="mt-5">
              <div className="text-xs font-montserrat font-bold text-gray-600">Modules</div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {modules.map((m) => (
                  <div key={m.module} className="rounded-2xl border-2 border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-montserrat font-bold text-black">{m.module}</div>
                      <div className="text-sm font-montserrat font-extrabold text-[#344895]">
                        {Math.round(m.accuracy * 100)}%
                      </div>
                    </div>
                    <div className="mt-1 text-xs font-lato text-gray-500">
                      {m.correct}/{m.attempts} correct
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
