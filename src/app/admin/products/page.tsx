/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Product, ProductCategory } from '@/types';
import { formatIDR } from '@/lib/utils';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  productSchema,
  productCategorySchema,
  type ProductFormValues,
  type ProductCategoryFormValues,
} from '@/lib/validators/schemas';
import { ImageUpload } from '@/components/ImageUpload';
import {
  Package,
  Layers,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Tag,
  Sparkles,
  AlertCircle,
  DollarSign,
  Boxes,
} from 'lucide-react';

const STANDARD_KAHF_CATEGORIES = [
  { name: 'Facial Wash & Cleanser', slug: 'cleanser', icon: '🧴', description: 'Pembersih wajah lembut membersihkan pori tanpa membuat kering' },
  { name: 'Moisturizer & Cream', slug: 'moisturizer', icon: '💧', description: 'Pelembap wajah penutrisi skin barrier & mencerahkan kulit' },
  { name: 'Sunscreen UV Shield', slug: 'sunscreen', icon: '☀️', description: 'Tabir surya pelindung UVA/UVB dan blue light perlindungan menyeluruh' },
  { name: 'Serum & Ampoule', slug: 'serum-treatment', icon: '🧪', description: 'Konsentrat perawatan intensif mencerahkan, anti-aging & acne' },
  { name: 'Toner & Essence', slug: 'toner-essence', icon: '✨', description: 'Penyegar wajah penyeimbang pH & hidrasi kulit' },
  { name: 'Lip Care & Color', slug: 'lip-care', icon: '💄', description: 'Pewarna dan pelembap bibir tahan lama kaya vitamin' },
  { name: 'Body Care', slug: 'body-care', icon: '🧼', description: 'Lotion dan sabun pembersih tubuh wangi menyegarkan' },
];

export const TARGET_SKIN_TYPES = [
  { id: 'normal', label: '🌿 Normal' },
  { id: 'oily', label: '💧 Berminyak (Oily)' },
  { id: 'dry', label: '🏜️ Kering (Dry)' },
  { id: 'combination', label: '☯️ Kombinasi' },
  { id: 'sensitive', label: '🌸 Sensitif' },
];

export const TARGET_SKIN_CONCERNS = [
  { id: 'jerawat', label: '🔴 Jerawat & Acne Care' },
  { id: 'kusam', label: '🌑 Kulit Kusam / Mencerahkan' },
  { id: 'komedo_pori', label: '⭕ Komedo & Pori-pori' },
  { id: 'dehidrasi', label: '🏜️ Kulit Kering & Dehidrasi' },
  { id: 'minyak', label: '💧 Minyak & Sebum Berlebih' },
  { id: 'penuaan', label: '〰️ Anti-Aging & Garis Halus' },
  { id: 'sensitif', label: '🌸 Sensitif & Iritasi' },
];

export const ROUTINE_STEPS = [
  { id: 'cleanser', label: '🧴 Step 1: Pembersih Wajah (Face Wash)' },
  { id: 'treatment', label: '🧪 Step 2: Perawatan Intensif (Serum / Treatment)' },
  { id: 'moisturizer', label: '💧 Step 3: Pelembap Wajah (Moisturizer)' },
  { id: 'protection', label: '☀️ Step 4: Proteksi UV (Sunscreen)' },
  { id: 'fragrance', label: '✨ Grooming: Parfum & Wewangian' },
  { id: 'body_hair', label: '💈 Personal Care: Tubuh & Rambut' },
];

