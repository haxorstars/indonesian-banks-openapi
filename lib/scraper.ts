import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface Bank {
  id: string;
  nama: string;
  sandi: string | null;
  tahun_berdiri: string | null;
  jenis_bank: string;
  kategori: 'Bank Sentral' | 'Bank Umum' | 'Kantor Cabang Bank Asing' | 'Unit Usaha Syariah';
  sub_kategori?: string;
  pengendali?: string | null;
  prinsip?: string | null;
  kepemilikan?: string | null;
  url: string | null;
  logo_url: string;
}

export interface ScrapingStats {
  lastUpdated: string;
  durationMs: number;
  sourceUrl: string;
  fromCache: boolean;
  totalCount: number;
}

export interface ScraperResponse {
  banks: Bank[];
  stats: ScrapingStats;
}

// In-memory cache variables
let cachedData: Bank[] | null = null;
let lastFetchTime: number = 0;
// Default Cache duration: 1 hour (3600000 ms)
const CACHE_TTL_MS = 3600000;

// Persistent Logo Cache
let logoCache: Record<string, string> = {};
let logoCacheLoaded = false;
const logoCachePath = path.join(process.cwd(), 'lib', 'logo_cache.json');

async function loadLogoCache() {
  if (logoCacheLoaded) return;
  try {
    const data = await fs.readFile(logoCachePath, 'utf-8');
    logoCache = JSON.parse(data);
    logoCacheLoaded = true;
    console.log(`[Scraper] Loaded ${Object.keys(logoCache).length} logos from cache file.`);
  } catch (error) {
    logoCache = {};
    logoCacheLoaded = true;
    console.log('[Scraper] No logo cache file found, starting fresh.');
  }
}

async function saveLogoCache() {
  try {
    await fs.mkdir(path.dirname(logoCachePath), { recursive: true });
    await fs.writeFile(logoCachePath, JSON.stringify(logoCache, null, 2), 'utf-8');
    console.log(`[Scraper] Saved ${Object.keys(logoCache).length} logos to cache file.`);
  } catch (error) {
    console.error('[Scraper] Failed to save logo cache file:', error);
  }
}

async function fetchLogoFromWikipediaPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const infobox = $('table.infobox, .infobox, .infobox_v2');
    if (!infobox.length) return null;
    
    let logoImg = infobox.find('.logo img, .image img, td[align="center"] img, th[colspan="2"] img, tr:nth-child(1) img, tr:nth-child(2) img').first();
    if (!logoImg.length) {
      logoImg = infobox.find('img').first();
    }
    
    if (logoImg.length) {
      let src = logoImg.attr('src');
      if (src) {
        if (src.startsWith('//')) {
          src = 'https:' + src;
        } else if (src.startsWith('/')) {
          src = 'https://id.wikipedia.org' + src;
        }
        
        if (src.includes('/thumb/')) {
          const original = src.replace('/thumb/', '/').replace(/\/[^\/]+$/, '');
          return original;
        }
        return src;
      }
    }
  } catch (error) {
    console.error(`[Scraper] Error fetching logo from Wikipedia page ${url}:`, error);
  }
  return null;
}

/**
 * Utility to generate an ID from a string
 */
function generateId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Utility to clean Wikipedia text, removing citations like [1], [Note 1], etc.
 */
function cleanText(text: string | undefined): string {
  if (!text) return '';
  return text
    .replace(/\[\d+\]/g, '') // Removes [1], [12]
    .replace(/\[\w+\s+\d+\]/g, '') // Removes [Note 1]
    .replace(/\[note\s+\d+\]/gi, '') // Removes [note 1]
    .replace(/\s+/g, ' ') // Collapses duplicate whitespace
    .trim();
}

/**
 * Utility to format a Wikipedia URL
 */
function cleanUrl(href: string | undefined): string | null {
  if (!href) return null;
  if (href.startsWith('//')) {
    return `https:${href}`;
  }
  if (href.startsWith('/')) {
    return `https://id.wikipedia.org${href}`;
  }
  return href;
}

/**
 * Utility to map a bank ID or name to its official logo or a high-quality initials fallback
 */
/**
 * Utility to map a bank ID or name to its official logo or a high-quality initials fallback
 */
