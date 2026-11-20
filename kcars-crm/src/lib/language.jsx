import { useSyncExternalStore } from 'react'
import translations from './translations.json'
const listeners=new Set()
let language='zh'
try { language=localStorage.getItem('kcars-language')==='en'?'en':'zh' } catch {}
export const getLanguage=()=>language
export function setLanguage(next){
  language=next==='en'?'en':'zh'
  try { localStorage.setItem('kcars-language',language) } catch {}
  document.documentElement.lang=language==='en'?'en':'zh-CN'
  listeners.forEach(fn=>fn())
}
export function useLanguage(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},getLanguage,getLanguage)}
export function t(key,...values){
  const template=language==='en'?(translations[key]||key):key
  return String(template).replace(/\{(\d+)\}/g,(_,index)=>values[Number(index)]??'')
}
export function LanguageSwitch(){
  const current=useLanguage()
  return <label className="language-switch"><span>Language / 语言</span><select aria-label="Language / 语言" value={current} onChange={e=>setLanguage(e.target.value)}><option value="zh">中文</option><option value="en">English</option></select></label>
}

export function translateError(message){
  if(language!=='en')return message
  const translated=t(message)
  if(!/[\u3400-\u9fff]/.test(translated))return translated
  for(const [key,value] of Object.entries(translations)){
    if(key.length>4 && message.includes(key) && !/[\u3400-\u9fff]/.test(value))return value
  }
  return 'Unable to complete this action. Check the workbook format, required columns, dates and amounts, or contact your administrator.'
}
