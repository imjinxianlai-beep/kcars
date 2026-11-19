// Local UI fixture only. Never imported by the production application.
import { createServer } from 'vite'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..')
const server=await createServer({root,server:{port:5174,strictPort:true,host:'127.0.0.1'},plugins:[{
  name:'handover-fixture-only',enforce:'pre',
  transform(code,id){
    if(id===path.join(root,'src/lib/supabase.js'))return code.replace("import { createClient } from '@supabase/supabase-js'", "import { createClient } from '/tests/fixtures/preview-auth.js'")
  }
}]})
await server.listen();server.printUrls()
