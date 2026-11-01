import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from '@/lib/utils/copy-text'
afterEach(()=>vi.unstubAllGlobals())
function fallback(result:boolean) {
 const field={value:'',readOnly:false,style:{},setAttribute:vi.fn(),focus:vi.fn(),select:vi.fn(),setSelectionRange:vi.fn(),remove:vi.fn()}
 const previous={focus:vi.fn()}
 const doc={activeElement:previous,createElement:vi.fn(()=>field),body:{appendChild:vi.fn()},execCommand:vi.fn(()=>result)}
 vi.stubGlobal('document',doc)
 return {doc,field,previous}
}
describe('clipboard copy fallback',()=>{
 it('uses the Clipboard API when available',async()=>{const write=vi.fn().mockResolvedValue(undefined);vi.stubGlobal('navigator',{clipboard:{writeText:write}});expect(await copyText('sample summary')).toBe(true);expect(write).toHaveBeenCalledWith('sample summary')})
 it('falls back when clipboard permission is rejected',async()=>{vi.stubGlobal('navigator',{clipboard:{writeText:vi.fn().mockRejectedValue(new Error('denied'))}});const {field,doc,previous}=fallback(true);expect(await copyText('sample summary')).toBe(true);expect(field.value).toBe('sample summary');expect(doc.execCommand).toHaveBeenCalledWith('copy');expect(field.remove).toHaveBeenCalled();expect(previous.focus).toHaveBeenCalled()})
 it('supports browsers without the Clipboard API',async()=>{vi.stubGlobal('navigator',{});fallback(true);expect(await copyText('sample')).toBe(true)})
 it('reports failure rather than falsely confirming copy',async()=>{vi.stubGlobal('navigator',{});const {field}=fallback(false);expect(await copyText('sample')).toBe(false);expect(field.remove).toHaveBeenCalled()})
 it('handles environments without either clipboard method',async()=>{vi.stubGlobal('navigator',{});vi.stubGlobal('document',{});expect(await copyText('sample')).toBe(false)})
})
