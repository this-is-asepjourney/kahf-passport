'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { formatIDR } from '@/lib/utils';
import type { Product, Customer, SkinProfile, ProductCategory } from '@/types';
import Link from 'next/link';

type SkinFilter = 'all' | 'oily_acne' | 'dry_sensitive' | 'dull_brightening' | 'pores_blackhead';

export default function BaProductsPage() {
  const { user, loading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<SkinProfile | null>(null);

  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [skinFilter, setSkinFilter] = useState<SkinFilter>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      loadData();
    }
  }, [user, loading]);

  const loadData = async () => {
    setDataLoading(true);
    try {
      // 1. Fetch active products, customers, and categories concurrently
      const [prodSnap, custSnap, catSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), where('isActive', '==', true))),
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'productCategories')),
      ]);

      setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
      setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[]);
      setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() })) as ProductCategory[]);
    } catch (err) {
      console.error('Error loading products, categories & customers:', err);
    } finally {
      setDataLoading(false);
    }
  };

  // Fetch skin profile when a customer is selected
  const handleSelectCustomer = async (cId: string) => {
    setSelectedCustomerId(cId);
    if (!cId) {
      setSelectedCustomerProfile(null);
      return;
    }
    try {
      const snap = await getDoc(doc(db, 'skinProfiles', cId));
      if (snap.exists()) {
        setSelectedCustomerProfile({ id: snap.id, ...snap.data() } as SkinProfile);
      } else {
        setSelectedCustomerProfile(null);
      }
    } catch (err) {
      console.error('Error fetching customer skin profile:', err);
    }
  };

  // Helper to resolve category name & icon
  const getCategoryDetails = (catIdOrName: string) => {
    const found = categories.find(
      c =>
        c.id === catIdOrName ||
        c.slug === catIdOrName ||
        c.name.toLowerCase() === catIdOrName?.toLowerCase()
    );
    return found
      ? { name: found.name, icon: found.icon || '🧴' }
      : { name: catIdOrName || 'Kahf Men', icon: '🧴' };
  };

  // Check if a product is relevant to a skin profile or filter
  const isProductMatch = (product: Product, filter: SkinFilter, profile: SkinProfile | null): boolean => {
    const text = (product.name + ' ' + (product.description || '') + ' ' + (product.categoryId || '')).toLowerCase();

    // If customer profile is loaded, check against customer's specific skin type & concerns
    if (profile) {
      const type = profile.skinType?.toLowerCase();
      const concerns = (profile.concerns || []).map(c => c.toLowerCase());

      if (type === 'oily' && (text.includes('acne') || text.includes('oil') || text.includes('matte') || text.includes('sebum'))) return true;
      if (type === 'dry' && (text.includes('hydrat') || text.includes('moistur') || text.includes('nourish'))) return true;
      if (concerns.some(c => c.includes('jerawat') && (text.includes('acne') || text.includes('salicylic')))) return true;
      if (concerns.some(c => (c.includes('kusam') || c.includes('flek')) && (text.includes('bright') || text.includes('exfoliat') || text.includes('lighten')))) return true;
      if (concerns.some(c => (c.includes('pori') || c.includes('komedo')) && (text.includes('comedo') || text.includes('pore') || text.includes('scrub')))) return true;
    }

    if (filter === 'all') return true;
    if (filter === 'oily_acne') return text.includes('oil') || text.includes('acne') || text.includes('jerawat') || text.includes('matte');
    if (filter === 'dry_sensitive') return text.includes('hydrat') || text.includes('moistur') || text.includes('gentle') || text.includes('sensitif');
    if (filter === 'dull_brightening') return text.includes('bright') || text.includes('exfoliat') || text.includes('glow') || text.includes('light');
    if (filter === 'pores_blackhead') return text.includes('comedo') || text.includes('pore') || text.includes('triple action') || text.includes('charcoal');

    return true;
  };

  // Filtered Products considering Search, Category, and Skin Condition
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // 1. Keyword search (Name, SKU, Description, Category)
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = p.sku.toLowerCase().includes(q);
        const matchesDesc = (p.description || '').toLowerCase().includes(q);
        const catInfo = getCategoryDetails(p.categoryId);
        const matchesCat = catInfo.name.toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesDesc && !matchesCat) return false;
      }

      // 2. Synchronized Category Filter
      if (selectedCategoryFilter !== 'all') {
        const targetCat = categories.find(c => c.id === selectedCategoryFilter);
        const catIdMatch = p.categoryId === selectedCategoryFilter;
        const catNameMatch = targetCat && p.categoryId?.toLowerCase() === targetCat.name.toLowerCase();
        const catSlugMatch = targetCat && targetCat.slug && p.categoryId?.toLowerCase() === targetCat.slug.toLowerCase();
        if (!catIdMatch && !catNameMatch && !catSlugMatch) {
          return false;
        }
      }

      // 3. Skin type match
      if (selectedCustomerProfile) {
        return isProductMatch(p, skinFilter, selectedCustomerProfile);
      } else if (skinFilter !== 'all') {
        return isProductMatch(p, skinFilter, null);
      }

      return true;
    });
  }, [products, search, skinFilter, selectedCategoryFilter, selectedCustomerProfile, categories]);

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomerId);

  const handleShareProduct = (product: Product) => {
    const text = `Halo! Kami merekomendasikan ${product.name} (${formatIDR(product.defaultPrice)}) yang sangat cocok untuk perawatan kulit Anda. Info lebih lanjut: kahf.id`;
    navigator.clipboard.writeText(text);
    setCopiedSku(product.sku);
    setTimeout(() => setCopiedSku(null), 2500);
  };

  if (loading || dataLoading) {
    return (
      <div className="h-full min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-[#E2F0EF] border-t-[#2C5C59] animate-spin" />
          <p className="text-xs text-gray-500 font-medium">Memuat katalog & data rekomendasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>Rekomendasi & Katalog Produk</span>
            <span className="text-[10px] uppercase font-bold bg-[#E2F0EF] text-[#2C5C59] px-2.5 py-0.5 rounded-full border border-[#6DB9B2]/30">
              Live Sync
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Telusuri katalog produk Kahf yang disinkronkan langsung dengan kategori admin dan profil kulit pelanggan.
          </p>
        </div>

        {/* Customer Selector for Auto-Suggestion */}
        <div className="w-full md:w-80">
          <label className="text-xs font-bold text-gray-700 block mb-1">
            🔍 Pilih Customer (Auto-Suggest):
          </label>
          <select
            value={selectedCustomerId}
            onChange={e => handleSelectCustomer(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#6DB9B2]"
          >
            <option value="">-- Semua Produk (Tanpa Customer) --</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.fullName} ({c.phone || c.memberNo})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Customer Skin Profile Highlight Card (Active if Customer Selected) */}
      {selectedCustomerObj && (
        <div className="bg-gradient-to-r from-[#2C5C59] to-[#1F4240] rounded-3xl p-5 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">👤</span>
              <h3 className="font-bold text-base">{selectedCustomerObj.fullName}</h3>
              <span className="text-[10px] bg-white/20 px-2.5 py-0.5 rounded-full font-medium">
                Member #{selectedCustomerObj.memberNo}
              </span>
            </div>

            {selectedCustomerProfile ? (
              <div className="mt-2 text-xs text-white/90 space-y-1">
                <p>
                  <span className="font-semibold text-[#6DB9B2]">Tipe Kulit:</span>{' '}
                  <span className="uppercase font-bold tracking-wide">{selectedCustomerProfile.skinType}</span>
                </p>
                {selectedCustomerProfile.concerns && selectedCustomerProfile.concerns.length > 0 && (
                  <p>
                    <span className="font-semibold text-[#6DB9B2]">Fokus Masalah:</span>{' '}
                    {selectedCustomerProfile.concerns.join(', ')}
                  </p>
                )}
                <p className="text-[11px] text-white/70 italic mt-1">
                  ⭐ Katalog di bawah otomatis difilter untuk produk yang paling sesuai!
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber-200">
                ⚠️ Customer ini belum mengisi kuesioner Skin Profile. Anda dapat mencatat konsultasi baru untuk mereka.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/ba/customers/${selectedCustomerObj.id}/consultation`}
              className="px-4 py-2 bg-[#6DB9B2] hover:bg-[#5aa69f] text-white text-xs font-bold rounded-xl shadow transition-colors"
            >
              📝 Mulai Konsultasi
            </Link>
            <button
              onClick={() => handleSelectCustomer('')}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Synchronized Category & Condition Filters Bar */}
      <div className="space-y-3 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
        {/* Row 1: Search & Category Dropdown */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Category Dropdown Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-gray-700 whitespace-nowrap">🏷️ Kategori:</span>
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#6DB9B2]"
            >
              <option value="all">Semua Kategori ({categories.length})</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon || '🧴'} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama, SKU, kategori..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6DB9B2] focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Row 2: Condition / Problem Filter Chips */}
        <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-gray-400 whitespace-nowrap mr-1">Kondisi:</span>
          {[
            { id: 'all', label: 'Semua Produk' },
            { id: 'oily_acne', label: '💧 Berminyak & Jerawat' },
            { id: 'dry_sensitive', label: '🏜️ Kering & Sensitif' },
            { id: 'dull_brightening', label: '✨ Kulit Kusam / Mencerahkan' },
            { id: 'pores_blackhead', label: '⭕ Komedo & Pori' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSkinFilter(tab.id as SkinFilter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                skinFilter === tab.id
                  ? 'bg-[#2C5C59] text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProducts.map(p => {
          const isSuggested = selectedCustomerProfile ? isProductMatch(p, 'all', selectedCustomerProfile) : false;
          const catInfo = getCategoryDetails(p.categoryId);

          return (
            <div
              key={p.id}
              className={`bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow relative ${
                isSuggested ? 'border-[#6DB9B2] ring-2 ring-[#6DB9B2]/20' : 'border-gray-100'
              }`}
            >
              {/* Auto-suggested badge */}
              {isSuggested && (
                <div className="absolute top-3 right-3 bg-[#2C5C59] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm z-10 flex items-center gap-1">
                  <span>⭐</span>
                  <span>Cocok untuk Customer</span>
                </div>
              )}

              <div className="h-44 bg-[#E2F0EF]/30 flex items-center justify-center p-6 border-b border-gray-50 relative">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="h-full object-contain drop-shadow" />
                ) : (
                  <span className="text-5xl drop-shadow-sm">{catInfo.icon || '🧴'}</span>
                )}
              </div>

              <div className="p-5 flex flex-col flex-1">
                {/* Synchronized Category Badge with Icon */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm leading-none">{catInfo.icon}</span>
                  <span className="text-[10px] font-bold text-[#6DB9B2] uppercase tracking-wider">
                    {catInfo.name}
                  </span>
                </div>

                <h3 className="font-bold text-gray-900 text-base leading-snug mb-1.5">{p.name}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mb-4 flex-1">
                  {p.description || 'Produk perawatan esensial pria Kahf.'}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <div>
                    <span className="font-bold text-[#2C5C59] text-base">{formatIDR(p.defaultPrice)}</span>
                    <span className="text-[10px] text-gray-400 block font-mono">SKU: {p.sku}</span>
                  </div>

                  <button
                    onClick={() => handleShareProduct(p)}
                    className="px-3 py-1.5 bg-gray-50 hover:bg-[#E2F0EF] text-gray-700 hover:text-[#2C5C59] rounded-xl text-xs font-bold border border-gray-200 transition-colors flex items-center gap-1"
                    title="Salin rekomendasi ke clipboard"
                  >
                    {copiedSku === p.sku ? '✅ Tersalin' : '📋 Salin Rekomendasi'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-gray-100 p-8">
            <span className="text-4xl block mb-2">🔍</span>
            <p className="font-bold text-gray-800">Tidak ada produk yang sesuai filter</p>
            <p className="text-xs text-gray-400 mt-1">
              Coba gunakan kata kunci pencarian lain atau ubah filter kategori/kondisi kulit.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
