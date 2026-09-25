import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

export async function GET(request: Request) {
  try {
    // Vercel Cron authentication check
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().slice(0, 10);
    console.log(`[sendRepurchaseReminders] Processing reminders for date: ${today}`);

    const remindersSnap = await adminDb()
      .collection('reminders')
      .where('reminderDate', '<=', today)
      .where('status', '==', 'pending')
      .limit(100)
      .get();

    if (remindersSnap.empty) {
      console.log('[sendRepurchaseReminders] No pending reminders.');
      return NextResponse.json({ success: true, message: 'No pending reminders' });
    }

    const batch = adminDb().batch();
    let sentCount = 0;

    for (const reminderDoc of remindersSnap.docs) {
      const reminder = reminderDoc.data();

      // TODO: Send via WA gateway when configured
      console.log(`[sendRepurchaseReminders] Would send to ${reminder.customerPhone}: ${reminder.message}`);

      batch.update(reminderDoc.ref, {
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      sentCount++;
    }

    await batch.commit();
    console.log(`[sendRepurchaseReminders] Sent ${sentCount} reminders.`);

    return NextResponse.json({ success: true, message: `Sent ${sentCount} reminders` });
  } catch (error) {
    console.error('[sendRepurchaseReminders] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
