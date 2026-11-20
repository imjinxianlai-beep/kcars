// Browser-only, fictional records. This fixture makes no network requests.
const uid='00000000-0000-4000-8000-000000000002',bid='00000000-0000-4000-8000-000000000010'
const batch={id:bid,created_by:uid,created_at:'2026-11-19T04:00:00Z',status:'partial',files:[{source:'kcars',name:'K Cars 示例.xlsx'},{source:'oneworld',name:'1 World 示例.xlsx'}]}
const entries=[['SAMPLE001','ready','SAA1234Z',1900],['SAMPLE002','hold','',260],['SAMPLE003','duplicate','SBB5678Z',100],['SAMPLE004','imported','SCC8888Z',800]].map(([invoice_no,status,car_plate,total],i)=>({id:String(i),invoice_no,status,car_plate,total,line_count:2,source:i%2?'oneworld':'kcars',payload:[{date:'2026-10-15',customer:'示例客户'}],issues:status==='hold'?['缺少车牌']:[],batch_id:bid}))
const customer={id:'customer-1',customer_id:'customer-1',name:'示例客户',car_plate:'SAA1234Z',car_make:'Toyota',car_model:'WISH'}
const records={crm_import_batches:[batch],crm_import_entries:entries,crm_import_events:[{id:'event-1',created_at:batch.created_at,action:'prepared',detail:{}}],vehicles:[{...customer,id:'vehicle-1',customers:customer}],customers:[customer],invoices:[{id:'invoice-1',invoice_no:'SAMPLE001',date:'2026-10-15',total:1900,status:'paid',advisor:'示例顾问',mechanic:'示例技师',vehicles:{car_plate:'SAA1234Z'},invoice_items:[{id:'line-1',description:'Gearbox overhaul',qty:1,amount:2000,sort_order:0},{id:'line-2',description:'Discount',qty:1,amount:-100,sort_order:1}]}]}
export function createClient(){return {
 auth:{getSession:async()=>({data:{session:{user:{id:uid}}}}),getUser:async()=>({data:{user:{id:uid}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>{}},
 rpc:async name=>name==='crm_my_profile'?{data:{username:'Jonathan · 本地示例',role:'operator'}}:{error:{message:'本地预览不写入数据，请在正式部署后操作。'}},
 from(table){const chain={select(){return this},order(){return this},limit(){return this},range(){return this},eq(){return this},or(){return this},ilike(){return this},single(){this.one=true;return this},then(fn){return Promise.resolve({data:this.one?records[table]?.[0]:records[table]||[],error:null}).then(fn)}};return chain},
 storage:{from:()=>({upload:async()=>({error:{message:'本地预览仅用于页面检查，不上传文件。'}}),download:async()=>({error:{message:'示例没有原始文件'}})})}
}}
