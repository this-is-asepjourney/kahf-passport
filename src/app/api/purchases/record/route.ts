import { NextRequest } from 'next/server';
import { POST as mainPostHandler } from '../route';

/**
 * POST /api/purchases/record
 * Backward-compatible endpoint forwarding to unified /api/purchases POST handler.
 */
export async function POST(request: NextRequest) {
  return mainPostHandler(request);
}
