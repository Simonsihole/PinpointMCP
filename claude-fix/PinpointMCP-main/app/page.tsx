export default function DashboardDemo() {
  return (
    <main className="p-10 max-w-5xl mx-auto space-y-12">
      <header className="pt-8 pb-4 border-b border-white/5">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
          Workspace Settings
        </h1>
        <p className="text-sm text-zinc-400 max-w-2xl">
          Manage your account profile, preferences, and view your weekly usage analytics. 
          Use <kbd className="px-1.5 py-0.5 border border-white/20 bg-white/5 rounded text-xs text-zinc-300">Alt+P</kbd> to pinpoint and redesign any of these elements.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Form Elements */}
        <div className="lg:col-span-2 space-y-6">
          <section className="glass-panel rounded-2xl p-8 transition-all duration-300">
            <h2 className="text-xl font-semibold text-white mb-6">Profile Information</h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Full Name</label>
                <input 
                  type="text" 
                  defaultValue="Simon Doe"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email Address</label>
                <input 
                  type="email" 
                  defaultValue="simon@example.com"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Bio</label>
                <textarea 
                  rows={3}
                  defaultValue="Software engineer working on next-gen AI developer tools."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 transition-colors resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/5">
                <span className="text-sm text-zinc-400">Profile updates will be visible to your team.</span>
                <button className="btn-brand rounded-xl text-white font-medium text-sm py-2.5 px-6">
                  Save Changes
                </button>
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-white mb-2">Danger Zone</h2>
            <p className="text-sm text-zinc-400 mb-6">Irreversible and destructive actions.</p>
            <div className="flex items-center justify-between p-4 rounded-xl border border-red-500/20 bg-red-500/5">
              <div>
                <h3 className="text-sm font-medium text-white">Delete Workspace</h3>
                <p className="text-xs text-zinc-500 mt-1">Permanently remove all data and projects.</p>
              </div>
              <button className="rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-medium text-sm py-2 px-4 transition-colors">
                Delete
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: Analytics Widget */}
        <div className="space-y-6">
          <section className="glass-panel rounded-2xl p-6 relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <h2 className="text-lg font-semibold text-white mb-6">Weekly Analytics</h2>
            
            <div className="space-y-6">
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">API Requests</div>
                <div className="text-3xl font-bold text-white flex items-baseline gap-2">
                  124.5K
                  <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">+14%</span>
                </div>
              </div>

              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Active Users</div>
                <div className="text-3xl font-bold text-white">
                  3,492
                </div>
              </div>

              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Error Rate</div>
                <div className="text-3xl font-bold text-white flex items-baseline gap-2">
                  0.12%
                  <span className="text-xs font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">+0.01%</span>
                </div>
              </div>
            </div>

            <button className="w-full mt-8 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-medium text-sm py-2.5 transition-colors">
              Download Full Report
            </button>
          </section>
        </div>

      </div>
    </main>
  );
}
