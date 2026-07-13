import{c as s,u as i,r as u}from"./index-BYq-m5vn.js";import{c as a}from"./hierarchy-C0Rj9S_D.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],l=s("chevron-right",c);function p(o){const{user:t}=i();return u.useMemo(()=>{if(!t)return[];const r=String(t.id_don_vi||t.idDonVi||"").trim();if(!r||r==="ALL"||r==="HO"||r==="DV_HO")return o.map(n=>String(n.id||""));const e=a(r,o);return Array.from(new Set([r,...e])).map(String)},[t,o])}export{l as C,p as u};
