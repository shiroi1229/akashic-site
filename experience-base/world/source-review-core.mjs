/** Local source intake only. No canon approval, upload, or world-manifest mutation. */
export const SOURCE_MAX_BYTES=32*1024*1024;
export const SOURCE_MAX_PIXELS=24_000_000;
export function imageHeader(data){
 const b=data instanceof Uint8Array?data:new Uint8Array(data);
 if(b.length<24)throw Error('image_header');
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 let format,width,height;
 if([137,80,78,71,13,10,26,10].every((x,i)=>b[i]===x)){
  if(v.getUint32(8)!==13||String.fromCharCode(...b.slice(12,16))!=='IHDR')throw Error('png_header');
  width=v.getUint32(16);height=v.getUint32(20);format='PNG';
 }else if(b[0]===255&&b[1]===216){
  let offset=2,segments=0;
  while(offset<b.length&&segments++<10000){
   if(b[offset++]!==255)throw Error('jpeg_header');
   while(offset<b.length&&b[offset]===255)offset++;
   const marker=b[offset++];if(marker===0xd9||marker===0xda)break;
   if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
   if(offset+2>b.length)throw Error('jpeg_segment');const length=v.getUint16(offset);
   if(length<2||offset+length>b.length)throw Error('jpeg_segment');
   if([0xc0,0xc1,0xc2].includes(marker)){
    if(length<8)throw Error('jpeg_frame');height=v.getUint16(offset+3);width=v.getUint16(offset+5);format='JPEG';break;
   }
   offset+=length;
  }
 }else throw Error('source_format_png_jpeg_only');
 if(!format||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw Error('image_dimensions');
 if(width*height>SOURCE_MAX_PIXELS)throw Error('decoded_pixel_budget');
 return {format,width,height};
}
export async function inspectSourceFile(file,{hasher=globalThis.crypto?.subtle}={}){
 if(!file||!Number.isSafeInteger(file.size)||file.size<1||file.size>SOURCE_MAX_BYTES)throw Error('source_file_budget');
 if(!hasher)throw Error('secure_context_required');
 const buffer=await file.arrayBuffer();if(buffer.byteLength!==file.size)throw Error('source_size_changed');
 const header=imageHeader(buffer);
 const hash=new Uint8Array(await hasher.digest('SHA-256',buffer));
 return {...header,bytes:buffer.byteLength,sha256:[...hash].map(x=>x.toString(16).padStart(2,'0')).join(''),original_name:file.name,
  status:'reference_only',approval:{status:'pending'},pixels_modified:false};
}
export function sourceReceipt(records){
 const allowed=['front','top','plate'];
 const items=allowed.filter(r=>records[r]).map(r=>({role:r,...records[r]}));
 const same=records.front&&records.top&&records.front.sha256===records.top.sha256;
 return {schema:'akashic-source-intake/v1',version:'0.3.1',canonical_status:'pending',production_ready:false,canonical_locations_added:0,approval_changed:false,
  source_images:items,missing_roles:allowed.filter(r=>!records[r]),
  errors:same?['front_and_top_are_identical']:[],
  note:'ハッシュは原本の同一性の証拠であり、正典承認や映画品質の証拠ではありません。ファイルは送信していません。'};
}
