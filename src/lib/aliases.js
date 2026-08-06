import { supabase } from './supabase'

export async function matchAlias(alias_name) {
  if (!alias_name) return null
  const { data } = await supabase
    .from('ingredient_aliases')
    .select('canonical_name')
    .ilike('alias_name', alias_name.trim())
    .maybeSingle()
  return data?.canonical_name ?? null
}

export async function saveAlias(alias_name, canonical_name) {
  if (!alias_name || !canonical_name) return
  await supabase
    .from('ingredient_aliases')
    .upsert(
      { alias_name: alias_name.trim(), canonical_name: canonical_name.trim() },
      { onConflict: 'alias_name' }
    )
}

export async function listAliases(canonical_name) {
  const { data } = await supabase
    .from('ingredient_aliases')
    .select('alias_name')
    .ilike('canonical_name', canonical_name)
  return data?.map((r) => r.alias_name) ?? []
}
