try{self["workbox:core:7.3.0"]&&_()}catch{}const Ot=(t,...e)=>{let n=t;return e.length>0&&(n+=` :: ${JSON.stringify(e)}`),n},Mt=Ot;class d extends Error{constructor(e,n){const s=Mt(e,n);super(s),this.name=e,this.details=n}}const m={googleAnalytics:"googleAnalytics",precache:"precache-v2",prefix:"workbox",runtime:"runtime",suffix:typeof registration<"u"?registration.scope:""},Y=t=>[m.prefix,t,m.suffix].filter(e=>e&&e.length>0).join("-"),xt=t=>{for(const e of Object.keys(m))t(e)},q={updateDetails:t=>{xt(e=>{typeof t[e]=="string"&&(m[e]=t[e])})},getGoogleAnalyticsName:t=>t||Y(m.googleAnalytics),getPrecacheName:t=>t||Y(m.precache),getPrefix:()=>m.prefix,getRuntimeName:t=>t||Y(m.runtime),getSuffix:()=>m.suffix};function De(t,e){const n=e();return t.waitUntil(n),n}try{self["workbox:precaching:7.3.0"]&&_()}catch{}const Pt="__WB_REVISION__";function Lt(t){if(!t)throw new d("add-to-cache-list-unexpected-type",{entry:t});if(typeof t=="string"){const i=new URL(t,location.href);return{cacheKey:i.href,url:i.href}}const{revision:e,url:n}=t;if(!n)throw new d("add-to-cache-list-unexpected-type",{entry:t});if(!e){const i=new URL(n,location.href);return{cacheKey:i.href,url:i.href}}const s=new URL(n,location.href),r=new URL(n,location.href);return s.searchParams.set(Pt,e),{cacheKey:s.href,url:r.href}}class Bt{constructor(){this.updatedURLs=[],this.notUpdatedURLs=[],this.handlerWillStart=async({request:e,state:n})=>{n&&(n.originalRequest=e)},this.cachedResponseWillBeUsed=async({event:e,state:n,cachedResponse:s})=>{if(e.type==="install"&&n&&n.originalRequest&&n.originalRequest instanceof Request){const r=n.originalRequest.url;s?this.notUpdatedURLs.push(r):this.updatedURLs.push(r)}return s}}}class Ut{constructor({precacheController:e}){this.cacheKeyWillBeUsed=async({request:n,params:s})=>{const r=(s==null?void 0:s.cacheKey)||this._precacheController.getCacheKeyForURL(n.url);return r?new Request(r,{headers:n.headers}):n},this._precacheController=e}}let O;function $t(){if(O===void 0){const t=new Response("");if("body"in t)try{new Response(t.body),O=!0}catch{O=!1}O=!1}return O}async function Ft(t,e){let n=null;if(t.url&&(n=new URL(t.url).origin),n!==self.location.origin)throw new d("cross-origin-copy-response",{origin:n});const s=t.clone(),i={headers:new Headers(s.headers),status:s.status,statusText:s.statusText},a=$t()?s.body:await s.blob();return new Response(a,i)}const Ht=t=>new URL(String(t),location.href).href.replace(new RegExp(`^${location.origin}`),"");function Ae(t,e){const n=new URL(t);for(const s of e)n.searchParams.delete(s);return n.href}async function jt(t,e,n,s){const r=Ae(e.url,n);if(e.url===r)return t.match(e,s);const i=Object.assign(Object.assign({},s),{ignoreSearch:!0}),a=await t.keys(e,i);for(const o of a){const l=Ae(o.url,n);if(r===l)return t.match(o,s)}}let Kt=class{constructor(){this.promise=new Promise((e,n)=>{this.resolve=e,this.reject=n})}};const Ve=new Set;async function Vt(){for(const t of Ve)await t()}function Wt(t){return new Promise(e=>setTimeout(e,t))}try{self["workbox:strategies:7.3.0"]&&_()}catch{}function $(t){return typeof t=="string"?new Request(t):t}class qt{constructor(e,n){this._cacheKeys={},Object.assign(this,n),this.event=n.event,this._strategy=e,this._handlerDeferred=new Kt,this._extendLifetimePromises=[],this._plugins=[...e.plugins],this._pluginStateMap=new Map;for(const s of this._plugins)this._pluginStateMap.set(s,{});this.event.waitUntil(this._handlerDeferred.promise)}async fetch(e){const{event:n}=this;let s=$(e);if(s.mode==="navigate"&&n instanceof FetchEvent&&n.preloadResponse){const a=await n.preloadResponse;if(a)return a}const r=this.hasCallback("fetchDidFail")?s.clone():null;try{for(const a of this.iterateCallbacks("requestWillFetch"))s=await a({request:s.clone(),event:n})}catch(a){if(a instanceof Error)throw new d("plugin-error-request-will-fetch",{thrownErrorMessage:a.message})}const i=s.clone();try{let a;a=await fetch(s,s.mode==="navigate"?void 0:this._strategy.fetchOptions);for(const o of this.iterateCallbacks("fetchDidSucceed"))a=await o({event:n,request:i,response:a});return a}catch(a){throw r&&await this.runCallbacks("fetchDidFail",{error:a,event:n,originalRequest:r.clone(),request:i.clone()}),a}}async fetchAndCachePut(e){const n=await this.fetch(e),s=n.clone();return this.waitUntil(this.cachePut(e,s)),n}async cacheMatch(e){const n=$(e);let s;const{cacheName:r,matchOptions:i}=this._strategy,a=await this.getCacheKey(n,"read"),o=Object.assign(Object.assign({},i),{cacheName:r});s=await caches.match(a,o);for(const l of this.iterateCallbacks("cachedResponseWillBeUsed"))s=await l({cacheName:r,matchOptions:i,cachedResponse:s,request:a,event:this.event})||void 0;return s}async cachePut(e,n){const s=$(e);await Wt(0);const r=await this.getCacheKey(s,"write");if(!n)throw new d("cache-put-with-no-response",{url:Ht(r.url)});const i=await this._ensureResponseSafeToCache(n);if(!i)return!1;const{cacheName:a,matchOptions:o}=this._strategy,l=await self.caches.open(a),c=this.hasCallback("cacheDidUpdate"),p=c?await jt(l,r.clone(),["__WB_REVISION__"],o):null;try{await l.put(r,c?i.clone():i)}catch(h){if(h instanceof Error)throw h.name==="QuotaExceededError"&&await Vt(),h}for(const h of this.iterateCallbacks("cacheDidUpdate"))await h({cacheName:a,oldResponse:p,newResponse:i.clone(),request:r,event:this.event});return!0}async getCacheKey(e,n){const s=`${e.url} | ${n}`;if(!this._cacheKeys[s]){let r=e;for(const i of this.iterateCallbacks("cacheKeyWillBeUsed"))r=$(await i({mode:n,request:r,event:this.event,params:this.params}));this._cacheKeys[s]=r}return this._cacheKeys[s]}hasCallback(e){for(const n of this._strategy.plugins)if(e in n)return!0;return!1}async runCallbacks(e,n){for(const s of this.iterateCallbacks(e))await s(n)}*iterateCallbacks(e){for(const n of this._strategy.plugins)if(typeof n[e]=="function"){const s=this._pluginStateMap.get(n);yield i=>{const a=Object.assign(Object.assign({},i),{state:s});return n[e](a)}}}waitUntil(e){return this._extendLifetimePromises.push(e),e}async doneWaiting(){for(;this._extendLifetimePromises.length;){const e=this._extendLifetimePromises.splice(0),s=(await Promise.allSettled(e)).find(r=>r.status==="rejected");if(s)throw s.reason}}destroy(){this._handlerDeferred.resolve(null)}async _ensureResponseSafeToCache(e){let n=e,s=!1;for(const r of this.iterateCallbacks("cacheWillUpdate"))if(n=await r({request:this.request,response:n,event:this.event})||void 0,s=!0,!n)break;return s||n&&n.status!==200&&(n=void 0),n}}class We{constructor(e={}){this.cacheName=q.getRuntimeName(e.cacheName),this.plugins=e.plugins||[],this.fetchOptions=e.fetchOptions,this.matchOptions=e.matchOptions}handle(e){const[n]=this.handleAll(e);return n}handleAll(e){e instanceof FetchEvent&&(e={event:e,request:e.request});const n=e.event,s=typeof e.request=="string"?new Request(e.request):e.request,r="params"in e?e.params:void 0,i=new qt(this,{event:n,request:s,params:r}),a=this._getResponse(i,s,n),o=this._awaitComplete(a,i,s,n);return[a,o]}async _getResponse(e,n,s){await e.runCallbacks("handlerWillStart",{event:s,request:n});let r;try{if(r=await this._handle(n,e),!r||r.type==="error")throw new d("no-response",{url:n.url})}catch(i){if(i instanceof Error){for(const a of e.iterateCallbacks("handlerDidError"))if(r=await a({error:i,event:s,request:n}),r)break}if(!r)throw i}for(const i of e.iterateCallbacks("handlerWillRespond"))r=await i({event:s,request:n,response:r});return r}async _awaitComplete(e,n,s,r){let i,a;try{i=await e}catch{}try{await n.runCallbacks("handlerDidRespond",{event:r,request:s,response:i}),await n.doneWaiting()}catch(o){o instanceof Error&&(a=o)}if(await n.runCallbacks("handlerDidComplete",{event:r,request:s,response:i,error:a}),n.destroy(),a)throw a}}class y extends We{constructor(e={}){e.cacheName=q.getPrecacheName(e.cacheName),super(e),this._fallbackToNetwork=e.fallbackToNetwork!==!1,this.plugins.push(y.copyRedirectedCacheableResponsesPlugin)}async _handle(e,n){const s=await n.cacheMatch(e);return s||(n.event&&n.event.type==="install"?await this._handleInstall(e,n):await this._handleFetch(e,n))}async _handleFetch(e,n){let s;const r=n.params||{};if(this._fallbackToNetwork){const i=r.integrity,a=e.integrity,o=!a||a===i;s=await n.fetch(new Request(e,{integrity:e.mode!=="no-cors"?a||i:void 0})),i&&o&&e.mode!=="no-cors"&&(this._useDefaultCacheabilityPluginIfNeeded(),await n.cachePut(e,s.clone()))}else throw new d("missing-precache-entry",{cacheName:this.cacheName,url:e.url});return s}async _handleInstall(e,n){this._useDefaultCacheabilityPluginIfNeeded();const s=await n.fetch(e);if(!await n.cachePut(e,s.clone()))throw new d("bad-precaching-response",{url:e.url,status:s.status});return s}_useDefaultCacheabilityPluginIfNeeded(){let e=null,n=0;for(const[s,r]of this.plugins.entries())r!==y.copyRedirectedCacheableResponsesPlugin&&(r===y.defaultPrecacheCacheabilityPlugin&&(e=s),r.cacheWillUpdate&&n++);n===0?this.plugins.push(y.defaultPrecacheCacheabilityPlugin):n>1&&e!==null&&this.plugins.splice(e,1)}}y.defaultPrecacheCacheabilityPlugin={async cacheWillUpdate({response:t}){return!t||t.status>=400?null:t}};y.copyRedirectedCacheableResponsesPlugin={async cacheWillUpdate({response:t}){return t.redirected?await Ft(t):t}};class zt{constructor({cacheName:e,plugins:n=[],fallbackToNetwork:s=!0}={}){this._urlsToCacheKeys=new Map,this._urlsToCacheModes=new Map,this._cacheKeysToIntegrities=new Map,this._strategy=new y({cacheName:q.getPrecacheName(e),plugins:[...n,new Ut({precacheController:this})],fallbackToNetwork:s}),this.install=this.install.bind(this),this.activate=this.activate.bind(this)}get strategy(){return this._strategy}precache(e){this.addToCacheList(e),this._installAndActiveListenersAdded||(self.addEventListener("install",this.install),self.addEventListener("activate",this.activate),this._installAndActiveListenersAdded=!0)}addToCacheList(e){const n=[];for(const s of e){typeof s=="string"?n.push(s):s&&s.revision===void 0&&n.push(s.url);const{cacheKey:r,url:i}=Lt(s),a=typeof s!="string"&&s.revision?"reload":"default";if(this._urlsToCacheKeys.has(i)&&this._urlsToCacheKeys.get(i)!==r)throw new d("add-to-cache-list-conflicting-entries",{firstEntry:this._urlsToCacheKeys.get(i),secondEntry:r});if(typeof s!="string"&&s.integrity){if(this._cacheKeysToIntegrities.has(r)&&this._cacheKeysToIntegrities.get(r)!==s.integrity)throw new d("add-to-cache-list-conflicting-integrities",{url:i});this._cacheKeysToIntegrities.set(r,s.integrity)}if(this._urlsToCacheKeys.set(i,r),this._urlsToCacheModes.set(i,a),n.length>0){const o=`Workbox is precaching URLs without revision info: ${n.join(", ")}
This is generally NOT safe. Learn more at https://bit.ly/wb-precache`;console.warn(o)}}}install(e){return De(e,async()=>{const n=new Bt;this.strategy.plugins.push(n);for(const[i,a]of this._urlsToCacheKeys){const o=this._cacheKeysToIntegrities.get(a),l=this._urlsToCacheModes.get(i),c=new Request(i,{integrity:o,cache:l,credentials:"same-origin"});await Promise.all(this.strategy.handleAll({params:{cacheKey:a},request:c,event:e}))}const{updatedURLs:s,notUpdatedURLs:r}=n;return{updatedURLs:s,notUpdatedURLs:r}})}activate(e){return De(e,async()=>{const n=await self.caches.open(this.strategy.cacheName),s=await n.keys(),r=new Set(this._urlsToCacheKeys.values()),i=[];for(const a of s)r.has(a.url)||(await n.delete(a),i.push(a.url));return{deletedURLs:i}})}getURLsToCacheKeys(){return this._urlsToCacheKeys}getCachedURLs(){return[...this._urlsToCacheKeys.keys()]}getCacheKeyForURL(e){const n=new URL(e,location.href);return this._urlsToCacheKeys.get(n.href)}getIntegrityForCacheKey(e){return this._cacheKeysToIntegrities.get(e)}async matchPrecache(e){const n=e instanceof Request?e.url:e,s=this.getCacheKeyForURL(n);if(s)return(await self.caches.open(this.strategy.cacheName)).match(s)}createHandlerBoundToURL(e){const n=this.getCacheKeyForURL(e);if(!n)throw new d("non-precached-url",{url:e});return s=>(s.request=new Request(e),s.params=Object.assign({cacheKey:n},s.params),this.strategy.handle(s))}}let Q;const qe=()=>(Q||(Q=new zt),Q);try{self["workbox:routing:7.3.0"]&&_()}catch{}const ze="GET",H=t=>t&&typeof t=="object"?t:{handle:t};class P{constructor(e,n,s=ze){this.handler=H(n),this.match=e,this.method=s}setCatchHandler(e){this.catchHandler=H(e)}}class Gt extends P{constructor(e,n,s){const r=({url:i})=>{const a=e.exec(i.href);if(a&&!(i.origin!==location.origin&&a.index!==0))return a.slice(1)};super(r,n,s)}}class Jt{constructor(){this._routes=new Map,this._defaultHandlerMap=new Map}get routes(){return this._routes}addFetchListener(){self.addEventListener("fetch",e=>{const{request:n}=e,s=this.handleRequest({request:n,event:e});s&&e.respondWith(s)})}addCacheListener(){self.addEventListener("message",e=>{if(e.data&&e.data.type==="CACHE_URLS"){const{payload:n}=e.data,s=Promise.all(n.urlsToCache.map(r=>{typeof r=="string"&&(r=[r]);const i=new Request(...r);return this.handleRequest({request:i,event:e})}));e.waitUntil(s),e.ports&&e.ports[0]&&s.then(()=>e.ports[0].postMessage(!0))}})}handleRequest({request:e,event:n}){const s=new URL(e.url,location.href);if(!s.protocol.startsWith("http"))return;const r=s.origin===location.origin,{params:i,route:a}=this.findMatchingRoute({event:n,request:e,sameOrigin:r,url:s});let o=a&&a.handler;const l=e.method;if(!o&&this._defaultHandlerMap.has(l)&&(o=this._defaultHandlerMap.get(l)),!o)return;let c;try{c=o.handle({url:s,request:e,event:n,params:i})}catch(h){c=Promise.reject(h)}const p=a&&a.catchHandler;return c instanceof Promise&&(this._catchHandler||p)&&(c=c.catch(async h=>{if(p)try{return await p.handle({url:s,request:e,event:n,params:i})}catch(I){I instanceof Error&&(h=I)}if(this._catchHandler)return this._catchHandler.handle({url:s,request:e,event:n});throw h})),c}findMatchingRoute({url:e,sameOrigin:n,request:s,event:r}){const i=this._routes.get(s.method)||[];for(const a of i){let o;const l=a.match({url:e,sameOrigin:n,request:s,event:r});if(l)return o=l,(Array.isArray(o)&&o.length===0||l.constructor===Object&&Object.keys(l).length===0||typeof l=="boolean")&&(o=void 0),{route:a,params:o}}return{}}setDefaultHandler(e,n=ze){this._defaultHandlerMap.set(n,H(e))}setCatchHandler(e){this._catchHandler=H(e)}registerRoute(e){this._routes.has(e.method)||this._routes.set(e.method,[]),this._routes.get(e.method).push(e)}unregisterRoute(e){if(!this._routes.has(e.method))throw new d("unregister-route-but-not-found-with-method",{method:e.method});const n=this._routes.get(e.method).indexOf(e);if(n>-1)this._routes.get(e.method).splice(n,1);else throw new d("unregister-route-route-not-registered")}}let M;const Yt=()=>(M||(M=new Jt,M.addFetchListener(),M.addCacheListener()),M);function Ge(t,e,n){let s;if(typeof t=="string"){const i=new URL(t,location.href),a=({url:o})=>o.href===i.href;s=new P(a,e,n)}else if(t instanceof RegExp)s=new Gt(t,e,n);else if(typeof t=="function")s=new P(t,e,n);else if(t instanceof P)s=t;else throw new d("unsupported-route-type",{moduleName:"workbox-routing",funcName:"registerRoute",paramName:"capture"});return Yt().registerRoute(s),s}function Qt(t,e=[]){for(const n of[...t.searchParams.keys()])e.some(s=>s.test(n))&&t.searchParams.delete(n);return t}function*Xt(t,{ignoreURLParametersMatching:e=[/^utm_/,/^fbclid$/],directoryIndex:n="index.html",cleanURLs:s=!0,urlManipulation:r}={}){const i=new URL(t,location.href);i.hash="",yield i.href;const a=Qt(i,e);if(yield a.href,n&&a.pathname.endsWith("/")){const o=new URL(a.href);o.pathname+=n,yield o.href}if(s){const o=new URL(a.href);o.pathname+=".html",yield o.href}if(r){const o=r({url:i});for(const l of o)yield l.href}}class Zt extends P{constructor(e,n){const s=({request:r})=>{const i=e.getURLsToCacheKeys();for(const a of Xt(r.url,n)){const o=i.get(a);if(o){const l=e.getIntegrityForCacheKey(o);return{cacheKey:o,integrity:l}}}};super(s,e.strategy)}}function en(t){const e=qe(),n=new Zt(e,t);Ge(n)}function tn(t){qe().precache(t)}function nn(t,e){tn(t),en(e)}class sn extends We{async _handle(e,n){let s=await n.cacheMatch(e),r;if(!s)try{s=await n.fetchAndCachePut(e)}catch(i){i instanceof Error&&(r=i)}if(!s)throw new d("no-response",{url:e.url,error:r});return s}}function Je(t){t.then(()=>{})}const rn=(t,e)=>e.some(n=>t instanceof n);let Re,ke;function an(){return Re||(Re=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function on(){return ke||(ke=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const Ye=new WeakMap,oe=new WeakMap,Qe=new WeakMap,X=new WeakMap,pe=new WeakMap;function cn(t){const e=new Promise((n,s)=>{const r=()=>{t.removeEventListener("success",i),t.removeEventListener("error",a)},i=()=>{n(b(t.result)),r()},a=()=>{s(t.error),r()};t.addEventListener("success",i),t.addEventListener("error",a)});return e.then(n=>{n instanceof IDBCursor&&Ye.set(n,t)}).catch(()=>{}),pe.set(e,t),e}function ln(t){if(oe.has(t))return;const e=new Promise((n,s)=>{const r=()=>{t.removeEventListener("complete",i),t.removeEventListener("error",a),t.removeEventListener("abort",a)},i=()=>{n(),r()},a=()=>{s(t.error||new DOMException("AbortError","AbortError")),r()};t.addEventListener("complete",i),t.addEventListener("error",a),t.addEventListener("abort",a)});oe.set(t,e)}let ce={get(t,e,n){if(t instanceof IDBTransaction){if(e==="done")return oe.get(t);if(e==="objectStoreNames")return t.objectStoreNames||Qe.get(t);if(e==="store")return n.objectStoreNames[1]?void 0:n.objectStore(n.objectStoreNames[0])}return b(t[e])},set(t,e,n){return t[e]=n,!0},has(t,e){return t instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in t}};function un(t){ce=t(ce)}function hn(t){return t===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(e,...n){const s=t.call(Z(this),e,...n);return Qe.set(s,e.sort?e.sort():[e]),b(s)}:on().includes(t)?function(...e){return t.apply(Z(this),e),b(Ye.get(this))}:function(...e){return b(t.apply(Z(this),e))}}function dn(t){return typeof t=="function"?hn(t):(t instanceof IDBTransaction&&ln(t),rn(t,an())?new Proxy(t,ce):t)}function b(t){if(t instanceof IDBRequest)return cn(t);if(X.has(t))return X.get(t);const e=dn(t);return e!==t&&(X.set(t,e),pe.set(e,t)),e}const Z=t=>pe.get(t);function B(t,e,{blocked:n,upgrade:s,blocking:r,terminated:i}={}){const a=indexedDB.open(t,e),o=b(a);return s&&a.addEventListener("upgradeneeded",l=>{s(b(a.result),l.oldVersion,l.newVersion,b(a.transaction),l)}),n&&a.addEventListener("blocked",l=>n(l.oldVersion,l.newVersion,l)),o.then(l=>{i&&l.addEventListener("close",()=>i()),r&&l.addEventListener("versionchange",c=>r(c.oldVersion,c.newVersion,c))}).catch(()=>{}),o}function F(t,{blocked:e}={}){const n=indexedDB.deleteDatabase(t);return e&&n.addEventListener("blocked",s=>e(s.oldVersion,s)),b(n).then(()=>{})}const fn=["get","getKey","getAll","getAllKeys","count"],pn=["put","add","delete","clear"],ee=new Map;function ve(t,e){if(!(t instanceof IDBDatabase&&!(e in t)&&typeof e=="string"))return;if(ee.get(e))return ee.get(e);const n=e.replace(/FromIndex$/,""),s=e!==n,r=pn.includes(n);if(!(n in(s?IDBIndex:IDBObjectStore).prototype)||!(r||fn.includes(n)))return;const i=async function(a,...o){const l=this.transaction(a,r?"readwrite":"readonly");let c=l.store;return s&&(c=c.index(o.shift())),(await Promise.all([c[n](...o),r&&l.done]))[0]};return ee.set(e,i),i}un(t=>({...t,get:(e,n,s)=>ve(e,n)||t.get(e,n,s),has:(e,n)=>!!ve(e,n)||t.has(e,n)}));try{self["workbox:expiration:7.3.0"]&&_()}catch{}const gn="workbox-expiration",x="cache-entries",Ne=t=>{const e=new URL(t,location.href);return e.hash="",e.href};class mn{constructor(e){this._db=null,this._cacheName=e}_upgradeDb(e){const n=e.createObjectStore(x,{keyPath:"id"});n.createIndex("cacheName","cacheName",{unique:!1}),n.createIndex("timestamp","timestamp",{unique:!1})}_upgradeDbAndDeleteOldDbs(e){this._upgradeDb(e),this._cacheName&&F(this._cacheName)}async setTimestamp(e,n){e=Ne(e);const s={url:e,timestamp:n,cacheName:this._cacheName,id:this._getId(e)},i=(await this.getDb()).transaction(x,"readwrite",{durability:"relaxed"});await i.store.put(s),await i.done}async getTimestamp(e){const s=await(await this.getDb()).get(x,this._getId(e));return s==null?void 0:s.timestamp}async expireEntries(e,n){const s=await this.getDb();let r=await s.transaction(x).store.index("timestamp").openCursor(null,"prev");const i=[];let a=0;for(;r;){const l=r.value;l.cacheName===this._cacheName&&(e&&l.timestamp<e||n&&a>=n?i.push(r.value):a++),r=await r.continue()}const o=[];for(const l of i)await s.delete(x,l.id),o.push(l.url);return o}_getId(e){return this._cacheName+"|"+Ne(e)}async getDb(){return this._db||(this._db=await B(gn,1,{upgrade:this._upgradeDbAndDeleteOldDbs.bind(this)})),this._db}}class bn{constructor(e,n={}){this._isRunning=!1,this._rerunRequested=!1,this._maxEntries=n.maxEntries,this._maxAgeSeconds=n.maxAgeSeconds,this._matchOptions=n.matchOptions,this._cacheName=e,this._timestampModel=new mn(e)}async expireEntries(){if(this._isRunning){this._rerunRequested=!0;return}this._isRunning=!0;const e=this._maxAgeSeconds?Date.now()-this._maxAgeSeconds*1e3:0,n=await this._timestampModel.expireEntries(e,this._maxEntries),s=await self.caches.open(this._cacheName);for(const r of n)await s.delete(r,this._matchOptions);this._isRunning=!1,this._rerunRequested&&(this._rerunRequested=!1,Je(this.expireEntries()))}async updateTimestamp(e){await this._timestampModel.setTimestamp(e,Date.now())}async isURLExpired(e){if(this._maxAgeSeconds){const n=await this._timestampModel.getTimestamp(e),s=Date.now()-this._maxAgeSeconds*1e3;return n!==void 0?n<s:!0}else return!1}async delete(){this._rerunRequested=!1,await this._timestampModel.expireEntries(1/0)}}function wn(t){Ve.add(t)}class yn{constructor(e={}){this.cachedResponseWillBeUsed=async({event:n,request:s,cacheName:r,cachedResponse:i})=>{if(!i)return null;const a=this._isResponseDateFresh(i),o=this._getCacheExpiration(r);Je(o.expireEntries());const l=o.updateTimestamp(s.url);if(n)try{n.waitUntil(l)}catch{}return a?i:null},this.cacheDidUpdate=async({cacheName:n,request:s})=>{const r=this._getCacheExpiration(n);await r.updateTimestamp(s.url),await r.expireEntries()},this._config=e,this._maxAgeSeconds=e.maxAgeSeconds,this._cacheExpirations=new Map,e.purgeOnQuotaError&&wn(()=>this.deleteCacheAndMetadata())}_getCacheExpiration(e){if(e===q.getRuntimeName())throw new d("expire-custom-caches-only");let n=this._cacheExpirations.get(e);return n||(n=new bn(e,this._config),this._cacheExpirations.set(e,n)),n}_isResponseDateFresh(e){if(!this._maxAgeSeconds)return!0;const n=this._getDateHeaderTimestamp(e);if(n===null)return!0;const s=Date.now();return n>=s-this._maxAgeSeconds*1e3}_getDateHeaderTimestamp(e){if(!e.headers.has("date"))return null;const n=e.headers.get("date"),r=new Date(n).getTime();return isNaN(r)?null:r}async deleteCacheAndMetadata(){for(const[e,n]of this._cacheExpirations)await self.caches.delete(e),await n.delete();this._cacheExpirations=new Map}}try{self["workbox:cacheable-response:7.3.0"]&&_()}catch{}class _n{constructor(e={}){this._statuses=e.statuses,this._headers=e.headers}isResponseCacheable(e){let n=!0;return this._statuses&&(n=this._statuses.includes(e.status)),this._headers&&n&&(n=Object.keys(this._headers).some(s=>e.headers.get(s)===this._headers[s])),n}}class En{constructor(e){this.cacheWillUpdate=async({response:n})=>this._cacheableResponse.isResponseCacheable(n)?n:null,this._cacheableResponse=new _n(e)}}function In(){self.addEventListener("activate",()=>self.clients.claim())}const Cn=()=>{};var Oe={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Xe=function(t){const e=[];let n=0;for(let s=0;s<t.length;s++){let r=t.charCodeAt(s);r<128?e[n++]=r:r<2048?(e[n++]=r>>6|192,e[n++]=r&63|128):(r&64512)===55296&&s+1<t.length&&(t.charCodeAt(s+1)&64512)===56320?(r=65536+((r&1023)<<10)+(t.charCodeAt(++s)&1023),e[n++]=r>>18|240,e[n++]=r>>12&63|128,e[n++]=r>>6&63|128,e[n++]=r&63|128):(e[n++]=r>>12|224,e[n++]=r>>6&63|128,e[n++]=r&63|128)}return e},Sn=function(t){const e=[];let n=0,s=0;for(;n<t.length;){const r=t[n++];if(r<128)e[s++]=String.fromCharCode(r);else if(r>191&&r<224){const i=t[n++];e[s++]=String.fromCharCode((r&31)<<6|i&63)}else if(r>239&&r<365){const i=t[n++],a=t[n++],o=t[n++],l=((r&7)<<18|(i&63)<<12|(a&63)<<6|o&63)-65536;e[s++]=String.fromCharCode(55296+(l>>10)),e[s++]=String.fromCharCode(56320+(l&1023))}else{const i=t[n++],a=t[n++];e[s++]=String.fromCharCode((r&15)<<12|(i&63)<<6|a&63)}}return e.join("")},Ze={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(t,e){if(!Array.isArray(t))throw Error("encodeByteArray takes an array as a parameter");this.init_();const n=e?this.byteToCharMapWebSafe_:this.byteToCharMap_,s=[];for(let r=0;r<t.length;r+=3){const i=t[r],a=r+1<t.length,o=a?t[r+1]:0,l=r+2<t.length,c=l?t[r+2]:0,p=i>>2,h=(i&3)<<4|o>>4;let I=(o&15)<<2|c>>6,U=c&63;l||(U=64,a||(I=64)),s.push(n[p],n[h],n[I],n[U])}return s.join("")},encodeString(t,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(t):this.encodeByteArray(Xe(t),e)},decodeString(t,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(t):Sn(this.decodeStringToByteArray(t,e))},decodeStringToByteArray(t,e){this.init_();const n=e?this.charToByteMapWebSafe_:this.charToByteMap_,s=[];for(let r=0;r<t.length;){const i=n[t.charAt(r++)],o=r<t.length?n[t.charAt(r)]:0;++r;const c=r<t.length?n[t.charAt(r)]:64;++r;const h=r<t.length?n[t.charAt(r)]:64;if(++r,i==null||o==null||c==null||h==null)throw new Tn;const I=i<<2|o>>4;if(s.push(I),c!==64){const U=o<<4&240|c>>2;if(s.push(U),h!==64){const Nt=c<<6&192|h;s.push(Nt)}}}return s},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let t=0;t<this.ENCODED_VALS.length;t++)this.byteToCharMap_[t]=this.ENCODED_VALS.charAt(t),this.charToByteMap_[this.byteToCharMap_[t]]=t,this.byteToCharMapWebSafe_[t]=this.ENCODED_VALS_WEBSAFE.charAt(t),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[t]]=t,t>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(t)]=t,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(t)]=t)}}};class Tn extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const Dn=function(t){const e=Xe(t);return Ze.encodeByteArray(e,!0)},et=function(t){return Dn(t).replace(/\./g,"")},An=function(t){try{return Ze.decodeString(t,!0)}catch(e){console.error("base64Decode failed: ",e)}return null};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Rn(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const kn=()=>Rn().__FIREBASE_DEFAULTS__,vn=()=>{if(typeof process>"u"||typeof Oe>"u")return;const t=Oe.__FIREBASE_DEFAULTS__;if(t)return JSON.parse(t)},Nn=()=>{if(typeof document>"u")return;let t;try{t=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const e=t&&An(t[1]);return e&&JSON.parse(e)},On=()=>{try{return Cn()||kn()||vn()||Nn()}catch(t){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${t}`);return}},tt=()=>{var t;return(t=On())==null?void 0:t.config};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Mn{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,n)=>{this.resolve=e,this.reject=n})}wrapCallback(e){return(n,s)=>{n?this.reject(n):this.resolve(s),typeof e=="function"&&(this.promise.catch(()=>{}),e.length===1?e(n):e(n,s))}}}function nt(){try{return typeof indexedDB=="object"}catch{return!1}}function st(){return new Promise((t,e)=>{try{let n=!0;const s="validate-browser-context-for-indexeddb-analytics-module",r=self.indexedDB.open(s);r.onsuccess=()=>{r.result.close(),n||self.indexedDB.deleteDatabase(s),t(!0)},r.onupgradeneeded=()=>{n=!1},r.onerror=()=>{var i;e(((i=r.error)==null?void 0:i.message)||"")}}catch(n){e(n)}})}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xn="FirebaseError";class N extends Error{constructor(e,n,s){super(n),this.code=e,this.customData=s,this.name=xn,Object.setPrototypeOf(this,N.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,z.prototype.create)}}class z{constructor(e,n,s){this.service=e,this.serviceName=n,this.errors=s}create(e,...n){const s=n[0]||{},r=`${this.service}/${e}`,i=this.errors[e],a=i?Pn(i,s):"Error",o=`${this.serviceName}: ${a} (${r}).`;return new N(r,o,s)}}function Pn(t,e){return t.replace(Ln,(n,s)=>{const r=e[s];return r!=null?String(r):`<${s}?>`})}const Ln=/\{\$([^}]+)}/g;function le(t,e){if(t===e)return!0;const n=Object.keys(t),s=Object.keys(e);for(const r of n){if(!s.includes(r))return!1;const i=t[r],a=e[r];if(Me(i)&&Me(a)){if(!le(i,a))return!1}else if(i!==a)return!1}for(const r of s)if(!n.includes(r))return!1;return!0}function Me(t){return t!==null&&typeof t=="object"}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function rt(t){return t&&t._delegate?t._delegate:t}class T{constructor(e,n,s){this.name=e,this.instanceFactory=n,this.type=s,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const C="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Bn{constructor(e,n){this.name=e,this.container=n,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){const n=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(n)){const s=new Mn;if(this.instancesDeferred.set(n,s),this.isInitialized(n)||this.shouldAutoInitialize())try{const r=this.getOrInitializeService({instanceIdentifier:n});r&&s.resolve(r)}catch{}}return this.instancesDeferred.get(n).promise}getImmediate(e){const n=this.normalizeInstanceIdentifier(e==null?void 0:e.identifier),s=(e==null?void 0:e.optional)??!1;if(this.isInitialized(n)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:n})}catch(r){if(s)return null;throw r}else{if(s)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,!!this.shouldAutoInitialize()){if($n(e))try{this.getOrInitializeService({instanceIdentifier:C})}catch{}for(const[n,s]of this.instancesDeferred.entries()){const r=this.normalizeInstanceIdentifier(n);try{const i=this.getOrInitializeService({instanceIdentifier:r});s.resolve(i)}catch{}}}}clearInstance(e=C){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){const e=Array.from(this.instances.values());await Promise.all([...e.filter(n=>"INTERNAL"in n).map(n=>n.INTERNAL.delete()),...e.filter(n=>"_delete"in n).map(n=>n._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=C){return this.instances.has(e)}getOptions(e=C){return this.instancesOptions.get(e)||{}}initialize(e={}){const{options:n={}}=e,s=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(s))throw Error(`${this.name}(${s}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const r=this.getOrInitializeService({instanceIdentifier:s,options:n});for(const[i,a]of this.instancesDeferred.entries()){const o=this.normalizeInstanceIdentifier(i);s===o&&a.resolve(r)}return r}onInit(e,n){const s=this.normalizeInstanceIdentifier(n),r=this.onInitCallbacks.get(s)??new Set;r.add(e),this.onInitCallbacks.set(s,r);const i=this.instances.get(s);return i&&e(i,s),()=>{r.delete(e)}}invokeOnInitCallbacks(e,n){const s=this.onInitCallbacks.get(n);if(s)for(const r of s)try{r(e,n)}catch{}}getOrInitializeService({instanceIdentifier:e,options:n={}}){let s=this.instances.get(e);if(!s&&this.component&&(s=this.component.instanceFactory(this.container,{instanceIdentifier:Un(e),options:n}),this.instances.set(e,s),this.instancesOptions.set(e,n),this.invokeOnInitCallbacks(s,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,s)}catch{}return s||null}normalizeInstanceIdentifier(e=C){return this.component?this.component.multipleInstances?e:C:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function Un(t){return t===C?void 0:t}function $n(t){return t.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Fn{constructor(e){this.name=e,this.providers=new Map}addComponent(e){const n=this.getProvider(e.name);if(n.isComponentSet())throw new Error(`Component ${e.name} has already been registered with ${this.name}`);n.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);const n=new Bn(e,this);return this.providers.set(e,n),n}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var u;(function(t){t[t.DEBUG=0]="DEBUG",t[t.VERBOSE=1]="VERBOSE",t[t.INFO=2]="INFO",t[t.WARN=3]="WARN",t[t.ERROR=4]="ERROR",t[t.SILENT=5]="SILENT"})(u||(u={}));const Hn={debug:u.DEBUG,verbose:u.VERBOSE,info:u.INFO,warn:u.WARN,error:u.ERROR,silent:u.SILENT},jn=u.INFO,Kn={[u.DEBUG]:"log",[u.VERBOSE]:"log",[u.INFO]:"info",[u.WARN]:"warn",[u.ERROR]:"error"},Vn=(t,e,...n)=>{if(e<t.logLevel)return;const s=new Date().toISOString(),r=Kn[e];if(r)console[r](`[${s}]  ${t.name}:`,...n);else throw new Error(`Attempted to log a message with an invalid logType (value: ${e})`)};class Wn{constructor(e){this.name=e,this._logLevel=jn,this._logHandler=Vn,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in u))throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e=="string"?Hn[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,u.DEBUG,...e),this._logHandler(this,u.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,u.VERBOSE,...e),this._logHandler(this,u.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,u.INFO,...e),this._logHandler(this,u.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,u.WARN,...e),this._logHandler(this,u.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,u.ERROR,...e),this._logHandler(this,u.ERROR,...e)}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qn{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(n=>{if(zn(n)){const s=n.getImmediate();return`${s.library}/${s.version}`}else return null}).filter(n=>n).join(" ")}}function zn(t){const e=t.getComponent();return(e==null?void 0:e.type)==="VERSION"}const ue="@firebase/app",xe="0.14.8";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const w=new Wn("@firebase/app"),Gn="@firebase/app-compat",Jn="@firebase/analytics-compat",Yn="@firebase/analytics",Qn="@firebase/app-check-compat",Xn="@firebase/app-check",Zn="@firebase/auth",es="@firebase/auth-compat",ts="@firebase/database",ns="@firebase/data-connect",ss="@firebase/database-compat",rs="@firebase/functions",is="@firebase/functions-compat",as="@firebase/installations",os="@firebase/installations-compat",cs="@firebase/messaging",ls="@firebase/messaging-compat",us="@firebase/performance",hs="@firebase/performance-compat",ds="@firebase/remote-config",fs="@firebase/remote-config-compat",ps="@firebase/storage",gs="@firebase/storage-compat",ms="@firebase/firestore",bs="@firebase/ai",ws="@firebase/firestore-compat",ys="firebase";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const he="[DEFAULT]",_s={[ue]:"fire-core",[Gn]:"fire-core-compat",[Yn]:"fire-analytics",[Jn]:"fire-analytics-compat",[Xn]:"fire-app-check",[Qn]:"fire-app-check-compat",[Zn]:"fire-auth",[es]:"fire-auth-compat",[ts]:"fire-rtdb",[ns]:"fire-data-connect",[ss]:"fire-rtdb-compat",[rs]:"fire-fn",[is]:"fire-fn-compat",[as]:"fire-iid",[os]:"fire-iid-compat",[cs]:"fire-fcm",[ls]:"fire-fcm-compat",[us]:"fire-perf",[hs]:"fire-perf-compat",[ds]:"fire-rc",[fs]:"fire-rc-compat",[ps]:"fire-gcs",[gs]:"fire-gcs-compat",[ms]:"fire-fst",[ws]:"fire-fst-compat",[bs]:"fire-vertex","fire-js":"fire-js",[ys]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const j=new Map,Es=new Map,de=new Map;function Pe(t,e){try{t.container.addComponent(e)}catch(n){w.debug(`Component ${e.name} failed to register with FirebaseApp ${t.name}`,n)}}function v(t){const e=t.name;if(de.has(e))return w.debug(`There were multiple attempts to register component ${e}.`),!1;de.set(e,t);for(const n of j.values())Pe(n,t);for(const n of Es.values())Pe(n,t);return!0}function ge(t,e){const n=t.container.getProvider("heartbeat").getImmediate({optional:!0});return n&&n.triggerHeartbeat(),t.container.getProvider(e)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Is={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},E=new z("app","Firebase",Is);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Cs{constructor(e,n,s){this._isDeleted=!1,this._options={...e},this._config={...n},this._name=n.name,this._automaticDataCollectionEnabled=n.automaticDataCollectionEnabled,this._container=s,this.container.addComponent(new T("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw E.create("app-deleted",{appName:this._name})}}function it(t,e={}){let n=t;typeof e!="object"&&(e={name:e});const s={name:he,automaticDataCollectionEnabled:!0,...e},r=s.name;if(typeof r!="string"||!r)throw E.create("bad-app-name",{appName:String(r)});if(n||(n=tt()),!n)throw E.create("no-options");const i=j.get(r);if(i){if(le(n,i.options)&&le(s,i.config))return i;throw E.create("duplicate-app",{appName:r})}const a=new Fn(r);for(const l of de.values())a.addComponent(l);const o=new Cs(n,s,a);return j.set(r,o),o}function Ss(t=he){const e=j.get(t);if(!e&&t===he&&tt())return it();if(!e)throw E.create("no-app",{appName:t});return e}function k(t,e,n){let s=_s[t]??t;n&&(s+=`-${n}`);const r=s.match(/\s|\//),i=e.match(/\s|\//);if(r||i){const a=[`Unable to register library "${s}" with version "${e}":`];r&&a.push(`library name "${s}" contains illegal characters (whitespace or "/")`),r&&i&&a.push("and"),i&&a.push(`version name "${e}" contains illegal characters (whitespace or "/")`),w.warn(a.join(" "));return}v(new T(`${s}-version`,()=>({library:s,version:e}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ts="firebase-heartbeat-database",Ds=1,L="firebase-heartbeat-store";let te=null;function at(){return te||(te=B(Ts,Ds,{upgrade:(t,e)=>{switch(e){case 0:try{t.createObjectStore(L)}catch(n){console.warn(n)}}}}).catch(t=>{throw E.create("idb-open",{originalErrorMessage:t.message})})),te}async function As(t){try{const n=(await at()).transaction(L),s=await n.objectStore(L).get(ot(t));return await n.done,s}catch(e){if(e instanceof N)w.warn(e.message);else{const n=E.create("idb-get",{originalErrorMessage:e==null?void 0:e.message});w.warn(n.message)}}}async function Le(t,e){try{const s=(await at()).transaction(L,"readwrite");await s.objectStore(L).put(e,ot(t)),await s.done}catch(n){if(n instanceof N)w.warn(n.message);else{const s=E.create("idb-set",{originalErrorMessage:n==null?void 0:n.message});w.warn(s.message)}}}function ot(t){return`${t.name}!${t.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Rs=1024,ks=30;class vs{constructor(e){this.container=e,this._heartbeatsCache=null;const n=this.container.getProvider("app").getImmediate();this._storage=new Os(n),this._heartbeatsCachePromise=this._storage.read().then(s=>(this._heartbeatsCache=s,s))}async triggerHeartbeat(){var e,n;try{const r=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),i=Be();if(((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((n=this._heartbeatsCache)==null?void 0:n.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===i||this._heartbeatsCache.heartbeats.some(a=>a.date===i))return;if(this._heartbeatsCache.heartbeats.push({date:i,agent:r}),this._heartbeatsCache.heartbeats.length>ks){const a=Ms(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(a,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(s){w.warn(s)}}async getHeartbeatsHeader(){var e;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const n=Be(),{heartbeatsToSend:s,unsentEntries:r}=Ns(this._heartbeatsCache.heartbeats),i=et(JSON.stringify({version:2,heartbeats:s}));return this._heartbeatsCache.lastSentHeartbeatDate=n,r.length>0?(this._heartbeatsCache.heartbeats=r,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),i}catch(n){return w.warn(n),""}}}function Be(){return new Date().toISOString().substring(0,10)}function Ns(t,e=Rs){const n=[];let s=t.slice();for(const r of t){const i=n.find(a=>a.agent===r.agent);if(i){if(i.dates.push(r.date),Ue(n)>e){i.dates.pop();break}}else if(n.push({agent:r.agent,dates:[r.date]}),Ue(n)>e){n.pop();break}s=s.slice(1)}return{heartbeatsToSend:n,unsentEntries:s}}class Os{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return nt()?st().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const n=await As(this.app);return n!=null&&n.heartbeats?n:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){if(await this._canUseIndexedDBPromise){const s=await this.read();return Le(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??s.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){if(await this._canUseIndexedDBPromise){const s=await this.read();return Le(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??s.lastSentHeartbeatDate,heartbeats:[...s.heartbeats,...e.heartbeats]})}else return}}function Ue(t){return et(JSON.stringify({version:2,heartbeats:t})).length}function Ms(t){if(t.length===0)return-1;let e=0,n=t[0].date;for(let s=1;s<t.length;s++)t[s].date<n&&(n=t[s].date,e=s);return e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function xs(t){v(new T("platform-logger",e=>new qn(e),"PRIVATE")),v(new T("heartbeat",e=>new vs(e),"PRIVATE")),k(ue,xe,t),k(ue,xe,"esm2020"),k("fire-js","")}xs("");var Ps="firebase",Ls="12.9.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */k(Ps,Ls,"app");const ct="@firebase/installations",me="0.6.19";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const lt=1e4,ut=`w:${me}`,ht="FIS_v2",Bs="https://firebaseinstallations.googleapis.com/v1",Us=60*60*1e3,$s="installations",Fs="Installations";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Hs={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},D=new z($s,Fs,Hs);function dt(t){return t instanceof N&&t.code.includes("request-failed")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ft({projectId:t}){return`${Bs}/projects/${t}/installations`}function pt(t){return{token:t.token,requestStatus:2,expiresIn:Ks(t.expiresIn),creationTime:Date.now()}}async function gt(t,e){const s=(await e.json()).error;return D.create("request-failed",{requestName:t,serverCode:s.code,serverMessage:s.message,serverStatus:s.status})}function mt({apiKey:t}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":t})}function js(t,{refreshToken:e}){const n=mt(t);return n.append("Authorization",Vs(e)),n}async function bt(t){const e=await t();return e.status>=500&&e.status<600?t():e}function Ks(t){return Number(t.replace("s","000"))}function Vs(t){return`${ht} ${t}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Ws({appConfig:t,heartbeatServiceProvider:e},{fid:n}){const s=ft(t),r=mt(t),i=e.getImmediate({optional:!0});if(i){const c=await i.getHeartbeatsHeader();c&&r.append("x-firebase-client",c)}const a={fid:n,authVersion:ht,appId:t.appId,sdkVersion:ut},o={method:"POST",headers:r,body:JSON.stringify(a)},l=await bt(()=>fetch(s,o));if(l.ok){const c=await l.json();return{fid:c.fid||n,registrationStatus:2,refreshToken:c.refreshToken,authToken:pt(c.authToken)}}else throw await gt("Create Installation",l)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function wt(t){return new Promise(e=>{setTimeout(e,t)})}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function qs(t){return btoa(String.fromCharCode(...t)).replace(/\+/g,"-").replace(/\//g,"_")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const zs=/^[cdef][\w-]{21}$/,fe="";function Gs(){try{const t=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(t),t[0]=112+t[0]%16;const n=Js(t);return zs.test(n)?n:fe}catch{return fe}}function Js(t){return qs(t).substr(0,22)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function G(t){return`${t.appName}!${t.appId}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yt=new Map;function _t(t,e){const n=G(t);Et(n,e),Ys(n,e)}function Et(t,e){const n=yt.get(t);if(n)for(const s of n)s(e)}function Ys(t,e){const n=Qs();n&&n.postMessage({key:t,fid:e}),Xs()}let S=null;function Qs(){return!S&&"BroadcastChannel"in self&&(S=new BroadcastChannel("[Firebase] FID Change"),S.onmessage=t=>{Et(t.data.key,t.data.fid)}),S}function Xs(){yt.size===0&&S&&(S.close(),S=null)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Zs="firebase-installations-database",er=1,A="firebase-installations-store";let ne=null;function be(){return ne||(ne=B(Zs,er,{upgrade:(t,e)=>{switch(e){case 0:t.createObjectStore(A)}}})),ne}async function K(t,e){const n=G(t),r=(await be()).transaction(A,"readwrite"),i=r.objectStore(A),a=await i.get(n);return await i.put(e,n),await r.done,(!a||a.fid!==e.fid)&&_t(t,e.fid),e}async function It(t){const e=G(t),s=(await be()).transaction(A,"readwrite");await s.objectStore(A).delete(e),await s.done}async function J(t,e){const n=G(t),r=(await be()).transaction(A,"readwrite"),i=r.objectStore(A),a=await i.get(n),o=e(a);return o===void 0?await i.delete(n):await i.put(o,n),await r.done,o&&(!a||a.fid!==o.fid)&&_t(t,o.fid),o}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function we(t){let e;const n=await J(t.appConfig,s=>{const r=tr(s),i=nr(t,r);return e=i.registrationPromise,i.installationEntry});return n.fid===fe?{installationEntry:await e}:{installationEntry:n,registrationPromise:e}}function tr(t){const e=t||{fid:Gs(),registrationStatus:0};return Ct(e)}function nr(t,e){if(e.registrationStatus===0){if(!navigator.onLine){const r=Promise.reject(D.create("app-offline"));return{installationEntry:e,registrationPromise:r}}const n={fid:e.fid,registrationStatus:1,registrationTime:Date.now()},s=sr(t,n);return{installationEntry:n,registrationPromise:s}}else return e.registrationStatus===1?{installationEntry:e,registrationPromise:rr(t)}:{installationEntry:e}}async function sr(t,e){try{const n=await Ws(t,e);return K(t.appConfig,n)}catch(n){throw dt(n)&&n.customData.serverCode===409?await It(t.appConfig):await K(t.appConfig,{fid:e.fid,registrationStatus:0}),n}}async function rr(t){let e=await $e(t.appConfig);for(;e.registrationStatus===1;)await wt(100),e=await $e(t.appConfig);if(e.registrationStatus===0){const{installationEntry:n,registrationPromise:s}=await we(t);return s||n}return e}function $e(t){return J(t,e=>{if(!e)throw D.create("installation-not-found");return Ct(e)})}function Ct(t){return ir(t)?{fid:t.fid,registrationStatus:0}:t}function ir(t){return t.registrationStatus===1&&t.registrationTime+lt<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ar({appConfig:t,heartbeatServiceProvider:e},n){const s=or(t,n),r=js(t,n),i=e.getImmediate({optional:!0});if(i){const c=await i.getHeartbeatsHeader();c&&r.append("x-firebase-client",c)}const a={installation:{sdkVersion:ut,appId:t.appId}},o={method:"POST",headers:r,body:JSON.stringify(a)},l=await bt(()=>fetch(s,o));if(l.ok){const c=await l.json();return pt(c)}else throw await gt("Generate Auth Token",l)}function or(t,{fid:e}){return`${ft(t)}/${e}/authTokens:generate`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ye(t,e=!1){let n;const s=await J(t.appConfig,i=>{if(!St(i))throw D.create("not-registered");const a=i.authToken;if(!e&&ur(a))return i;if(a.requestStatus===1)return n=cr(t,e),i;{if(!navigator.onLine)throw D.create("app-offline");const o=dr(i);return n=lr(t,o),o}});return n?await n:s.authToken}async function cr(t,e){let n=await Fe(t.appConfig);for(;n.authToken.requestStatus===1;)await wt(100),n=await Fe(t.appConfig);const s=n.authToken;return s.requestStatus===0?ye(t,e):s}function Fe(t){return J(t,e=>{if(!St(e))throw D.create("not-registered");const n=e.authToken;return fr(n)?{...e,authToken:{requestStatus:0}}:e})}async function lr(t,e){try{const n=await ar(t,e),s={...e,authToken:n};return await K(t.appConfig,s),n}catch(n){if(dt(n)&&(n.customData.serverCode===401||n.customData.serverCode===404))await It(t.appConfig);else{const s={...e,authToken:{requestStatus:0}};await K(t.appConfig,s)}throw n}}function St(t){return t!==void 0&&t.registrationStatus===2}function ur(t){return t.requestStatus===2&&!hr(t)}function hr(t){const e=Date.now();return e<t.creationTime||t.creationTime+t.expiresIn<e+Us}function dr(t){const e={requestStatus:1,requestTime:Date.now()};return{...t,authToken:e}}function fr(t){return t.requestStatus===1&&t.requestTime+lt<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function pr(t){const e=t,{installationEntry:n,registrationPromise:s}=await we(e);return s?s.catch(console.error):ye(e).catch(console.error),n.fid}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function gr(t,e=!1){const n=t;return await mr(n),(await ye(n,e)).token}async function mr(t){const{registrationPromise:e}=await we(t);e&&await e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function br(t){if(!t||!t.options)throw se("App Configuration");if(!t.name)throw se("App Name");const e=["projectId","apiKey","appId"];for(const n of e)if(!t.options[n])throw se(n);return{appName:t.name,projectId:t.options.projectId,apiKey:t.options.apiKey,appId:t.options.appId}}function se(t){return D.create("missing-app-config-values",{valueName:t})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Tt="installations",wr="installations-internal",yr=t=>{const e=t.getProvider("app").getImmediate(),n=br(e),s=ge(e,"heartbeat");return{app:e,appConfig:n,heartbeatServiceProvider:s,_delete:()=>Promise.resolve()}},_r=t=>{const e=t.getProvider("app").getImmediate(),n=ge(e,Tt).getImmediate();return{getId:()=>pr(n),getToken:r=>gr(n,r)}};function Er(){v(new T(Tt,yr,"PUBLIC")),v(new T(wr,_r,"PRIVATE"))}Er();k(ct,me);k(ct,me,"esm2020");/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Dt="BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4",Ir="https://fcmregistrations.googleapis.com/v1",At="FCM_MSG",Cr="google.c.a.c_id",Sr=3,Tr=1;var V;(function(t){t[t.DATA_MESSAGE=1]="DATA_MESSAGE",t[t.DISPLAY_NOTIFICATION=3]="DISPLAY_NOTIFICATION"})(V||(V={}));/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */var W;(function(t){t.PUSH_RECEIVED="push-received",t.NOTIFICATION_CLICKED="notification-clicked"})(W||(W={}));/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function g(t){const e=new Uint8Array(t);return btoa(String.fromCharCode(...e)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}function Dr(t){const e="=".repeat((4-t.length%4)%4),n=(t+e).replace(/\-/g,"+").replace(/_/g,"/"),s=atob(n),r=new Uint8Array(s.length);for(let i=0;i<s.length;++i)r[i]=s.charCodeAt(i);return r}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const re="fcm_token_details_db",Ar=5,He="fcm_token_object_Store";async function Rr(t){if("databases"in indexedDB&&!(await indexedDB.databases()).map(i=>i.name).includes(re))return null;let e=null;return(await B(re,Ar,{upgrade:async(s,r,i,a)=>{if(r<2||!s.objectStoreNames.contains(He))return;const o=a.objectStore(He),l=await o.index("fcmSenderId").get(t);if(await o.clear(),!!l){if(r===2){const c=l;if(!c.auth||!c.p256dh||!c.endpoint)return;e={token:c.fcmToken,createTime:c.createTime??Date.now(),subscriptionOptions:{auth:c.auth,p256dh:c.p256dh,endpoint:c.endpoint,swScope:c.swScope,vapidKey:typeof c.vapidKey=="string"?c.vapidKey:g(c.vapidKey)}}}else if(r===3){const c=l;e={token:c.fcmToken,createTime:c.createTime,subscriptionOptions:{auth:g(c.auth),p256dh:g(c.p256dh),endpoint:c.endpoint,swScope:c.swScope,vapidKey:g(c.vapidKey)}}}else if(r===4){const c=l;e={token:c.fcmToken,createTime:c.createTime,subscriptionOptions:{auth:g(c.auth),p256dh:g(c.p256dh),endpoint:c.endpoint,swScope:c.swScope,vapidKey:g(c.vapidKey)}}}}}})).close(),await F(re),await F("fcm_vapid_details_db"),await F("undefined"),kr(e)?e:null}function kr(t){if(!t||!t.subscriptionOptions)return!1;const{subscriptionOptions:e}=t;return typeof t.createTime=="number"&&t.createTime>0&&typeof t.token=="string"&&t.token.length>0&&typeof e.auth=="string"&&e.auth.length>0&&typeof e.p256dh=="string"&&e.p256dh.length>0&&typeof e.endpoint=="string"&&e.endpoint.length>0&&typeof e.swScope=="string"&&e.swScope.length>0&&typeof e.vapidKey=="string"&&e.vapidKey.length>0}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const vr="firebase-messaging-database",Nr=1,R="firebase-messaging-store";let ie=null;function _e(){return ie||(ie=B(vr,Nr,{upgrade:(t,e)=>{switch(e){case 0:t.createObjectStore(R)}}})),ie}async function Ee(t){const e=Ce(t),s=await(await _e()).transaction(R).objectStore(R).get(e);if(s)return s;{const r=await Rr(t.appConfig.senderId);if(r)return await Ie(t,r),r}}async function Ie(t,e){const n=Ce(t),r=(await _e()).transaction(R,"readwrite");return await r.objectStore(R).put(e,n),await r.done,e}async function Or(t){const e=Ce(t),s=(await _e()).transaction(R,"readwrite");await s.objectStore(R).delete(e),await s.done}function Ce({appConfig:t}){return t.appId}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Mr={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"only-available-in-window":"This method is available in a Window context.","only-available-in-sw":"This method is available in a service worker context.","permission-default":"The notification permission was not granted and dismissed instead.","permission-blocked":"The notification permission was not granted and blocked instead.","unsupported-browser":"This browser doesn't support the API's required to use the Firebase SDK.","indexed-db-unsupported":"This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)","failed-service-worker-registration":"We are unable to register the default service worker. {$browserErrorMessage}","token-subscribe-failed":"A problem occurred while subscribing the user to FCM: {$errorInfo}","token-subscribe-no-token":"FCM returned no token when subscribing the user to push.","token-unsubscribe-failed":"A problem occurred while unsubscribing the user from FCM: {$errorInfo}","token-update-failed":"A problem occurred while updating the user from FCM: {$errorInfo}","token-update-no-token":"FCM returned no token when updating the user to push.","use-sw-after-get-token":"The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.","invalid-sw-registration":"The input to useServiceWorker() must be a ServiceWorkerRegistration.","invalid-bg-handler":"The input to setBackgroundMessageHandler() must be a function.","invalid-vapid-key":"The public VAPID key must be a string.","use-vapid-key-after-get-token":"The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used."},f=new z("messaging","Messaging",Mr);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function xr(t,e){const n=await Te(t),s=kt(e),r={method:"POST",headers:n,body:JSON.stringify(s)};let i;try{i=await(await fetch(Se(t.appConfig),r)).json()}catch(a){throw f.create("token-subscribe-failed",{errorInfo:a==null?void 0:a.toString()})}if(i.error){const a=i.error.message;throw f.create("token-subscribe-failed",{errorInfo:a})}if(!i.token)throw f.create("token-subscribe-no-token");return i.token}async function Pr(t,e){const n=await Te(t),s=kt(e.subscriptionOptions),r={method:"PATCH",headers:n,body:JSON.stringify(s)};let i;try{i=await(await fetch(`${Se(t.appConfig)}/${e.token}`,r)).json()}catch(a){throw f.create("token-update-failed",{errorInfo:a==null?void 0:a.toString()})}if(i.error){const a=i.error.message;throw f.create("token-update-failed",{errorInfo:a})}if(!i.token)throw f.create("token-update-no-token");return i.token}async function Rt(t,e){const s={method:"DELETE",headers:await Te(t)};try{const i=await(await fetch(`${Se(t.appConfig)}/${e}`,s)).json();if(i.error){const a=i.error.message;throw f.create("token-unsubscribe-failed",{errorInfo:a})}}catch(r){throw f.create("token-unsubscribe-failed",{errorInfo:r==null?void 0:r.toString()})}}function Se({projectId:t}){return`${Ir}/projects/${t}/registrations`}async function Te({appConfig:t,installations:e}){const n=await e.getToken();return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":t.apiKey,"x-goog-firebase-installations-auth":`FIS ${n}`})}function kt({p256dh:t,auth:e,endpoint:n,vapidKey:s}){const r={web:{endpoint:n,auth:e,p256dh:t}};return s!==Dt&&(r.web.applicationPubKey=s),r}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Lr=7*24*60*60*1e3;async function Br(t){const e=await $r(t.swRegistration,t.vapidKey),n={vapidKey:t.vapidKey,swScope:t.swRegistration.scope,endpoint:e.endpoint,auth:g(e.getKey("auth")),p256dh:g(e.getKey("p256dh"))},s=await Ee(t.firebaseDependencies);if(s){if(Fr(s.subscriptionOptions,n))return Date.now()>=s.createTime+Lr?Ur(t,{token:s.token,createTime:Date.now(),subscriptionOptions:n}):s.token;try{await Rt(t.firebaseDependencies,s.token)}catch(r){console.warn(r)}return Ke(t.firebaseDependencies,n)}else return Ke(t.firebaseDependencies,n)}async function je(t){const e=await Ee(t.firebaseDependencies);e&&(await Rt(t.firebaseDependencies,e.token),await Or(t.firebaseDependencies));const n=await t.swRegistration.pushManager.getSubscription();return n?n.unsubscribe():!0}async function Ur(t,e){try{const n=await Pr(t.firebaseDependencies,e),s={...e,token:n,createTime:Date.now()};return await Ie(t.firebaseDependencies,s),n}catch(n){throw n}}async function Ke(t,e){const s={token:await xr(t,e),createTime:Date.now(),subscriptionOptions:e};return await Ie(t,s),s.token}async function $r(t,e){const n=await t.pushManager.getSubscription();return n||t.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:Dr(e)})}function Fr(t,e){const n=e.vapidKey===t.vapidKey,s=e.endpoint===t.endpoint,r=e.auth===t.auth,i=e.p256dh===t.p256dh;return n&&s&&r&&i}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Hr(t){const e={from:t.from,collapseKey:t.collapse_key,messageId:t.fcmMessageId};return jr(e,t),Kr(e,t),Vr(e,t),e}function jr(t,e){if(!e.notification)return;t.notification={};const n=e.notification.title;n&&(t.notification.title=n);const s=e.notification.body;s&&(t.notification.body=s);const r=e.notification.image;r&&(t.notification.image=r);const i=e.notification.icon;i&&(t.notification.icon=i)}function Kr(t,e){e.data&&(t.data=e.data)}function Vr(t,e){var r,i,a,o;if(!e.fcmOptions&&!((r=e.notification)!=null&&r.click_action))return;t.fcmOptions={};const n=((i=e.fcmOptions)==null?void 0:i.link)??((a=e.notification)==null?void 0:a.click_action);n&&(t.fcmOptions.link=n);const s=(o=e.fcmOptions)==null?void 0:o.analytics_label;s&&(t.fcmOptions.analyticsLabel=s)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Wr(t){return typeof t=="object"&&!!t&&Cr in t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function qr(t){return new Promise(e=>{setTimeout(e,t)})}async function zr(t,e){const n=Gr(e,await t.firebaseDependencies.installations.getId());Jr(t,n,e.productId)}function Gr(t,e){var s,r;const n={};return t.from&&(n.project_number=t.from),t.fcmMessageId&&(n.message_id=t.fcmMessageId),n.instance_id=e,t.notification?n.message_type=V.DISPLAY_NOTIFICATION.toString():n.message_type=V.DATA_MESSAGE.toString(),n.sdk_platform=Sr.toString(),n.package_name=self.origin.replace(/(^\w+:|^)\/\//,""),t.collapse_key&&(n.collapse_key=t.collapse_key),n.event=Tr.toString(),(s=t.fcmOptions)!=null&&s.analytics_label&&(n.analytics_label=(r=t.fcmOptions)==null?void 0:r.analytics_label),n}function Jr(t,e,n){const s={};s.event_time_ms=Math.floor(Date.now()).toString(),s.source_extension_json_proto3=JSON.stringify({messaging_client_event:e}),n&&(s.compliance_data=Yr(n)),t.logEvents.push(s)}function Yr(t){return{privacy_context:{prequest:{origin_associated_product_id:t}}}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Qr(t,e){var r;const{newSubscription:n}=t;if(!n){await je(e);return}const s=await Ee(e.firebaseDependencies);await je(e),e.vapidKey=((r=s==null?void 0:s.subscriptionOptions)==null?void 0:r.vapidKey)??Dt,await Br(e)}async function Xr(t,e){const n=ti(t);if(!n)return;e.deliveryMetricsExportedToBigQueryEnabled&&await zr(e,n);const s=await vt();if(si(s))return ri(s,n);if(n.notification&&await ii(ei(n)),!!e&&e.onBackgroundMessageHandler){const r=Hr(n);typeof e.onBackgroundMessageHandler=="function"?await e.onBackgroundMessageHandler(r):e.onBackgroundMessageHandler.next(r)}}async function Zr(t){var a,o;const e=(o=(a=t.notification)==null?void 0:a.data)==null?void 0:o[At];if(e){if(t.action)return}else return;t.stopImmediatePropagation(),t.notification.close();const n=ai(e);if(!n)return;const s=new URL(n,self.location.href),r=new URL(self.location.origin);if(s.host!==r.host)return;let i=await ni(s);if(i?i=await i.focus():(i=await self.clients.openWindow(n),await qr(3e3)),!!i)return e.messageType=W.NOTIFICATION_CLICKED,e.isFirebaseMessaging=!0,i.postMessage(e)}function ei(t){const e={...t.notification};return e.data={[At]:t},e}function ti({data:t}){if(!t)return null;try{return t.json()}catch{return null}}async function ni(t){const e=await vt();for(const n of e){const s=new URL(n.url,self.location.href);if(t.host===s.host)return n}return null}function si(t){return t.some(e=>e.visibilityState==="visible"&&!e.url.startsWith("chrome-extension://"))}function ri(t,e){e.isFirebaseMessaging=!0,e.messageType=W.PUSH_RECEIVED;for(const n of t)n.postMessage(e)}function vt(){return self.clients.matchAll({type:"window",includeUncontrolled:!0})}function ii(t){const{actions:e}=t,{maxActions:n}=Notification;return e&&n&&e.length>n&&console.warn(`This browser only supports ${n} actions. The remaining actions will not be displayed.`),self.registration.showNotification(t.title??"",t)}function ai(t){var n,s;const e=((n=t.fcmOptions)==null?void 0:n.link)??((s=t.notification)==null?void 0:s.click_action);return e||(Wr(t.data)?self.location.origin:null)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function oi(t){if(!t||!t.options)throw ae("App Configuration Object");if(!t.name)throw ae("App Name");const e=["projectId","apiKey","appId","messagingSenderId"],{options:n}=t;for(const s of e)if(!n[s])throw ae(s);return{appName:t.name,projectId:n.projectId,apiKey:n.apiKey,appId:n.appId,senderId:n.messagingSenderId}}function ae(t){return f.create("missing-app-config-values",{valueName:t})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ci{constructor(e,n,s){this.deliveryMetricsExportedToBigQueryEnabled=!1,this.onBackgroundMessageHandler=null,this.onMessageHandler=null,this.logEvents=[],this.isLogServiceStarted=!1;const r=oi(e);this.firebaseDependencies={app:e,appConfig:r,installations:n,analyticsProvider:s}}_delete(){return Promise.resolve()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const li=t=>{const e=new ci(t.getProvider("app").getImmediate(),t.getProvider("installations-internal").getImmediate(),t.getProvider("analytics-internal"));return self.addEventListener("push",n=>{n.waitUntil(Xr(n,e))}),self.addEventListener("pushsubscriptionchange",n=>{n.waitUntil(Qr(n,e))}),self.addEventListener("notificationclick",n=>{n.waitUntil(Zr(n))}),e};function ui(){v(new T("messaging-sw",li,"PUBLIC"))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function hi(){return nt()&&await st()&&"PushManager"in self&&"Notification"in self&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function di(t,e){if(self.document!==void 0)throw f.create("only-available-in-sw");return t.onBackgroundMessageHandler=e,()=>{t.onBackgroundMessageHandler=null}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function fi(t=Ss()){return hi().then(e=>{if(!e)throw f.create("unsupported-browser")},e=>{throw f.create("indexed-db-unsupported")}),ge(rt(t),"messaging-sw").getImmediate()}function pi(t,e){return t=rt(t),di(t,e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */ui();self.skipWaiting();In();nn([{"revision":"44aeb1815e14d1dc8527bbc8d23808f9","url":"registerSW.js"},{"revision":"9499e137b16ab52c521ff2bb7213241e","url":"index.html"},{"revision":"29b1ca7d548ba9883c36cbaa551d1bd0","url":"firebase-messaging-token-sw.js"},{"revision":null,"url":"assets/trips-Xc5Dv5N7.css"},{"revision":null,"url":"assets/trips-C-mnf_XA.js"},{"revision":null,"url":"assets/trending-up-BrtZOGs7.js"},{"revision":null,"url":"assets/trash-2-B3VOJSNq.js"},{"revision":null,"url":"assets/storage-bDzsT60Y.js"},{"revision":null,"url":"assets/send-mMAT3AOb.js"},{"revision":null,"url":"assets/save-COWbPM-X.js"},{"revision":null,"url":"assets/route-block-B_A1xBdJ.js"},{"revision":null,"url":"assets/pencil-DNxC-vT3.js"},{"revision":null,"url":"assets/participants-CNIoEDnB.css"},{"revision":null,"url":"assets/participants-CJ2ycbqw.js"},{"revision":null,"url":"assets/notifications-oZyZRC_p.css"},{"revision":null,"url":"assets/notifications-DudGuZHt.js"},{"revision":null,"url":"assets/notifications-ClEzkz9n.js"},{"revision":null,"url":"assets/notifications-C5sARTzn.css"},{"revision":null,"url":"assets/login-BowR4ENC.js"},{"revision":null,"url":"assets/lock-CpZYLUra.js"},{"revision":null,"url":"assets/locations-mqSrGT0g.js"},{"revision":null,"url":"assets/locations-Dwgxud5o.css"},{"revision":null,"url":"assets/itinerary-DZr5PIaZ.js"},{"revision":null,"url":"assets/itinerary-BG4ZYuds.css"},{"revision":null,"url":"assets/index-DeY6t9kE.js"},{"revision":null,"url":"assets/index-DGyx7By9.js"},{"revision":null,"url":"assets/index-CUvUfETL.css"},{"revision":null,"url":"assets/download-dHmekaqb.js"},{"revision":null,"url":"assets/copy-CMpcB7Ez.js"},{"revision":null,"url":"assets/config-C2fWw53x.js"},{"revision":null,"url":"assets/chevron-left-G5h8Knkp.js"},{"revision":null,"url":"assets/check-CcXUfeB1.js"},{"revision":null,"url":"assets/auth-DQlTdX9D.js"},{"revision":null,"url":"assets/add-hHpgPvE8.js"},{"revision":null,"url":"assets/_id_-DxD2sXxJ.js"},{"revision":null,"url":"assets/_...all_-BQwFyAVs.js"},{"revision":null,"url":"assets/Wallet-CijWVYTy.js"},{"revision":null,"url":"assets/Wallet-BvSvyNzs.css"},{"revision":null,"url":"assets/Settings-D4Jhaw_K.js"},{"revision":null,"url":"assets/Itinerary-LZ5L1AB4.css"},{"revision":null,"url":"assets/Itinerary-CYMDERen.js"},{"revision":null,"url":"assets/Converter-DI2bROIU.css"},{"revision":null,"url":"assets/Converter-Brne3Atd.js"},{"revision":null,"url":"assets/AdminItineraryItemForm-COy1DGmx.js"},{"revision":null,"url":"assets/AdminDataTable-DiRACWEe.js"},{"revision":null,"url":"assets/AdminDataTable-D0UBXLEy.css"},{"revision":"3782339b23eb7ae7622f07fa8a797cba","url":"192.png"},{"revision":"48f42c40e27f65f7bea0b7d9169659b2","url":"512.png"},{"revision":"d6c316cd12d9489a0177aca36dc8b64f","url":"manifest.webmanifest"}]);Ge(({url:t})=>t.origin==="https://i.ibb.co"||t.origin==="https://firebasestorage.googleapis.com",new sn({cacheName:"external-images",plugins:[new yn({maxEntries:100,maxAgeSeconds:60*60*24*30}),new En({statuses:[0,200]})]}));const gi={apiKey:"AIzaSyA30W2hG77pT06xcBjrKbJd66yyEP9jk2U",authDomain:"guidebook-jeju.firebaseapp.com",projectId:"guidebook-jeju",storageBucket:"guidebook-jeju.firebasestorage.app",messagingSenderId:"537972388759",appId:"1:537972388759:web:eb81ce2b9d0db4fab14ad2"},mi=it(gi),bi=fi(mi),wi="itineraryUpdated",yi="guidebook-sync-signals",_i="/__guidebook_pending_itinerary_sync__",Ei=async t=>{await(await caches.open(yi)).put(_i,new Response(JSON.stringify(t||{}),{headers:{"Content-Type":"application/json"}}))},Ii=async t=>{const e=await clients.matchAll({type:"window",includeUncontrolled:!0});if(!e.length){await Ei(t);return}e.forEach(n=>n.postMessage(t))};pi(bi,t=>{var s,r,i,a;if(console.log("【Guidebook 背景收到推播】",t),((s=t.data)==null?void 0:s.type)===wi)return Ii(t.data);if(t.notification)return;const e=((r=t.data)==null?void 0:r.title)||"旅程新動態",n={body:((i=t.data)==null?void 0:i.body)||"收到一則新訊息",icon:"/192.png",badge:"/192.png",image:(a=t.data)==null?void 0:a.image};self.registration.showNotification(e,n)});
