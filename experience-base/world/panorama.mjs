/** One true equirectangular capture. No outpainting, fake panorama, or external CDN. */
export class Panorama{
 constructor(canvas){
  this.canvas=canvas;this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});
  this.destroyed=false;this.loaded=false;this.program=null;this.buffer=null;this.texture=null;
  if(!this.gl)throw Error('webgl_unavailable');
  const gl=this.gl,shaders=[];
  try{
   const vs=`attribute vec2 p; varying vec2 uv; void main(){uv=p;gl_Position=vec4(p,0.,1.);}`;
   const fs=`precision highp float; varying vec2 uv; uniform sampler2D map; uniform float aspect; uniform float fov; uniform float yaw; uniform float pitch;
    void main(){vec3 d=normalize(vec3(uv.x*aspect*tan(fov*.5),uv.y*tan(fov*.5),-1.));
     d=vec3(d.x,cos(pitch)*d.y-sin(pitch)*d.z,sin(pitch)*d.y+cos(pitch)*d.z);
     d=vec3(cos(yaw)*d.x-sin(yaw)*d.z,d.y,sin(yaw)*d.x+cos(yaw)*d.z);
     vec2 t=vec2(fract(atan(d.x,-d.z)/6.28318530718+.5),.5-asin(clamp(d.y,-1.,1.))/3.14159265359);
     gl_FragColor=texture2D(map,t);}`;
   const shader=(type,src)=>{const s=gl.createShader(type);if(!s)throw Error('shader_allocation');shaders.push(s);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('shader_compile');return s;};
   const v=shader(gl.VERTEX_SHADER,vs),f=shader(gl.FRAGMENT_SHADER,fs);
   this.program=gl.createProgram();if(!this.program)throw Error('program_allocation');
   gl.attachShader(this.program,v);gl.attachShader(this.program,f);gl.linkProgram(this.program);
   if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('shader_link');
   gl.useProgram(this.program);
   this.buffer=gl.createBuffer();if(!this.buffer)throw Error('buffer_allocation');
   gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
   this.position=gl.getAttribLocation(this.program,'p');if(this.position<0)throw Error('shader_attribute');
   this.texture=gl.createTexture();if(!this.texture)throw Error('texture_allocation');
   gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   this.uniforms=Object.fromEntries(['map','aspect','fov','yaw','pitch'].map(k=>[k,gl.getUniformLocation(this.program,k)]));
   this.check('webgl_initialization');
  }catch(e){this.dispose();throw e;}
  finally{for(const shader of shaders)gl.deleteShader(shader);}
 }
 check(code){if(this.gl.isContextLost())throw Error('webgl_context_lost');if(this.gl.getError()!==this.gl.NO_ERROR)throw Error(code);}
 setImage(image){
  if(this.destroyed)throw Error('renderer_disposed');this.loaded=false;
  const gl=this.gl,w=image.naturalWidth||image.width,h=image.naturalHeight||image.height,limit=gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<2||h<1||w!==2*h)throw Error('panorama_dimensions');
  if(w>limit||h>limit)throw Error('texture_limit');
  this.check('webgl_before_upload');
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);
  this.check('texture_upload_failed');this.loaded=true;
 }
 render(v,w,h){
  if(this.destroyed)throw Error('renderer_disposed');if(!this.loaded)throw Error('panorama_not_loaded');
  if(![w,h,v?.fov,v?.yaw,v?.pitch].every(Number.isFinite)||w<1||h<1||v.fov<1||v.fov>=180)throw Error('invalid_viewport');
  const gl=this.gl;this.check('webgl_before_render');
  const limits=gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  const d=Math.min(globalThis.devicePixelRatio||1,1.5,limits[0]/w,limits[1]/h,Math.sqrt(4_000_000/(w*h)));
  const bw=Math.max(1,Math.round(w*d)),bh=Math.max(1,Math.round(h*d));
  // Assigning dimensions reallocates the drawing buffer. Do it only when needed.
  if(this.canvas.width!==bw)this.canvas.width=bw;if(this.canvas.height!==bh)this.canvas.height=bh;
  gl.viewport(0,0,bw,bh);gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(this.uniforms.map,0);
  gl.uniform1f(this.uniforms.aspect,w/h);gl.uniform1f(this.uniforms.fov,v.fov*Math.PI/180);gl.uniform1f(this.uniforms.yaw,v.yaw);gl.uniform1f(this.uniforms.pitch,v.pitch);gl.drawArrays(gl.TRIANGLES,0,6);
  this.check('panorama_draw_failed');
 }
 dispose(){
  if(this.destroyed)return;this.destroyed=true;this.loaded=false;const g=this.gl;if(!g)return;
  if(this.texture)g.deleteTexture(this.texture);if(this.buffer)g.deleteBuffer(this.buffer);if(this.program)g.deleteProgram(this.program);
  this.texture=null;this.buffer=null;this.program=null;
 }
}
