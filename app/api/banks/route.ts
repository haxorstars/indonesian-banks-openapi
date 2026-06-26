import { NextRequest, NextResponse } from 'next/server';
import { scrapeWikipediaBanks } from '@/lib/scraper';

/**
 * Handle GET requests to fetch list of Indonesian Banks from Wikipedia.
 * 
 * Query parameters supported:
 * - search: string (search by name, sandi/code, or sub_category)
 * - category: 'sentral' | 'umum' | 'asing' | 'uus'
 * - type: 'syariah' | 'konvensional'
 * - force: 'true' (bypass in-memory cache to fetch live from Wikipedia)
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin') || '*';
  
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === 'true';
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    
    // Scrape banks (uses in-memory cache unless force=true)
    let { banks, stats } = await scrapeWikipediaBanks(force);
    
    // Search filter (name, sandi, sub_kategori)
    if (search) {
      const q = search.toLowerCase();
      banks = banks.filter(
        (b) =>
          b.nama.toLowerCase().includes(q) ||
          (b.sandi && b.sandi.toLowerCase().includes(q)) ||
          (b.sub_kategori && b.sub_kategori.toLowerCase().includes(q))
      );
    }
    
    // Category filter
    if (category) {
      const catLower = category.toLowerCase();
      banks = banks.filter((b) => {
        if (catLower === 'sentral') return b.kategori === 'Bank Sentral';
        if (catLower === 'umum') return b.kategori === 'Bank Umum';
        if (catLower === 'asing') return b.kategori === 'Kantor Cabang Bank Asing';
        if (catLower === 'uus') return b.kategori === 'Unit Usaha Syariah';
        return b.kategori.toLowerCase().includes(catLower);
      });
    }
    
    // Type filter (Syariah vs Konvensional)
    if (type) {
      const typeLower = type.toLowerCase();
      banks = banks.filter((b) => b.jenis_bank.toLowerCase().includes(typeLower));
    }
    
    return NextResponse.json(
      {
        success: true,
        count: banks.length,
        banks,
        stats,
      },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
          // Cache the API response in intermediate proxies/browsers for 10 minutes
          'Cache-Control': 'public, max-age=600, s-maxage=3600',
          'X-Cache-Status': stats.fromCache ? 'HIT' : 'MISS',
        },
      }
    );
  } catch (error: any) {
    console.error('API Error fetching banks:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to scrape or retrieve bank data.',
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
        },
      }
    );
  }
}

/**
 * Handle OPTIONS preflight requests for CORS.
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') || '*';
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
      'Access-Control-Max-Age': '86400',
    },
  });
}
