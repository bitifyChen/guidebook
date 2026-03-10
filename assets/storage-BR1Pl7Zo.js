import{k as a}from"./index-DqK6zhCN.js";/**
 * @license lucide-vue-next v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const n=a("LoaderCircleIcon",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]]);/**
 * @license lucide-vue-next v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=a("PencilIcon",[["path",{d:"M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z",key:"5qss01"}],["path",{d:"m15 5 4 4",key:"1mk7zo"}]]),p=async s=>{const t="b2c8f13582d4c8d1690d82734055d420",r=new FormData;r.append("image",s);try{const o=await(await fetch(`https://api.imgbb.com/1/upload?key=${t}`,{method:"POST",body:r})).json();if(o.success)return o.data.url;throw new Error(o.error.message||"上傳失敗")}catch(e){throw console.error("ImgBB Upload Error:",e),e}};export{n as L,d as P,p as u};
