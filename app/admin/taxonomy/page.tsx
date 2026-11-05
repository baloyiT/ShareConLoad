'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import type { ServiceCategory, TransportMode } from '@/services/freightTypes';

const MODES: TransportMode[] = ['sea', 'air', 'road', 'rail'];

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function AdminTaxonomyPage() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [mode, setMode] = useState<TransportMode | ''>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function load() {
    // Admins see inactive categories too (RLS).
    const { data, error: err } = await supabase.from('service_categories').select('*').order('sort_order').order('name');
    if (err) {
      console.error('Load service categories failed:', err);
      setError('Could not load the categories.');
    } else {
      setCategories((data ?? []) as ServiceCategory[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const finalSlug = slugify(slug || name);
    if (!name.trim() || !finalSlug) { setError('Enter a name and a slug.'); return; }
    setBusy(true);
    setError(null);
    const nextOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0) + 10;
    const { error: err } = await supabase.from('service_categories').insert({
      name: name.trim(), slug: finalSlug, transport_mode: mode || null, sort_order: nextOrder,
    });
    if (err) {
      console.error('Add category failed:', err);
      setError(err.code === '23505' ? 'That slug is already in use.' : 'Could not add the category.');
    } else {
      setName(''); setSlug(''); setMode('');
      await load();
    }
    setBusy(false);
  }

  async function update(id: string, patch: Partial<Pick<ServiceCategory, 'name' | 'is_active'>>) {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('service_categories').update(patch).eq('id', id);
    if (err) {
      console.error('Update category failed:', err);
      setError('Could not save the change.');
    } else {
      setEditingId(null);
      await load();
    }
    setBusy(false);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/admin" className="text-sm text-gray-500 hover:underline">Back to admin</Link>
      <h1 className="text-2xl font-bold text-[#081D3A] mt-2 mb-1">Service categories</h1>
      <p className="text-sm text-gray-500 mb-6">
        Deactivating a category hides it from operators&apos; choices. Operators who already chose it keep their selection.
      </p>

      {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

      <form onSubmit={add} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 grid gap-3 sm:grid-cols-4 items-end">
        <div className="sm:col-span-2">
          <label htmlFor="cat-name" className="block text-sm text-gray-600 mb-1">Name</label>
          <input id="cat-name" className="input input-bordered input-sm w-full" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="cat-slug" className="block text-sm text-gray-600 mb-1">Slug</label>
          <input id="cat-slug" className="input input-bordered input-sm w-full" placeholder={slugify(name)} value={slug} onChange={(e) => setSlug(e.target.value)} />
        </div>
        <div>
          <label htmlFor="cat-mode" className="block text-sm text-gray-600 mb-1">Mode</label>
          <select id="cat-mode" className="select select-bordered select-sm w-full" value={mode} onChange={(e) => setMode(e.target.value as TransportMode | '')}>
            <option value="">Any</option>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <button type="submit" disabled={busy} className="btn btn-sm text-white sm:col-span-4 sm:justify-self-start" style={{ backgroundColor: '#FF6A00' }}>
          Add category
        </button>
      </form>

      {loading && <span className="loading loading-spinner" />}

      <ul className="grid gap-2">
        {categories.map((c) => (
          <li key={c.id} data-testid="category-row" className="bg-white rounded-xl border border-gray-100 p-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[12rem]">
              {editingId === c.id ? (
                <input
                  aria-label="Category name"
                  className="input input-bordered input-sm w-full"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              ) : (
                <p className={`font-medium ${c.is_active ? 'text-gray-800' : 'text-gray-400'}`}>{c.name}</p>
              )}
              <p className="text-xs text-gray-400">{c.slug}{c.transport_mode ? ` · ${c.transport_mode}` : ''}{c.is_active ? '' : ' · inactive'}</p>
            </div>
            {editingId === c.id ? (
              <>
                <button disabled={busy || !editName.trim()} onClick={() => update(c.id, { name: editName.trim() })} className="btn btn-xs btn-outline">Save</button>
                <button onClick={() => setEditingId(null)} className="btn btn-xs btn-ghost">Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => { setEditingId(c.id); setEditName(c.name); }} className="btn btn-xs btn-outline">Rename</button>
                <button disabled={busy} onClick={() => update(c.id, { is_active: !c.is_active })} className="btn btn-xs btn-outline">
                  {c.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
