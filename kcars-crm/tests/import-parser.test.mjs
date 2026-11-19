import test from 'node:test'
import assert from 'node:assert/strict'
import {zipSync,strToU8} from 'fflate'
import {parseWorkbook} from '../src/lib/importWorkbook.js'
import {loginEmail} from '../src/lib/loginIdentity.js'
const headers=['Doc No','Doc Date','Debtor Name','Remark 1','Detail Description','Qty','Unit Price','Total (Ex)','Phone 1','Fax 1','Make','Model']
function book(sheets,date1904=false){
  const files={'xl/workbook.xml':`<workbook><workbookPr date1904="${date1904?'1':'0'}"/><sheets>${sheets.map((_,i)=>`<sheet name="Month${i}" r:id="rId${i}"/>`).join('')}</sheets></workbook>`,'xl/_rels/workbook.xml.rels':`<Relationships>${sheets.map((_,i)=>`<Relationship Id="rId${i}" Target="worksheets/sheet${i}.xml"/>`).join('')}</Relationships>`}
  sheets.forEach((rows,i)=>{files[`xl/worksheets/sheet${i}.xml`]=`<worksheet><sheetData>${[headers,...rows].map((r,n)=>`<row r="${n+1}">${r.map((v,j)=>v===null?'':`<c r="${String.fromCharCode(65+j)}${n+1}" t="inlineStr"><is><t>${v}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`})
  return zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)]))).buffer
}
const row=['001453','46201','Example','SBW25J','Gearbox',1,2000,2000,'JON','TA0','Toyota','Wish']
test('all sheets, leading-zero invoice numbers and staff columns are preserved',()=>{
  const p=parseWorkbook(book([[row],[['KC002',...row.slice(1)]]]),'kcars','K Cars.xlsx')
  assert.equal(p.rows.length,2);assert.equal(p.rows[0].invoice_no,'001453');assert.equal(p.rows[0].mechanic,'TAO');assert.equal(p.rows[0].date,'2026-06-28')
})
test('FOC blank unit price normalizes to zero, other missing prices remain missing',()=>{
  const foc=[...row];foc[4]='Alignment F.O.C';foc[6]=null;foc[7]=0
  const missing=[...foc];missing[4]='Part'
  const p=parseWorkbook(book([[foc,missing]]),'kcars','K Cars.xlsx');assert.equal(p.rows[0].unit_price,0);assert.equal(p.rows[1].unit_price,null)
})
test('wrong format, mismatched source, missing description and invalid date are rejected',()=>{
  assert.throws(()=>parseWorkbook(book([[row]]),'oneworld','1 World.xlsx'),/缺少列/)
  assert.throws(()=>parseWorkbook(book([[row]]),'kcars','K Cars.xls'),/xlsx/)
  const bad=[...row];bad[4]='';assert.throws(()=>parseWorkbook(book([[bad]]),'kcars','K Cars.xlsx'),/缺少发票号或项目说明/)
  bad[4]='Item';bad[1]='31/02/2026';assert.throws(()=>parseWorkbook(book([[bad]]),'kcars','K Cars.xlsx'),/日期无效/)
})
test('1904 dates use workbook date system and footer rows are excluded',()=>{
  const d=[...row];d[1]='1';const p=parseWorkbook(book([[d,[null,null,null,null,null,229]]],true),'kcars','K Cars.xlsx')
  assert.equal(p.rows[0].date,'1904-01-02');assert.equal(p.excluded.length,1)
})
test('username authentication is case insensitive and does not embed a password',()=>{
  assert.equal(loginEmail('Jonathan'),'jonathan@users.kcars.invalid');assert.equal(loginEmail('Owner@Example.com'),'owner@example.com');assert.throws(()=>loginEmail('a b'),/用户名/)
})
