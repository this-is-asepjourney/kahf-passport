import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

export async function GET(request: Request) {
  try {
    // Vercel Cron authentication check (optional but recommended for security)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);

    console.log(`[aggregateDailySales] Reconciling date: ${dateStr}`);

    // Query all valid purchases from yesterday
    const purchasesSnap = await adminDb()
      .collection('purchases')
      .where('purchasedAt', '>=', admin.firestore.Timestamp.fromDate(new Date(`${dateStr}T00:00:00+07:00`)))
      .where('purchasedAt', '<=', admin.firestore.Timestamp.fromDate(new Date(`${dateStr}T23:59:59+07:00`)))
      .where('status', '==', 'valid')
      .get();

    // Aggregate by store
    const storeMap = new Map<string, {
      storeId: string; regionId: string;
      totalSales: number; totalOrders: number; totalQty: number;
    }>();

    // Aggregate by product
    const productMap = new Map<string, {
      productId: string; productName: string; regionId: string;
      qty: number; sales: number;
    }>();

    // Aggregate by BA
    const baMap = new Map<string, {
      baId: string; baName: string;
      orders: number; sales: number;
    }>();

    for (const docSnap of purchasesSnap.docs) {
      const p = docSnap.data();
      const totalQty = (p.items as { qty: number }[]).reduce((s, i) => s + i.qty, 0);

      // Store agg
      const existingStore = storeMap.get(p.storeId) ?? {
        storeId: p.storeId, regionId: p.regionId,
        totalSales: 0, totalOrders: 0, totalQty: 0,
      };
      storeMap.set(p.storeId, {
        ...existingStore,
        totalSales: existingStore.totalSales + p.totalAmount,
        totalOrders: existingStore.totalOrders + 1,
        totalQty: existingStore.totalQty + totalQty,
      });

      // Product agg
      for (const item of (p.items as { productId: string; productName: string; qty: number; subtotal: number }[])) {
        const existingProduct = productMap.get(item.productId) ?? {
          productId: item.productId, productName: item.productName,
          regionId: p.regionId, qty: 0, sales: 0,
        };
        productMap.set(item.productId, {
          ...existingProduct,
          qty: existingProduct.qty + item.qty,
          sales: existingProduct.sales + item.subtotal,
        });
      }

      // BA agg
      const existingBa = baMap.get(p.baId) ?? { baId: p.baId, baName: p.baNameSnapshot, orders: 0, sales: 0 };
      baMap.set(p.baId, {
        ...existingBa,
        orders: existingBa.orders + 1,
        sales: existingBa.sales + p.totalAmount,
      });
    }

    const batch = adminDb().batch();

    // Write store summaries
    for (const [storeId, data] of storeMap.entries()) {
      const ref = adminDb().collection('dailySalesSummary').doc(`${dateStr}_${storeId}`);
      batch.set(ref, { ...data, date: dateStr }, { merge: true });
    }

    // Write product summaries
    for (const [productId, data] of productMap.entries()) {
      const ref = adminDb().collection('dailyProductSummary').doc(`${dateStr}_${productId}`);
      batch.set(ref, { ...data, date: dateStr }, { merge: true });
    }

    // Write BA summaries
    for (const [baId, data] of baMap.entries()) {
      const ref = adminDb().collection('dailyBaSummary').doc(`${dateStr}_${baId}`);
      batch.set(ref, { ...data, date: dateStr }, { merge: true });
    }

    await batch.commit();
    console.log(`[aggregateDailySales] Done. Stores: ${storeMap.size}, Products: ${productMap.size}, BAs: ${baMap.size}`);

    return NextResponse.json({ success: true, message: 'Aggregation complete' });
  } catch (error) {
    console.error('[aggregateDailySales] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