function getBankLogoUrl(id: string, name: string): string {
  // 1. Direct High-Quality Wikipedia Commons SVGs for major Indonesian banks
  const majorLogos: Record<string, string> = {
    'bank-indonesia': 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Bank_Indonesia_logo.svg',
    'bank-mandiri': 'https://upload.wikimedia.org/wikipedia/commons/a/ad/Bank_Mandiri_logo_2016.svg',
    'bank-rakyat-indonesia': 'https://upload.wikimedia.org/wikipedia/commons/2/2e/BRI_Logo.svg',
    'bank-negara-indonesia': 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Negara_Indonesia_logo.svg',
    'bank-central-asia': 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Logo_BCA.svg',
    'bank-syariah-indonesia': 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_Bank_Syariah_Indonesia.svg',
    'bank-tabungan-negara': 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Logo_BTN_baru.svg',
    'bank-danamon-indonesia': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Danamon_Logo.svg',
    'bank-cimb-niaga': 'https://upload.wikimedia.org/wikipedia/commons/c/ca/CIMB_Niaga_logo.svg',
    'bank-permata': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Permata_Bank.svg',
    'bank-mega': 'https://upload.wikimedia.org/wikipedia/commons/a/af/Bank_Mega_logo.svg',
    'bank-maybank-indonesia': 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Maybank_Logo.svg',
    'bank-ocbc-indonesia': 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Logo_OCBC_Indonesia.svg',
    'bank-ocbc-nisp': 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Logo_OCBC_Indonesia.svg',
    'bank-pan-indonesia': 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Logo_Panin_Bank.svg',
    'bank-kb-bukopin': 'https://upload.wikimedia.org/wikipedia/commons/d/df/KB_Bank_Logo_2024.svg',
    'bank-btpn': 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Logo_BTPN.svg',
    'bank-jago': 'https://upload.wikimedia.org/wikipedia/commons/9/91/Bank_Jago_logo.svg',
    'bank-aladin-syariah': 'https://upload.wikimedia.org/wikipedia/commons/6/62/Logo_Bank_Aladin_Syariah.svg',
    'allo-bank-indonesia': 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Allo_Bank_logo.svg',
    'bank-neo-commerce': 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Bank_Neo_Commerce.svg',
    'bank-dki': 'https://upload.wikimedia.org/wikipedia/commons/4/44/Logo_Bank_DKI.svg',
    'bank-pembangunan-daerah-jawa-barat-dan-banten': 'https://upload.wikimedia.org/wikipedia/commons/4/40/Logo_bank_bjb.svg',
    'bank-muamalat-indonesia': 'https://upload.wikimedia.org/wikipedia/commons/0/00/Logo_Bank_Muamalat.svg',
    'bank-uob-indonesia': 'https://upload.wikimedia.org/wikipedia/commons/b/b3/UOB_logo.svg',
    'bank-commonwealth': 'https://upload.wikimedia.org/wikipedia/commons/0/02/Commonwealth_Bank_logo.svg',
    'bank-hsbc-indonesia': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/HSBC_Logo.svg',
    'citi': 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Citi.svg',
    'dbs': 'https://upload.wikimedia.org/wikipedia/commons/c/c5/DBS_Bank_logo.svg',
    'standard-chartered': 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Standard_Chartered_logo.svg'
  };

  if (majorLogos[id]) {
    return majorLogos[id];
  }

  // Check with partial matches for id
  for (const key of Object.keys(majorLogos)) {
    if (id.includes(key) || key.includes(id)) {
      return majorLogos[key];
    }
  }

  // 2. Clearbit Logo fallback with Google Favicon multi-tier support for all banks
  const bankDomains: Record<string, string> = {
    // Commercial Banks
    'bank-central-asia': 'bca.co.id',
    'bank-cimb-niaga': 'cimbniaga.co.id',
    'bank-danamon': 'danamon.co.id',
    'bank-maybank': 'maybank.co.id',
    'bank-mega': 'bankmega.com',
    'bank-ocbc': 'ocbc.id',
    'bank-panin': 'panin.co.id',
    'bank-permata': 'permatabank.com',
    'bank-kb-bukopin': 'kbbukopin.com',
    'bank-keb-hana': 'hanabank.co.id',
    'bank-mnc': 'mncbank.co.id',
    'bank-jtrust': 'jtrustbank.co.id',
    'bank-shinhan': 'shinhan.co.id',
    'bank-maspion': 'bankmaspion.co.id',
    'bank-mayapada': 'bankmayapada.com',
    'bank-muamalat': 'bankmuamalat.co.id',
    'bank-artha-graha': 'arthagraha.com',
    'bank-bumi-arta': 'bankbumiarta.co.id',
    'bank-hsbc': 'hsbc.co.id',
    'bank-icbc': 'icbcindonesia.com',
    'bank-qnb': 'qnb.co.id',
    'bank-sbi': 'sbiindonesia.co.id',
    'bank-victoria': 'victoriabank.co.id',
    'bank-woori-saudara': 'bankwoorisaudara.com',
    'bank-ccb': 'ccbindonesia.co.id',
    'bank-capital': 'bankcapital.co.id',
    'bank-ganesha': 'bankganesha.co.id',
    'bank-ina-perdana': 'bankina.co.id',
    'bank-index': 'bankindex.co.id',
    'bank-jago': 'bankjago.com',
    'bank-aladin': 'aladinbank.co.id',
    'allo-bank': 'allobank.com',
    'bank-neo-commerce': 'bankneocommerce.co.id',
    'seabank': 'seabank.co.id',
    'superbank': 'superbank.id',
    'bank-saqu': 'banksaqu.co.id',
    'bank-krom': 'krom.id',
    'bank-mestika': 'bankmestika.co.id',
    'bank-oke': 'okbank.co.id',
    'bank-sahabat-sampoerna': 'banksampoerna.com',
    'bank-sinarmas': 'banksinarmas.com',
    'bank-commonwealth': 'commbank.co.id',
    'bank-amar': 'amarbank.co.id',
    'bank-mas': 'bankmas.co.id',
    'hibank': 'hibank.co.id',

    // Regional Development Banks (BPD)
    'bank-dki': 'bankdki.co.id',
    'bank-bjb': 'bankbjb.co.id',
    'bank-jateng': 'bankjateng.co.id',
    'bank-jatim': 'bankjatim.co.id',
    'bank-bpd-diy': 'bpddiy.co.id',
    'bank-bpd-bali': 'bankbpdbali.co.id',
    'bank-bpd-diy-uus': 'bpddiy.co.id',
    'bank-bali': 'bankbpdbali.co.id',
    'bank-banten': 'bankbanten.co.id',
    'bank-aceh': 'bankaceh.co.id',
    'bank-sumut': 'banksumut.co.id',
    'bank-nagari': 'banknagari.co.id',
    'bank-riau-kepri': 'brksyariah.co.id',
    'bank-sumsel-babel': 'banksumselbabel.co.id',
    'bank-lampung': 'banklampung.co.id',
    'bank-jambi': 'bankjambi.co.id',
    'bank-bengkulu': 'bankbengkulu.co.id',
    'bank-kalbar': 'bankkalbar.co.id',
    'bank-kalteng': 'bankkalteng.co.id',
    'bank-kalsel': 'bankkalsel.co.id',
    'bank-kaltimtara': 'bankkaltimtara.co.id',
    'bank-sulselbar': 'banksulselbar.co.id',
    'bank-sultra': 'banksultra.co.id',
    'bank-sulteng': 'banksulteng.co.id',
    'bank-sulutgo': 'banksulutgo.co.id',
    'bank-ntb': 'bankntb.co.id',
    'bank-ntb-syariah': 'bankntb.co.id',
    'bank-ntt': 'bpdntt.co.id',
    'bank-maluku': 'bankmaluku.co.id',
    'bank-papua': 'bankpapua.co.id',

    // Syariah Banks
    'bank-syariah-indonesia': 'bankbsi.co.id',
    'bank-muamalat-indonesia': 'bankmuamalat.co.id',
    'bank-mega-syariah': 'megasyariah.co.id',
    'bank-victoria-syariah': 'bankvictoriasyariah.co.id',
    'bank-bjb-syariah': 'bankbjbsyariah.co.id',
    'bank-aceh-syariah': 'bankaceh.co.id',

    // Foreign Banks (Branch Offices in Jakarta)
    'bank-of-china': 'bankofchina.com',
    'citibank': 'citibank.co.id',
    'citi': 'citibank.co.id',
    'deutsche-bank': 'db.com',
    'jpmorgan': 'jpmorgan.com',
    'jp-morgan': 'jpmorgan.com',
    'mufg': 'mufg.jp',
    'dbs': 'dbs.id',
    'uob': 'uob.co.id',
    'standard-chartered': 'sc.com/id',
    'hsbc': 'hsbc.co.id'
  };

  // Check domains
  for (const [key, domain] of Object.entries(bankDomains)) {
    if (id.includes(key) || key.includes(id)) {
      return `https://logo.clearbit.com/${domain}`;
    }
  }

  // 3. Smart Guess Domain as a secondary resolver before final vector fallback
  const normalizedId = id.replace(/^(pt-bank-|bank-|pt-)/i, '').replace(/-(persero|tbk|syariah)$/i, '');
  if (normalizedId.length > 2) {
    const guessedDomain = `bank${normalizedId.replace(/-/g, '')}.co.id`;
    return `https://logo.clearbit.com/${guessedDomain}`;
  }

  // 4. Default high-quality, pixel-perfect Landmark building SVG icon as a clean fallback
  return 'https://unpkg.com/lucide-static@1.21.0/icons/landmark.svg';
}

