'use client'

import { useEffect, useState } from 'react'
import { Layers, RefreshCw, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  getNextNaplexCard,
  listNaplexDecks,
  reviewNaplexCard,
  type NaplexDeckInfo,
  type NaplexNextCardResponse,
  type NaplexReviewRating,
} from '@/lib/naplexApi'

export default function NaplexDecksPage() {
  const { toast } = useToast()
  const [decks, setDecks] = useState<NaplexDeckInfo[]>([])
  const [deckId, setDeckId] = useState<string>('top200')
  const [next, setNext] = useState<NaplexNextCardResponse | null>(null)
  const [showBack, setShowBack] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(false)

  const load = async (deck: string) => {
    try {
      setLoading(true)
      setNext(await getNextNaplexCard(deck))
    } catch (e: any) {
      toast({
        title: 'Failed to load deck',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        const list = await listNaplexDecks()
        setDecks(list.decks)
        const first = list.decks[0]?.deck_id || 'top200'
        setDeckId(first)
        await load(first)
      } catch (e: any) {
        toast({
          title: 'NAPLEX Decks',
          description: e?.message || 'Failed to load decks',
          variant: 'destructive',
        })
      }
    }
    init()
  }, [toast])

  const review = async (rating: NaplexReviewRating) => {
    if (!next?.card) return
    try {
      setReviewing(true)
      await reviewNaplexCard(deckId, next.card.id, { rating })
      setShowBack(false)
      await load(deckId)
    } catch (e: any) {
      toast({
        title: 'Failed to save review',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setReviewing(false)
    }
  }

  return (
    <div className="pt-2">
      <div className="flex items-center gap-2">
        <Layers className="h-6 w-6 text-[#344895]" />
        <h1 className="text-2xl sm:text-3xl font-montserrat font-bold text-[#344895]">Decks</h1>
      </div>
      <p className="mt-1 text-sm sm:text-base font-lato text-gray-700">
        Spaced repetition reviews for fast recall.
      </p>

      <div className="mt-6 bg-white border-2 border-[#3DD6D0] rounded-[20px] sm:rounded-[33px] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-montserrat font-bold text-black">Deck:</span>
            <select
              value={deckId}
              onChange={(e) => {
                const id = e.target.value
                setDeckId(id)
                setShowBack(false)
                load(id)
              }}
              className="rounded-full border-2 border-[#344895] bg-white px-4 py-2 font-montserrat font-bold text-[#344895]"
            >
              {decks.map((d) => (
                <option key={d.deck_id} value={d.deck_id}>
                  {d.title} ({d.total_cards})
                </option>
              ))}
              {decks.length === 0 && <option value="top200">Top 200</option>}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-full border-2 border-[#3DD6D0] bg-white px-4 py-2 font-montserrat font-bold text-[#1A1F71]">
              Due: {next?.due_count ?? 0} • New: {next?.new_count ?? 0}
            </div>
            <Button
              onClick={() => load(deckId)}
              disabled={loading || reviewing}
              className="rounded-full bg-white border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white font-montserrat font-bold"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="text-sm font-lato text-gray-600">Loading card...</div>
          ) : !next?.card ? (
            <div className="rounded-[20px] border-2 border-gray-200 p-6 text-center">
              <div className="text-lg font-montserrat font-bold text-black">All done for now</div>
              <p className="mt-2 text-sm font-lato text-gray-600">Come back later for your next review.</p>
            </div>
          ) : (
            <>
              <div
                className="rounded-[20px] sm:rounded-[33px] border-2 border-[#344895] bg-gradient-to-br from-white to-[#F0F0F0] p-6 sm:p-10 text-center shadow-sm"
              >
                <div className="text-xs font-montserrat font-bold text-gray-500">Card</div>
                <div className="mt-2 text-2xl sm:text-3xl font-montserrat font-extrabold text-[#1A1F71]">
                  {showBack ? next.card.back : next.card.front}
                </div>
                <div className="mt-6 flex items-center justify-center">
                  <Button
                    onClick={() => setShowBack((v) => !v)}
                    disabled={reviewing}
                    className="rounded-full bg-gradient-to-r from-[#344895] to-[#1A1F71] text-white font-montserrat font-bold h-12"
                  >
                    <RotateCw className="h-4 w-4" />
                    {showBack ? 'Show Front' : 'Show Answer'}
                  </Button>
                </div>
              </div>

              {showBack && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { rating: 'again', label: 'Again', style: 'bg-white border-2 border-red-500 text-red-600 hover:bg-red-50' },
                      { rating: 'hard', label: 'Hard', style: 'bg-white border-2 border-orange-500 text-orange-700 hover:bg-orange-50' },
                      { rating: 'good', label: 'Good', style: 'bg-white border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white' },
                      { rating: 'easy', label: 'Easy', style: 'bg-gradient-to-r from-[#3DD6D0] to-[#344895] text-white' },
                    ] as const
                  ).map((b) => (
                    <button
                      key={b.rating}
                      type="button"
                      onClick={() => review(b.rating)}
                      disabled={reviewing}
                      className={`h-12 rounded-full font-montserrat font-bold transition-colors ${b.style} ${reviewing ? 'opacity-60' : ''}`}
                    >
                      {reviewing ? 'Saving...' : b.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