export default function AdminProductsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');

  // Master Data
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Filters & Search
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categorySearch, setCategorySearch] = useState('');

  // Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductSubmitting, setIsProductSubmitting] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<ProductCategory | null>(null);
  const [seedingCategories, setSeedingCategories] = useState(false);

  // Product Form Hook
  const {
    register: registerProduct,
    handleSubmit: handleProductSubmit,
    reset: resetProductForm,
    control: productControl,
    formState: { errors: productErrors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      isActive: true,
      sku: `PRD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    },
  });

  // Category Form Hook
  const {
    register: registerCategory,
    handleSubmit: handleCategorySubmit,
    reset: resetCategoryForm,
    setValue: setCategoryValue,
    formState: { errors: categoryErrors },
  } = useForm<ProductCategoryFormValues>({
    resolver: zodResolver(productCategorySchema),
    defaultValues: {
      icon: '🧴',
    },
  });

  // Load all Products & Categories
  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [productsSnap, categoriesSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'productCategories')),
      ]);

      const loadedCategories = categoriesSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as ProductCategory[];

      setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
      setCategories(loadedCategories);
    } catch (err) {
      console.error('Error loading products & categories:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }
    if (!loading && user && !['admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/');
      return;
    }
    if (!loading && user) {
      loadData();
    }
  }, [user, loading, router, loadData]);

  // Check if admin is authorized to edit
  const canManage = user?.role === 'super_admin' || user?.role === 'admin_region';

  // Toggle active status
  const toggleActive = async (product: Product) => {
    if (!canManage) return;
    try {
      const newStatus = !product.isActive;
      await updateDoc(doc(db, 'products', product.id), { isActive: newStatus });
      setProducts(prev =>
        prev.map(p => (p.id === product.id ? { ...p, isActive: newStatus } : p))
      );
    } catch (err) {
      console.error('Error toggling product status:', err);
      alert('Gagal mengubah status produk.');
    }
  };

  // Condition States for Product Modal
  const [selectedSkinTypes, setSelectedSkinTypes] = useState<string[]>([]);
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
  const [selectedRoutineStep, setSelectedRoutineStep] = useState<string>('cleanser');

  const toggleSkinType = (typeId: string) => {
    setSelectedSkinTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    );
  };

  const toggleConcern = (concernId: string) => {
    setSelectedConcerns((prev) =>
      prev.includes(concernId) ? prev.filter((c) => c !== concernId) : [...prev, concernId]
    );
  };

  // Product Add / Edit Modal Controls
  const openAddProductModal = () => {
    setEditingProduct(null);
    setSelectedSkinTypes([]);
    setSelectedConcerns([]);
    setSelectedRoutineStep('cleanser');
    resetProductForm({
      name: '',
      description: '',
      categoryId: categories.length > 0 ? categories[0].id : '',
      sku: `KHF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      defaultPrice: 0,
      imageUrl: '',
      isActive: true,
    });
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setSelectedSkinTypes(product.suitableSkinTypes || []);
    setSelectedConcerns(product.suitableConcerns || []);
    setSelectedRoutineStep(product.routineStep || 'cleanser');
    resetProductForm({
      name: product.name,
      description: product.description || '',
      categoryId: product.categoryId,
      sku: product.sku,
      defaultPrice: product.defaultPrice,
      imageUrl: product.imageUrl || '',
      isActive: product.isActive,
    });
    setIsProductModalOpen(true);
  };

  // Submit Product (Add or Edit)
  const onProductSubmit = async (data: ProductFormValues) => {
    if (!canManage) return;
    setIsProductSubmitting(true);
    try {
      const productPayload = {
        ...data,
        suitableSkinTypes: selectedSkinTypes,
        suitableConcerns: selectedConcerns,
        routineStep: selectedRoutineStep,
      };

      if (editingProduct) {
        // Edit mode
        await updateDoc(doc(db, 'products', editingProduct.id), {
          ...productPayload,
          updatedAt: serverTimestamp(),
        });
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? { ...p, ...productPayload } : p))
        );
      } else {
        // Add mode
        const newProduct = {
          ...productPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, 'products'), newProduct);
        setProducts((prev) => [
          {
            id: docRef.id,
            ...productPayload,
            createdAt: new Date().toISOString(),
          } as unknown as Product,
          ...prev,
        ]);
      }
      setIsProductModalOpen(false);
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Gagal menyimpan data produk. Pastikan semua data valid.');
    } finally {
      setIsProductSubmitting(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async () => {
    if (!deletingProduct || !canManage) return;
    try {
      await deleteDoc(doc(db, 'products', deletingProduct.id));
      setProducts(prev => prev.filter(p => p.id !== deletingProduct.id));
      setDeletingProduct(null);
    } catch (err) {
      console.error('Error deleting product:', err);
      alert('Gagal menghapus produk.');
    }
  };

  // Category Add / Edit Modal Controls
  const openAddCategoryModal = () => {
    setEditingCategory(null);
    resetCategoryForm({
      name: '',
      slug: '',
      icon: '🧴',
      description: '',
    });
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: ProductCategory) => {
    setEditingCategory(cat);
    resetCategoryForm({
      name: cat.name,
      slug: cat.slug || cat.id,
      icon: cat.icon || '🧴',
      description: cat.description || '',
    });
    setIsCategoryModalOpen(true);
  };

  // Submit Category (Add or Edit)
  const onCategorySubmit = async (data: ProductCategoryFormValues) => {
    if (!canManage) return;
    setIsCategorySubmitting(true);
    try {
      const slugVal = (data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')).trim();

      if (editingCategory) {
        // Edit mode
        await updateDoc(doc(db, 'productCategories', editingCategory.id), {
          name: data.name,
          slug: slugVal,
          icon: data.icon || '🧴',
          description: data.description || '',
          updatedAt: serverTimestamp(),
        });
        setCategories(prev =>
          prev.map(c =>
            c.id === editingCategory.id
              ? { ...c, ...data, slug: slugVal }
              : c
          )
        );
      } else {
        // Add mode
        const categoryData = {
          name: data.name,
          slug: slugVal,
          icon: data.icon || '🧴',
          description: data.description || '',
          createdAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, 'productCategories'), categoryData);
        setCategories(prev => [
          ...prev,
          {
            id: docRef.id,
            ...categoryData,
          } as ProductCategory,
        ]);
      }
      setIsCategoryModalOpen(false);
    } catch (err) {
      console.error('Error saving category:', err);
      alert('Gagal menyimpan kategori.');
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async () => {
    if (!deletingCategory || !canManage) return;
    try {
      await deleteDoc(doc(db, 'productCategories', deletingCategory.id));
      setCategories(prev => prev.filter(c => c.id !== deletingCategory.id));
      setDeletingCategory(null);
    } catch (err) {
      console.error('Error deleting category:', err);
      alert('Gagal menghapus kategori.');
    }
  };

  // Seed Standard Kahf Categories if empty
  const handleSeedStandardCategories = async () => {
    if (!canManage) return;
    setSeedingCategories(true);
    try {
      for (const cat of STANDARD_KAHF_CATEGORIES) {
        const docRef = doc(db, 'productCategories', cat.slug);
        await setDoc(
          docRef,
          {
            name: cat.name,
            slug: cat.slug,
            icon: cat.icon,
            description: cat.description,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      await loadData();
    } catch (err) {
      console.error('Error seeding categories:', err);
      alert('Gagal memuat kategori standar.');
    } finally {
      setSeedingCategories(false);
    }
  };

  // Category name resolver
  const getCategoryDetails = (catIdOrName: string) => {
    const found = categories.find(
      c => c.id === catIdOrName || c.slug === catIdOrName || c.name.toLowerCase() === catIdOrName.toLowerCase()
    );
    return found ? { name: found.name, icon: found.icon || '🧴' } : { name: catIdOrName || 'Umum', icon: '🧴' };
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter(p => p.isActive).length;
    const totalCategories = categories.length;
    const avgPrice = total > 0 ? Math.round(products.reduce((acc, p) => acc + (p.defaultPrice || 0), 0) / total) : 0;
    return { total, active, totalCategories, avgPrice };
  }, [products, categories]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Search keyword
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = p.sku.toLowerCase().includes(q);
        const matchesDesc = (p.description || '').toLowerCase().includes(q);
        const catName = getCategoryDetails(p.categoryId).name.toLowerCase();
        const matchesCat = catName.includes(q);
        if (!matchesName && !matchesSku && !matchesDesc && !matchesCat) return false;
      }

      // Category filter
      if (selectedCategoryFilter !== 'all') {
        if (p.categoryId !== selectedCategoryFilter) {
          const cat = categories.find(c => c.id === selectedCategoryFilter);
          if (!cat || (p.categoryId !== cat.name && p.categoryId !== cat.slug)) {
            return false;
          }
        }
      }

      // Status filter
      if (statusFilter === 'active' && !p.isActive) return false;
      if (statusFilter === 'inactive' && p.isActive) return false;

      return true;
    });
  }, [products, productSearch, selectedCategoryFilter, statusFilter, categories]);

  // Filtered Categories
  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      if (!categorySearch.trim()) return true;
      const q = categorySearch.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.slug || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
    });
  }, [categories, categorySearch]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <span>Product Insight & Rekomendasi</span>
            <span className="text-xs bg-[#E2F0EF] text-[#2C5C59] font-bold px-3 py-1 rounded-full border border-[#6DB9B2]/30">
              Katalog Wardah
            </span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Kelola data produk dan kategori untuk sinkronisasi rekomendasi BA & Customer
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={openAddCategoryModal}
              className="px-4 py-2.5 bg-white border border-[#2C5C59]/30 text-[#2C5C59] font-bold text-xs rounded-xl hover:bg-[#E2F0EF] transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Tag className="w-4 h-4" />
              <span>+ Tambah Kategori</span>
            </button>
            <button
              onClick={openAddProductModal}
              className="px-4 py-2.5 bg-[#2C5C59] text-white font-bold text-xs rounded-xl hover:bg-[#1f4240] transition-all flex items-center gap-1.5 shadow-md shadow-[#2C5C59]/20"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Produk Baru</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#E2F0EF] text-[#2C5C59] flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Produk</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Produk Aktif</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              {stats.active}{' '}
              <span className="text-xs font-medium text-emerald-600">
                ({stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%)
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Kategori Terdaftar</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{stats.totalCategories}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Rata-rata Harga</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{formatIDR(stats.avgPrice)}</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('products')}
          className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 transition-all relative ${
            activeTab === 'products'
              ? 'text-[#2C5C59]'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Katalog Produk ({products.length})</span>
          {activeTab === 'products' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2C5C59] rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 transition-all relative ${
            activeTab === 'categories'
              ? 'text-[#2C5C59]'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Kelola Kategori Rekomendasi ({categories.length})</span>
          {activeTab === 'categories' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2C5C59] rounded-full" />
          )}
        </button>
      </div>

      {/* TAB 1: PRODUCT CATALOG */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Cari nama produk, SKU, kategori..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6DB9B2] focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              {/* Category Filter */}
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
                <Filter className="w-3.5 h-3.5 text-gray-500" />
                <select
                  value={selectedCategoryFilter}
                  onChange={e => setSelectedCategoryFilter(e.target.value)}
                  className="bg-transparent text-xs text-gray-700 font-medium focus:outline-none py-1"
                >
                  <option value="all">Semua Kategori ({categories.length})</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.icon || '🧴'} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1">
                {(['all', 'active', 'inactive'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      statusFilter === s
                        ? 'bg-[#2C5C59] text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {s === 'all' ? 'Semua' : s === 'active' ? 'Aktif' : 'Nonaktif'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {dataLoading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 rounded-full border-4 border-[#E2F0EF] border-t-[#2C5C59] animate-spin" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-16 text-center">
                <p className="text-4xl mb-3">📦</p>
                <h3 className="text-lg font-semibold text-gray-900">Tidak ada produk ditemukan</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Coba ubah kata kunci pencarian atau filter kategori di atas.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Produk</th>
                      <th className="px-6 py-4 font-semibold">SKU / Kode</th>
                      <th className="px-6 py-4 font-semibold">Kategori</th>
                      <th className="px-6 py-4 font-semibold text-right">Harga</th>
                      <th className="px-6 py-4 font-semibold text-center">Status</th>
                      <th className="px-6 py-4 font-semibold text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProducts.map(product => {
                      const catInfo = getCategoryDetails(product.categoryId);

                      return (
                        <tr
                          key={product.id}
                          className={`hover:bg-gray-50/60 transition-colors ${
                            !product.isActive ? 'opacity-60 bg-gray-50/30' : ''
                          }`}
                        >
                          {/* Product Info */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-12 h-12 rounded-2xl object-cover shadow-sm border border-gray-100 bg-[#E2F0EF]/30"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-2xl bg-[#E2F0EF] text-[#2C5C59] flex items-center justify-center text-xl shadow-inner">
                                  {catInfo.icon || '🧴'}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-gray-900 hover:text-[#2C5C59] transition-colors">
                                    {product.name}
                                  </p>
                                  {product.routineStep && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#E2F0EF] text-[#2C5C59]">
                                      {ROUTINE_STEPS.find((s) => s.id === product.routineStep)?.label.split(':')[0] || product.routineStep}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 max-w-xs truncate">
                                  {product.description || 'Tidak ada deskripsi'}
                                </p>
                                {((product.suitableSkinTypes?.length ?? 0) > 0 || (product.suitableConcerns?.length ?? 0) > 0) && (
                                  <div className="flex items-center gap-1 mt-1 flex-wrap max-w-xs">
                                    {(product.suitableSkinTypes || []).slice(0, 2).map((t) => (
                                      <span key={t} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                        {TARGET_SKIN_TYPES.find((st) => st.id === t)?.label.split(' ')[0] || t}
                                      </span>
                                    ))}
                                    {(product.suitableConcerns || []).slice(0, 2).map((c) => (
                                      <span key={c} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">
                                        {TARGET_SKIN_CONCERNS.find((sc) => sc.id === c)?.label.split(' ')[0] || c}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* SKU */}
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs font-semibold px-2.5 py-1 bg-gray-100 rounded-lg text-gray-700">
                              {product.sku}
                            </span>
                          </td>

                          {/* Category Badge */}
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#E2F0EF] text-[#2C5C59] rounded-xl text-xs font-bold border border-[#6DB9B2]/20">
                              <span>{catInfo.icon}</span>
                              <span>{catInfo.name}</span>
                            </span>
                          </td>

                          {/* Price */}
                          <td className="px-6 py-4 font-bold text-gray-900 text-right">
                            {formatIDR(product.defaultPrice)}
                          </td>

                          {/* Status Toggle */}
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => toggleActive(product)}
                              disabled={!canManage}
                              className={`text-xs font-bold px-3 py-1 rounded-full transition-all inline-flex items-center gap-1 ${
                                product.isActive
                                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                  : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                              } ${!canManage && 'cursor-default opacity-80'}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${product.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              <span>{product.isActive ? 'Aktif' : 'Nonaktif'}</span>
                            </button>
                          </td>

                          {/* Action Buttons */}
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {/* Edit Button */}
                              <button
                                onClick={() => openEditProductModal(product)}
                                className="px-3 py-1.5 bg-[#E2F0EF] hover:bg-[#2C5C59] text-[#2C5C59] hover:text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1 border border-[#6DB9B2]/30 shadow-sm"
                                title="Edit Produk"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>

                              {/* Delete Button */}
                              {canManage && (
                                <button
                                  onClick={() => setDeletingProduct(product)}
                                  className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                                  title="Hapus Produk"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CATEGORY MANAGEMENT */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Manajemen Kategori Produk</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Kategori ini langsung tersinkronisasi pada filter rekomendasi produk di aplikasi Beauty Advisor (BA).
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {categories.length === 0 && (
                <button
                  onClick={handleSeedStandardCategories}
                  disabled={seedingCategories}
                  className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl border border-amber-200 transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>{seedingCategories ? 'Memuat...' : 'Inisialisasi Kategori Wardah'}</span>
                </button>
              )}
              <button
                onClick={openAddCategoryModal}
                className="px-4 py-2 bg-[#2C5C59] text-white font-bold text-xs rounded-xl hover:bg-[#1f4240] transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Kategori</span>
              </button>
            </div>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(cat => {
              const count = products.filter(
                p => p.categoryId === cat.id || p.categoryId === cat.slug || p.categoryId === cat.name
              ).length;

              return (
                <div
                  key={cat.id}
                  className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-[#E2F0EF] text-2xl flex items-center justify-center shadow-inner">
                        {cat.icon || '🧴'}
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                        {count} Produk
                      </span>
                    </div>

                    <h3 className="font-bold text-gray-900 text-base mt-3">{cat.name}</h3>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">Kode: {cat.slug || cat.id}</p>
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                      {cat.description || 'Kategori perawatan resmi Wardah.'}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditCategoryModal(cat)}
                      className="px-3 py-1.5 bg-gray-50 hover:bg-[#E2F0EF] text-gray-700 hover:text-[#2C5C59] font-bold text-xs rounded-xl transition-colors flex items-center gap-1 border border-gray-200"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    {canManage && (
                      <button
                        onClick={() => setDeletingCategory(cat)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Hapus Kategori"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {categories.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-gray-100 p-8">
                <span className="text-4xl block mb-2">🏷️</span>
                <p className="font-bold text-gray-800">Belum ada kategori yang terdaftar</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto mb-4">
                  Tambahkan kategori baru atau gunakan tombol di bawah untuk mengisi kategori standar produk Wardah.
                </p>
                <button
                  onClick={handleSeedStandardCategories}
                  disabled={seedingCategories}
                  className="px-5 py-2.5 bg-[#2C5C59] text-white font-bold text-xs rounded-xl hover:bg-[#1f4240] transition-colors shadow-sm inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{seedingCategories ? 'Menambahkan...' : 'Inisialisasi Kategori Standar Wardah'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT PRODUCT                                      */}
      {/* ============================================================== */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsProductModalOpen(false)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 sm:rounded-t-3xl rounded-t-3xl">
              <div>
                <h2 className="font-bold text-lg text-gray-900">
                  {editingProduct ? 'Edit Data Produk' : 'Tambah Produk Baru'}
                </h2>
                <p className="text-xs text-gray-500">
                  {editingProduct ? 'Perbarui informasi produk dan harga' : 'Tambahkan produk ke katalog resmi Wardah'}
                </p>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form Body */}
            <div className="overflow-y-auto flex-1 p-6">
              <form id="product-form" onSubmit={handleProductSubmit(onProductSubmit)} className="space-y-4">
                {/* Photo Upload */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 text-center">
                    Foto Produk (Opsional)
                  </label>
                  <Controller
                    name="imageUrl"
                    control={productControl}
                    render={({ field }) => (
                      <ImageUpload
                        onUploadSuccess={url => field.onChange(url)}
                        folder="products"
                        currentImage={field.value}
                        className="w-full max-w-[140px] mx-auto aspect-square rounded-2xl overflow-hidden shadow-sm border border-gray-200"
                        label="Unggah Foto"
                      />
                    )}
                  />
                  {productErrors.imageUrl && (
                    <p className="text-xs text-rose-500 mt-1 text-center">{productErrors.imageUrl.message}</p>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Nama Produk <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Mis. Wardah UV Shield Essential Gel Sunscreen Serum"
                    {...registerProduct('name')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none"
                  />
                  {productErrors.name && (
                    <p className="text-xs text-rose-500 mt-1">{productErrors.name.message}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Deskripsi Produk</label>
                  <textarea
                    placeholder="Deskripsi singkat manfaat, bahan aktif, dan cara pakai..."
                    {...registerProduct('description')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none resize-none h-20"
                  />
                  {productErrors.description && (
                    <p className="text-xs text-rose-500 mt-1">{productErrors.description.message}</p>
                  )}
                </div>

                {/* Category & SKU */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-700">
                        Kategori <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProductModalOpen(false);
                          openAddCategoryModal();
                        }}
                        className="text-[11px] text-[#2C5C59] font-bold hover:underline"
                      >
                        + Kategori Baru
                      </button>
                    </div>
                    <select
                      {...registerProduct('categoryId')}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none bg-white font-medium"
                    >
                      <option value="">Pilih Kategori...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon || '🧴'} {cat.name}
                        </option>
                      ))}
                    </select>
                    {productErrors.categoryId && (
                      <p className="text-xs text-rose-500 mt-1">{productErrors.categoryId.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      SKU / Kode Produk <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Mis. KHF-FW-001"
                      {...registerProduct('sku')}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none font-mono"
                    />
                    {productErrors.sku && (
                      <p className="text-xs text-rose-500 mt-1">{productErrors.sku.message}</p>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Harga Jual Default (IDR) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="Mis. 45000"
                    {...registerProduct('defaultPrice', { valueAsNumber: true })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none font-bold text-gray-900"
                  />
                  {productErrors.defaultPrice && (
                    <p className="text-xs text-rose-500 mt-1">{productErrors.defaultPrice.message}</p>
                  )}
                </div>

                {/* Routine Step (Tahapan Rutinitas) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Tahapan Rutinitas (Routine Step)
                  </label>
                  <select
                    value={selectedRoutineStep}
                    onChange={(e) => setSelectedRoutineStep(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none bg-white font-medium"
                  >
                    {ROUTINE_STEPS.map((step) => (
                      <option key={step.id} value={step.id}>
                        {step.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Skin Types */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Target Tipe Kulit (Pilih yang sesuai)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {TARGET_SKIN_TYPES.map((type) => {
                      const isSelected = selectedSkinTypes.includes(type.id);
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => toggleSkinType(type.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                            isSelected
                              ? 'bg-[#2C5C59] text-white border-[#2C5C59] shadow-sm'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target Skin Concerns */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Target Fokus Masalah Kulit (Pilih yang sesuai)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {TARGET_SKIN_CONCERNS.map((concern) => {
                      const isSelected = selectedConcerns.includes(concern.id);
                      return (
                        <button
                          key={concern.id}
                          type="button"
                          onClick={() => toggleConcern(concern.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                            isSelected
                              ? 'bg-[#E2F0EF] text-[#2C5C59] border-[#6DB9B2] shadow-sm font-bold'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}
                          {concern.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Checkbox */}
                <div className="pt-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      {...registerProduct('isActive')}
                      className="w-4 h-4 rounded text-[#2C5C59] focus:ring-[#6DB9B2]"
                    />
                    <span className="text-xs font-bold text-gray-800">
                      Tampilkan produk ini di katalog aktif (BA & Customer dapat melihat)
                    </span>
                  </label>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2 sm:rounded-b-3xl shrink-0">
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                form="product-form"
                disabled={isProductSubmitting}
                className="flex-[2] py-2.5 bg-[#2C5C59] text-white font-bold text-xs rounded-xl hover:bg-[#1f4240] disabled:opacity-50 transition-colors shadow-md shadow-[#2C5C59]/20"
              >
                {isProductSubmitting
                  ? 'Menyimpan...'
                  : editingProduct
                  ? 'Simpan Perubahan'
                  : 'Tambah Produk Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT CATEGORY                                     */}
      {/* ============================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsCategoryModalOpen(false)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 sm:rounded-t-3xl rounded-t-3xl">
              <div>
                <h2 className="font-bold text-base text-gray-900">
                  {editingCategory ? 'Edit Kategori Produk' : 'Tambah Kategori Baru'}
                </h2>
                <p className="text-xs text-gray-500">
                  Kategori akan langsung muncul di filter rekomendasi BA
                </p>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <form id="category-form" onSubmit={handleCategorySubmit(onCategorySubmit)} className="space-y-4">
                {/* Category Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Nama Kategori <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Mis. Face Wash, Moisturizer, Sunscreen"
                    {...registerCategory('name')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none font-medium"
                  />
                  {categoryErrors.name && (
                    <p className="text-xs text-rose-500 mt-1">{categoryErrors.name.message}</p>
                  )}
                </div>

                {/* Emoji / Icon Selector */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Icon / Emoji</label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="🧴"
                      {...registerCategory('icon')}
                      className="w-16 px-3 py-2 text-center rounded-xl border border-gray-200 text-base focus:border-[#6DB9B2] outline-none"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {['🧴', '💧', '☀️', '🧪', '✨', '💈', '🧼', '🌿', '👔', '⭐'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setCategoryValue('icon', emoji)}
                          className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-[#E2F0EF] text-sm flex items-center justify-center transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Slug / Code */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Kode / Slug Kategori (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Mis. face-wash (otomatis jika dikosongkan)"
                    {...registerCategory('slug')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none font-mono"
                  />
                  {categoryErrors.slug && (
                    <p className="text-xs text-rose-500 mt-1">{categoryErrors.slug.message}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Deskripsi Singkat (Opsional)
                  </label>
                  <textarea
                    placeholder="Penjelasan fungsi kategori untuk konsultasi..."
                    {...registerCategory('description')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none resize-none h-20"
                  />
                  {categoryErrors.description && (
                    <p className="text-xs text-rose-500 mt-1">{categoryErrors.description.message}</p>
                  )}
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2 sm:rounded-b-3xl shrink-0">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                form="category-form"
                disabled={isCategorySubmitting}
                className="flex-[2] py-2.5 bg-[#2C5C59] text-white font-bold text-xs rounded-xl hover:bg-[#1f4240] disabled:opacity-50 transition-colors shadow-md shadow-[#2C5C59]/20"
              >
                {isCategorySubmitting
                  ? 'Menyimpan...'
                  : editingCategory
                  ? 'Simpan Perubahan Kategori'
                  : 'Tambah Kategori'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DELETE PRODUCT CONFIRMATION MODAL                              */}
      {/* ============================================================== */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeletingProduct(null)} />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900">Hapus Produk?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Apakah Anda yakin ingin menghapus produk <strong>{deletingProduct.name}</strong> ({deletingProduct.sku})? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                className="flex-1 py-2.5 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition-colors shadow-md shadow-rose-600/20"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DELETE CATEGORY CONFIRMATION MODAL                             */}
      {/* ============================================================== */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeletingCategory(null)} />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900">Hapus Kategori?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Kategori <strong>{deletingCategory.name}</strong> akan dihapus. Produk yang menggunakan kategori ini tidak akan terhapus.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteCategory}
                className="flex-1 py-2.5 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition-colors shadow-md shadow-rose-600/20"
              >
                Hapus Kategori
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
