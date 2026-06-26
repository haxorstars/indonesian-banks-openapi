'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  RefreshCw,
  ExternalLink,
  Database,
  Cpu,
  Clock,
  Check,
  Copy,
  Server,
  Code,
  Building,
  Globe,
  AlertCircle,
  TrendingUp,
  FileJson,
  Menu,
  X,
  Layers,
  Terminal,
  Activity,
  ChevronRight
} from 'lucide-react';
import { Bank, ScrapingStats } from '@/lib/scraper';

export default function Home() {
  // States
  const [banks, setBanks] = useState<Bank[]>([]);
  const [stats, setStats] = useState<ScrapingStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [apiTab, setApiTab] = useState<'curl' | 'js' | 'php' | 'python' | 'express'>('curl');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  
  // Scraper action transitions
  const [isPending, startTransition] = useTransition();

  // Load initial data
  const fetchBanksData = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/banks${force ? '?force=true' : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setBanks(data.banks);
        setStats(data.stats);
      } else {
        setError(data.error || 'Terjadi kesalahan saat mengambil data.');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal terhubung ke API Server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBanksData();
  }, []);

  // Force Refresh Trigger
  const handleForceRefresh = () => {
    startTransition(async () => {
      await fetchBanksData(true);
    });
  };

  // Copy to Clipboard Utility
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => {
      setCopiedText(null);
    }, 2000);
  };

  // Filtered Banks for client-side quick responsive search
  const filteredBanks = banks.filter((bank) => {
    // Search query match
    const q = searchQuery.toLowerCase();
    const matchSearch =
      bank.nama.toLowerCase().includes(q) ||
      (bank.sandi && bank.sandi.toLowerCase().includes(q)) ||
      (bank.sub_kategori && bank.sub_kategori.toLowerCase().includes(q)) ||
      (bank.kepemilikan && bank.kepemilikan.toLowerCase().includes(q));

    // Category match
    let matchCategory = true;
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'sentral') matchCategory = bank.kategori === 'Bank Sentral';
      else if (selectedCategory === 'umum') matchCategory = bank.kategori === 'Bank Umum';
      else if (selectedCategory === 'asing') matchCategory = bank.kategori === 'Kantor Cabang Bank Asing';
      else if (selectedCategory === 'uus') matchCategory = bank.kategori === 'Unit Usaha Syariah';
    }

    // Type match
    let matchType = true;
    if (selectedType !== 'all') {
      matchType = bank.jenis_bank.toLowerCase().includes(selectedType.toLowerCase());
    }

    return matchSearch && matchCategory && matchType;
  });

  // Dynamic API Endpoint URL based on state
  const getDynamicApiUrl = () => {
    if (typeof window === 'undefined') return '/api/banks';
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    if (selectedCategory !== 'all') params.append('category', selectedCategory);
    if (selectedType !== 'all') params.append('type', selectedType);
    const paramStr = params.toString();
    return `${window.location.origin}/api/banks${paramStr ? `?${paramStr}` : ''}`;
  };

  // Dynamic status counts
  const syariahCount = banks.filter(b => 
    b.jenis_bank.toLowerCase().includes('syariah') || 
    b.kategori.toLowerCase().includes('syariah') ||
    b.nama.toLowerCase().includes('syariah')
  ).length;

  const bpdCount = banks.filter(b => 
    b.sub_kategori?.toLowerCase().includes('pembangunan daerah') ||
    b.nama.toLowerCase().includes('bpd') ||
    b.nama.toLowerCase().includes('bank pembangunan daerah')
  ).length;

  // API Client Code Snippets
  const codeSnippets = {
    curl: `curl -X GET "${getDynamicApiUrl()}" \\
  -H "Accept: application/json"`,
    js: `// Fetch data bank secara realtime
fetch("${getDynamicApiUrl()}")
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log(\`Berhasil memuat \${data.count} bank:\`, data.banks);
    } else {
      console.error("Gagal:", data.error);
    }
  })
  .catch(err => console.error("Network Error:", err));`,
    php: `<?php
// PHP cURL Request Client
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "${getDynamicApiUrl()}");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Accept: application/json'
]);

$response = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
} else {
    $data = json_decode($response, true);
    print_r($data['banks']);
}
curl_close($ch);
?>`,
    python: `import requests

# Python Requests Client
url = "${getDynamicApiUrl()}"
response = requests.get(url, headers={"Accept": "application/json"})

if response.status_code == 200:
    data = response.json()
    print(f"Total Bank: {data['count']}")
    for bank in data['banks'][:3]:
        print(f"- {bank['nama']} (Sandi: {bank['sandi']})")
else:
    print("Gagal mengambil data:", response.text)`,
    express: `// Standalone Node.js Express server code utilizing Cheerio
const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');
const axios = require('axios');

const app = express();
app.use(cors());

let cache = null;
let lastUpdate = 0;

app.get('/api/banks', async (req, res) => {
  const { force } = req.query;
  const now = Date.now();
  
  if (!force && cache && (now - lastUpdate < 3600000)) {
    return res.json({ success: true, count: cache.length, banks: cache, cached: true });
  }

  try {
    const wikiRes = await axios.get('https://id.wikipedia.org/wiki/Daftar_bank_di_Indonesia');
    const $ = cheerio.load(wikiRes.data);
    const banks = [];

    // 1. Bank Sentral
    banks.push({
      id: 'bank-indonesia',
      nama: 'Bank Indonesia',
      sandi: '011',
      tahun_berdiri: '1828',
      jenis_bank: 'Sentral',
      kategori: 'Bank Sentral',
      url: 'https://id.wikipedia.org/wiki/Bank_Indonesia'
    });

    // 2. Bank Umum Table
    const table = $('table.wikitable.sortable').first();
    table.find('tbody tr').each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length === 0) return;
      const nameCell = tds.eq(0);
      const name = nameCell.text().replace(/\\[.*?\\]/g, '').trim();
      if (!name) return;
      
      banks.push({
        id: name.toLowerCase().replace(/[^a-z0-9\\s]/g, '').replace(/\\s+/g, '-'),
        nama: name,
        sandi: tds.eq(1).text().trim() || null,
        tahun_berdiri: tds.eq(2).text().trim() || null,
        jenis_bank: tds.eq(3).text().trim() || 'Konvensional',
        kategori: 'Bank Umum'
      });
    });

    cache = banks;
    lastUpdate = now;
    res.json({ success: true, count: banks.length, banks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));`
  };

  // Navigation handlers for sidebar routes acting as filter macros
  const handleSidebarNav = (catId: string, typeId: string = 'all') => {
    setSelectedCategory(catId);
    setSelectedType(typeId);
    setSearchQuery('');
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-300 flex overflow-hidden font-sans" id="main-container">
      
      {/* LEFT SIDEBAR: API NAVIGATION */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-emerald-500/20 bg-[#0d0d12] flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:h-screen lg:shrink-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`} id="sidebar">
        
        {/* Sidebar Header */}
        <div className="p-6 border-b border-emerald-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-emerald-500 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
              <Building className="w-5 h-5 text-black" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-bold tracking-tight text-emerald-500 leading-none">
                Indonesian Banks
              </h1>
              <span className="text-[10px] text-slate-400 font-medium mt-0.5">OpenApi</span>
            </div>
          </div>
          <button 
            className="lg:hidden p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar Navigation Links */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto" id="sidebar-nav">
          <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">Interactive API Endpoints</div>
          
          <button
            onClick={() => handleSidebarNav('all')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
              selectedCategory === 'all' && selectedType === 'all'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium'
                : 'border-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                selectedCategory === 'all' && selectedType === 'all' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
              }`}>GET</span>
              <span className="text-sm truncate">/api/banks</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          </button>

          <button
            onClick={() => handleSidebarNav('sentral')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
              selectedCategory === 'sentral'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium'
                : 'border-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                selectedCategory === 'sentral' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
              }`}>GET</span>
              <span className="text-sm truncate">/api/banks/sentral</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          </button>

          <button
            onClick={() => handleSidebarNav('all', 'syariah')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
              selectedType === 'syariah'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium'
                : 'border-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                selectedType === 'syariah' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
              }`}>GET</span>
              <span className="text-sm truncate">/api/banks/syariah</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          </button>

          <button
            onClick={() => handleSidebarNav('uus')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
              selectedCategory === 'uus'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium'
                : 'border-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                selectedCategory === 'uus' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
              }`}>GET</span>
              <span className="text-sm truncate">/api/banks/uus-syariah</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          </button>

          <div className="pt-6 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">Scraper Engine</div>
          
          <div className="flex items-center gap-3 px-3 py-2 text-slate-400 text-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
            <span>Cheerio Cache Engine</span>
          </div>
          
          <div className="flex items-center gap-3 px-3 py-2 text-slate-400 text-sm">
            <div className={`w-2 h-2 rounded-full ${stats?.fromCache ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
            <span className="truncate">Cache: {stats?.fromCache ? 'HIT (Active)' : 'MISS (Live Scrape)'}</span>
          </div>

          <div className="flex items-center gap-3 px-3 py-2 text-slate-400 text-sm">
            <Activity className="h-4 w-4 text-emerald-500" />
            <span>CORS Enabled (*)</span>
          </div>

          <div className="pt-6 px-3 py-2 border-t border-emerald-500/10 mt-4 space-y-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Thanks To</div>
            <a 
              href="https://github.com/haxorstars" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#14141b]/60 border border-white/5 hover:border-emerald-500/30 text-slate-300 hover:text-emerald-400 text-xs transition-all cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-semibold">NuLz (Me)</span>
            </a>
            <a 
              href="https://id.wikipedia.org/wiki/Allah" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#14141b]/60 border border-white/5 hover:border-emerald-500/30 text-slate-300 hover:text-emerald-400 text-xs transition-all cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-semibold">Allah</span>
            </a>
            <a 
              href="https://id.wikipedia.org/wiki/Siddhattha_Gotama" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#14141b]/60 border border-white/5 hover:border-emerald-500/30 text-slate-300 hover:text-emerald-400 text-xs transition-all cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-semibold">Siddhattha Gotama (Buddha)</span>
            </a>
            <a 
              href="https://id.wikipedia.org/wiki/Kwan_Im" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#14141b]/60 border border-white/5 hover:border-emerald-500/30 text-slate-300 hover:text-emerald-400 text-xs transition-all cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-semibold">Kwan Im</span>
            </a>
            <a 
              href="https://id.wikipedia.org/wiki/Yesus" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#14141b]/60 border border-white/5 hover:border-emerald-500/30 text-slate-300 hover:text-emerald-400 text-xs transition-all cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-semibold">Yesus</span>
            </a>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-6 border-t border-emerald-500/10">
          <div className="text-[10px] text-slate-500 uppercase mb-1 tracking-wider font-mono">Wikipedia Scraper v2.5.0</div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: '85%' }}></div>
          </div>
        </div>
      </aside>

      {/* Main Viewport Container */}
      <main className="flex-1 flex flex-col relative h-screen overflow-y-auto bg-[#0a0a0c]" id="main-viewport">
        
        {/* HEADER / STATUS BAR */}
        <header className="h-20 border-b border-emerald-500/10 bg-[#0d0d12]/80 backdrop-blur sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 shrink-0" id="header">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-slate-400 hover:text-white bg-slate-900 rounded-xl border border-white/5 transition"
              onClick={() => setSidebarOpen(true)}
              id="sidebar-toggle-btn"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex gap-4 sm:gap-8 overflow-hidden">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase text-slate-500 font-bold tracking-widest font-mono">Scraper Sync</span>
                <span className="text-emerald-400 font-mono text-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Active
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase text-slate-500 font-bold tracking-widest font-mono">Uptime</span>
                <span className="text-emerald-400 font-mono text-sm">99.99%</span>
              </div>
              <div className="flex flex-col hidden sm:flex">
                <span className="text-[9px] uppercase text-slate-500 font-bold tracking-widest font-mono">Engine Latency</span>
                <span className="text-emerald-400 font-mono text-sm">
                  {stats ? `${stats.durationMs}ms` : '142ms'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleForceRefresh}
              disabled={loading || isPending}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/20 transition-all cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
              title="Memaksa scraper mengambil data fresh dari Wikipedia"
              id="refresh-btn"
            >
              <RefreshCw className={`h-4 w-4 ${(loading || isPending) ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Scrap Real-time</span>
            </button>
            <a
              href="https://id.wikipedia.org/wiki/Daftar_bank_di_Indonesia"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-slate-400 hover:text-white bg-white/5 border border-white/5 hover:border-white/10 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition"
              id="source-link"
            >
              <span className="hidden sm:inline">Wiki Source</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </header>

        {/* CONTENT DASHBOARD */}
        <div className="flex-1 p-4 sm:p-8 space-y-6" id="dashboard-content">
          
          {/* TOP METRICS / ANALYTICS BAR */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="telemetry-grid">
              
              <div className="bg-[#14141b] border border-white/5 p-5 rounded-2xl shadow-2xl flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <Database className="h-5.5 w-5.5" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-mono font-bold uppercase tracking-wider">Total Bank Terdata</div>
                  <div className="text-2xl font-light text-white tracking-tight mt-0.5">{stats.totalCount}</div>
                  <div className="text-[10px] text-emerald-400/80 font-mono font-medium mt-0.5">Wikipedia Bahasa Indonesia</div>
                </div>
              </div>

              <div className="bg-[#14141b] border border-white/5 p-5 rounded-2xl shadow-2xl flex items-center gap-4">
                <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
                  <Cpu className="h-5.5 w-5.5" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-mono font-bold uppercase tracking-wider">Cache Hit Ratio</div>
                  <div className="text-2xl font-light text-white tracking-tight mt-0.5">
                    {stats.fromCache ? '100% (HIT)' : '0% (BYPASS)'}
                  </div>
                  <div className="text-[10px] text-sky-400/80 font-mono font-medium mt-0.5">
                    {stats.fromCache ? 'In-Memory Cache Active' : 'Force Refreshed Live'}
                  </div>
                </div>
              </div>

              <div className="bg-[#14141b] border border-white/5 p-5 rounded-2xl shadow-2xl flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                  <Globe className="h-5.5 w-5.5" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-mono font-bold uppercase tracking-wider">Layanan Syariah</div>
                  <div className="text-2xl font-light text-white tracking-tight mt-0.5">
                    {syariahCount} Bank
                  </div>
                  <div className="text-[10px] text-amber-400/80 font-mono font-medium mt-0.5">
                    Prinsip Syariah & UUS
                  </div>
                </div>
              </div>

              <div className="bg-[#14141b] border border-white/5 p-5 rounded-2xl shadow-2xl flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                  <Layers className="h-5.5 w-5.5" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-mono font-bold uppercase tracking-wider">Pembangunan Daerah</div>
                  <div className="text-2xl font-light text-white tracking-tight mt-0.5">
                    {bpdCount} BPD
                  </div>
                  <div className="text-[10px] text-purple-400/80 font-mono font-medium mt-0.5">
                    Sub-Sektor Daerah
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* DUAL WORKSPACE: LEFT (TABLES/FILTERS) & RIGHT (SANDBOX/DEVELOPER DOCS) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="dashboard-grid">
            
            {/* LEFT WORKSPACE: Filters & Directory List */}
            <div className="lg:col-span-2 space-y-6" id="left-area">
              
              {/* High-Tech Search & Filters Card */}
              <div className="bg-[#0d0d12] border border-white/5 p-6 rounded-2xl space-y-5" id="filters-panel">
                <div className="relative">
                  <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Cari bank berdasarkan nama, sandi bank (kode), kepemilikan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#14141b] border border-white/5 focus:border-emerald-500/30 rounded-xl py-3.5 pl-11 pr-4 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/10 transition text-slate-200 placeholder-slate-500 font-medium"
                    id="search-input"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-white/5">
                  
                  {/* Category Filter Pills */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block font-mono">Kategori Bank (Wikitable)</span>
                    <div className="flex flex-wrap gap-1.5" id="category-filters">
                      {[
                        { id: 'all', label: 'Semua Kategori' },
                        { id: 'sentral', label: 'Sentral' },
                        { id: 'umum', label: 'Umum' },
                        { id: 'asing', label: 'Kantor Asing' },
                        { id: 'uus', label: 'Syariah UUS' }
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                            selectedCategory === cat.id
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                              : 'bg-white/5 border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Operational Type (Prinsip) Filter Pills */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block font-mono">Sistem / Prinsip Kerja</span>
                    <div className="flex gap-1.5" id="type-filters">
                      {[
                        { id: 'all', label: 'Semua Sistem' },
                        { id: 'konvensional', label: 'Konvensional' },
                        { id: 'syariah', label: 'Syariah' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedType(t.id)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                            selectedType === t.id
                              ? 'bg-sky-500/10 border-sky-500/40 text-sky-400'
                              : 'bg-white/5 border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* Banks List / Table Card */}
              <div className="bg-[#0d0d12] border border-white/5 rounded-2xl overflow-hidden" id="banks-table-card">
                
                {/* Header of Table */}
                <div className="px-6 py-4.5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                  <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Terminal className="h-4.5 w-4.5 text-emerald-500" />
                    Structured Banks Database
                    <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-mono border border-emerald-500/20">
                      {filteredBanks.length} Banks matches
                    </span>
                  </h2>
                  <button
                    onClick={() => handleCopy(JSON.stringify(filteredBanks, null, 2), 'filtered-json')}
                    className="text-xs text-slate-400 hover:text-slate-100 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition cursor-pointer"
                    title="Copy current filtered banks as JSON array"
                    id="copy-filtered-btn"
                  >
                    {copiedText === 'filtered-json' ? <Check className="h-3 w-3 text-emerald-400" /> : <FileJson className="h-3.5 w-3.5" />}
                    {copiedText === 'filtered-json' ? 'Copied' : 'Export JSON'}
                  </button>
                </div>

                {/* Table or state views */}
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-4" id="loading-spinner">
                    <div className="relative flex items-center justify-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500/20 border-t-emerald-500"></div>
                    </div>
                    <p className="text-sm text-slate-400 font-mono animate-pulse">Running live Wikipedia parse & assembling database...</p>
                  </div>
                ) : error ? (
                  <div className="p-12 text-center" id="error-display">
                    <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-3 animate-bounce" />
                    <p className="text-sm font-bold text-rose-400 font-mono">SCRAPER_ENGINE_FAILURE</p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-2 font-mono">{error}</p>
                    <button
                      onClick={() => fetchBanksData()}
                      className="mt-5 bg-emerald-600 hover:bg-emerald-500 text-black px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Retry Parse Execution
                    </button>
                  </div>
                ) : filteredBanks.length === 0 ? (
                  <div className="py-20 text-center text-slate-500" id="empty-state">
                    <Search className="h-10 w-10 mx-auto mb-3 text-slate-600" />
                    <p className="text-sm font-bold text-slate-400 font-mono">NO_MATCHING_RECORDS</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Coba bersihkan kata kunci filter pencarian Anda di console.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto" id="table-wrapper">
                    
                    {/* Desktop View Table */}
                    <table className="w-full text-left border-collapse hidden md:table" id="desktop-table">
                      <thead>
                        <tr className="border-b border-white/5 text-slate-500 text-[10px] font-bold tracking-wider uppercase bg-white/[0.01]">
                          <th className="px-6 py-4">Nama Bank / ID</th>
                          <th className="px-4 py-4 text-center">Sandi</th>
                          <th className="px-4 py-4">Kategori Sektor</th>
                          <th className="px-4 py-4 text-center">Sistem</th>
                          <th className="px-4 py-4">Est.</th>
                          <th className="px-6 py-4">Kepemilikan / Pengendali</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-sm">
                        <AnimatePresence mode="popLayout">
                          {filteredBanks.map((bank, idx) => (
                            <motion.tr
                              key={bank.id}
                              initial={{ opacity: 0, y: 3 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.12, delay: Math.min(idx * 0.012, 0.12) }}
                              className="hover:bg-white/[0.02] transition"
                            >
                              {/* Name & ID column */}
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                                    <img
                                      src={bank.logo_url}
                                      alt={`${bank.nama} logo`}
                                      className="w-7 h-7 object-contain"
                                      loading="lazy"
                                      onError={(e) => {
                                        const target = e.currentTarget;
                                        if (target.src.includes('clearbit.com')) {
                                          const parts = target.src.split('/');
                                          const domain = parts[parts.length - 1];
                                          target.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                                        } else {
                                          target.src = 'https://unpkg.com/lucide-static@1.21.0/icons/landmark.svg';
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="flex flex-col">
                                    {bank.url ? (
                                      <a
                                        href={bank.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-semibold text-white hover:text-emerald-400 inline-flex items-center gap-1 group"
                                      >
                                        {bank.nama}
                                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition shrink-0" />
                                      </a>
                                    ) : (
                                      <span className="font-semibold text-white">{bank.nama}</span>
                                    )}
                                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">{bank.id}</span>
                                  </div>
                                </div>
                              </td>

                              {/* Sandi Bank (Kode Transfer) */}
                              <td className="px-4 py-4 text-center">
                                {bank.sandi ? (
                                  <span className="font-mono text-xs font-bold bg-[#14141b] text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-500/10">
                                    {bank.sandi}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-600 font-mono">-</span>
                                )}
                              </td>

                              {/* Kategori / Sub-kategori */}
                              <td className="px-4 py-4">
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold text-slate-300">{bank.kategori}</span>
                                  {bank.sub_kategori && (
                                    <span className="text-[10px] text-slate-500 mt-0.5 font-medium truncate max-w-[150px]" title={bank.sub_kategori}>
                                      {bank.sub_kategori}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Sistem operational (Konvensional/Syariah/Sentral) */}
                              <td className="px-4 py-4 text-center">
                                <span
                                  className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                                    bank.jenis_bank.toLowerCase().includes('syariah')
                                      ? 'bg-teal-500/10 border-teal-500/20 text-teal-400'
                                      : bank.jenis_bank.toLowerCase().includes('sentral')
                                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                      : 'bg-sky-500/10 border-sky-500/20 text-sky-400'
                                  }`}
                                >
                                  {bank.jenis_bank}
                                </span>
                              </td>

                              {/* Tahun berdiri */}
                              <td className="px-4 py-4 text-slate-400 font-mono text-xs">
                                {bank.tahun_berdiri || 'N/A'}
                              </td>

                              {/* Kepemilikan */}
                              <td className="px-6 py-4 text-slate-400 text-xs max-w-[180px] truncate" title={bank.kepemilikan || bank.pengendali || ''}>
                                {bank.kepemilikan || bank.pengendali || <span className="text-slate-600">-</span>}
                              </td>

                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>

                    {/* Mobile Card Layout for extreme responsiveness */}
                    <div className="md:hidden divide-y divide-white/5" id="mobile-cards">
                      {filteredBanks.map((bank) => (
                        <div key={bank.id} className="p-5 space-y-3.5">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                                <img
                                  src={bank.logo_url}
                                  alt={`${bank.nama} logo`}
                                  className="w-8 h-8 object-contain"
                                  loading="lazy"
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    if (target.src.includes('clearbit.com')) {
                                      const parts = target.src.split('/');
                                      const domain = parts[parts.length - 1];
                                      target.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                                    } else {
                                      target.src = 'https://unpkg.com/lucide-static@1.21.0/icons/landmark.svg';
                                    }
                                  }}
                                />
                              </div>
                              <div>
                                {bank.url ? (
                                  <a
                                    href={bank.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-bold text-white hover:text-emerald-400 flex items-center gap-1 text-base"
                                  >
                                    {bank.nama}
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                  </a>
                                ) : (
                                  <span className="font-bold text-white text-base">{bank.nama}</span>
                                )}
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{bank.id}</p>
                              </div>
                            </div>
                            
                            {bank.sandi && (
                              <span className="font-mono text-xs font-bold bg-[#14141b] text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-500/20">
                                {bank.sandi}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3.5 text-xs border-t border-white/5 pt-3">
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-wider font-mono">Kategori</span>
                              <span className="font-semibold text-slate-300">{bank.kategori}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-wider font-mono">Sistem</span>
                              <span
                                className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded mt-1 border ${
                                  bank.jenis_bank.toLowerCase().includes('syariah')
                                    ? 'bg-teal-500/10 border-teal-500/20 text-teal-400'
                                    : bank.jenis_bank.toLowerCase().includes('sentral')
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                    : 'bg-sky-500/10 border-sky-500/20 text-sky-400'
                                }`}
                              >
                                {bank.jenis_bank}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-wider font-mono">Tahun Berdiri</span>
                              <span className="font-mono text-slate-400">{bank.tahun_berdiri || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-wider font-mono">Pengendali</span>
                              <span className="text-slate-400 block truncate max-w-[130px]" title={bank.kepemilikan || bank.pengendali || ''}>
                                {bank.kepemilikan || bank.pengendali || '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                )}

              </div>
            </div>

            {/* RIGHT WORKSPACE: Developer Sandbox Explorer & Integration Snippets */}
            <div className="lg:col-span-1 space-y-6" id="right-area">
              
              {/* Dynamic JSON Sandbox terminal */}
              <div className="bg-[#0d0d12] border border-white/5 rounded-2xl flex flex-col h-[520px] overflow-hidden shadow-2xl" id="sandbox-card">
                
                {/* Visual Window Header */}
                <div className="bg-white/5 px-5 py-3 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 ml-4 font-bold tracking-widest uppercase">Response Headers</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    200 OK
                  </span>
                </div>

                {/* API Request Sandbox Box */}
                <div className="p-4 border-b border-white/5 bg-[#0a0a0c]">
                  <div className="text-[10px] font-mono font-bold text-slate-500 uppercase mb-2 tracking-wider">Dynamic Request URL</div>
                  <div className="bg-[#14141b] p-3 rounded-xl border border-white/5 flex items-center justify-between gap-3 overflow-hidden">
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                      <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 border border-emerald-500/10">GET</span>
                      <span className="font-mono text-xs text-slate-300 truncate select-all">{getDynamicApiUrl()}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(getDynamicApiUrl(), 'endpoint-url')}
                      className="p-1.5 bg-[#0d0d12] hover:bg-white/5 border border-white/5 text-slate-400 hover:text-white rounded-lg shrink-0 transition-colors cursor-pointer"
                      title="Salin request URL lengkap ke clipboard"
                    >
                      {copiedText === 'endpoint-url' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Live JSON Output Payload Terminal */}
                <div className="flex-1 bg-[#050508] p-4 overflow-y-auto font-mono text-[11px] leading-relaxed relative flex flex-col">
                  
                  {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-emerald-500" />
                      <span className="text-[10px] font-mono">LOADING_JSON_PAYLOAD...</span>
                    </div>
                  ) : error ? (
                    <div className="text-rose-400 whitespace-pre-wrap">{JSON.stringify({ success: false, error }, null, 2)}</div>
                  ) : (
                    <div className="text-slate-300 whitespace-pre-wrap flex-1 select-all">
                      <span className="text-purple-400">{`{`}</span>{`\n`}
                      {`  `}<span className="text-sky-400">{"\"success\""}</span>: <span className="text-amber-400">true</span>,{`\n`}
                      {`  `}<span className="text-sky-400">{"\"count\""}</span>: <span className="text-amber-400">{filteredBanks.length}</span>,{`\n`}
                      {`  `}<span className="text-sky-400">{"\"banks\""}</span>: <span className="text-purple-400">[</span>{`\n`}
                      {filteredBanks.slice(0, 3).map((b, idx) => (
                        <React.Fragment key={b.id}>
                          {`    `}<span className="text-purple-400">{`{`}</span>{`\n`}
                          {`      `}<span className="text-sky-400">{"\"id\""}</span>: <span className="text-emerald-400">{`"${b.id}"`}</span>,{`\n`}
                          {`      `}<span className="text-sky-400">{"\"nama\""}</span>: <span className="text-emerald-400">{`"${b.nama}"`}</span>,{`\n`}
                          {`      `}<span className="text-sky-400">{"\"sandi\""}</span>: {b.sandi ? <span className="text-emerald-400">{`"${b.sandi}"`}</span> : <span className="text-slate-500">null</span>},{`\n`}
                          {`      `}<span className="text-sky-400">{"\"jenis_bank\""}</span>: <span className="text-emerald-400">{`"${b.jenis_bank}"`}</span>,{`\n`}
                          {`      `}<span className="text-sky-400">{"\"kategori\""}</span>: <span className="text-emerald-400">{`"${b.kategori}"`}</span>,{`\n`}
                          {`      `}<span className="text-sky-400">{"\"logo_url\""}</span>: <span className="text-emerald-400">{`"${b.logo_url}"`}</span>{`\n`}
                          {`    `}<span className="text-purple-400">{`}`}</span>{idx < Math.min(filteredBanks.length, 3) - 1 ? ',' : ''}{`\n`}
                        </React.Fragment>
                      ))}
                      {filteredBanks.length > 3 && <span className="text-slate-500">{`    // ... +${filteredBanks.length - 3} records matching current query parameters\n`}</span>}
                      {`  `}<span className="text-purple-400">]</span>,{`\n`}
                      {`  `}<span className="text-sky-400">{"\"stats\""}</span>: <span className="text-purple-400">{`{`}</span>{`\n`}
                      {`    `}<span className="text-sky-400">{"\"lastUpdated\""}</span>: <span className="text-emerald-400">{`"${stats?.lastUpdated}"`}</span>,{`\n`}
                      {`    `}<span className="text-sky-400">{"\"durationMs\""}</span>: <span className="text-amber-400">{stats?.durationMs}</span>,{`\n`}
                      {`    `}<span className="text-sky-400">{"\"fromCache\""}</span>: <span className="text-amber-400">{stats?.fromCache ? 'true' : 'false'}</span>{`\n`}
                      {`  `}<span className="text-purple-400">{`}`}</span>{`\n`}
                      <span className="text-purple-400">{`}`}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* API Client Integration Snippets Panel */}
              <div className="bg-[#0d0d12] border border-white/5 rounded-2xl overflow-hidden shadow-2xl" id="api-integration-card">
                
                <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2 bg-white/[0.01]">
                  <Code className="h-4.5 w-4.5 text-emerald-500" />
                  <h3 className="text-sm font-bold text-slate-200">API Integration Snippets</h3>
                </div>
                
                {/* Tab Switch Headers */}
                <div className="flex bg-[#0a0a0c] border-b border-white/5 text-xs text-slate-500">
                  {(['curl', 'js', 'php', 'python', 'express'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setApiTab(tab)}
                      className={`flex-1 py-3 font-semibold text-center border-b-2 transition-all uppercase tracking-wider cursor-pointer ${
                        apiTab === tab
                          ? 'border-emerald-500 text-emerald-400 bg-white/[0.02]'
                          : 'border-transparent hover:text-slate-300 text-slate-500 hover:bg-white/[0.01]'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Tab Snippet Content */}
                <div className="p-5 bg-white/[0.01]">
                  <div className="bg-[#050508] text-slate-300 p-4.5 rounded-xl border border-white/5 font-mono text-[11px] leading-relaxed relative overflow-hidden group">
                    <button
                      onClick={() => handleCopy(codeSnippets[apiTab], `snippet-${apiTab}`)}
                      className="absolute top-3 right-3 p-1.5 bg-[#0d0d12] hover:bg-white/5 border border-white/5 text-slate-400 hover:text-white rounded-md opacity-0 group-hover:opacity-100 transition duration-150 cursor-pointer"
                      title="Copy code snippet to clipboard"
                    >
                      {copiedText === `snippet-${apiTab}` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    
                    {apiTab === 'express' ? (
                      <div className="max-h-[220px] overflow-y-auto whitespace-pre select-all text-slate-400">
                        {codeSnippets.express}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap select-all text-emerald-400/90">
                        {codeSnippets[apiTab]}
                      </div>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-slate-500 font-medium mt-3.5 text-center font-mono">
                    {apiTab === 'express' 
                      ? "Use this standalone Node.js Express setup to run scraper endpoints locally."
                      : "Endpoint parameters are automatically synced with your current active dashboard filters!"
                    }
                  </p>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* FOOTER */}
        <footer className="bg-[#0d0d12] border-t border-white/5 py-8 mt-auto shrink-0" id="footer">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-emerald-500" />
              <span className="font-semibold text-slate-400">Indonesia Banks Real-time API</span>
              <span>&bull; &copy; {new Date().getFullYear()}</span>
            </div>
            <div>
              <span>Formulated with Next.js & Cheerio Scraping. CORS: Access-Control-Allow-Origin: *</span>
            </div>
          </div>
        </footer>

      </main>

    </div>
  );
}
