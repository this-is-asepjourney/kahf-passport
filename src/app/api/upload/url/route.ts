import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { generateUploadUrl, R2_PUBLIC_URL } from '@/lib/r2';

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const decodedToken = await adminAuth().verifyIdToken(authorization.split('Bearer ')[1]);
    
    const body = await request.json();
    const { contentType, folder = 'uploads', filename } = body;

    if (!contentType) {
      return NextResponse.json({ error: 'ContentType diperlukan' }, { status: 400 });
    }

    // Generate unique filename based on user ID and timestamp if not provided
    const extension = contentType.split('/')[1] || 'bin';
    const finalFilename = filename || `${decodedToken.uid}-${Date.now()}.${extension}`;
    const key = `${folder}/${finalFilename}`;

    const uploadUrl = await generateUploadUrl(key, contentType);
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (error) {
    console.error('Upload URL generation error:', error);
    return NextResponse.json({ error: 'Gagal membuat URL upload' }, { status: 500 });
  }
}
