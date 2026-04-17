import{c2 as s}from"./index-CWLehAVQ.js";/**
 * @license lucide-vue-next v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const n=s("LoaderCircleIcon",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]]),d=async a=>{const t="3b8a790244de3e1c68ed273c740152fe",o=new FormData;o.append("image",a);try{const r=await(await fetch(`https://api.imgbb.com/1/upload?key=${t}`,{method:"POST",body:o})).json();if(r.success)return r.data.url;throw new Error(r.error.message||"上傳失敗")}catch(e){throw console.error("ImgBB Upload Error:",e),e}};export{n as L,d as u};