/**
 * Main scraper function
 */
export async function scrapeWikipediaBanks(forceRefresh = false): Promise<ScraperResponse> {
  const startTime = Date.now();
  const sourceUrl = 'https://id.wikipedia.org/wiki/Daftar_bank_di_Indonesia';

  // Load logo cache from disk if needed
  await loadLogoCache();

  // Check cache validity
  const now = Date.now();
  const cacheAge = now - lastFetchTime;
  if (!forceRefresh && cachedData && cacheAge < CACHE_TTL_MS) {
    // Make sure we attach correct logo URLs from our logoCache to the cached data in memory as well
    for (const bank of cachedData) {
      if (logoCache[bank.id]) {
        bank.logo_url = logoCache[bank.id];
      }
    }
    return {
      banks: cachedData,
      stats: {
        lastUpdated: new Date(lastFetchTime).toISOString(),
        durationMs: Date.now() - startTime,
        sourceUrl,
        fromCache: true,
        totalCount: cachedData.length,
      },
    };
  }

  try {
    // Fetch live page HTML
    const res = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 0 }, // Ensure next.js fetches live data
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Wikipedia page: ${res.status} ${res.statusText}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const banks: Bank[] = [];

    // --- 1. Category: Bank Sentral (Bank Indonesia) ---
    // Since BI is described in a paragraph rather than a table, we add it with its standard details
    const biLinkEl = $('h2:contains("Bank Sentral")').parent().nextAll('p').find('a:contains("Bank Indonesia")').first();
    const biUrl = biLinkEl.attr('href') ? cleanUrl(biLinkEl.attr('href')) : 'https://id.wikipedia.org/wiki/Bank_Indonesia';
    
    banks.push({
      id: 'bank-indonesia',
      nama: 'Bank Indonesia',
      sandi: '011',
      tahun_berdiri: '1828', // De Javasche Bank founded in 1828, designated as BI in 1953
      jenis_bank: 'Sentral',
      kategori: 'Bank Sentral',
      sub_kategori: 'Bank Sentral Republik Indonesia',
      pengendali: 'Pemerintah Republik Indonesia',
      prinsip: 'Moneter',
      kepemilikan: 'Negara',
      url: biUrl,
      logo_url: getBankLogoUrl('bank-indonesia', 'Bank Indonesia'),
    });

    // --- 2. Category: Bank Umum (Table #1) ---
    // Table 1 columns: [Nama, Sandi bank, Tahun berdiri, Jenis bank, Pengendali, Prinsip, Kepemilikan, Operasional]
    const bankUmumTable = $('table.wikitable.sortable').first();
    if (bankUmumTable.length) {
      // Find row headers first to verify positions, although Wikipedia structure is highly stable
      const headerIndices: Record<string, number> = {
        nama: 0,
        sandi: 1,
        berdiri: 2,
        jenis: 3,
        pengendali: 4,
        prinsip: 5,
        kepemilikan: 6,
      };

      bankUmumTable.find('tbody tr').each((_, trEl) => {
        const tds = $(trEl).find('td');
        // Skip header rows or empty rows
        if (tds.length === 0) return;

        const nameCell = tds.eq(headerIndices.nama);
        const nameText = cleanText(nameCell.text());
        if (!nameText) return;

        const sandiText = cleanText(tds.eq(headerIndices.sandi).text()) || null;
        const berdiriText = cleanText(tds.eq(headerIndices.berdiri).text()) || null;
        const jenisText = cleanText(tds.eq(headerIndices.jenis).text()) || 'Konvensional';
        const pengendaliText = cleanText(tds.eq(headerIndices.pengendali).text()) || null;
        const prinsipText = cleanText(tds.eq(headerIndices.prinsip).text()) || null;
        const kepemilikanText = cleanText(tds.eq(headerIndices.kepemilikan).text()) || null;
        
        const anchor = nameCell.find('a').first();
        const relativeUrl = anchor.attr('href');
        const url = relativeUrl ? cleanUrl(relativeUrl) : null;

        // Group into types (BUMN, BPD, Swasta, etc.)
        let subKategori = 'Bank Swasta Nasional';
        if (pengendaliText?.toLowerCase().includes('bpd') || kepemilikanText?.toLowerCase().includes('pemerintah daerah')) {
          subKategori = 'Bank Pembangunan Daerah (BPD)';
        } else if (pengendaliText?.toLowerCase().includes('bumn') || kepemilikanText?.toLowerCase().includes('pemerintah indonesia') || nameText.includes('Mandiri') || nameText.includes('Negara Indonesia') || nameText.includes('Rakyat Indonesia') || nameText.includes('Tabungan Negara')) {
          subKategori = 'Bank Milik Negara (BUMN)';
        } else if (pengendaliText?.toLowerCase().includes('asing')) {
          subKategori = 'Bank Swasta Asing';
        }

        const bankId = generateId(nameText);
        banks.push({
          id: bankId,
          nama: nameText,
          sandi: sandiText,
          tahun_berdiri: berdiriText,
          jenis_bank: jenisText,
          kategori: 'Bank Umum',
          sub_kategori: subKategori,
          pengendali: pengendaliText,
          prinsip: prinsipText,
          kepemilikan: kepemilikanText,
          url,
          logo_url: getBankLogoUrl(bankId, nameText),
        });
      });
    }

    // --- 3. Category: Kantor Cabang Bank Asing (Table #2) ---
    // Table 2 columns: [Nama bank, Sandi bank, Tahun pendirian]
    let bankAsingTable: any = null;
    $('table.wikitable').each((_idx: number, tableEl: any) => {
      const headersText = $(tableEl).find('th').text().toLowerCase();
      if (headersText.includes('kantor cabang bank asing') || (headersText.includes('nama bank') && headersText.includes('tahun pendirian'))) {
        bankAsingTable = $(tableEl);
      }
    });

    if (bankAsingTable && bankAsingTable.length) {
      bankAsingTable.find('tbody tr').each((_idx: number, trEl: any) => {
        const tds = $(trEl).find('td');
        if (tds.length === 0) return;

        const nameCell = tds.eq(0);
        const nameText = cleanText(nameCell.text());
        if (!nameText) return;

        const sandiText = cleanText(tds.eq(1).text()) || null;
        const berdiriText = cleanText(tds.eq(2).text()) || null;
        const anchor = nameCell.find('a').first();
        const relativeUrl = anchor.attr('href');
        const url = relativeUrl ? cleanUrl(relativeUrl) : null;

        const bankId = generateId(nameText);
        banks.push({
          id: bankId,
          nama: nameText,
          sandi: sandiText,
          tahun_berdiri: berdiriText,
          jenis_bank: 'Konvensional',
          kategori: 'Kantor Cabang Bank Asing',
          sub_kategori: 'Bank Asing',
          pengendali: 'Kantor Cabang Asing',
          prinsip: 'Devisa',
          kepemilikan: 'Swasta Asing',
          url,
          logo_url: getBankLogoUrl(bankId, nameText),
        });
      });
    }

    // --- 4. Category: Unit Usaha Syariah (Table #3) ---
    // Table 3 columns: [Nama, Dibentuk] with subheaders for subcategories
    let uusTable: any = null;
    $('table.wikitable').each((_idx: number, tableEl: any) => {
      const headersText = $(tableEl).find('th').text().toLowerCase();
      if (headersText.includes('bank pembangunan daerah') && headersText.includes('bank swasta') && headersText.includes('dibentuk')) {
        uusTable = $(tableEl);
      } else if (headersText.includes('dibentuk') && !headersText.includes('tahun pendirian') && !headersText.includes('jenis bank')) {
        uusTable = $(tableEl);
      }
    });

    if (uusTable && uusTable.length) {
      let currentSubCat = 'Bank Pembangunan Daerah (UUS)';

      uusTable.find('tr').each((_idx: number, trEl: any) => {
        const row = $(trEl);
        
        // Check for subheader row spanning 2 columns (indicates subcategory)
        const subheaderTh = row.find('th[colspan="2"]');
        if (subheaderTh.length) {
          const subText = cleanText(subheaderTh.text());
          if (subText) {
            currentSubCat = `${subText} (UUS)`;
          }
          return;
        }

        const tds = row.find('td');
        if (tds.length === 0) return;

        const nameCell = tds.eq(0);
        const nameText = cleanText(nameCell.text());
        if (!nameText) return;

        const dibentukText = cleanText(tds.eq(1).text()) || null;
        const anchor = nameCell.find('a').first();
        const relativeUrl = anchor.attr('href');
        const url = relativeUrl ? cleanUrl(relativeUrl) : null;

        const bankId = generateId(nameText);
        banks.push({
          id: bankId,
          nama: nameText,
          sandi: null, // UUS are units of parent banks, code depends on parent bank
          tahun_berdiri: dibentukText,
          jenis_bank: 'Syariah',
          kategori: 'Unit Usaha Syariah',
          sub_kategori: currentSubCat,
          pengendali: 'Bank Induk',
          prinsip: 'Syariah',
          kepemilikan: currentSubCat.toLowerCase().includes('pembangunan daerah') ? 'BUMD / Pemda' : 'Swasta',
          url,
          logo_url: getBankLogoUrl(bankId, nameText),
        });
      });
    }

    // Resolve all bank logos from Wikipedia in parallel with limited concurrency (batch of 10)
    let hasNewLogos = false;
    const banksToScrape = banks.filter(b => !logoCache[b.id] && b.url);
    
    if (banksToScrape.length > 0) {
      console.log(`[Scraper] Scraping logos for ${banksToScrape.length} new banks from Wikipedia...`);
      const batchSize = 10;
      for (let i = 0; i < banksToScrape.length; i += batchSize) {
        const batch = banksToScrape.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (bank) => {
            if (bank.url) {
              const scrapedLogo = await fetchLogoFromWikipediaPage(bank.url);
              if (scrapedLogo) {
                logoCache[bank.id] = scrapedLogo;
                hasNewLogos = true;
              }
            }
          })
        );
      }
    }

    // Now populate/map the final logo URLs to each bank
    for (const bank of banks) {
      if (logoCache[bank.id]) {
        bank.logo_url = logoCache[bank.id];
      } else {
        // Fallback to domain logo or initials/icon
        const fallbackLogo = getBankLogoUrl(bank.id, bank.nama);
        logoCache[bank.id] = fallbackLogo;
        bank.logo_url = fallbackLogo;
        hasNewLogos = true;
      }
    }

    if (hasNewLogos) {
      await saveLogoCache();
    }

    // Update in-memory cache
    cachedData = banks;
    lastFetchTime = Date.now();

    return {
      banks,
      stats: {
        lastUpdated: new Date(lastFetchTime).toISOString(),
        durationMs: Date.now() - startTime,
        sourceUrl,
        fromCache: false,
        totalCount: banks.length,
      },
    };

  } catch (error: any) {
    console.error('Error during Wikipedia bank scraping:', error);
    
    // Fallback to cache if exists, even if expired, for maximum resiliency
    if (cachedData) {
      return {
        banks: cachedData,
        stats: {
          lastUpdated: new Date(lastFetchTime).toISOString(),
          durationMs: Date.now() - startTime,
          sourceUrl,
          fromCache: true,
          totalCount: cachedData.length,
        },
      };
    }
    
    throw error;
  }
}
