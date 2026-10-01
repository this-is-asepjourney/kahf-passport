import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { maskPhone, normalizePhone } from '@/lib/utils';
import { FieldValue } from 'firebase-admin/firestore';
import { nanoid } from 'nanoid';

interface CustomerDocData {
  id: string;
  fullName: string;
  phone: string;
  phoneDisplay: string;
  memberNo: string;
  city?: string;
  status: string;
  purchaseCount: number;
  lastPurchaseAt: string | null;
  createdAt?: string | null;
  score?: number;
}

/**
 * GET /api/customers/search?q=query
 * Mesin pencari customer cerdas untuk Beauty Advisor & Admin:
 * - Case-insensitive (huruf besar/kecil tidak berpengaruh)
 * - Substring / substring fuzzy (mencari nama depan, belakang, potongan kata)
 * - Pencarian nomor HP fleksibel (awalan 08..., +62..., atau 4 digit nomor)
 * - Pencarian nomor Member ID / NIK
 * - Tanpa batasan minimal 3 karakter yang kaku
 */
export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await adminAuth().verifyIdToken(idToken);

    if (!['ba', 'admin_region', 'super_admin'].includes(decodedToken.role as string)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('q')?.trim() ?? '';
    const db = adminDb();

    // 1. Jika query kosong, kembalikan 30 customer terbaru
    if (rawQuery.length === 0) {
      const snap = await db
        .collection('customers')
        .limit(35)
        .get();

      const customers = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          fullName: data.fullName || 'Customer Tanpa Nama',
          phone: data.phone || '',
          phoneDisplay: data.phone ? maskPhone(data.phone) : '-',
          memberNo: data.memberNo || `WRD-${doc.id.slice(0, 5).toUpperCase()}`,
          city: data.city || '-',
          status: data.status || 'active',
          purchaseCount: data.purchaseCount || 0,
          lastPurchaseAt: data.lastPurchaseAt?.toDate?.()?.toISOString() ?? null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        };
      });

      // Urutkan dari yang terbaru
      customers.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return NextResponse.json({ success: true, count: customers.length, customers });
    }

    // 2. Olah query pencarian
    const cleanQuery = rawQuery;
    const lowerQuery = cleanQuery.toLowerCase();
    const upperQuery = cleanQuery.toUpperCase();
    const titleQuery = cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1).toLowerCase();
    const digitsOnly = cleanQuery.replace(/[^0-9]/g, '');

    // Kumpulkan dokumen dari berbagai strategi query Firestore
    const candidateDocsMap = new Map<string, Record<string, unknown>>();

    const queryPromises: Promise<void>[] = [];

    // Strategi A: Ambil pool 150 customer terbaru untuk pencarian substring in-memory
    queryPromises.push(
      db.collection('customers').limit(150).get().then((snap) => {
        snap.docs.forEach((doc) => candidateDocsMap.set(doc.id, { id: doc.id, ...doc.data() }));
      }).catch(() => {})
    );

    // Strategi B: Jika query berupa ID dokumen spesifik
    if (cleanQuery.length >= 8) {
      queryPromises.push(
        db.collection('customers').doc(cleanQuery).get().then((doc) => {
          if (doc.exists) candidateDocsMap.set(doc.id, { id: doc.id, ...doc.data() });
        }).catch(() => {})
      );
    }

    // Strategi C: Pencarian berdasarkan Phone
    if (digitsOnly.length >= 3) {
      const normalized = normalizePhone(cleanQuery);
      queryPromises.push(
        db.collection('customers').where('phone', '==', normalized).limit(10).get().then((snap) => {
          snap.docs.forEach((doc) => candidateDocsMap.set(doc.id, { id: doc.id, ...doc.data() }));
        }).catch(() => {})
      );
      queryPromises.push(
        db.collection('customers').where('phone', '==', cleanQuery).limit(10).get().then((snap) => {
          snap.docs.forEach((doc) => candidateDocsMap.set(doc.id, { id: doc.id, ...doc.data() }));
        }).catch(() => {})
      );
    }

    // Strategi D: Prefix query Firestore pada fullName (TitleCase, UPPER, lower)
    queryPromises.push(
      db.collection('customers').where('fullName', '>=', titleQuery).where('fullName', '<=', titleQuery + '\uf8ff').limit(25).get().then((snap) => {
        snap.docs.forEach((doc) => candidateDocsMap.set(doc.id, { id: doc.id, ...doc.data() }));
      }).catch(() => {})
    );

    queryPromises.push(
      db.collection('customers').where('fullName', '>=', upperQuery).where('fullName', '<=', upperQuery + '\uf8ff').limit(25).get().then((snap) => {
        snap.docs.forEach((doc) => candidateDocsMap.set(doc.id, { id: doc.id, ...doc.data() }));
      }).catch(() => {})
    );

    // Strategi E: Prefix query pada memberNo
    queryPromises.push(
      db.collection('customers').where('memberNo', '>=', upperQuery).where('memberNo', '<=', upperQuery + '\uf8ff').limit(20).get().then((snap) => {
        snap.docs.forEach((doc) => candidateDocsMap.set(doc.id, { id: doc.id, ...doc.data() }));
      }).catch(() => {})
    );

    await Promise.all(queryPromises);

    // 3. Evaluasi & Scoring In-Memory
    const matchedList: CustomerDocData[] = [];

    candidateDocsMap.forEach((data, id) => {
      const name = (data.fullName || '').toString();
      const lowerName = name.toLowerCase();
      const rawPhone = (data.phone || '').toString();
      const phoneDigits = rawPhone.replace(/[^0-9]/g, '');
      const memberNo = (data.memberNo || '').toString().toLowerCase();
      const city = (data.city || '').toString().toLowerCase();
      const docId = id.toLowerCase();

      let score = 0;

      // Exact match
      if (lowerName === lowerQuery) score += 100;
      if (phoneDigits === digitsOnly && digitsOnly.length > 0) score += 100;
      if (memberNo === lowerQuery) score += 95;
      if (docId === lowerQuery) score += 90;

      // Starts with
      if (lowerName.startsWith(lowerQuery)) score += 75;
      if (digitsOnly.length >= 3 && phoneDigits.startsWith(digitsOnly)) score += 70;
      if (memberNo.startsWith(lowerQuery)) score += 65;

      // Contains (Substring anywhere in word)
      if (lowerName.includes(lowerQuery)) score += 50;
      if (digitsOnly.length >= 3 && phoneDigits.includes(digitsOnly)) score += 45;
      if (memberNo.includes(lowerQuery)) score += 40;
      if (city.includes(lowerQuery)) score += 25;
      if (docId.includes(lowerQuery)) score += 20;

      // Token match: pecah nama (misal "Elsa Safitri" cocok untuk query "Safitri")
      const tokens = lowerName.split(/\s+/);
      if (tokens.some((t: string) => t.startsWith(lowerQuery))) score += 40;
      if (tokens.some((t: string) => t.includes(lowerQuery))) score += 25;

      if (score > 0) {
        matchedList.push({
          id,
          fullName: data.fullName || 'Customer Tanpa Nama',
          phone: rawPhone,
          phoneDisplay: rawPhone ? maskPhone(rawPhone) : '-',
          memberNo: data.memberNo || `WRD-${id.slice(0, 5).toUpperCase()}`,
          city: data.city || '-',
          status: data.status || 'active',
          purchaseCount: data.purchaseCount || 0,
          lastPurchaseAt: data.lastPurchaseAt?.toDate?.()?.toISOString() ?? null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
          score,
        });
      }
    });

    // Urutkan berdasarkan score tertinggi, lalu nama
    matchedList.sort((a, b) => {
      if ((b.score ?? 0) !== (a.score ?? 0)) {
        return (b.score ?? 0) - (a.score ?? 0);
      }
      return a.fullName.localeCompare(b.fullName, 'id', { sensitivity: 'base' });
    });

    // Batasi maksimal 25 hasil paling relevan
    const finalCustomers = matchedList.slice(0, 25);

    return NextResponse.json({
      success: true,
      query: cleanQuery,
      count: finalCustomers.length,
      customers: finalCustomers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mencari customer';
    console.error('[GET /api/customers/search]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/customers/search (Quick register by BA)
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await adminAuth().verifyIdToken(idToken);

    if (!['ba', 'admin_region', 'super_admin'].includes(decodedToken.role as string)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { fullName, phone, city } = body;

    if (!fullName || !phone) {
      return NextResponse.json({ error: 'Nama dan nomor HP wajib diisi' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    const db = adminDb();

    // Check if customer with this phone already exists
    const existingQuery = await db
      .collection('customers')
      .where('phone', '==', normalizedPhone)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      const existing = existingQuery.docs[0];
      return NextResponse.json({
        customerId: existing.id,
        action: 'existing',
        message: 'Customer dengan nomor HP ini sudah terdaftar',
        customer: { id: existing.id, ...existing.data() },
      });
    }

    // Create unclaimed customer
    const customerId = nanoid(26).toUpperCase();
    const qrToken = nanoid(32);

    const memberPrefix = 'WRD';
    const memberNo = `${memberPrefix}${Date.now().toString(36).toUpperCase()}`;

    await db.runTransaction(async (tx) => {
      const customerRef = db.collection('customers').doc(customerId);
      tx.set(customerRef, {
        id: customerId,
        publicId: customerId.slice(0, 8).toLowerCase(),
        uid: null,
        fullName: fullName.trim(),
        phone: normalizedPhone,
        birthDate: null,
        gender: null,
        city: city ?? null,
        regionId: null,
        memberNo,
        registeredByBaId: decodedToken.uid,
        registeredStoreId: decodedToken.storeId ?? null,
        status: 'unclaimed',
        claimedAt: null,
        qrTokenId: qrToken,
        lastPurchaseAt: null,
        purchaseCount: 0,
        totalSpent: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const tokenRef = db.collection('qrTokens').doc(qrToken);
      tx.set(tokenRef, {
        customerId,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        revokedAt: null,
      });
    });

    return NextResponse.json({
      success: true,
      customerId,
      action: 'created',
      qrToken,
      customer: {
        id: customerId,
        fullName: fullName.trim(),
        phone: normalizedPhone,
        memberNo,
        status: 'unclaimed',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mendaftarkan customer';
    console.error('[quick-register-customer]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
