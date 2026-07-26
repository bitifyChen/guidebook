import{N as s}from"./index-B7UdY_IM.js";/**
 * @license lucide-vue-next v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c=s("UploadIcon",[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"17 8 12 3 7 8",key:"t8dd8p"}],["line",{x1:"12",x2:"12",y1:"3",y2:"15",key:"widbto"}]]),p=async r=>{const t="3b8a790244de3e1c68ed273c740152fe",a=new FormData;a.append("image",r);try{const o=await(await fetch(`https://api.imgbb.com/1/upload?key=${t}`,{method:"POST",body:a})).json();if(o.success)return o.data.url;throw new Error(o.error.message||"上傳失敗")}catch(e){throw console.error("ImgBB Upload Error:",e),e}};export{c as U,p as u};
