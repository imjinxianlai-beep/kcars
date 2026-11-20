import { supabase } from './supabase'
export async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(error.message)
  return data
}
export function readWorkbook(file, source) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./importWorker.js', import.meta.url), { type: 'module' })
    const finish = (error, result) => { clearTimeout(timer); worker.terminate(); error ? reject(error) : resolve(result) }
    const timer = setTimeout(() => finish(new Error('文件解析超时，请缩小导出范围后重试')), 20000)
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.result)
    worker.onerror = () => finish(new Error('无法解析文件，请检查是否为有效的 .xlsx 文件'))
    file.arrayBuffer().then(buffer => worker.postMessage({ buffer, source, filename: file.name }, [buffer])).catch(e => finish(e))
  })
}
export async function uploadBatch(files) {
  const id = crypto.randomUUID()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('登录已过期，请重新登录')
  const rows = [], originals = []
  let excluded = 0
  // Parse both before uploading; malformed files must not create a partial draft.
  for (const source of ['kcars','oneworld']) {
    const file = files[source]
    const parsed = await readWorkbook(file, source)
    rows.push(...parsed.rows); excluded += parsed.excluded.length
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    originals.push({ source, name: file.name, sha256: [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,'0')).join(''), path: `${user.id}/${id}/${source}.xlsx` })
  }
  for (const f of originals) {
    const { error } = await supabase.storage.from('crm-imports').upload(f.path, files[f.source], { upsert: false, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    if (error) throw new Error(`原始文件保存失败：${error.message}`)
  }
  await rpc('crm_prepare_import', { p_id: id, p_files: originals, p_rows: rows, p_excluded: excluded })
  return id
}
