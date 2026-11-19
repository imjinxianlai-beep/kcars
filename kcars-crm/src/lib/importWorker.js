import { parseWorkbook } from './importWorkbook'
self.onmessage = ({ data }) => {
  try { self.postMessage({ result: parseWorkbook(data.buffer, data.source, data.filename) }) }
  catch (error) { self.postMessage({ error: error.message || '无法读取 Excel 文件' }) }
}
