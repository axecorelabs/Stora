import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { redis, withTimeout } from '@/lib/redis';
import { listBanks } from '@/lib/paystack';

const BANKS_CACHE_KEY = 'dashboard:paystack:banks';
const BANKS_CACHE_TTL_SECONDS = 24 * 60 * 60; // bank list changes rarely

export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    try {
      const cached = await withTimeout(redis.get(BANKS_CACHE_KEY));
      if (cached) {
        return NextResponse.json({ success: true, banks: cached });
      }
    } catch (error) {
      console.error('Bank list cache read failed, falling back to Paystack:', error);
    }

    const banks = await listBanks();
    // Paystack's bank list sometimes has more than one entry sharing the
    // same settlement code (e.g. an old and new name for the same bank) --
    // harmless for resolving an account number, but a duplicate React key
    // when rendered as dropdown options, so dedupe by code here (once,
    // cached) rather than in every consumer of this endpoint.
    const seenCodes = new Set();
    const simplified = [];
    for (const b of banks) {
      if (seenCodes.has(b.code)) continue;
      seenCodes.add(b.code);
      simplified.push({ name: b.name, code: b.code });
    }

    try {
      await withTimeout(redis.set(BANKS_CACHE_KEY, simplified, { ex: BANKS_CACHE_TTL_SECONDS }));
    } catch (error) {
      console.error('Bank list cache write failed, skipping:', error);
    }

    return NextResponse.json({ success: true, banks: simplified });
  } catch (error) {
    console.error('Bank list fetch error:', error);
    return NextResponse.json({ success: false, message: 'Failed to load bank list' }, { status: 500 });
  }
}
