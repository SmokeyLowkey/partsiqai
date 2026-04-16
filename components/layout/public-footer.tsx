import Link from "next/link"

export function PublicFooter() {
  return (
    <footer className="bg-slate-950 text-white py-16 border-t border-slate-900">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-5 gap-12 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img src="/dark-theme-icon-logo-no-text.svg" alt="PartsIQ" className="h-10 w-10" />
                <h3 className="text-2xl font-bold">PartsIQ</h3>
              </div>
              <p className="text-slate-400 mb-6 max-w-md">
                AI-powered parts inventory management software with voice agent automation. Your AI calls suppliers, negotiates pricing, and manages the entire quote-to-order workflow.
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center px-4 py-2 bg-white text-slate-950 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
              >
                Start Free Trial
              </Link>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-3 text-slate-400">
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/security" className="hover:text-white transition-colors">Security</Link></li>
                <li><Link href="/solutions/ai-parts-search" className="hover:text-white transition-colors">AI Parts Search</Link></li>
                <li><Link href="/integrations" className="hover:text-white transition-colors">Integrations</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Solutions</h4>
              <ul className="space-y-3 text-slate-400">
                <li><Link href="/solutions/parts-inventory-tracking" className="hover:text-white transition-colors">Parts Inventory Tracking</Link></li>
                <li><Link href="/solutions/heavy-equipment-parts-catalog" className="hover:text-white transition-colors">Heavy Equipment Parts Catalog</Link></li>
                <li><Link href="/solutions/supplier-management-software" className="hover:text-white transition-colors">Supplier Management</Link></li>
                <li><Link href="/solutions/parts-inventory-management-software" className="hover:text-white transition-colors">Parts Management Software</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-3 text-slate-400">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><Link href="/support" className="hover:text-white transition-colors">Support</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-900 pt-8">
            <p className="text-slate-500 text-sm text-center">
              &copy; {new Date().getFullYear()} PartsIQ. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
