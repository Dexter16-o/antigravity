import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles, AlertTriangle, ArrowBigUp, ArrowBigDown, MessageCircle, MessageSquare } from 'lucide-react';

export const metadata = {
  title: 'CampusYak Design System Style Guide',
  description: 'Style guide for CampusYak design tokens and interactive elements.'
};

export default function StyleGuidePage() {
  // 1. Gate route from production environments (returns 404 secure)
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <main className="min-h-screen bg-bg-cream text-ink py-10 px-4 transition-colors duration-300">
      <div className="max-w-2xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-800 pb-5">
          <Link href="/" className="inline-flex items-center space-x-2 text-xs font-bold text-gray-500 hover:text-ink transition-colors mb-4">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to CampusYak</span>
          </Link>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-primary/10 text-primary dark:text-amber-500 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black tracking-tight">Style Guide & Design Tokens</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Developer tool mapping visual states, accessibility contrast ratios, and interactive component tokens.
          </p>
        </div>

        {/* Color Palette section */}
        <section className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-400 dark:text-gray-600">Color Swatches & Contrast</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            
            {/* Primary Yellow */}
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-3 rounded-2xl flex flex-col justify-between h-28">
              <div className="w-full h-8 bg-primary rounded-xl flex items-center justify-center text-xs font-bold text-ink shadow-sm">
                Primary Yellow
              </div>
              <div className="mt-2">
                <p className="text-[11px] font-bold">--primary</p>
                <p className="text-[10px] text-gray-400 font-bold">Contrast: 8.26:1 (Passes AA/AAA)</p>
              </div>
            </div>

            {/* Ink Text */}
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-3 rounded-2xl flex flex-col justify-between h-28">
              <div className="w-full h-8 bg-ink rounded-xl border border-gray-200/10 flex items-center justify-center text-xs font-bold text-bg-cream shadow-sm">
                Ink Text
              </div>
              <div className="mt-2">
                <p className="text-[11px] font-bold">--ink</p>
                <p className="text-[10px] text-gray-400 font-bold">Contrast: 16.5:1 (Passes AA/AAA)</p>
              </div>
            </div>

            {/* Surface Background */}
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-3 rounded-2xl flex flex-col justify-between h-28">
              <div className="w-full h-8 bg-bg-cream rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-center text-xs font-bold text-ink shadow-sm">
                Surface Cream
              </div>
              <div className="mt-2">
                <p className="text-[11px] font-bold">--background</p>
                <p className="text-[10px] text-gray-400 font-bold">Background Surface fill</p>
              </div>
            </div>

            {/* Upvote Green */}
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-3 rounded-2xl flex flex-col justify-between h-28">
              <div className="w-full h-8 bg-upvote rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm">
                Upvote Green
              </div>
              <div className="mt-2">
                <p className="text-[11px] font-bold">--upvote</p>
                <p className="text-[10px] text-gray-400 font-bold">Tactile positive action</p>
              </div>
            </div>

            {/* Downvote Rose */}
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-3 rounded-2xl flex flex-col justify-between h-28">
              <div className="w-full h-8 bg-downvote rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm">
                Downvote Rose
              </div>
              <div className="mt-2">
                <p className="text-[11px] font-bold">--downvote</p>
                <p className="text-[10px] text-gray-400 font-bold">Muted Rose (Differentiated)</p>
              </div>
            </div>

            {/* Danger Red */}
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-3 rounded-2xl flex flex-col justify-between h-28">
              <div className="w-full h-8 bg-danger rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm">
                Danger Red
              </div>
              <div className="mt-2">
                <p className="text-[11px] font-bold">--danger</p>
                <p className="text-[10px] text-gray-400 font-bold">Destructive/Flag actions only</p>
              </div>
            </div>

          </div>
        </section>

        {/* Typography section */}
        <section className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-400 dark:text-gray-600">Typography (Outfit)</h2>
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-5 rounded-3xl space-y-4">
            <div>
              <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase mb-1">Black Title (20px)</p>
              <h1 className="text-xl font-black">CampusYak Bulletin Board</h1>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase mb-1">Post Content / Legible Body (16px)</p>
              <p className="text-base leading-relaxed">
                This is a larger, more legible body text mapped to the post card content. Legibility is prioritized over tight layout density because students spend significant time reading text-heavy campus conversations.
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase mb-1">Small Meta Label (12px)</p>
              <p className="text-xs text-gray-500 font-semibold">Posted in Placements • 5 minutes ago</p>
            </div>
          </div>
        </section>

        {/* Button states */}
        <section className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-400 dark:text-gray-600">Buttons & States</h2>
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-5 rounded-3xl grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Primary CTA */}
            <div className="space-y-1">
              <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Primary Action (Yellow)</p>
              <button className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-ink text-xs font-black transition-all duration-150 active:scale-95 shadow-sm">
                Primary Button
              </button>
            </div>

            {/* Danger Button */}
            <div className="space-y-1">
              <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Danger Action (Crimson)</p>
              <button className="w-full py-2.5 rounded-xl bg-danger hover:bg-danger/95 text-white text-xs font-black transition-all duration-150 active:scale-95 shadow-sm">
                Delete Content
              </button>
            </div>

            {/* Voting Component Display */}
            <div className="space-y-1">
              <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Tactile Active Upvote</p>
              <div className="flex items-center w-28 bg-gray-50 dark:bg-gray-800 rounded-xl p-0.5 border border-gray-100 dark:border-gray-800/80">
                <button className="p-1.5 rounded-lg text-upvote bg-upvote/10 border-upvote/20 transition-all duration-150 active:scale-[0.80] ease-out">
                  <ArrowBigUp className="w-5 h-5 fill-current" />
                </button>
                <span className="px-2 text-sm font-bold text-upvote text-center flex-1">12</span>
                <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-all duration-150 active:scale-[0.80] ease-out">
                  <ArrowBigDown className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Active Downvote Display */}
            <div className="space-y-1">
              <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Tactile Active Downvote</p>
              <div className="flex items-center w-28 bg-gray-50 dark:bg-gray-800 rounded-xl p-0.5 border border-gray-100 dark:border-gray-800/80">
                <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-all duration-150 active:scale-[0.80] ease-out">
                  <ArrowBigUp className="w-5 h-5" />
                </button>
                <span className="px-2 text-sm font-bold text-downvote text-center flex-1">-4</span>
                <button className="p-1.5 rounded-lg text-downvote bg-downvote/10 border-downvote/20 transition-all duration-150 active:scale-[0.80] ease-out">
                  <ArrowBigDown className="w-5 h-5 fill-current" />
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* Mock Static Card */}
        <section className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-400 dark:text-gray-600">Sample Card Layout</h2>
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 text-xs font-bold rounded-lg border bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/40">
                  🐢 Turquoise
                </span>
                <span className="text-gray-450 dark:text-gray-500 text-xs font-bold bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-lg border border-gray-100 dark:border-gray-800/50">
                  Hostel/Mess
                </span>
                <span className="text-gray-400 dark:text-gray-600 text-xs">2 minutes ago</span>
              </div>
              <button className="text-gray-400 hover:text-danger p-1 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
              </button>
            </div>
            <p className="text-base leading-relaxed text-ink">
              Mess food quality is actually quite good today. Paneer butter masala is a solid 9/10! 🍲😋
            </p>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800/80">
              <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl p-0.5 border border-gray-100 dark:border-gray-850">
                <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-all duration-150 active:scale-[0.80] ease-out">
                  <ArrowBigUp className="w-5 h-5" />
                </button>
                <span className="px-2 text-sm font-bold text-gray-500 text-center min-w-[20px]">0</span>
                <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-all duration-150 active:scale-[0.80] ease-out">
                  <ArrowBigDown className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center space-x-1.5 text-gray-400 px-3 py-1.5 rounded-xl">
                <MessageCircle className="w-4.5 h-4.5" />
                <span className="text-xs font-bold">5 replies</span>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
