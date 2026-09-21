(function(){
'use strict';

/* ============================================================
   DMC 데이터
   ============================================================ */
var DMC = (window.APP_DMC_DATA || '').split(';').filter(Boolean).map(function(s){
  var parts = s.split('|');
  var code = parts[0], name = parts[1], hex = parts[2];
  return { code: code, name: name, hex: '#' + hex, rgb: hexToRgb(hex) };
});
var DMC_BY_CODE = {};
DMC.forEach(function(d){ DMC_BY_CODE[d.code] = d; });
var VERSION = window.APP_VERSION || '0.0.0';

/* ============================================================
   색상 유틸
   ============================================================ */
function hexToRgb(hex){
  hex = hex.replace('#','');
  return { r: parseInt(hex.substr(0,2),16), g: parseInt(hex.substr(2,2),16), b: parseInt(hex.substr(4,2),16) };
}
function rgbToHex(r,g,b){
  return '#' + [r,g,b].map(function(v){ v=Math.max(0,Math.min(255,Math.round(v))); var s=v.toString(16); return s.length<2?'0'+s:s; }).join('');
}
function srgbToLinear(c){ c/=255; return c<=0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); }
function rgbToXyz(r,g,b){
  var R=srgbToLinear(r),G=srgbToLinear(g),B=srgbToLinear(b);
  return {
    x: R*0.4124564+G*0.3575761+B*0.1804375,
    y: R*0.2126729+G*0.7151522+B*0.0721750,
    z: R*0.0193339+G*0.1191920+B*0.9503041
  };
}
var WHITE = { x:0.95047, y:1.0, z:1.08883 };
function fLab(t){ return t>0.008856 ? Math.cbrt(t) : (7.787*t + 16/116); }
function rgbToLab(r,g,b){
  var xyz = rgbToXyz(r,g,b);
  var fx=fLab(xyz.x/WHITE.x), fy=fLab(xyz.y/WHITE.y), fz=fLab(xyz.z/WHITE.z);
  return { L: 116*fy-16, a: 500*(fx-fy), b: 200*(fy-fz) };
}
function relLuminance(r,g,b){
  return 0.2126*srgbToLinear(r)+0.7152*srgbToLinear(g)+0.0722*srgbToLinear(b);
}
function contrastSymbolColor(r,g,b){
  return relLuminance(r,g,b) > 0.55 ? '#161616' : '#F5F5F5';
}
// CIEDE2000
function deltaE2000(lab1, lab2){
  var L1=lab1.L,a1=lab1.a,b1=lab1.b, L2=lab2.L,a2=lab2.a,b2=lab2.b;
  var kL=1,kC=1,kH=1;
  var C1=Math.sqrt(a1*a1+b1*b1), C2=Math.sqrt(a2*a2+b2*b2);
  var Cbar=(C1+C2)/2;
  var G=0.5*(1-Math.sqrt(Math.pow(Cbar,7)/(Math.pow(Cbar,7)+Math.pow(25,7))));
  var a1p=a1*(1+G), a2p=a2*(1+G);
  var C1p=Math.sqrt(a1p*a1p+b1*b1), C2p=Math.sqrt(a2p*a2p+b2*b2);
  function hp(ap,b){ if(ap===0&&b===0) return 0; var h=Math.atan2(b,ap)*180/Math.PI; return h<0?h+360:h; }
  var h1p=hp(a1p,b1), h2p=hp(a2p,b2);
  var dLp=L2-L1, dCp=C2p-C1p;
  var dhp;
  if(C1p*C2p===0) dhp=0;
  else { dhp = h2p-h1p; if(dhp>180) dhp-=360; else if(dhp<-180) dhp+=360; }
  var dHp = 2*Math.sqrt(C1p*C2p)*Math.sin((dhp*Math.PI/180)/2);
  var Lbar=(L1+L2)/2, Cbarp=(C1p+C2p)/2;
  var hbarp;
  if(C1p*C2p===0) hbarp=h1p+h2p;
  else { hbarp = Math.abs(h1p-h2p)>180 ? (h1p+h2p+360)/2 : (h1p+h2p)/2; }
  var T = 1 - 0.17*Math.cos((hbarp-30)*Math.PI/180) + 0.24*Math.cos((2*hbarp)*Math.PI/180)
    + 0.32*Math.cos((3*hbarp+6)*Math.PI/180) - 0.20*Math.cos((4*hbarp-63)*Math.PI/180);
  var dTheta = 30*Math.exp(-Math.pow((hbarp-275)/25,2));
  var Rc = 2*Math.sqrt(Math.pow(Cbarp,7)/(Math.pow(Cbarp,7)+Math.pow(25,7)));
  var Sl = 1 + (0.015*Math.pow(Lbar-50,2))/Math.sqrt(20+Math.pow(Lbar-50,2));
  var Sc = 1 + 0.045*Cbarp;
  var Sh = 1 + 0.015*Cbarp*T;
  var Rt = -Math.sin(2*dTheta*Math.PI/180)*Rc;
  var dE = Math.sqrt(
    Math.pow(dLp/(kL*Sl),2) + Math.pow(dCp/(kC*Sc),2) + Math.pow(dHp/(kH*Sh),2) +
    Rt*(dCp/(kC*Sc))*(dHp/(kH*Sh))
  );
  return dE;
}
function nearestDMC(lab, excludeSet){
  var best=null, bestD=Infinity;
  for(var i=0;i<DMC.length;i++){
    var d=DMC[i];
    if(excludeSet && excludeSet.has(d.code)) continue;
    var dl=d.lab || (d.lab = rgbToLab(d.rgb.r,d.rgb.g,d.rgb.b));
    var e=deltaE2000(lab, dl);
    if(e<bestD){ bestD=e; best=d; }
  }
  return best;
}

/* mulberry32 PRNG */
function mulberry32(seed){
  return function(){
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================================================
   상수
   ============================================================ */
var FABRICS = {
  aida11: { label:'Aida 11ct', ct:11, eff:11 },
  aida14: { label:'Aida 14ct', ct:14, eff:14 },
  aida16: { label:'Aida 16ct', ct:16, eff:16 },
  aida18: { label:'Aida 18ct', ct:18, eff:18 },
  aida20: { label:'Aida 20ct', ct:20, eff:20 },
  linen28: { label:'린넨 28ct · 2올', ct:28, eff:14 },
  linen32: { label:'린넨 32ct · 2올', ct:32, eff:16 }
};
var SYMBOLS = ['●','■','▲','◆','★','♥','♠','♣','○','□','△','◇','☆','♡','✕','+','×','÷','=','#','%','@','&','$','?','!',
  'A','B','C','D','E','F','G','H','J','K','L','M','N','P','R','S','T','U','V','W','X','Y','Z',
  'a','b','d','e','f','g','h','k','m','n','q','r','t','u','y',
  '2','3','4','5','6','7','8','9'];

var TOOLS = [
  { id:'move', key:'h', label:'이동', icon: iconMove },
  { id:'full', key:'b', label:'풀 스티치', icon: iconFull },
  { id:'half', key:'/', label:'하프 스티치', icon: iconHalf },
  { id:'quarter', key:'q', label:'쿼터 스티치', icon: iconQuarter },
  { id:'three', key:'t', label:'3/4 스티치', icon: iconThree },
  { id:'back', key:'l', label:'백스티치', icon: iconBack },
  { id:'knot', key:'k', label:'프렌치 노트', icon: iconKnot },
  { id:'erase', key:'e', label:'지우개', icon: iconErase },
  { id:'fill', key:'g', label:'채우기', icon: iconFill },
  { id:'eye', key:'i', label:'스포이드', icon: iconEye },
  { id:'select', key:'s', label:'선택', icon: iconSelect },
  { id:'done', key:'d', label:'진행 체크', icon: iconDone }
];

/* corner mapping helpers */
var MIRROR_H_CORNER = [1,0,3,2];
var MIRROR_V_CORNER = [3,2,1,0];

/* ============================================================
   아이콘 (인라인 SVG 문자열)
   ============================================================ */
function svg(paths, extra){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(paths||'')+'</svg>'; }
function iconMove(){ return svg('<path d="M12 2v20M2 12h20M5 9l-3 3 3 3M19 9l3 3-3 3M9 5l3-3 3 3M9 19l3 3 3-3"/>'); }
function iconFull(){ return svg('<path d="M5 5l14 14M19 5 5 19"/>'); }
function iconHalf(){ return svg('<path d="M5 19 19 5"/>'); }
function iconQuarter(){ return svg('<path d="M5 19 19 5" opacity=".25"/><path d="M5 5h6v6H5z" fill="currentColor" stroke="none"/>'); }
function iconThree(){ return svg('<path d="M5 5l14 14M19 5 5 19" opacity=".25"/><path d="M5 19L19 19L19 5Z" fill="currentColor" stroke="none"/>'); }
function iconBack(){ return svg('<path d="M4 18 10 8l4 6 6-10"/>'); }
function iconKnot(){ return svg('<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>'); }
function iconErase(){ return svg('<path d="M4 16l7-7 7 7-4 4H10z"/><path d="M11 9l6 6"/>'); }
function iconFill(){ return svg('<path d="M4 12l7-7 7 7-7 7z"/><path d="M4 12h14"/><circle cx="19" cy="17" r="2.4" fill="currentColor" stroke="none"/>'); }
function iconEye(){ return svg('<path d="M17 3l4 4-11 11H6v-4z"/>'); }
function iconSelect(){ return svg('<path d="M4 4h4M4 4v4M20 4h-4M20 4v4M4 20h4M4 20v-4M20 20h-4M20 20v-4"/>'); }
function iconDone(){ return svg('<path d="M20 6 9 17l-5-5"/>'); }
function iconPalette(){ return svg('<circle cx="9" cy="9.5" r="4.5"/><circle cx="15" cy="9.5" r="4.5"/><circle cx="12" cy="15.5" r="4.5"/>'); }
function iconLinkOn(){ return svg('<path d="M9 15 15 9"/><path d="M10 6l1.5-1.5a4 4 0 0 1 5.66 5.66L15.5 11.66"/><path d="M14 18l-1.5 1.5a4 4 0 0 1-5.66-5.66L8.5 12.34"/>'); }
function iconLinkOff(){ return svg('<path d="M9 15 15 9" opacity=".35"/><path d="M10 6l1-1a4 4 0 0 1 5.66 5.66l-1 1"/><path d="M14 18l-1 1a4 4 0 0 1-5.66-5.66l1-1"/><path d="M4 4l16 16"/>'); }

/* ============================================================
   RLE
   ============================================================ */
function rleEncode(arr){
  var out=[], i=0, n=arr.length;
  while(i<n){
    var v=arr[i], c=1;
    while(i+c<n && arr[i+c]===v) c++;
    out.push(c>1 ? (v+'*'+c) : String(v));
    i+=c;
  }
  return out.join(',');
}
function rleDecode(str, Ctor, expectedLen){
  var out = new Ctor(expectedLen);
  if(!str){ return out; }
  var tokens = str.split(','), p=0;
  for(var i=0;i<tokens.length;i++){
    var t=tokens[i], star=t.indexOf('*');
    if(star>=0){
      var v=parseInt(t.slice(0,star),10), c=parseInt(t.slice(star+1),10);
      for(var k=0;k<c;k++) out[p++]=v;
    } else {
      out[p++]=parseInt(t,10);
    }
  }
  return out;
}

/* ============================================================
   패턴 모델
   ============================================================ */
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,9); }

function newPattern(w,h,name){
  var n=w*h;
  var cells = new Int16Array(n); cells.fill(-1);
  return {
    id: uid(), name: name||'새 도안', w:w, h:h,
    fabric:'aida14', strands:2,
    palette: [],
    cells: cells,
    types: new Uint8Array(n),
    backs: [],
    knots: [],
    done: new Uint8Array(n),
    created: Date.now(), updated: Date.now()
  };
}
function clonePattern(pat){
  return {
    id: pat.id, name: pat.name, w: pat.w, h: pat.h,
    fabric: pat.fabric, strands: pat.strands,
    palette: pat.palette.map(function(p){ return {code:p.code, sym:p.sym}; }),
    cells: pat.cells.slice(), types: pat.types.slice(),
    backs: pat.backs.map(function(b){ return b.slice(); }),
    knots: pat.knots.map(function(k){ return k.slice(); }),
    done: pat.done.slice(),
    created: pat.created, updated: pat.updated
  };
}
var MAX_DIM = 300;
function serialize(pat){
  return {
    app:'ttamttam', v:1,
    id:pat.id, name:pat.name, w:pat.w, h:pat.h, fabric:pat.fabric, strands:pat.strands,
    palette: pat.palette,
    cells: rleEncode(pat.cells),
    types: rleEncode(pat.types),
    done: rleEncode(pat.done),
    backs: pat.backs, knots: pat.knots,
    created: pat.created, updated: pat.updated
  };
}
function deserialize(obj){
  var n = obj.w*obj.h;
  return {
    id: obj.id || uid(), name: obj.name || '도안', w: obj.w, h: obj.h,
    fabric: FABRICS[obj.fabric] ? obj.fabric : 'aida14',
    strands: obj.strands || 2,
    palette: (obj.palette||[]).map(function(p){ return {code:p.code, sym:p.sym}; }),
    cells: rleDecode(obj.cells, Int16Array, n),
    types: rleDecode(obj.types, Uint8Array, n),
    done: rleDecode(obj.done, Uint8Array, n),
    backs: (obj.backs||[]).map(function(b){ return b.slice(); }),
    knots: (obj.knots||[]).map(function(k){ return k.slice(); }),
    created: obj.created || Date.now(),
    updated: obj.updated || Date.now()
  };
}

/* 예시 도안: 하트 */
function makeSampleHeart(){
  var w=40, h=36;
  var pat = newPattern(w,h,'예시 · 하트');
  pat.fabric='aida14'; pat.strands=2;
  function addColor(code, sym){
    var idx = pat.palette.findIndex(function(p){return p.code===code;});
    if(idx>=0) return idx;
    pat.palette.push({code:code, sym:sym});
    return pat.palette.length-1;
  }
  var iOutline = addColor('814','●');
  var iDark = addColor('304','■');
  var iMid = addColor('321','▲');
  var iLight = addColor('3705','◆');
  var iHi = addColor('B5200','★');
  function setCell(x,y,idx,type){
    if(x<0||y<0||x>=w||y>=h) return;
    pat.cells[y*w+x]=idx; pat.types[y*w+x]=type||1;
  }
  // 하트 방정식으로 채움 + 음영
  var cx=w/2, cy=h/2+2, scale=Math.min(w,h)*0.30;
  for(var y=0;y<h;y++){
    for(var x=0;x<w;x++){
      var u=(x-cx)/scale, v=-(y-cy)/scale;
      var val = Math.pow(u*u+v*v-1,3) - u*u*v*v*v;
      if(val<=0){
        var d = Math.sqrt(u*u+v*v);
        var idx = d>1.35 ? iDark : d>0.95 ? iMid : d>0.5 ? iLight : iHi;
        // 가장자리는 outline
        setCell(x,y,idx,1);
      }
    }
  }
  // outline: 값이 경계 근처인 칸 감지 (인접 중 하나라도 비어있으면 외곽선)
  var outlineSet=[];
  for(var y2=0;y2<h;y2++){
    for(var x2=0;x2<w;x2++){
      var i2=y2*w+x2;
      if(pat.cells[i2]<0) continue;
      var edge=false;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){
        var nx=x2+d[0], ny=y2+d[1];
        if(nx<0||ny<0||nx>=w||ny>=h||pat.cells[ny*w+nx]<0) edge=true;
      });
      if(edge) outlineSet.push(i2);
    }
  }
  // 외곽선 백스티치 (셀 사각형 둘레, 반칸 단위)
  outlineSet.forEach(function(i2){
    var x2=i2%w, y2=(i2/w)|0;
    var X=x2*2, Y=y2*2;
    pat.backs.push([X,Y,X+2,Y,iOutline]);
    pat.backs.push([X,Y,X,Y+2,iOutline]);
    pat.backs.push([X+2,Y,X+2,Y+2,iOutline]);
    pat.backs.push([X,Y+2,X+2,Y+2,iOutline]);
  });
  // 프렌치 노트 몇 개 (310) — 하트 윗쪽 봉우리 부근 (u,v 곡선 좌표계 기준)
  var iKnot = addColor('310','+');
  [[-0.5,0.95],[0,0.7],[0.5,0.95]].forEach(function(p){
    var kx = cx+p[0]*scale, ky = cy-p[1]*scale;
    pat.knots.push([Math.round(kx*2), Math.round(ky*2), iKnot]);
  });
  return pat;
}

/* ============================================================
   저장소(Storage) 어댑터
   ============================================================ */
var LocalStore = (function(){
  var mode = null; // 'idb' | 'ls' | 'mem'
  var db = null;
  var mem = {};
  function openIDB(){
    return new Promise(function(resolve,reject){
      if(!window.indexedDB){ reject(new Error('no idb')); return; }
      var req = indexedDB.open('ttamttam', 2);
      req.onupgradeneeded = function(){
        var d = req.result;
        if(!d.objectStoreNames.contains('patterns')) d.createObjectStore('patterns', {keyPath:'id'});
        if(!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', {keyPath:'key'});
      };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error); };
    });
  }
  function idbTx(storeMode){
    return db.transaction('patterns', storeMode).objectStore('patterns');
  }
  function getMeta(key){
    if(mode!=='idb') return Promise.resolve(null);
    return new Promise(function(resolve){
      var r = db.transaction('meta','readonly').objectStore('meta').get(key);
      r.onsuccess=function(){ resolve(r.result?r.result.value:null); };
      r.onerror=function(){ resolve(null); };
    });
  }
  function setMeta(key,value){
    if(mode!=='idb') return Promise.resolve();
    return new Promise(function(resolve,reject){
      var r = db.transaction('meta','readwrite').objectStore('meta').put({key:key, value:value});
      r.onsuccess=function(){ resolve(); }; r.onerror=function(){ reject(r.error); };
    });
  }
  function init(){
    return openIDB().then(function(d){
      db=d; mode='idb';
      if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function(){});
    }).catch(function(){
      try { localStorage.setItem('xstitch:test','1'); localStorage.removeItem('xstitch:test'); mode='ls'; }
      catch(e){ mode='mem'; }
    });
  }
  function lsKey(id){ return 'xstitch:p:'+id; }
  function put(pat){
    var obj = serialize(pat);
    if(mode==='idb'){
      return new Promise(function(resolve,reject){
        var store = idbTx('readwrite');
        var r = store.put(obj);
        r.onsuccess=function(){resolve();}; r.onerror=function(){reject(r.error);};
      });
    } else if(mode==='ls'){
      try { localStorage.setItem(lsKey(pat.id), JSON.stringify(obj)); return Promise.resolve(); }
      catch(e){ return Promise.reject(e); }
    } else {
      mem[pat.id]=obj; return Promise.resolve();
    }
  }
  function get(id){
    if(mode==='idb'){
      return new Promise(function(resolve,reject){
        var r = idbTx('readonly').get(id);
        r.onsuccess=function(){ resolve(r.result?deserialize(r.result):null); };
        r.onerror=function(){ reject(r.error); };
      });
    } else if(mode==='ls'){
      var s = localStorage.getItem(lsKey(id));
      return Promise.resolve(s?deserialize(JSON.parse(s)):null);
    } else {
      return Promise.resolve(mem[id]?deserialize(mem[id]):null);
    }
  }
  function del(id){
    if(mode==='idb'){
      return new Promise(function(resolve,reject){
        var r = idbTx('readwrite').delete(id);
        r.onsuccess=function(){resolve();}; r.onerror=function(){reject(r.error);};
      });
    } else if(mode==='ls'){
      localStorage.removeItem(lsKey(id)); return Promise.resolve();
    } else { delete mem[id]; return Promise.resolve(); }
  }
  function listAll(){
    if(mode==='idb'){
      return new Promise(function(resolve,reject){
        var out=[];
        var store = idbTx('readonly');
        var req = store.openCursor();
        req.onsuccess=function(){
          var cur = req.result;
          if(cur){ out.push(deserialize(cur.value)); cur.continue(); }
          else resolve(out);
        };
        req.onerror=function(){reject(req.error);};
      });
    } else if(mode==='ls'){
      var out=[];
      for(var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i);
        if(k.indexOf('xstitch:p:')===0){
          try{ out.push(deserialize(JSON.parse(localStorage.getItem(k)))); }catch(e){}
        }
      }
      return Promise.resolve(out);
    } else {
      return Promise.resolve(Object.keys(mem).map(function(k){ return deserialize(mem[k]); }));
    }
  }
  return { init:init, put:put, get:get, del:del, listAll:listAll, mode:function(){return mode;}, getMeta:getMeta, setMeta:setMeta };
})();

/* ============================================================
   Google 로그인 + 클라우드 동기화 (선택 기능)
   로그인하지 않으면 이 블록은 아무 것도 하지 않고, 앱은 이전처럼
   완전 로컬(LocalStore)로만 동작한다. 로그인한 경우에만 Firestore로
   실시간 동기화하며, Firestore 자체 오프라인 캐시로 오프라인에서도
   읽기/쓰기가 되고 재연결 시 자동 동기화된다.
   ============================================================ */
var Auth = (function(){
  var enabled = !!(window.APP_FIREBASE_CONFIG && window.APP_FIREBASE_CONFIG.enabled);
  var authInst=null, user=null;
  var listeners=[];
  function fire(){ listeners.forEach(function(fn){ try{ fn(user); }catch(e){} }); }
  // init()은 최초 로그인 상태가 확정될 때 그 사용자로 resolve된다 (비활성/실패 시 null).
  // 이후의 변화(로그인·로그아웃 버튼, 세션 만료)는 onChange 리스너로만 통지한다.
  function init(){
    if(!enabled || !window.firebase){ enabled=false; return Promise.resolve(null); }
    try{
      firebase.initializeApp(window.APP_FIREBASE_CONFIG);
      authInst = firebase.auth();
    }catch(e){ console.error('Firebase init 실패', e); enabled=false; return Promise.resolve(null); }
    return new Promise(function(resolve){
      var first=true;
      authInst.onAuthStateChanged(function(u){
        user=u;
        if(first){ first=false; resolve(u); }
        else fire();
      });
    });
  }
  function signIn(){
    if(!enabled) return Promise.reject(new Error('disabled'));
    var provider = new firebase.auth.GoogleAuthProvider();
    return authInst.signInWithPopup(provider).catch(function(err){
      if(err && (err.code==='auth/popup-blocked'||err.code==='auth/operation-not-supported-in-this-environment'||err.code==='auth/cancelled-popup-request')){
        return authInst.signInWithRedirect(provider);
      }
      throw err;
    });
  }
  function signOut(){ return enabled ? authInst.signOut() : Promise.resolve(); }
  function onChange(fn){ listeners.push(fn); }
  return { isEnabled:function(){return enabled;}, init:init, signIn:signIn, signOut:signOut, onChange:onChange, currentUser:function(){return user;} };
})();

var CloudStore = (function(){
  var db=null, unsub=null;
  function ensureDb(){ if(!db) db = firebase.firestore(); return db; }
  function col(){
    var u = Auth.currentUser();
    if(!u) throw new Error('로그인이 필요해요');
    return ensureDb().collection('users').doc(u.uid).collection('patterns');
  }
  function init(){
    if(!Auth.isEnabled()) return Promise.resolve();
    try{
      ensureDb().enablePersistence({synchronizeTabs:true}).catch(function(){});
    }catch(e){}
    return Promise.resolve();
  }
  function put(pat){ return col().doc(pat.id).set(serialize(pat)); }
  function get(id){ return col().doc(id).get().then(function(d){ return d.exists? deserialize(d.data()) : null; }); }
  function del(id){ return col().doc(id).delete(); }
  function listAll(){ return col().get().then(function(snap){ var out=[]; snap.forEach(function(d){ out.push(deserialize(d.data())); }); return out; }); }
  function watch(onData){
    unwatch();
    unsub = col().onSnapshot({includeMetadataChanges:true}, function(snap){
      var out=[]; snap.forEach(function(d){ out.push(deserialize(d.data())); });
      onData(out, {fromCache: snap.metadata.fromCache});
    }, function(err){ console.error('동기화 오류', err); });
  }
  function unwatch(){ if(unsub){ unsub(); unsub=null; } }
  return { init:init, put:put, get:get, del:del, listAll:listAll, watch:watch, unwatch:unwatch };
})();

// 저장소 파사드: 로그인 상태에 따라 LocalStore ↔ CloudStore로 자동 전환
var Data = {
  init: function(){ return Promise.all([LocalStore.init(), CloudStore.init()]); },
  put: function(pat){ return (Auth.currentUser()?CloudStore:LocalStore).put(pat).then(scheduleAutoBackup); },
  get: function(id){ return (Auth.currentUser()?CloudStore:LocalStore).get(id); },
  del: function(id){ return (Auth.currentUser()?CloudStore:LocalStore).del(id).then(scheduleAutoBackup); },
  listAll: function(){ return (Auth.currentUser()?CloudStore:LocalStore).listAll(); }
};
function scheduleAutoBackup(){
  clearTimeout(scheduleAutoBackup._t);
  scheduleAutoBackup._t = setTimeout(function(){ AutoBackup.writeNow(); }, 3000);
}

/* ============================================================
   자동 백업 폴더 (선택) — 로컬 폴더 하나를 지정해두면 도안이 바뀔 때마다
   그 폴더에 백업 JSON을 자동으로 다시 써준다. 그 폴더가 구글드라이브·
   원드라이브 등 동기화 폴더 안이면 결과적으로 클라우드에도 자동 저장됨.
   크롬/엣지(File System Access API 지원 브라우저)에서만 가능.
   ============================================================ */
var AutoBackup = (function(){
  var dirHandle = null, enabled = false;
  function supported(){ return !!window.showDirectoryPicker; }
  function load(){
    if(!supported()) return Promise.resolve();
    return LocalStore.getMeta('autoBackupDir').then(function(h){
      if(h){ dirHandle = h; enabled = true; }
    });
  }
  function choose(){
    if(!supported()) return Promise.reject(new Error('unsupported'));
    return window.showDirectoryPicker({mode:'readwrite'}).then(function(h){
      dirHandle = h; enabled = true;
      return writeNow().then(function(){
        // 핸들 저장에 실패해도(예: 브라우저 제약) 이번 세션에서는 계속 동작하게 둔다.
        return LocalStore.setMeta('autoBackupDir', h).catch(function(e){ console.error('자동 백업 폴더 정보 저장 실패', e); });
      });
    });
  }
  function turnOff(){
    dirHandle = null; enabled = false;
    return LocalStore.setMeta('autoBackupDir', null);
  }
  function ensurePermission(){
    if(!dirHandle) return Promise.resolve(false);
    return dirHandle.queryPermission({mode:'readwrite'}).then(function(p){
      if(p==='granted') return true;
      return dirHandle.requestPermission({mode:'readwrite'}).then(function(p2){ return p2==='granted'; });
    }).catch(function(){ return false; });
  }
  function writeNow(){
    if(!enabled || !dirHandle) return Promise.resolve();
    return ensurePermission().then(function(ok){
      if(!ok) return;
      return Data.listAll().then(function(list){
        var data = { app:'ttamttam-backup', v:1, exported:Date.now(), patterns:list.map(serialize) };
        return dirHandle.getFileHandle('ttamttam-auto-backup.json', {create:true}).then(function(fh){
          return fh.createWritable();
        }).then(function(w){
          return w.write(JSON.stringify(data)).then(function(){ return w.close(); });
        });
      });
    }).catch(function(e){ console.error('자동 백업 실패', e); });
  }
  return {
    supported:supported, load:load, choose:choose, turnOff:turnOff, writeNow:writeNow,
    isEnabled:function(){return enabled;}, folderName:function(){ return dirHandle?dirHandle.name:null; }
  };
})();

/* ============================================================
   전역 상태
   ============================================================ */
var $ = function(sel,root){ return (root||document).querySelector(sel); };
var $$ = function(sel,root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); };
var app = $('#app');

var S = {
  patternsMeta: [],   // {id,name,w,h,colorCount,updated,progress,thumb}
  pat: null,          // 현재 편집중 패턴
  tool: 'full',
  prevTool: 'full',
  halfDir: '/',
  curPaletteIdx: -1,
  recentColors: [], // 최근 사용한 palette idx (최신순)
  view: {colorSym:'color'}, // color | symbol | both
  symH: false, symV: false,
  onlySelected: false,
  showDone: false,
  showRunCount: false,
  showCmSize: false,
  zoom: 16,
  pan: {x:0,y:0},
  selection: null, // {x0,y0,x1,y1}
  clipboard: null,
  history: [], future: [],
  saveTimer: null,
  saveState: 'saved',
  dirty: false,
  pointer: {},
  regFlood: null
};
var HISTORY_MAX = 80;

/* ============================================================
   유틸 UI
   ============================================================ */
function toast(msg, ms){
  var root = $('#toast-root');
  var el = document.createElement('div');
  el.className='toast'; el.textContent = msg;
  root.innerHTML=''; root.appendChild(el);
  clearTimeout(toast._t);
  toast._t = setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, ms||2200);
}
function closeMenu(){ $('#menu-root').innerHTML=''; }
function openMenu(items, x, y){
  closeMenu();
  var root = $('#menu-root');
  var menu = document.createElement('div');
  menu.className='menu';
  items.forEach(function(it){
    if(it===null){ var hr=document.createElement('hr'); menu.appendChild(hr); return; }
    var b=document.createElement('button');
    if(it.danger) b.className='danger';
    b.innerHTML = (it.icon?it.icon+' ':'')+escapeHtml(it.label);
    b.disabled = !!it.disabled;
    b.onclick=function(){ closeMenu(); it.action&&it.action(); };
    menu.appendChild(b);
  });
  root.appendChild(menu);
  var vw=innerWidth, vh=innerHeight;
  requestAnimationFrame(function(){
    var r = menu.getBoundingClientRect();
    var left = Math.min(x, vw-r.width-8), top = Math.min(y, vh-r.height-8);
    menu.style.left = Math.max(8,left)+'px'; menu.style.top = Math.max(8,top)+'px';
  });
  setTimeout(function(){
    document.addEventListener('pointerdown', onOut, {capture:true});
    document.addEventListener('keydown', onEsc);
  },0);
  function onOut(e){ if(!menu.contains(e.target)){ closeMenu(); cleanup(); } }
  function onEsc(e){ if(e.key==='Escape'){ closeMenu(); cleanup(); } }
  function cleanup(){ document.removeEventListener('pointerdown', onOut, {capture:true}); document.removeEventListener('keydown', onEsc); }
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

function closeModal(){ $('#modal-root').innerHTML=''; document.removeEventListener('keydown', modalEsc); }
function modalEsc(e){ if(e.key==='Escape') closeModal(); }
function openModal(opts){
  // opts: {title, bodyHTML, wide, footerHTML, onMount(root), onClose}
  closeModal();
  var root=$('#modal-root');
  var ov=document.createElement('div'); ov.className='overlay';
  var modal=document.createElement('div'); modal.className='modal'+(opts.wide?' wide':'');
  modal.innerHTML =
    '<div class="modal-h"><h2>'+escapeHtml(opts.title)+'</h2><button class="icon-btn" id="modal-x">'+iconClose()+'</button></div>'+
    '<div class="modal-b">'+(opts.bodyHTML||'')+'</div>'+
    (opts.footerHTML!==undefined ? '<div class="modal-f">'+opts.footerHTML+'</div>' : '');
  ov.appendChild(modal);
  root.appendChild(ov);
  ov.addEventListener('pointerdown', function(e){ if(e.target===ov) closeModal(); });
  $('#modal-x',modal).onclick=closeModal;
  document.addEventListener('keydown', modalEsc);
  if(opts.onMount) opts.onMount(modal);
  return modal;
}
function iconClose(){ return svg('<path d="M6 6l12 12M18 6 6 18"/>'); }

function confirmModal(title, msg, opts){
  opts = opts || {};
  return new Promise(function(resolve){
    var modal = openModal({
      title: title,
      bodyHTML: '<p style="margin:0">'+escapeHtml(msg)+'</p>',
      footerHTML:
        '<button class="btn ghost" id="cf-no">'+(opts.cancelLabel||'취소')+'</button>'+
        '<button class="btn '+(opts.danger?'danger':'primary')+'" id="cf-yes">'+(opts.okLabel||'확인')+'</button>'
    });
    $('#cf-no',modal).onclick=function(){ closeModal(); resolve(false); };
    $('#cf-yes',modal).onclick=function(){ closeModal(); resolve(true); };
  });
}

/* ============================================================
   다운로드
   PNG/PDF/JSON 내보내기는 브라우저 다운로드로 저장된다. 크롬/엣지에서
   Settings -> Downloads -> "다운로드 전 저장 위치를 항상 확인" 을 켜두면
   내보낼 때마다 저장 위치(구글드라이브 동기화 폴더 등)를 고를 수 있다 —
   이건 브라우저 자체 기능이라 앱에서 별도 처리하지 않는다. (File System
   Access API의 showSaveFilePicker는 캔버스/PDF 생성처럼 콜백이 여러 단계
   중첩된 흐름에서 응답이 아예 멈추는 사례가 확인되어 내보내기에는 쓰지
   않는다 — 대신 "자동 백업 폴더"는 버튼 클릭에서 바로 호출하므로 안전하다.)
   ============================================================ */
function downloadBlob(name, blob){
  if(window.claude && window.claude.use){
    try{ window.claude.use('downloads', {filename:name, blob:blob}); return Promise.resolve(true); }catch(e){}
  }
  var a=document.createElement('a');
  var url=URL.createObjectURL(blob);
  a.href=url; a.download=name; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 4000);
  return Promise.resolve(true);
}

/* ============================================================
   라이브러리(내 도안) 화면
   ============================================================ */
function fmtDate(ms){
  var d = new Date(ms);
  var mm = d.getMonth()+1, dd = d.getDate();
  var hh = d.getHours(), mi = d.getMinutes();
  function p2(n){ return n<10?'0'+n:''+n; }
  return mm+'/'+dd+' '+p2(hh)+':'+p2(mi);
}
function patternColorCount(pat){ return pat.palette.length; }
function patternProgress(pat){
  var total=0, doneN=0;
  for(var i=0;i<pat.types.length;i++){
    if(pat.types[i]!==0){ total++; if(pat.done[i]) doneN++; }
  }
  return total? doneN/total : 0;
}
function makeThumb(pat, size){
  size = size || 240;
  var scale = Math.max(1, Math.floor(size/Math.max(pat.w,pat.h)));
  var c = document.createElement('canvas');
  c.width = pat.w; c.height = pat.h;
  var ctx = c.getContext('2d');
  ctx.fillStyle = '#FAFBF8'; ctx.fillRect(0,0,pat.w,pat.h);
  var img = ctx.createImageData(pat.w, pat.h);
  for(var y=0;y<pat.h;y++){
    for(var x=0;x<pat.w;x++){
      var i=y*pat.w+x;
      var idx = pat.cells[i];
      var p = i*4;
      if(idx>=0 && pat.types[i]!==0){
        var code = pat.palette[idx].code;
        var d = DMC_BY_CODE[code];
        var rgb = d?d.rgb:{r:200,g:200,b:200};
        img.data[p]=rgb.r; img.data[p+1]=rgb.g; img.data[p+2]=rgb.b; img.data[p+3]=255;
      } else {
        img.data[p]=250; img.data[p+1]=251; img.data[p+2]=248; img.data[p+3]=255;
      }
    }
  }
  ctx.putImageData(img,0,0);
  var out = document.createElement('canvas');
  out.width = pat.w*scale; out.height = pat.h*scale;
  var octx = out.getContext('2d');
  octx.imageSmoothingEnabled=false;
  octx.drawImage(c,0,0,out.width,out.height);
  return out.toDataURL('image/png');
}

function applyLibraryList(list){
  list.sort(function(a,b){ return b.updated-a.updated; });
  S.patternsMeta = list.map(function(pat){
    return {
      id:pat.id, name:pat.name, w:pat.w, h:pat.h,
      colorCount: patternColorCount(pat), updated: pat.updated,
      progress: patternProgress(pat), thumb: makeThumb(pat)
    };
  });
  return list;
}
function refreshLibraryMeta(){
  return Data.listAll().then(applyLibraryList);
}

function renderLibrary(){
  var grid = $('#lib-grid'), empty = $('#lib-empty');
  grid.innerHTML='';
  if(S.patternsMeta.length===0){ empty.hidden=false; grid.hidden=true; return; }
  empty.hidden=true; grid.hidden=false;
  S.patternsMeta.forEach(function(m){
    var card=document.createElement('div'); card.className='card';
    var progHTML = m.progress>0 ? '<div class="progress"><i style="width:'+Math.round(m.progress*100)+'%"></i></div>' : '';
    card.innerHTML =
      '<button class="card-thumb" data-open="'+m.id+'"><img src="'+m.thumb+'" alt=""></button>'+
      '<div class="card-body">'+
        '<div class="card-name">'+escapeHtml(m.name)+'</div>'+
        '<div class="card-meta"><span>'+m.w+'×'+m.h+'</span><span>'+m.colorCount+'색</span><span>'+fmtDate(m.updated)+'</span></div>'+
        progHTML+
      '</div>'+
      '<div class="card-foot">'+
        '<button class="btn ghost sm" data-open="'+m.id+'">열기</button>'+
        '<span class="grow"></span>'+
        '<button class="icon-btn" data-dup="'+m.id+'" title="복제">'+iconDup()+'</button>'+
        '<button class="icon-btn" data-export="'+m.id+'" title="내보내기(JSON)">'+iconExport()+'</button>'+
        '<button class="icon-btn" data-del="'+m.id+'" title="삭제">'+iconTrash()+'</button>'+
      '</div>';
    grid.appendChild(card);
  });
  grid.onclick = function(e){
    var t=e.target.closest('[data-open],[data-dup],[data-export],[data-del]');
    if(!t) return;
    if(t.dataset.open) openPattern(t.dataset.open);
    else if(t.dataset.dup) duplicatePattern(t.dataset.dup);
    else if(t.dataset.export) exportPatternJSONById(t.dataset.export);
    else if(t.dataset.del) deletePattern(t.dataset.del);
  };
}
function iconDup(){ return svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'); }
function iconExport(){ return svg('<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 21h14"/>'); }
function iconTrash(){ return svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>'); }

function openPattern(id){
  Data.get(id).then(function(pat){
    if(!pat){ toast('도안을 열 수 없어요'); return; }
    S.pat = pat;
    enterEditor();
  });
}
function duplicatePattern(id){
  Data.get(id).then(function(pat){
    if(!pat) return;
    var copy = clonePattern(pat);
    copy.id = uid(); copy.name = pat.name+' (사본)';
    copy.created = Date.now(); copy.updated = Date.now();
    return Data.put(copy);
  }).then(function(){ return refreshLibraryMeta(); }).then(function(){ renderLibrary(); toast('복제했어요'); });
}
function exportPatternJSONById(id){
  Data.get(id).then(function(pat){
    if(!pat) return;
    var blob = new Blob([JSON.stringify(serialize(pat))], {type:'application/json'});
    downloadBlob(safeFileName(pat.name)+'.json', blob);
  });
}
function safeFileName(s){ return (s||'도안').replace(/[\\/:*?"<>|]/g,'_').slice(0,60); }
function deletePattern(id){
  var m = S.patternsMeta.find(function(x){return x.id===id;});
  confirmModal('도안 삭제', (m?('"'+m.name+'" '):'')+'도안을 삭제할까요? 되돌릴 수 없어요.', {danger:true, okLabel:'삭제'}).then(function(ok){
    if(!ok) return;
    Data.del(id).then(function(){ return refreshLibraryMeta(); }).then(function(){ renderLibrary(); toast('삭제했어요'); });
  });
}

function createNewPattern(){
  openModal({
    title:'새 도안',
    bodyHTML:
      '<div class="stack">'+
      '<label class="field"><span>이름</span><input id="np-name" value="새 도안"></label>'+
      '<div class="row2">'+
        '<label class="field"><span>가로 (스티치)</span><input id="np-w" type="number" min="4" max="'+MAX_DIM+'" value="60"></label>'+
        '<label class="field"><span>세로 (스티치)</span><input id="np-h" type="number" min="4" max="'+MAX_DIM+'" value="60"></label>'+
      '</div>'+
      '<label class="field"><span>원단</span><select id="np-fabric">'+fabricOptions('aida14')+'</select></label>'+
      '</div>',
    footerHTML: '<button class="btn ghost" id="np-cancel">취소</button><button class="btn primary" id="np-ok">만들기</button>'
  });
  var modal = $('#modal-root .modal');
  $('#np-cancel',modal).onclick=closeModal;
  $('#np-ok',modal).onclick=function(){
    var name = $('#np-name',modal).value.trim()||'새 도안';
    var w = clamp(parseInt($('#np-w',modal).value,10)||60,4,MAX_DIM);
    var h = clamp(parseInt($('#np-h',modal).value,10)||60,4,MAX_DIM);
    var fabric = $('#np-fabric',modal).value;
    var pat = newPattern(w,h,name);
    pat.fabric = fabric;
    closeModal();
    Data.put(pat).then(function(){ S.pat=pat; enterEditor(); });
  };
}
function fabricOptions(sel){
  return Object.keys(FABRICS).map(function(k){
    return '<option value="'+k+'"'+(k===sel?' selected':'')+'>'+FABRICS[k].label+'</option>';
  }).join('');
}
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

/* 전체 백업 / 복원 */
function backupAll(){
  Data.listAll().then(function(list){
    var data = { app:'ttamttam-backup', v:1, exported: Date.now(), patterns: list.map(serialize) };
    var blob = new Blob([JSON.stringify(data)], {type:'application/json'});
    downloadBlob('ttamttam-backup-'+new Date().toISOString().slice(0,10)+'.json', blob);
  });
}
function restoreBackupFile(file){
  var reader = new FileReader();
  reader.onload = function(){
    try{
      var data = JSON.parse(reader.result);
      var list = data.patterns || (data.app==='ttamttam'?[data]:[]);
      if(!list.length){ toast('불러올 도안이 없어요'); return; }
      Data.listAll().then(function(existing){
        var ids = new Set(existing.map(function(p){return p.id;}));
        var ops = list.map(function(raw){
          var pat = deserialize(raw);
          if(ids.has(pat.id)) pat.id = uid();
          ids.add(pat.id);
          return Data.put(pat);
        });
        return Promise.all(ops);
      }).then(function(){ return refreshLibraryMeta(); }).then(function(){ renderLibrary(); toast(list.length+'개 도안을 불러왔어요'); });
    }catch(e){ toast('파일을 읽을 수 없어요'); }
  };
  reader.readAsText(file);
}
function openSingleFile(file){
  var reader = new FileReader();
  reader.onload = function(){
    try{
      var raw = JSON.parse(reader.result);
      var pat = deserialize(raw);
      Data.listAll().then(function(existing){
        var ids = new Set(existing.map(function(p){return p.id;}));
        if(ids.has(pat.id)) pat.id = uid();
        return Data.put(pat);
      }).then(function(){ return refreshLibraryMeta(); }).then(function(){ renderLibrary(); toast('도안을 불러왔어요'); });
    }catch(e){ toast('파일을 읽을 수 없어요'); }
  };
  reader.readAsText(file);
}

/* ============================================================
   화면 전환
   ============================================================ */
function enterLibrary(){
  flushSave(true).then(function(){
    S.pat = null;
    app.classList.remove('mode-editor');
    return refreshLibraryMeta();
  }).then(renderLibrary);
}
function enterEditor(){
  app.classList.add('mode-editor');
  S.history=[]; S.future=[]; S.selection=null; S.clipboard=S.clipboard;
  S.curPaletteIdx = S.pat.palette.length?0:-1;
  S.recentColors = [];
  S.tool='full'; S.zoom = fitZoom();
  $('#title-input').value = S.pat.name;
  buildToolbar(); buildOptbar(); buildPanel();
  centerCanvas();
  drawEditor();
  updateCmSizeBadge();
  setSaveState('saved');
}
function fitZoom(){
  var wrap = $('#canvas-wrap');
  var w = wrap.clientWidth-52, h = wrap.clientHeight-52;
  if(!S.pat) return 16;
  var z = Math.floor(Math.min(w/S.pat.w, h/S.pat.h));
  return clamp(z||16, 3, 48);
}
function centerCanvas(){
  var wrap = $('#canvas-wrap');
  var cw = S.pat.w*S.zoom+26, ch = S.pat.h*S.zoom+26;
  S.pan.x = Math.max(20,(wrap.clientWidth-cw)/2);
  S.pan.y = Math.max(20,(wrap.clientHeight-ch)/2);
}

/* ============================================================
   저장 (자동저장)
   ============================================================ */
function setSaveState(s){
  S.saveState=s;
  var el=$('#save-state');
  el.textContent = s==='saving'?'저장 중…':s==='saved'?'저장됨':'저장 실패';
}
function markDirty(){
  S.pat.updated = Date.now();
  S.dirty = true;
  setSaveState('saving');
  clearTimeout(S.saveTimer);
  S.saveTimer = setTimeout(function(){ flushSave(); }, 1500);
}
function flushSave(sync){
  if(!S.pat || !S.dirty) return Promise.resolve();
  clearTimeout(S.saveTimer);
  return Data.put(S.pat).then(function(){
    S.dirty=false; setSaveState('saved');
  }).catch(function(){ setSaveState('error'); toast('저장에 실패했어요'); });
}
window.addEventListener('beforeunload', function(){ if(S.dirty) flushSave(true); });

/* ============================================================
   되돌리기 / 다시하기
   ============================================================ */
function snapshot(){
  return {
    cells: S.pat.cells.slice(), types: S.pat.types.slice(), done: S.pat.done.slice(),
    backs: S.pat.backs.map(function(b){return b.slice();}),
    knots: S.pat.knots.map(function(k){return k.slice();}),
    palette: S.pat.palette.map(function(p){return {code:p.code,sym:p.sym};})
  };
}
function pushHistory(){
  S.history.push(snapshot());
  if(S.history.length>HISTORY_MAX) S.history.shift();
  S.future.length=0;
}
function applySnapshot(snap){
  S.pat.cells=snap.cells.slice(); S.pat.types=snap.types.slice(); S.pat.done=snap.done.slice();
  S.pat.backs=snap.backs.map(function(b){return b.slice();});
  S.pat.knots=snap.knots.map(function(k){return k.slice();});
  S.pat.palette=snap.palette.map(function(p){return {code:p.code,sym:p.sym};});
}
function undo(){
  if(!S.history.length) return;
  S.future.push(snapshot());
  applySnapshot(S.history.pop());
  fixCurPalette(); markDirty(); drawEditor(); buildPanel();
}
function redo(){
  if(!S.future.length) return;
  S.history.push(snapshot());
  applySnapshot(S.future.pop());
  fixCurPalette(); markDirty(); drawEditor(); buildPanel();
}
function fixCurPalette(){
  if(S.curPaletteIdx>=S.pat.palette.length) S.curPaletteIdx = S.pat.palette.length-1;
}

/* ============================================================
   렌더링 (편집기 / PDF / PNG 공용)
   renderRegion(ctx, pat, {sx,sy,ex,ey,cell,ox,oy,mode,grid,fabric,done,highlightIdx})
   ============================================================ */
function renderRegion(ctx, pat, o){
  var sx=o.sx, sy=o.sy, ex=o.ex, ey=o.ey, cell=o.cell, ox=o.ox, oy=o.oy;
  var mode=o.mode||'color', grid=o.grid!==false, showDone=!!o.done, highlightIdx=o.highlightIdx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, (ex-sx)*cell, (ey-sy)*cell);
  ctx.clip();
  if(o.fabric!==false){
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(ox, oy, (ex-sx)*cell, (ey-sy)*cell);
  }
  var w=pat.w;
  for(var y=sy;y<ey;y++){
    for(var x=sx;x<ex;x++){
      var i=y*w+x;
      var idx=pat.cells[i], type=pat.types[i];
      if(type===0||idx<0) continue;
      var dim = highlightIdx!=null && idx!==highlightIdx;
      var code = pat.palette[idx] ? pat.palette[idx].code : null;
      var d = code?DMC_BY_CODE[code]:null;
      var rgb = d?d.rgb:{r:170,g:170,b:170};
      var sym = pat.palette[idx]?pat.palette[idx].sym:'?';
      var px=ox+(x-sx)*cell, py=oy+(y-sy)*cell;
      var alpha = dim?0.18:1;
      drawStitch(ctx, px, py, cell, type, rgb, sym, mode, alpha);
      if(showDone && pat.done[i]){
        ctx.fillStyle='rgba(255,255,255,'+(dim?0.3:0.55)+')';
        ctx.fillRect(px,py,cell,cell);
      }
    }
  }
  if(grid && cell>=5){
    ctx.strokeStyle='rgba(20,25,24,0.14)';
    ctx.lineWidth=1;
    for(var gx=sx;gx<=ex;gx++){
      var px2=ox+(gx-sx)*cell+0.5;
      ctx.beginPath(); ctx.moveTo(px2,oy); ctx.lineTo(px2,oy+(ey-sy)*cell); ctx.stroke();
    }
    for(var gy=sy;gy<=ey;gy++){
      var py2=oy+(gy-sy)*cell+0.5;
      ctx.beginPath(); ctx.moveTo(ox,py2); ctx.lineTo(ox+(ex-sx)*cell,py2); ctx.stroke();
    }
  }
  if(grid){
    ctx.strokeStyle='rgba(20,25,24,0.38)';
    ctx.lineWidth=1;
    for(var gx2=sx;gx2<=ex;gx2++){
      if(gx2%10!==0) continue;
      var px3=ox+(gx2-sx)*cell+0.5;
      ctx.beginPath(); ctx.moveTo(px3,oy); ctx.lineTo(px3,oy+(ey-sy)*cell); ctx.stroke();
    }
    for(var gy2=sy;gy2<=ey;gy2++){
      if(gy2%10!==0) continue;
      var py3=oy+(gy2-sy)*cell+0.5;
      ctx.beginPath(); ctx.moveTo(ox,py3); ctx.lineTo(ox+(ex-sx)*cell,py3); ctx.stroke();
    }
  }
  // 중앙 표시
  var midx=pat.w/2, midy=pat.h/2;
  ctx.fillStyle='rgba(20,25,24,0.55)';
  if(midx>=sx&&midx<=ex){
    var cxp=ox+(midx-sx)*cell;
    tri(ctx,cxp,oy-1,5,'down'); tri(ctx,cxp,oy+(ey-sy)*cell+1,5,'up');
  }
  if(midy>=sy&&midy<=ey){
    var cyp=oy+(midy-sy)*cell;
    tri(ctx,ox-1,cyp,5,'right'); tri(ctx,ox+(ex-sx)*cell+1,cyp,5,'left');
  }
  // 백스티치
  pat.backs.forEach(function(b){
    var x1=b[0]/2,y1=b[1]/2,x2=b[2]/2,y2=b[3]/2,pidx=b[4];
    if(Math.max(x1,x2)<sx||Math.min(x1,x2)>ex||Math.max(y1,y2)<sy||Math.min(y1,y2)>ey) return;
    var code = pat.palette[pidx]?pat.palette[pidx].code:null;
    var d=code?DMC_BY_CODE[code]:null;
    var rgb=d?d.rgb:{r:20,g:20,b:20};
    var dim = highlightIdx!=null && pidx!==highlightIdx;
    ctx.strokeStyle = dim?'rgba(20,20,20,0.2)':rgbToHex(rgb.r,rgb.g,rgb.b);
    ctx.lineWidth=Math.max(1.4,cell*0.13);
    ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(ox+(x1-sx)*cell, oy+(y1-sy)*cell);
    ctx.lineTo(ox+(x2-sx)*cell, oy+(y2-sy)*cell);
    ctx.stroke();
  });
  // 프렌치 노트
  pat.knots.forEach(function(k){
    var x=k[0]/2,y=k[1]/2,pidx=k[2];
    if(x<sx||x>ex||y<sy||y>ey) return;
    var code = pat.palette[pidx]?pat.palette[pidx].code:null;
    var d=code?DMC_BY_CODE[code]:null;
    var rgb=d?d.rgb:{r:20,g:20,b:20};
    var dim = highlightIdx!=null && pidx!==highlightIdx;
    ctx.fillStyle = dim?'rgba(20,20,20,0.2)':rgbToHex(rgb.r,rgb.g,rgb.b);
    ctx.beginPath();
    ctx.arc(ox+(x-sx)*cell, oy+(y-sy)*cell, Math.max(1.6,cell*0.22), 0, Math.PI*2);
    ctx.fill();
  });
  ctx.restore();
}
function tri(ctx,x,y,s,dir){
  ctx.beginPath();
  if(dir==='down'){ ctx.moveTo(x-s,y-s*1.6); ctx.lineTo(x+s,y-s*1.6); ctx.lineTo(x,y); }
  else if(dir==='up'){ ctx.moveTo(x-s,y+s*1.6); ctx.lineTo(x+s,y+s*1.6); ctx.lineTo(x,y); }
  else if(dir==='right'){ ctx.moveTo(x-s*1.6,y-s); ctx.lineTo(x-s*1.6,y+s); ctx.lineTo(x,y); }
  else { ctx.moveTo(x+s*1.6,y-s); ctx.lineTo(x+s*1.6,y+s); ctx.lineTo(x,y); }
  ctx.closePath(); ctx.fill();
}
var CORNER_XY = [ [0,0],[1,0],[1,1],[0,1] ]; // TL,TR,BR,BL
function cornerTriPath(ctx,px,py,cell,k,opposite){
  var pts = [[px,py],[px+cell,py],[px+cell,py+cell],[px,py+cell]];
  var c = CORNER_XY[k];
  var cx=px+c[0]*cell, cy=py+c[1]*cell;
  var n1 = pts[(k+3)%4], n2 = pts[(k+1)%4];
  ctx.beginPath();
  if(!opposite){
    ctx.moveTo(cx,cy); ctx.lineTo((cx+n1[0])/2,(cy+n1[1])/2); ctx.lineTo(px+cell/2,py+cell/2); ctx.lineTo((cx+n2[0])/2,(cy+n2[1])/2);
  } else {
    // 3/4 : 전체에서 반대 코너 삼각형 제외
    var order=[0,1,2,3].filter(function(kk){return kk!==((k+2)%4);});
    ctx.moveTo(pts[order[0]][0],pts[order[0]][1]);
    order.forEach(function(kk,i2){ if(i2) ctx.lineTo(pts[kk][0],pts[kk][1]); });
  }
  ctx.closePath();
}
function drawStitch(ctx, px, py, cell, type, rgb, sym, mode, alpha){
  var hex = rgbToHex(rgb.r,rgb.g,rgb.b);
  var showColor = mode==='color'||mode==='both';
  var showSym = mode==='symbol'||mode==='both';
  var partial = type>=4; // quarter or three-quarter
  ctx.globalAlpha = (partial && showSym && !showColor) ? 1 : alpha;
  if(type===1){
    if(showColor){ ctx.fillStyle=hex; ctx.fillRect(px,py,cell,cell); }
  } else if(type===2||type===3){
    if(showColor){
      ctx.fillStyle=hex; ctx.beginPath();
      if(type===2){ ctx.moveTo(px,py+cell); ctx.lineTo(px+cell,py); ctx.lineTo(px+cell,py+cell); }
      else { ctx.moveTo(px,py); ctx.lineTo(px+cell,py); ctx.lineTo(px,py+cell); }
      ctx.closePath(); ctx.fill();
    }
  } else if(type>=4 && type<=7){
    var k=type-4;
    if(showColor){
      ctx.globalAlpha = alpha*(showSym?1:1);
      ctx.fillStyle=hex; cornerTriPath(ctx,px,py,cell,k,false); ctx.fill();
    }
  } else if(type>=8 && type<=11){
    var k2=type-8;
    if(showColor){
      ctx.fillStyle=hex; cornerTriPath(ctx,px,py,cell,k2,true); ctx.fill();
    }
  }
  ctx.globalAlpha=1;
  if(showSym && cell>=9){
    var fg = showColor ? contrastSymbolColor(rgb.r,rgb.g,rgb.b) : '#20262A';
    if(!showColor){
      // 기호 전용 모드: 배경 살짝 표시 안함, 기호만 검정 계열
      fg = '#20262A';
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle=fg;
    ctx.font=(Math.max(8,cell*0.62))+'px var(--font),sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    var scale = (type>=4) ? 0.62 : 1;
    var ox2 = px+cell/2, oy2=py+cell/2;
    if(type>=4){
      var kk=(type>=8)?type-8:type-4;
      var c=CORNER_XY[kk];
      ox2 = px+cell*(0.5+ (c[0]-0.5)*0.5);
      oy2 = py+cell*(0.5+ (c[1]-0.5)*0.5);
    }
    ctx.save();
    ctx.translate(ox2,oy2); ctx.scale(scale,scale);
    ctx.fillText(sym, 0, 1);
    ctx.restore();
    ctx.globalAlpha=1;
  }
}

/* ============================================================
   에디터: 캔버스 드로잉 (뷰포트)
   ============================================================ */
var RULER = 26;
function drawEditor(){
  if(!S.pat) return;
  var cv = $('#cv'), wrap=$('#canvas-wrap');
  var dpr = window.devicePixelRatio||1;
  var cw = wrap.clientWidth, ch = wrap.clientHeight;
  if(cv.width !== Math.round(cw*dpr) || cv.height !== Math.round(ch*dpr)){
    cv.width = Math.round(cw*dpr); cv.height = Math.round(ch*dpr);
  }
  var ctx = cv.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cw,ch);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--canvas-out')||'#DDE3DF';
  ctx.fillRect(0,0,cw,ch);

  var cell = S.zoom;
  var ox = S.pan.x+RULER, oy = S.pan.y+RULER;
  var pat = S.pat;
  var sx = clamp(Math.floor((0-ox)/cell),0,pat.w), sy=clamp(Math.floor((0-oy)/cell),0,pat.h);
  var ex = clamp(Math.ceil((cw-ox)/cell),0,pat.w), ey=clamp(Math.ceil((ch-oy)/cell),0,pat.h);
  if(ex<=sx) ex=Math.min(pat.w,sx+1);
  if(ey<=sy) ey=Math.min(pat.h,sy+1);

  // 원단 바깥 영역 표시(사각 바탕)
  ctx.fillStyle='#fff';
  ctx.fillRect(ox, oy, pat.w*cell, pat.h*cell);

  var highlightIdx = S.onlySelected && S.curPaletteIdx>=0 ? S.curPaletteIdx : null;
  renderRegion(ctx, pat, { sx:sx, sy:sy, ex:ex, ey:ey, cell:cell, ox:ox+sx*cell, oy:oy+sy*cell, mode:S.view.colorSym, grid:true, done:S.showDone, highlightIdx:highlightIdx, fabric:false });

  if(S.showRunCount && cell>=18){
    drawRunCounts(ctx, pat, sx, sy, ex, ey, ox+sx*cell, oy+sy*cell, cell);
  }

  // 눈금자
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface')||'#fff';
  ctx.fillRect(0,0,cw,oy);
  ctx.fillRect(0,0,ox,ch);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted')||'#666';
  ctx.font='10px var(--mono),monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  for(var gx=sx;gx<=ex;gx++){
    if(gx%10!==0) continue;
    var px=ox+(gx-sx)*cell;
    ctx.fillText(String(gx), px, oy-10);
  }
  ctx.textAlign='right';
  for(var gy=sy;gy<=ey;gy++){
    if(gy%10!==0) continue;
    var py=oy+(gy-sy)*cell;
    ctx.fillText(String(gy), ox-8, py);
  }

  // 호버 칸
  if(S.hover && S.hover.x>=0 && S.hover.x<pat.w && S.hover.y>=0 && S.hover.y<pat.h){
    ctx.strokeStyle='var(--accent)'.indexOf('var')>=0?'#0D6663':'#0D6663';
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent')||'#0D6663';
    ctx.lineWidth=2;
    ctx.strokeRect(ox+(S.hover.x-sx)*cell+1, oy+(S.hover.y-sy)*cell+1, cell-2, cell-2);
  }
  // 선택 영역
  if(S.selection){
    var sel=S.selection;
    var x0=Math.min(sel.x0,sel.x1), x1=Math.max(sel.x0,sel.x1)+1;
    var y0=Math.min(sel.y0,sel.y1), y1=Math.max(sel.y0,sel.y1)+1;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent')||'#0D6663';
    ctx.setLineDash([5,4]); ctx.lineWidth=1.5;
    ctx.strokeRect(ox+(x0-sx)*cell, oy+(y0-sy)*cell, (x1-x0)*cell, (y1-y0)*cell);
    ctx.setLineDash([]);
  }
  // 붙여넣기 미리보기
  if(S.pastePreview && S.hover){
    drawPastePreview(ctx, ox, oy, sx, sy, cell);
  }
  // 백스티치 미리보기선
  if(S.backPreview){
    var bp=S.backPreview;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent')||'#0D6663';
    ctx.lineWidth=Math.max(1.4,cell*0.13); ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(ox+(bp.x1-sx)*cell, oy+(bp.y1-sy)*cell);
    ctx.lineTo(ox+(bp.x2-sx)*cell, oy+(bp.y2-sy)*cell);
    ctx.stroke();
  }
  S._view = {ox:ox,oy:oy,sx:sx,sy:sy,ex:ex,ey:ey,cell:cell};
}
function drawPastePreview(ctx, ox, oy, sx, sy, cell){
  var clip = S.clipboard; if(!clip) return;
  var bx = S.hover.x, by = S.hover.y;
  ctx.globalAlpha=0.6;
  for(var y=0;y<clip.h;y++){
    for(var x=0;x<clip.w;x++){
      var idx = clip.cells[y*clip.w+x], type=clip.types[y*clip.w+x];
      if(type===0||idx<0) continue;
      var code = clip.palette[idx];
      var d = DMC_BY_CODE[code];
      var rgb = d?d.rgb:{r:150,g:150,b:150};
      var px = ox+(bx+x-sx)*cell, py = oy+(by+y-sy)*cell;
      drawStitch(ctx, px, py, cell, type, rgb, '?', S.view.colorSym, 1);
    }
  }
  ctx.globalAlpha=1;
}
// 한 줄(가로)에 같은 색·같은 스티치 종류가 RUN_COUNT_THRESHOLD칸 이상 이어지면
// 그 구간 가운데 칸에 개수를 표시 — 세다가 헷갈리는 것 방지용 보조 표시.
var RUN_COUNT_THRESHOLD = 5;
function drawRunCounts(ctx, pat, sx, sy, ex, ey, ox, oy, cell){
  // 가운데 하나에 총 개수 대신, 구간 안 칸마다 몇 번째인지(1,2,3...) 작게 표시
  // — 실제로 세면서 스티치할 때 "지금 몇 번째"를 바로 알 수 있게.
  var w = pat.w;
  ctx.save();
  ctx.font = '700 '+Math.max(7,Math.round(cell*0.3))+'px var(--mono),monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  for(var y=sy; y<ey; y++){
    var x=sx;
    while(x<ex){
      var i=y*w+x;
      if(pat.types[i]===0 || pat.cells[i]<0){ x++; continue; }
      var startX=x, idx0=pat.cells[i], t0=pat.types[i];
      var runEnd=x+1;
      while(runEnd<w && pat.cells[y*w+runEnd]===idx0 && pat.types[y*w+runEnd]===t0){ runEnd++; }
      var runLen=runEnd-startX;
      if(runLen>=RUN_COUNT_THRESHOLD){
        for(var xi=startX; xi<runEnd; xi++){
          if(xi<sx || xi>=ex) continue;
          var label=String(xi-startX+1);
          var px=ox+(xi-sx)*cell+cell*0.24, py=oy+(y-sy)*cell+cell*0.24;
          var tw=ctx.measureText(label).width;
          ctx.fillStyle='rgba(255,255,255,0.85)';
          ctx.fillRect(px-tw/2-2, py-cell*0.18, tw+4, cell*0.36);
          ctx.fillStyle='#161616';
          ctx.fillText(label, px, py+1);
        }
      }
      x=runEnd;
    }
  }
  ctx.restore();
}

/* ============================================================
   화면좌표 <-> 셀좌표
   ============================================================ */
function cellFromEvent(e){
  var v = S._view; if(!v) return null;
  var rect = $('#cv').getBoundingClientRect();
  var px = e.clientX-rect.left, py=e.clientY-rect.top;
  var x = Math.floor((px-v.ox)/v.cell)+0, y=Math.floor((py-v.oy)/v.cell);
  return {x:x, y:y, halfx: (px-v.ox)/v.cell, halfy:(py-v.oy)/v.cell};
}
function nearestGridPoint(hx, hy){
  return { x: clamp(Math.round(hx),0,S.pat.w)*2, y: clamp(Math.round(hy),0,S.pat.h)*2 };
}
function nearestHalfPoint(hx,hy){
  // 격자점 또는 셀 중앙 스냅 (반칸 단위 좌표)
  var gx = Math.round(hx*2), gy = Math.round(hy*2);
  return { x: clamp(gx,0,S.pat.w*2), y: clamp(gy,0,S.pat.h*2) };
}
function cornerFromHalf(hx,hy){
  var fx = hx-Math.floor(hx), fy = hy-Math.floor(hy);
  if(fx<0.5 && fy<0.5) return 0;
  if(fx>=0.5 && fy<0.5) return 1;
  if(fx>=0.5 && fy>=0.5) return 2;
  return 3;
}

/* ============================================================
   스티치 적용
   ============================================================ */
function ensurePaletteIdx(){
  if(S.curPaletteIdx<0 || S.curPaletteIdx>=S.pat.palette.length){
    if(S.pat.palette.length===0){ toast('먼저 실을 추가하세요'); return -1; }
    S.curPaletteIdx=0;
  }
  return S.curPaletteIdx;
}
function pushRecentColor(idx){
  if(idx==null || idx<0) return;
  S.recentColors = [idx].concat(S.recentColors.filter(function(i){ return i!==idx; })).slice(0,6);
}
// 실 선택(패널 목록/툴바 최근색/색 선택 팝업/스포이드에서 공통으로 사용)
function selectPaletteIdx(idx){
  S.curPaletteIdx = idx;
  pushRecentColor(idx);
  setTool(S.tool==='eye'?S.prevTool:S.tool);
  buildToolbar(); buildPanel();
}
function mirroredCells(x,y){
  var out=[{x:x,y:y}];
  var w=S.pat.w,h=S.pat.h;
  if(S.symH) out.push({x:w-1-x,y:y});
  if(S.symV) out.push({x:x,y:h-1-y});
  if(S.symH&&S.symV) out.push({x:w-1-x,y:h-1-y});
  return dedupe(out);
}
function dedupe(list){
  var seen={}, out=[];
  list.forEach(function(p){ var k=p.x+'_'+p.y; if(!seen[k]){seen[k]=1;out.push(p);} });
  return out;
}
function mirrorType(type, hFlip, vFlip){
  if(type===2||type===3){
    if(hFlip!==vFlip) return type===2?3:2; // 한쪽만 뒤집으면 방향 반전, 둘 다면 원위치
    return type;
  }
  if(type>=4 && type<=7){
    var k=type-4;
    if(hFlip) k=MIRROR_H_CORNER[k];
    if(vFlip) k=MIRROR_V_CORNER[k];
    return 4+k;
  }
  if(type>=8 && type<=11){
    var k2=type-8;
    if(hFlip) k2=MIRROR_H_CORNER[k2];
    if(vFlip) k2=MIRROR_V_CORNER[k2];
    return 8+k2;
  }
  return type;
}
// 지금 도구·색으로 클릭했을 때 이 칸이 "완전히 똑같은" 결과가 될지 확인.
// 그렇다면 (전체 스트로크 동안) 다시 그리는 대신 지운다 — 실수로 옆칸을
// 칠했을 때 지우개로 안 바꾸고 같은 도구로 한 번 더 눌러서 바로 취소하기 위함.
function stitchTargetMatches(c){
  if(!S.pat || c.x<0||c.y<0||c.x>=S.pat.w||c.y>=S.pat.h) return false;
  var pIdx = S.curPaletteIdx;
  if(pIdx<0 || pIdx>=S.pat.palette.length) return false;
  var i=c.y*S.pat.w+c.x;
  if(S.pat.cells[i]!==pIdx) return false;
  var finalType;
  if(S.tool==='full') finalType=1;
  else if(S.tool==='half') finalType = S.halfDir==='/'?2:3;
  else if(S.tool==='quarter') finalType = 4+cornerFromHalf(c.halfx,c.halfy);
  else if(S.tool==='three') finalType = 8+cornerFromHalf(c.halfx,c.halfy);
  else return false;
  return S.pat.types[i]===finalType;
}
function setStitch(x,y,type,corner){
  if(x<0||y<0||x>=S.pat.w||y>=S.pat.h) return;
  var pIdx = ensurePaletteIdx(); if(pIdx<0) return;
  var finalType = type;
  if(type>=4){
    finalType = (type<8?4:8)+corner;
  }
  applyToCell(x,y,finalType,pIdx,type,corner);
}
function applyToCell(x,y,finalType,pIdx,baseType,corner){
  var w=S.pat.w,h=S.pat.h;
  var targets = mirroredCells(x,y);
  targets.forEach(function(t){
    var hFlip = t.x!==x, vFlip = t.y!==y;
    var ft = finalType;
    if(baseType>=4){
      var k=corner;
      if(hFlip) k=MIRROR_H_CORNER[k];
      if(vFlip) k=MIRROR_V_CORNER[k];
      ft = (baseType<8?4:8)+k;
    } else {
      ft = mirrorType(finalType, hFlip, vFlip);
    }
    var i=t.y*w+t.x;
    S.pat.cells[i]=pIdx; S.pat.types[i]=ft;
  });
}
function eraseStitch(x,y){
  if(x<0||y<0||x>=S.pat.w||y>=S.pat.h) return;
  var targets = mirroredCells(x,y);
  var w=S.pat.w;
  targets.forEach(function(t){
    var i=t.y*w+t.x;
    S.pat.cells[i]=-1; S.pat.types[i]=0; S.pat.done[i]=0;
  });
  // 근처 백스티치/노트 제거 (해당 셀에 인접한 반칸 좌표 범위)
  targets.forEach(function(t){
    var X0=t.x*2, Y0=t.y*2, X1=X0+2, Y1=Y0+2;
    S.pat.backs = S.pat.backs.filter(function(b){
      return !(Math.min(b[0],b[2])>=X0-0.01 && Math.max(b[0],b[2])<=X1+0.01 && Math.min(b[1],b[3])>=Y0-0.01 && Math.max(b[1],b[3])<=Y1+0.01);
    });
    S.pat.knots = S.pat.knots.filter(function(k){
      return !(k[0]>=X0 && k[0]<=X1 && k[1]>=Y0 && k[1]<=Y1);
    });
  });
}
function toggleDoneAt(x,y,val){
  if(x<0||y<0||x>=S.pat.w||y>=S.pat.h) return;
  var w=S.pat.w, i=y*w+x;
  if(S.pat.types[i]===0) return;
  S.pat.done[i]=val;
}
function floodFillAt(x,y){
  if(x<0||y<0||x>=S.pat.w||y>=S.pat.h) return;
  var pIdx=ensurePaletteIdx(); if(pIdx<0) return;
  var w=S.pat.w,h=S.pat.h;
  var i0=y*w+x;
  var targetIdx=S.pat.cells[i0], targetType=S.pat.types[i0];
  if(targetIdx===pIdx && targetType===1) return;
  var stack=[[x,y]]; var visited=new Uint8Array(w*h);
  while(stack.length){
    var p=stack.pop(); var cx=p[0],cy=p[1];
    if(cx<0||cy<0||cx>=w||cy>=h) continue;
    var i=cy*w+cx;
    if(visited[i]) continue; visited[i]=1;
    if(S.pat.cells[i]!==targetIdx || S.pat.types[i]!==targetType) continue;
    S.pat.cells[i]=pIdx; S.pat.types[i]=1;
    stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
}
function eyedropAt(x,y){
  if(x<0||y<0||x>=S.pat.w||y>=S.pat.h) return;
  var i=y*S.pat.w+x;
  if(S.pat.types[i]!==0 && S.pat.cells[i]>=0){
    pushRecentColor(S.pat.cells[i]);
    S.curPaletteIdx = S.pat.cells[i];
    setTool(S.prevTool||'full');
    buildToolbar(); buildPanel();
  }
}
function addBackstitchSeg(x1,y1,x2,y2){
  var pIdx=ensurePaletteIdx(); if(pIdx<0) return;
  if(x1===x2&&y1===y2) return;
  var w2=S.pat.w*2,h2=S.pat.h*2;
  // 완전히 같은 선분을 같은 색으로 또 그으면 지움(토글), 다른 색이면 색만 바꿈
  function place(X1,Y1,X2,Y2){
    var idx = S.pat.backs.findIndex(function(b){ return (b[0]===X1&&b[1]===Y1&&b[2]===X2&&b[3]===Y2)||(b[0]===X2&&b[1]===Y2&&b[2]===X1&&b[3]===Y1); });
    if(idx<0){ S.pat.backs.push([X1,Y1,X2,Y2,pIdx]); }
    else if(S.pat.backs[idx][4]===pIdx){ S.pat.backs.splice(idx,1); }
    else { S.pat.backs[idx][4]=pIdx; }
  }
  place(x1,y1,x2,y2);
  if(S.symH){ place(w2-x1,y1,w2-x2,y2); }
  if(S.symV){ place(x1,h2-y1,x2,h2-y2); }
  if(S.symH&&S.symV){ place(w2-x1,h2-y1,w2-x2,h2-y2); }
}
function eraseBackAt(hx,hy){
  var pt = nearestHalfPoint(hx,hy);
  var THRESH = 0.5;
  var v=S._view;
  S.pat.backs = S.pat.backs.filter(function(b){
    var d = distToSeg(pt.x,pt.y,b[0],b[1],b[2],b[3]);
    return d>THRESH;
  });
}
function distToSeg(px,py,x1,y1,x2,y2){
  var dx=x2-x1, dy=y2-y1;
  var len2=dx*dx+dy*dy;
  var t = len2? clamp(((px-x1)*dx+(py-y1)*dy)/len2,0,1) : 0;
  var cx=x1+t*dx, cy=y1+t*dy;
  return Math.hypot(px-cx,py-cy);
}
function addKnot(x,y){
  var pIdx=ensurePaletteIdx(); if(pIdx<0) return;
  var pt = nearestHalfPoint(x,y);
  var w2=S.pat.w*2,h2=S.pat.h*2;
  // 같은 자리에 같은 색으로 또 찍으면 지움(토글), 다른 색이면 색만 바꿈
  function place(X,Y){
    var idx = S.pat.knots.findIndex(function(k){ return k[0]===X && k[1]===Y; });
    if(idx<0){ S.pat.knots.push([X,Y,pIdx]); }
    else if(S.pat.knots[idx][2]===pIdx){ S.pat.knots.splice(idx,1); }
    else { S.pat.knots[idx][2]=pIdx; }
  }
  place(pt.x,pt.y);
  if(S.symH) place(w2-pt.x,pt.y);
  if(S.symV) place(pt.x,h2-pt.y);
  if(S.symH&&S.symV) place(w2-pt.x,h2-pt.y);
}

/* ============================================================
   선택 / 클립보드
   ============================================================ */
function selectionRect(){
  if(!S.selection) return null;
  var sel=S.selection;
  return { x0:Math.min(sel.x0,sel.x1), y0:Math.min(sel.y0,sel.y1), x1:Math.max(sel.x0,sel.x1), y1:Math.max(sel.y0,sel.y1) };
}
function copySelection(cut){
  var r=selectionRect(); if(!r) return;
  var w=r.x1-r.x0+1, h=r.y1-r.y0+1;
  var cells=new Int16Array(w*h).fill(-1), types=new Uint8Array(w*h);
  var backs=[], knots=[]; var paletteCodes=[];
  function codeIdx(code){
    var i=paletteCodes.indexOf(code);
    if(i<0){ paletteCodes.push(code); i=paletteCodes.length-1; }
    return i;
  }
  for(var y=r.y0;y<=r.y1;y++){
    for(var x=r.x0;x<=r.x1;x++){
      var i=y*S.pat.w+x, oi=(y-r.y0)*w+(x-r.x0);
      if(S.pat.types[i]!==0 && S.pat.cells[i]>=0){
        var code = S.pat.palette[S.pat.cells[i]].code;
        cells[oi]=codeIdx(code); types[oi]=S.pat.types[i];
      }
    }
  }
  S.pat.backs.forEach(function(b){
    var x1=b[0]/2,y1=b[1]/2,x2=b[2]/2,y2=b[3]/2;
    if(x1>=r.x0&&x1<=r.x1+1&&x2>=r.x0&&x2<=r.x1+1&&y1>=r.y0&&y1<=r.y1+1&&y2>=r.y0&&y2<=r.y1+1){
      var code=S.pat.palette[b[4]].code;
      backs.push([(x1-r.x0)*2,(y1-r.y0)*2,(x2-r.x0)*2,(y2-r.y0)*2, codeIdx(code)]);
    }
  });
  S.pat.knots.forEach(function(k){
    var x=k[0]/2,y=k[1]/2;
    if(x>=r.x0&&x<=r.x1+1&&y>=r.y0&&y<=r.y1+1){
      var code=S.pat.palette[k[2]].code;
      knots.push([(x-r.x0)*2,(y-r.y0)*2, codeIdx(code)]);
    }
  });
  S.clipboard = { w:w,h:h,cells:cells,types:types,backs:backs,knots:knots,palette:paletteCodes };
  if(cut){ pushHistory(); clearRegion(r); markDirty(); drawEditor(); }
  toast(cut?'잘라냈어요':'복사했어요');
}
function clearRegion(r){
  for(var y=r.y0;y<=r.y1;y++){
    for(var x=r.x0;x<=r.x1;x++){
      var i=y*S.pat.w+x;
      S.pat.cells[i]=-1; S.pat.types[i]=0; S.pat.done[i]=0;
    }
  }
  var X0=r.x0*2,Y0=r.y0*2,X1=(r.x1+1)*2,Y1=(r.y1+1)*2;
  S.pat.backs = S.pat.backs.filter(function(b){
    return !(Math.min(b[0],b[2])>=X0 && Math.max(b[0],b[2])<=X1 && Math.min(b[1],b[3])>=Y0 && Math.max(b[1],b[3])<=Y1);
  });
  S.pat.knots = S.pat.knots.filter(function(k){
    return !(k[0]>=X0&&k[0]<=X1&&k[1]>=Y0&&k[1]<=Y1);
  });
}
function pasteAt(bx,by){
  var clip=S.clipboard; if(!clip) return;
  pushHistory();
  var map={};
  clip.palette.forEach(function(code){
    var idx = S.pat.palette.findIndex(function(p){return p.code===code;});
    if(idx<0){
      var d=DMC_BY_CODE[code];
      var sym = pickFreeSymbol();
      S.pat.palette.push({code:code, sym:sym}); idx=S.pat.palette.length-1;
    }
    map[code]=idx;
  });
  for(var y=0;y<clip.h;y++){
    for(var x=0;x<clip.w;x++){
      var oi=y*clip.w+x, type=clip.types[oi], ci=clip.cells[oi];
      if(type===0||ci<0) continue;
      var tx=bx+x, ty=by+y;
      if(tx<0||ty<0||tx>=S.pat.w||ty>=S.pat.h) continue;
      var i=ty*S.pat.w+tx;
      S.pat.cells[i]=map[clip.palette[ci]]; S.pat.types[i]=type;
    }
  }
  clip.backs.forEach(function(b){
    var X1=b[0]+bx*2,Y1=b[1]+by*2,X2=b[2]+bx*2,Y2=b[3]+by*2;
    S.pat.backs.push([X1,Y1,X2,Y2, map[clip.palette[b[4]]]]);
  });
  clip.knots.forEach(function(k){
    S.pat.knots.push([k[0]+bx*2, k[1]+by*2, map[clip.palette[k[2]]]]);
  });
  markDirty(); drawEditor(); buildPanel();
}
function flipSelection(horizontal){
  var r=selectionRect(); if(!r) return;
  pushHistory();
  var w=r.x1-r.x0+1, h=r.y1-r.y0+1;
  var newCells=new Int16Array(w*h).fill(-1), newTypes=new Uint8Array(w*h), newDone=new Uint8Array(w*h);
  for(var y=0;y<h;y++){
    for(var x=0;x<w;x++){
      var sx = horizontal? (w-1-x) : x, sy = horizontal? y : (h-1-y);
      var si=(r.y0+sy)*S.pat.w+(r.x0+sx);
      var di=y*w+x;
      newCells[di]=S.pat.cells[si];
      var t=S.pat.types[si];
      if(horizontal) t=mirrorType(t,true,false); else t=mirrorType(t,false,true);
      newTypes[di]=t; newDone[di]=S.pat.done[si];
    }
  }
  for(var y2=0;y2<h;y2++) for(var x2=0;x2<w;x2++){
    var di2=(r.y0+y2)*S.pat.w+(r.x0+x2);
    S.pat.cells[di2]=newCells[y2*w+x2]; S.pat.types[di2]=newTypes[y2*w+x2]; S.pat.done[di2]=newDone[y2*w+x2];
  }
  var X0=r.x0*2,Y0=r.y0*2,X1=(r.x1+1)*2,Y1=(r.y1+1)*2;
  S.pat.backs.forEach(function(b){
    if(!(Math.min(b[0],b[2])>=X0&&Math.max(b[0],b[2])<=X1&&Math.min(b[1],b[3])>=Y0&&Math.max(b[1],b[3])<=Y1)) return;
    if(horizontal){ b[0]=X0+(X1-b[0]); b[2]=X0+(X1-b[2]); } else { b[1]=Y0+(Y1-b[1]); b[3]=Y0+(Y1-b[3]); }
  });
  S.pat.knots.forEach(function(k){
    if(!(k[0]>=X0&&k[0]<=X1&&k[1]>=Y0&&k[1]<=Y1)) return;
    if(horizontal){ k[0]=X0+(X1-k[0]); } else { k[1]=Y0+(Y1-k[1]); }
  });
  markDirty(); drawEditor();
}
function clearSelectionRegion(){
  var r=selectionRect(); if(!r) return;
  pushHistory(); clearRegion(r); markDirty(); drawEditor();
}
function cropToSelection(){
  var r=selectionRect(); if(!r) return;
  pushHistory();
  var w=r.x1-r.x0+1, h=r.y1-r.y0+1;
  var newCells=new Int16Array(w*h).fill(-1), newTypes=new Uint8Array(w*h), newDone=new Uint8Array(w*h);
  for(var y=0;y<h;y++) for(var x=0;x<w;x++){
    var si=(r.y0+y)*S.pat.w+(r.x0+x), di=y*w+x;
    newCells[di]=S.pat.cells[si]; newTypes[di]=S.pat.types[si]; newDone[di]=S.pat.done[si];
  }
  var X0=r.x0*2,Y0=r.y0*2;
  var newBacks=S.pat.backs.filter(function(b){
    return Math.min(b[0],b[2])>=X0 && Math.max(b[0],b[2])<=X0+w*2 && Math.min(b[1],b[3])>=Y0 && Math.max(b[1],b[3])<=Y0+h*2;
  }).map(function(b){ return [b[0]-X0,b[1]-Y0,b[2]-X0,b[3]-Y0,b[4]]; });
  var newKnots=S.pat.knots.filter(function(k){
    return k[0]>=X0&&k[0]<=X0+w*2&&k[1]>=Y0&&k[1]<=Y0+h*2;
  }).map(function(k){ return [k[0]-X0,k[1]-Y0,k[2]]; });
  S.pat.w=w; S.pat.h=h; S.pat.cells=newCells; S.pat.types=newTypes; S.pat.done=newDone;
  S.pat.backs=newBacks; S.pat.knots=newKnots;
  S.selection=null;
  markDirty(); drawEditor(); buildPanel();
}

/* ============================================================
   캔버스 크기 변경
   ============================================================ */
function resizeCanvasModal(){
  var locked = false;
  var ratio = S.pat.w / S.pat.h;
  openModal({
    title:'캔버스 크기 변경',
    bodyHTML:
      '<div class="stack">'+
      '<div style="display:flex;gap:8px;align-items:flex-end">'+
        '<label class="field" style="flex:1"><span>가로</span><input id="rs-w" type="number" min="4" max="'+MAX_DIM+'" value="'+S.pat.w+'"></label>'+
        '<button type="button" class="icon-btn" id="rs-lock" title="가로세로 비율 고정">'+iconLinkOff()+'</button>'+
        '<label class="field" style="flex:1"><span>세로</span><input id="rs-h" type="number" min="4" max="'+MAX_DIM+'" value="'+S.pat.h+'"></label>'+
      '</div>'+
      '<label class="field"><span>기준점</span><select id="rs-anchor"><option value="tl">좌상단</option><option value="c">가운데</option></select></label>'+
      '</div>',
    footerHTML: '<button class="btn ghost" id="rs-cancel">취소</button><button class="btn primary" id="rs-ok">적용</button>'
  });
  var modal=$('#modal-root .modal');
  var wInput=$('#rs-w',modal), hInput=$('#rs-h',modal), lockBtn=$('#rs-lock',modal);
  lockBtn.onclick=function(){
    locked=!locked;
    if(locked) ratio = (parseInt(wInput.value,10)||S.pat.w) / (parseInt(hInput.value,10)||S.pat.h);
    lockBtn.classList.toggle('on', locked);
    lockBtn.innerHTML = locked ? iconLinkOn() : iconLinkOff();
  };
  wInput.oninput=function(){
    if(!locked) return;
    var w=parseInt(wInput.value,10); if(!w) return;
    hInput.value = clamp(Math.round(w/ratio),4,MAX_DIM);
  };
  hInput.oninput=function(){
    if(!locked) return;
    var h=parseInt(hInput.value,10); if(!h) return;
    wInput.value = clamp(Math.round(h*ratio),4,MAX_DIM);
  };
  $('#rs-cancel',modal).onclick=closeModal;
  $('#rs-ok',modal).onclick=function(){
    var nw=clamp(parseInt(wInput.value,10)||S.pat.w,4,MAX_DIM);
    var nh=clamp(parseInt(hInput.value,10)||S.pat.h,4,MAX_DIM);
    var anchor=$('#rs-anchor',modal).value;
    closeModal();
    doResizeCanvas(nw,nh,anchor);
  };
}
function doResizeCanvas(nw,nh,anchor){
  pushHistory();
  var ow=S.pat.w, oh=S.pat.h;
  var offx = anchor==='c' ? Math.floor((nw-ow)/2) : 0;
  var offy = anchor==='c' ? Math.floor((nh-oh)/2) : 0;
  var cells=new Int16Array(nw*nh).fill(-1), types=new Uint8Array(nw*nh), done=new Uint8Array(nw*nh);
  for(var y=0;y<oh;y++){
    for(var x=0;x<ow;x++){
      var nx=x+offx, ny=y+offy;
      if(nx<0||ny<0||nx>=nw||ny>=nh) continue;
      var si=y*ow+x, di=ny*nw+nx;
      cells[di]=S.pat.cells[si]; types[di]=S.pat.types[si]; done[di]=S.pat.done[si];
    }
  }
  var backs=S.pat.backs.map(function(b){ return [b[0]+offx*2,b[1]+offy*2,b[2]+offx*2,b[3]+offy*2,b[4]]; })
    .filter(function(b){ return Math.min(b[0],b[2])>=0&&Math.max(b[0],b[2])<=nw*2&&Math.min(b[1],b[3])>=0&&Math.max(b[1],b[3])<=nh*2; });
  var knots=S.pat.knots.map(function(k){ return [k[0]+offx*2,k[1]+offy*2,k[2]]; })
    .filter(function(k){ return k[0]>=0&&k[0]<=nw*2&&k[1]>=0&&k[1]<=nh*2; });
  S.pat.w=nw; S.pat.h=nh; S.pat.cells=cells; S.pat.types=types; S.pat.done=done; S.pat.backs=backs; S.pat.knots=knots;
  markDirty(); centerCanvas(); drawEditor(); buildPanel(); updateCmSizeBadge();
}

/* ============================================================
   포인터 입력
   ============================================================ */
function setupPointerEvents(){
  var cv=$('#cv');
  var active = new Map();
  var drag = null;
  var pinchStart = null;
  var singleStrokeTimer = null;
  var spaceDown=false;

  window.addEventListener('keydown', function(e){
    if(e.code==='Space' && S.pat){ spaceDown=true; }
  });
  window.addEventListener('keyup', function(e){ if(e.code==='Space') spaceDown=false; });

  cv.addEventListener('pointerdown', function(e){
    cv.setPointerCapture(e.pointerId);
    active.set(e.pointerId, {x:e.clientX,y:e.clientY});
    if(active.size===2){
      var pts=Array.from(active.values());
      pinchStart = { dist: Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y), zoom:S.zoom, pan:{x:S.pan.x,y:S.pan.y},
        mid:{x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2} };
      drag=null; clearTimeout(singleStrokeTimer);
      return;
    }
    if(active.size>1) return;
    var mid = e.button===1 || spaceDown;
    if(mid){ drag={type:'pan', x:e.clientX,y:e.clientY, ox:S.pan.x, oy:S.pan.y}; return; }
    startTool(e);
  });
  cv.addEventListener('pointermove', function(e){
    if(active.has(e.pointerId)) active.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(active.size===2 && pinchStart){
      var pts=Array.from(active.values());
      var dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      var scale = dist/Math.max(1,pinchStart.dist);
      var nz = clamp(Math.round(pinchStart.zoom*scale),3,64);
      var mid={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
      var rect=cv.getBoundingClientRect();
      var focusX = pinchStart.mid.x-rect.left, focusY = pinchStart.mid.y-rect.top;
      S.pan.x = pinchStart.pan.x + (mid.x-pinchStart.mid.x) - (focusX)*(nz/pinchStart.zoom-1);
      S.pan.y = pinchStart.pan.y + (mid.y-pinchStart.mid.y) - (focusY)*(nz/pinchStart.zoom-1);
      S.zoom = nz;
      updateZoomLabel(); drawEditor();
      return;
    }
    var c = cellFromEvent(e);
    S.hover = c;
    if(drag && drag.type==='pan'){
      S.pan.x = drag.ox + (e.clientX-drag.x);
      S.pan.y = drag.oy + (e.clientY-drag.y);
      drawEditor(); return;
    }
    if(drag){ moveTool(e); }
    drawEditor();
  });
  function endPointer(e){
    active.delete(e.pointerId);
    if(active.size<2) pinchStart=null;
    if(active.size===0){
      if(drag && drag.type!=='pan') endTool(e);
      drag=null;
    }
  }
  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('pointercancel', endPointer);
  cv.addEventListener('pointerleave', function(){ S.hover=null; drawEditor(); });

  cv.addEventListener('wheel', function(e){
    e.preventDefault();
    var trackpadPan = !e.ctrlKey && Math.abs(e.deltaX)>0.5;
    if(!trackpadPan){
      var rect=cv.getBoundingClientRect();
      var fx=e.clientX-rect.left, fy=e.clientY-rect.top;
      var oz=S.zoom;
      var nz=clamp(Math.round(S.zoom*(e.deltaY<0?1.1:0.9)),3,64);
      S.pan.x -= (fx-S.pan.x)*(nz/oz-1);
      S.pan.y -= (fy-S.pan.y)*(nz/oz-1);
      S.zoom=nz; updateZoomLabel();
    } else {
      S.pan.x -= e.deltaX; S.pan.y -= e.deltaY;
    }
    drawEditor();
  }, {passive:false});

  function startTool(e){
    if(!S.pat) return;
    var c = cellFromEvent(e);
    if(S.pastePreview){
      pasteAt(c.x,c.y);
      S.pastePreview=false;
      drawEditor();
      return;
    }
    if(S.tool==='move'){ drag={type:'toolpan', x:e.clientX,y:e.clientY, ox:S.pan.x, oy:S.pan.y}; return; }
    if(S.tool==='select'){
      S.selection={x0:c.x,y0:c.y,x1:c.x,y1:c.y};
      drag={type:'select', last:c, startHalf:{x:c.halfx,y:c.halfy}};
      drawEditor();
      return;
    }
    pushHistory();
    var eraseMode = (S.tool==='full'||S.tool==='half'||S.tool==='quarter'||S.tool==='three') && stitchTargetMatches(c);
    drag={type:S.tool, last:c, startHalf:{x:c.halfx,y:c.halfy}, eraseMode:eraseMode};
    doToolAt(c, true);
    drawEditor();
  }
  function moveTool(e){
    if(drag.type==='toolpan'){ S.pan.x=drag.ox+(e.clientX-drag.x); S.pan.y=drag.oy+(e.clientY-drag.y); return; }
    var c = cellFromEvent(e);
    if(S.tool==='back'){
      S.backPreview = { x1:drag.startHalf.x, y1:drag.startHalf.y, x2:c.halfx, y2:c.halfy };
      return;
    }
    if(S.tool==='knot'){ return; }
    if(drag.last && (c.x!==drag.last.x||c.y!==drag.last.y)){
      bresenhamStroke(drag.last, c);
      drag.last=c;
    }
  }
  function endTool(e){
    if(drag.type==='back'){
      var c=cellFromEvent(e);
      var p1=nearestHalfPoint(drag.startHalf.x,drag.startHalf.y);
      var p2=nearestHalfPoint(c.halfx,c.halfy);
      addBackstitchSeg(p1.x,p1.y,p2.x,p2.y);
      S.backPreview = null;
      markDirty(); drawEditor();
    } else if(drag.type==='select'){
      // selection already updated live
    } else if(drag.type==='toolpan'){
      // 이동 도구: 저장할 변경 없음
    } else {
      markDirty();
    }
    drag=null;
    buildPanel();
  }
  function bresenhamStroke(a,b){
    var x0=a.x,y0=a.y,x1=b.x,y1=b.y;
    var dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0);
    var sx=x0<x1?1:-1, sy=y0<y1?1:-1;
    var err=dx+dy;
    while(true){
      doToolAt({x:x0,y:y0,halfx:x0,halfy:y0}, false);
      if(x0===x1&&y0===y1) break;
      var e2=2*err;
      if(e2>=dy){ err+=dy; x0+=sx; }
      if(e2<=dx){ err+=dx; y0+=sy; }
    }
  }
  function doToolAt(c, isStart){
    var eraseMode = drag && drag.eraseMode;
    switch(S.tool){
      case 'full': if(eraseMode) eraseStitch(c.x,c.y); else setStitch(c.x,c.y,1); break;
      case 'half': if(eraseMode) eraseStitch(c.x,c.y); else setStitch(c.x,c.y, S.halfDir==='/'?2:3); break;
      case 'quarter': { var k=cornerFromHalf(c.halfx,c.halfy); if(eraseMode) eraseStitch(c.x,c.y); else setStitch(c.x,c.y,4,k); break; }
      case 'three': { var k2=cornerFromHalf(c.halfx,c.halfy); if(eraseMode) eraseStitch(c.x,c.y); else setStitch(c.x,c.y,8,k2); break; }
      case 'erase': eraseStitch(c.x,c.y); eraseBackAt(c.halfx,c.halfy); break;
      case 'fill': if(isStart) floodFillAt(c.x,c.y); break;
      case 'eye': if(isStart) eyedropAt(c.x,c.y); break;
      case 'knot': if(isStart) addKnot(c.halfx,c.halfy); break;
      case 'done': if(isStart){ S._doneVal = S.pat.types[c.y*S.pat.w+c.x]!==0 ? (S.pat.done[c.y*S.pat.w+c.x]?0:1) : 1; }
        toggleDoneAt(c.x,c.y,S._doneVal); break;
      case 'select':
        if(isStart){ S.selection={x0:c.x,y0:c.y,x1:c.x,y1:c.y}; }
        else if(S.selection){ S.selection.x1=c.x; S.selection.y1=c.y; }
        break;
    }
  }
}
function updateZoomLabel(){ var el=$('#zoom-val'); if(el) el.textContent=Math.round(S.zoom/16*100)+'%'; }

/* ============================================================
   키보드 단축키
   ============================================================ */
document.addEventListener('keydown', function(e){
  if(!S.pat || app.classList.contains('mode-editor')===false) return;
  var tag=(e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='select'||tag==='textarea') {
    if(e.key==='Escape') e.target.blur();
    return;
  }
  var mod = e.ctrlKey||e.metaKey;
  if(mod && e.key.toLowerCase()==='z' && e.shiftKey){ e.preventDefault(); redo(); return; }
  if(mod && e.key.toLowerCase()==='z'){ e.preventDefault(); undo(); return; }
  if(mod && e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); return; }
  if(mod && e.key.toLowerCase()==='s'){ e.preventDefault(); flushSave(true); return; }
  if(mod && e.key.toLowerCase()==='c'){ if(S.selection){ copySelection(false); } return; }
  if(mod && e.key.toLowerCase()==='x'){ if(S.selection){ copySelection(true); } return; }
  if(mod && e.key.toLowerCase()==='v'){ if(S.clipboard){ S.pastePreview=true; drawEditor(); } return; }
  if(e.key==='Escape'){ S.selection=null; S.pastePreview=false; drawEditor(); return; }
  var found = TOOLS.find(function(t){ return t.key===e.key.toLowerCase(); });
  if(found){ setTool(found.id); return; }
});

/* ============================================================
   툴바 / 옵션바
   ============================================================ */
function setTool(id){
  if(id!==S.tool) S.prevTool=S.tool;
  S.tool=id;
  buildToolbar();
  var hint=$('#hint');
  var msgs={
    move:'드래그해서 캔버스를 움직여요', full:'클릭·드래그로 풀 스티치', half:'클릭·드래그로 하프 스티치',
    quarter:'칸 안 위치에 따라 모서리가 정해져요', three:'칸 안 위치에 따라 반대 모서리가 비어요',
    back:'드래그로 백스티치 선을 그어요', knot:'클릭해서 프렌치 노트', erase:'클릭·드래그로 지워요',
    fill:'클릭한 영역을 채워요', eye:'클릭해서 실을 선택해요', select:'드래그로 영역을 선택해요', done:'클릭해서 진행 체크'
  };
  hint.hidden=false; hint.textContent=msgs[id]||'';
  clearTimeout(setTool._t); setTool._t=setTimeout(function(){ hint.hidden=true; },2200);
}
function buildToolbar(){
  var tb=$('#toolbar');
  tb.innerHTML = TOOLS.map(function(t){
    return '<button class="tool'+(S.tool===t.id?' on':'')+'" data-tool="'+t.id+'" title="'+t.label+' ('+t.key.toUpperCase()+')">'+t.icon()+'</button>';
  }).join('') + '<div class="tool-sep"></div>';
  var swatch=document.createElement('div');
  swatch.className='cur-thread';
  var p = S.curPaletteIdx>=0 ? S.pat.palette[S.curPaletteIdx] : null;
  if(p){
    var d=DMC_BY_CODE[p.code];
    var rgb=d?d.rgb:{r:200,g:200,b:200};
    swatch.style.background=rgbToHex(rgb.r,rgb.g,rgb.b);
    swatch.style.color=contrastSymbolColor(rgb.r,rgb.g,rgb.b);
    swatch.textContent=p.sym;
  } else { swatch.style.background='var(--surface-2)'; swatch.textContent='–'; }
  tb.appendChild(swatch);

  // 최근 쓴 색 (현재색 제외, 최대 2개) — 클릭 한 번으로 바로 전환
  var recents = S.recentColors.filter(function(idx){ return idx!==S.curPaletteIdx && S.pat.palette[idx]; }).slice(0,2);
  recents.forEach(function(idx){
    var rp = S.pat.palette[idx];
    var rd = DMC_BY_CODE[rp.code];
    var rrgb = rd?rd.rgb:{r:200,g:200,b:200};
    var rsw = document.createElement('div');
    rsw.className='sw'; rsw.style.cursor='pointer'; rsw.style.margin='3px auto';
    rsw.title='DMC '+rp.code+(rd?(' '+rd.name):'');
    rsw.style.background=rgbToHex(rrgb.r,rrgb.g,rrgb.b);
    rsw.style.color=contrastSymbolColor(rrgb.r,rrgb.g,rrgb.b);
    rsw.textContent=rp.sym;
    rsw.onclick=function(){ selectPaletteIdx(idx); };
    tb.appendChild(rsw);
  });

  // 색 선택(실 추가 + 기존 실 목록) 버튼
  var pickBtn=document.createElement('button');
  pickBtn.className='tool'; pickBtn.title='실 선택';
  pickBtn.innerHTML=iconPalette();
  pickBtn.onclick=openQuickColorPicker;
  tb.appendChild(pickBtn);

  // 스포이드 (도구 목록의 스포이드와 동일 동작 — 색 선택 버튼 옆에도 바로 접근 가능하게)
  var eyeBtn=document.createElement('button');
  eyeBtn.className='tool'+(S.tool==='eye'?' on':''); eyeBtn.title='스포이드 (I)';
  eyeBtn.innerHTML=iconEye();
  eyeBtn.onclick=function(){ setTool('eye'); };
  tb.appendChild(eyeBtn);

  tb.onclick=function(e){
    var b=e.target.closest('[data-tool]'); if(!b) return;
    setTool(b.dataset.tool);
  };
}
function buildOptbar(){
  var ob=$('#optbar');
  ob.innerHTML =
    '<div class="seg" id="seg-view">'+
      seg('color','컬러')+seg('symbol','기호')+seg('both','컬러+기호')+
    '</div>'+
    '<div class="div"></div>'+
    (S.tool==='half'? ('<div class="seg" id="seg-half">'+segDir('/','/')+segDir('\\','\\')+'</div><div class="div"></div>') : '')+
    '<button class="chip'+(S.symH?' on':'')+'" id="chip-symh">↔ 좌우대칭</button>'+
    '<button class="chip'+(S.symV?' on':'')+'" id="chip-symv">↕ 상하대칭</button>'+
    '<button class="chip'+(S.onlySelected?' on':'')+'" id="chip-only">선택한 실만</button>'+
    '<button class="chip'+(S.showDone?' on':'')+'" id="chip-done">진행표시</button>'+
    '<button class="chip'+(S.showRunCount?' on':'')+'" id="chip-runcount" title="한 줄에 같은 스티치가 5개 이상 이어지면 개수를 표시">연속 칸수</button>'+
    '<button class="chip'+(S.showCmSize?' on':'')+'" id="chip-cmsize" title="캔버스 오른쪽 위에 완성 크기(cm) 표시">실측 크기</button>'+
    '<div class="div"></div>'+
    '<button class="icon-btn" id="zoom-out">−</button><span class="zoom-val" id="zoom-val">'+Math.round(S.zoom/16*100)+'%</span><button class="icon-btn" id="zoom-in">＋</button>'+
    '<button class="btn ghost sm" id="zoom-fit">맞춤</button>'+
    '<span class="only-mobile" style="flex:1"></span>'+
    '<button class="btn ghost sm only-mobile" id="btn-panel-toggle2">실·정보</button>';
  function seg(v,label){ return '<button data-view="'+v+'" class="'+(S.view.colorSym===v?'on':'')+'">'+label+'</button>'; }
  function segDir(v,label){ return '<button data-dir="'+v+'" class="'+(S.halfDir===v?'on':'')+'">'+label+'</button>'; }
  $('#seg-view',ob).onclick=function(e){ var b=e.target.closest('[data-view]'); if(!b) return; S.view.colorSym=b.dataset.view; buildOptbar(); drawEditor(); };
  var segHalf=$('#seg-half',ob); if(segHalf) segHalf.onclick=function(e){ var b=e.target.closest('[data-dir]'); if(!b) return; S.halfDir=b.dataset.dir; buildOptbar(); };
  $('#chip-symh',ob).onclick=function(){ S.symH=!S.symH; buildOptbar(); };
  $('#chip-symv',ob).onclick=function(){ S.symV=!S.symV; buildOptbar(); };
  $('#chip-only',ob).onclick=function(){ S.onlySelected=!S.onlySelected; buildOptbar(); drawEditor(); };
  $('#chip-done',ob).onclick=function(){ S.showDone=!S.showDone; buildOptbar(); drawEditor(); };
  $('#chip-runcount',ob).onclick=function(){ S.showRunCount=!S.showRunCount; buildOptbar(); drawEditor(); };
  $('#chip-cmsize',ob).onclick=function(){ S.showCmSize=!S.showCmSize; buildOptbar(); updateCmSizeBadge(); };
  $('#zoom-out',ob).onclick=function(){ zoomBy(0.85); };
  $('#zoom-in',ob).onclick=function(){ zoomBy(1.18); };
  $('#zoom-fit',ob).onclick=function(){ S.zoom=fitZoom(); centerCanvas(); updateZoomLabel(); drawEditor(); };
  var pt2=$('#btn-panel-toggle2',ob); if(pt2) pt2.onclick=togglePanel;
}
function zoomBy(f){
  var wrap=$('#canvas-wrap'), rect=wrap.getBoundingClientRect();
  var fx=rect.width/2, fy=rect.height/2;
  var oz=S.zoom, nz=clamp(Math.round(S.zoom*f),3,64);
  S.pan.x -= (fx-S.pan.x)*(nz/oz-1);
  S.pan.y -= (fy-S.pan.y)*(nz/oz-1);
  S.zoom=nz; updateZoomLabel(); drawEditor();
}
function togglePanel(){ $('#panel').classList.toggle('open'); }

/* ============================================================
   선택바 (selbar)
   ============================================================ */
function updateSelbar(){
  var bar=$('#selbar');
  if(!S.selection){ bar.hidden=true; bar.innerHTML=''; return; }
  bar.hidden=false;
  bar.innerHTML =
    btn('copy','복사')+btn('cut','잘라내기')+btn('paste','붙여넣기', !S.clipboard)+
    btn('fliph','좌우반전')+btn('flipv','상하반전')+btn('clear','지우기')+btn('crop','선택영역으로 자르기')+btn('deselect','해제');
  function btn(id,label,disabled){ return '<button class="btn sm ghost" data-act="'+id+'"'+(disabled?' disabled':'')+'>'+label+'</button>'; }
  bar.onclick=function(e){
    var b=e.target.closest('[data-act]'); if(!b) return;
    var act=b.dataset.act;
    if(act==='copy') copySelection(false);
    else if(act==='cut') copySelection(true);
    else if(act==='paste'){ var r=selectionRect(); pasteAt(r?r.x0:0, r?r.y0:0); }
    else if(act==='fliph') flipSelection(true);
    else if(act==='flipv') flipSelection(false);
    else if(act==='clear') clearSelectionRegion();
    else if(act==='crop') cropToSelection();
    else if(act==='deselect'){ S.selection=null; drawEditor(); updateSelbar(); }
    if(act!=='deselect') { drawEditor(); updateSelbar(); }
  };
}
// selection 변화를 draw 루프와 연동
var _origDrawEditor = drawEditor;
drawEditor = function(){ _origDrawEditor(); updateSelbar(); };

/* ============================================================
   패널: 실 목록 / DMC / 기호 / 도안 정보
   ============================================================ */
function pickFreeSymbol(){
  var used = new Set(S.pat.palette.map(function(p){return p.sym;}));
  for(var i=0;i<SYMBOLS.length;i++){ if(!used.has(SYMBOLS[i])) return SYMBOLS[i]; }
  return SYMBOLS[S.pat.palette.length % SYMBOLS.length];
}
function stitchCounts(pat){
  var counts={}; // idx -> {full,half,quarter,three,total}
  for(var i=0;i<pat.types.length;i++){
    var idx=pat.cells[i], t=pat.types[i];
    if(t===0||idx<0) continue;
    if(!counts[idx]) counts[idx]={full:0,half:0,quarter:0,three:0};
    if(t===1) counts[idx].full++;
    else if(t===2||t===3) counts[idx].half++;
    else if(t>=4&&t<=7) counts[idx].quarter++;
    else counts[idx].three++;
  }
  return counts;
}
function backLenByColor(pat){
  var out={};
  pat.backs.forEach(function(b){
    var x1=b[0]/2,y1=b[1]/2,x2=b[2]/2,y2=b[3]/2;
    var len=Math.hypot(x2-x1,y2-y1);
    out[b[4]]=(out[b[4]]||0)+len;
  });
  return out;
}
function knotCountByColor(pat){
  var out={};
  pat.knots.forEach(function(k){ out[k[2]]=(out[k[2]]||0)+1; });
  return out;
}
function estimateSkeins(pat){
  var fab = FABRICS[pat.fabric]||FABRICS.aida14;
  var cellCm = 2.54/fab.eff;
  var fullPath = (2*Math.SQRT2+2)*cellCm;
  var counts = stitchCounts(pat);
  var backLen = backLenByColor(pat);
  var knotCount = knotCountByColor(pat);
  var strands = pat.strands;
  var out={}; // idx -> skeins
  pat.palette.forEach(function(p,idx){
    var c = counts[idx]||{full:0,half:0,quarter:0,three:0};
    var usage = strands*(c.full*fullPath + c.three*0.8*fullPath + c.half*0.5*fullPath + c.quarter*0.35*fullPath);
    usage += (backLen[idx]||0)*cellCm*2;
    usage += (knotCount[idx]||0)*3*strands;
    usage *= 1.3;
    out[idx] = usage/4800;
  });
  return out;
}
function totalStitchCount(pat){
  var n=0; for(var i=0;i<pat.types.length;i++) if(pat.types[i]!==0) n++; return n;
}
function finishedSizeCm(pat){
  var fab=FABRICS[pat.fabric]||FABRICS.aida14;
  return { w: pat.w/fab.eff*2.54, h: pat.h/fab.eff*2.54 };
}
function updateCmSizeBadge(){
  var el = $('#cm-size-badge');
  if(!el) return;
  if(!S.showCmSize || !S.pat){ el.hidden=true; return; }
  var f = finishedSizeCm(S.pat);
  el.hidden=false;
  el.textContent = f.w.toFixed(1)+' × '+f.h.toFixed(1)+' cm';
}
function cutSizeCm(pat, marginCm){
  var f = finishedSizeCm(pat);
  return { w: f.w+marginCm*2, h: f.h+marginCm*2 };
}

function buildPanel(){
  if(!S.pat) return;
  var root = $('#panel-scroll');
  var skeins = estimateSkeins(S.pat);
  var counts = stitchCounts(S.pat);
  var finished = finishedSizeCm(S.pat);
  var margin = S.pat._margin!=null?S.pat._margin:5;
  var cut = cutSizeCm(S.pat, margin);
  var totalSkeinsRounded = S.pat.palette.reduce(function(a,p,i){ return a+Math.ceil((skeins[i]||0)); },0);

  var threadsHTML = S.pat.palette.map(function(p,idx){
    var d=DMC_BY_CODE[p.code];
    var rgb=d?d.rgb:{r:170,g:170,b:170};
    var c=counts[idx]||{full:0,half:0,quarter:0,three:0};
    var total=c.full+c.half+c.quarter+c.three;
    var sk=(skeins[idx]||0).toFixed(1);
    return '<div class="thread'+(S.curPaletteIdx===idx?' on':'')+'" data-idx="'+idx+'">'+
      '<div class="sw" style="background:'+rgbToHex(rgb.r,rgb.g,rgb.b)+';color:'+contrastSymbolColor(rgb.r,rgb.g,rgb.b)+'">'+p.sym+'</div>'+
      '<div class="t-main"><div class="t-code mono">DMC '+p.code+'</div><div class="t-name">'+escapeHtml(d?d.name:'')+'</div></div>'+
      '<div class="t-cnt">'+total+'<br><span class="mono">'+sk+' 타래</span></div>'+
      '<button class="icon-btn thread-menu-btn" data-menu="'+idx+'">'+iconMore()+'</button>'+
    '</div>';
  }).join('') || '<p class="muted small">아직 사용한 실이 없어요.</p>';

  root.innerHTML =
    '<section>'+
      '<div class="section-hd"><h3>실 목록</h3><button class="link-btn" id="btn-add-thread">+ 실 추가</button></div>'+
      '<div class="threads">'+threadsHTML+'</div>'+
      (S.pat.palette.length? '<button class="btn ghost sm" id="btn-clean-threads" style="margin-top:8px;width:100%">안 쓰는 실 정리</button>':'')+
    '</section>'+
    '<section>'+
      '<h3>도안 정보</h3>'+
      '<dl class="kv">'+
        '<dt>크기</dt><dd>'+S.pat.w+' × '+S.pat.h+' 스티치</dd>'+
        '<dt>총 스티치</dt><dd>'+totalStitchCount(S.pat)+'</dd>'+
        '<dt>색 수</dt><dd>'+S.pat.palette.length+'</dd>'+
        '<dt>필요 타래(합계)</dt><dd>'+totalSkeinsRounded+'</dd>'+
        '<dt>완성 크기</dt><dd>'+finished.w.toFixed(1)+' × '+finished.h.toFixed(1)+' cm</dd>'+
        '<dt>재단 원단 크기</dt><dd>'+cut.w.toFixed(1)+' × '+cut.h.toFixed(1)+' cm</dd>'+
        '<dt>진행률</dt><dd>'+Math.round(patternProgress(S.pat)*100)+'%</dd>'+
      '</dl>'+
      '<div class="row2" style="margin-top:10px">'+
        '<label class="field"><span>원단</span><select id="pi-fabric">'+fabricOptions(S.pat.fabric)+'</select></label>'+
        '<label class="field"><span>가닥 수</span><select id="pi-strands">'+[1,2,3].map(function(n){return '<option value="'+n+'"'+(n===S.pat.strands?' selected':'')+'>'+n+'가닥</option>';}).join('')+'</select></label>'+
      '</div>'+
      '<label class="field" style="margin-top:8px"><span>여유분 (cm)</span><input id="pi-margin" type="number" min="0" step="0.5" value="'+margin+'"></label>'+
    '</section>';

  $('#btn-add-thread',root).onclick = openDmcPicker;
  var cleanBtn = $('#btn-clean-threads',root); if(cleanBtn) cleanBtn.onclick=cleanUnusedThreads;
  $$('.thread',root).forEach(function(el){
    el.onclick=function(e){ if(e.target.closest('[data-menu]')) return; selectPaletteIdx(parseInt(el.dataset.idx,10)); };
  });
  $$('[data-menu]',root).forEach(function(b){
    b.onclick=function(e){ e.stopPropagation(); openThreadMenu(parseInt(b.dataset.menu,10), e.clientX, e.clientY); };
  });
  $('#pi-fabric',root).onchange=function(e){ S.pat.fabric=e.target.value; markDirty(); buildPanel(); updateCmSizeBadge(); };
  $('#pi-strands',root).onchange=function(e){ S.pat.strands=parseInt(e.target.value,10); markDirty(); buildPanel(); };
  $('#pi-margin',root).oninput=function(e){ S.pat._margin=parseFloat(e.target.value)||0; buildPanel(); };
}
function iconMore(){ return svg('<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/>'); }

function openThreadMenu(idx, x, y){
  var p = S.pat.palette[idx];
  openMenu([
    { label:'색 바꾸기', action:function(){ openDmcPicker(idx); } },
    { label:'기호 바꾸기', action:function(){ openSymbolPicker(idx); } },
    { label:'다른 실로 합치기', action:function(){ openMergeThread(idx); } },
    null,
    { label:'이 실 스티치 모두 지우기', danger:true, action:function(){ clearThreadStitches(idx); } }
  ], x, y);
}
function clearThreadStitches(idx){
  confirmModal('스티치 지우기', 'DMC '+S.pat.palette[idx].code+' 실로 놓은 스티치를 모두 지울까요?', {danger:true, okLabel:'지우기'}).then(function(ok){
    if(!ok) return;
    pushHistory();
    for(var i=0;i<S.pat.cells.length;i++){ if(S.pat.cells[i]===idx){ S.pat.cells[i]=-1; S.pat.types[i]=0; S.pat.done[i]=0; } }
    S.pat.backs = S.pat.backs.filter(function(b){ return b[4]!==idx; });
    S.pat.knots = S.pat.knots.filter(function(k){ return k[2]!==idx; });
    markDirty(); drawEditor(); buildPanel();
  });
}
function cleanUnusedThreads(){
  var used = new Set();
  for(var i=0;i<S.pat.cells.length;i++){ if(S.pat.types[i]!==0 && S.pat.cells[i]>=0) used.add(S.pat.cells[i]); }
  S.pat.backs.forEach(function(b){ used.add(b[4]); });
  S.pat.knots.forEach(function(k){ used.add(k[2]); });
  var removed = S.pat.palette.length - used.size;
  if(removed<=0){ toast('정리할 실이 없어요'); return; }
  pushHistory();
  remapPalette(Array.from({length:S.pat.palette.length},function(_,i){return i;}).filter(function(i){return used.has(i);}));
  markDirty(); drawEditor(); buildPanel();
  toast(removed+'개 실을 정리했어요');
}
function remapPalette(keepIdxList){
  var map={}; keepIdxList.forEach(function(oldIdx,newIdx){ map[oldIdx]=newIdx; });
  S.pat.palette = keepIdxList.map(function(i){ return S.pat.palette[i]; });
  for(var i=0;i<S.pat.cells.length;i++){
    if(S.pat.types[i]!==0 && S.pat.cells[i]>=0){
      S.pat.cells[i] = map[S.pat.cells[i]]!=null?map[S.pat.cells[i]]:-1;
      if(S.pat.cells[i]<0) S.pat.types[i]=0;
    }
  }
  S.pat.backs = S.pat.backs.filter(function(b){ return map[b[4]]!=null; }).map(function(b){ b[4]=map[b[4]]; return b; });
  S.pat.knots = S.pat.knots.filter(function(k){ return map[k[2]]!=null; }).map(function(k){ k[2]=map[k[2]]; return k; });
  fixCurPalette();
}
function openMergeThread(fromIdx){
  var options = S.pat.palette.map(function(p,i){ return i; }).filter(function(i){ return i!==fromIdx; });
  if(!options.length){ toast('합칠 다른 실이 없어요'); return; }
  var listHTML = options.map(function(i){
    var p=S.pat.palette[i]; var d=DMC_BY_CODE[p.code];
    return '<button class="pk" data-i="'+i+'" style="align-items:flex-start;padding:8px"><i style="background:'+d.hex+';width:100%;border-radius:4px"></i><b>'+p.code+'</b><span>'+escapeHtml(d.name)+'</span></button>';
  }).join('');
  openModal({ title:'다른 실로 합치기', bodyHTML:'<div class="picker-grid">'+listHTML+'</div>' });
  var modal=$('#modal-root .modal');
  $$('[data-i]',modal).forEach(function(b){
    b.onclick=function(){
      var toIdx=parseInt(b.dataset.i,10);
      closeModal();
      pushHistory();
      for(var i=0;i<S.pat.cells.length;i++){ if(S.pat.cells[i]===fromIdx) S.pat.cells[i]=toIdx; }
      S.pat.backs.forEach(function(bk){ if(bk[4]===fromIdx) bk[4]=toIdx; });
      S.pat.knots.forEach(function(k){ if(k[2]===fromIdx) k[2]=toIdx; });
      var keep = S.pat.palette.map(function(_,i){return i;}).filter(function(i){return i!==fromIdx;});
      remapPalette(keep);
      markDirty(); drawEditor(); buildPanel();
      toast('실을 합쳤어요');
    };
  });
}

/* DMC 선택 모달 */
// 툴바에서 바로 여는 실 선택 팝업: 이미 쓰는 실 빠르게 선택 + 새 실 추가
function openQuickColorPicker(){
  var listHTML = S.pat.palette.map(function(p, idx){
    var d = DMC_BY_CODE[p.code];
    var rgb = d?d.rgb:{r:170,g:170,b:170};
    var curStyle = idx===S.curPaletteIdx ? 'border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)' : '';
    return '<button class="pk" data-idx="'+idx+'" style="'+curStyle+'">'+
      '<i style="background:'+rgbToHex(rgb.r,rgb.g,rgb.b)+';display:flex;align-items:center;justify-content:center;color:'+contrastSymbolColor(rgb.r,rgb.g,rgb.b)+';font-weight:700">'+p.sym+'</i>'+
      '<b>'+p.code+'</b><span>'+escapeHtml(d?d.name:'')+'</span>'+
    '</button>';
  }).join('');
  var modal = openModal({
    title:'실 선택',
    bodyHTML: listHTML ? '<div class="picker-grid">'+listHTML+'</div>' : '<p class="muted small">아직 사용한 실이 없어요.</p>',
    footerHTML: '<button class="btn ghost" id="qcp-cancel">닫기</button><button class="btn primary" id="qcp-add">+ 새 실 추가</button>'
  });
  $$('.pk',modal).forEach(function(b){
    b.onclick=function(){ closeModal(); selectPaletteIdx(parseInt(b.dataset.idx,10)); };
  });
  $('#qcp-cancel',modal).onclick=closeModal;
  $('#qcp-add',modal).onclick=function(){ closeModal(); openDmcPicker(); };
}
function openDmcPicker(replaceIdx){
  var usedCodes = new Set(S.pat.palette.map(function(p){return p.code;}));
  var modal = openModal({
    title: typeof replaceIdx==='number' ? '색 바꾸기' : '실 추가',
    wide:true,
    bodyHTML:
      '<div class="picker-search"><input id="dmc-search" placeholder="번호 또는 이름 검색" style="flex:1;height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px"></div>'+
      '<div class="picker-grid" id="dmc-grid"></div>'
  });
  function render(q){
    q=(q||'').toLowerCase();
    var grid=$('#dmc-grid',modal);
    var list = DMC.filter(function(d){ return !q || d.code.toLowerCase().indexOf(q)>=0 || d.name.toLowerCase().indexOf(q)>=0; });
    grid.innerHTML = list.map(function(d){
      var used = usedCodes.has(d.code);
      return '<button class="pk'+(used?' used':'')+'" data-code="'+d.code+'"><i style="background:'+d.hex+'"></i><b>'+d.code+'</b><span>'+escapeHtml(d.name)+'</span></button>';
    }).join('');
    grid.onclick=function(e){
      var b=e.target.closest('[data-code]'); if(!b) return;
      pickDmc(b.dataset.code, replaceIdx);
    };
  }
  render('');
  $('#dmc-search',modal).oninput=function(e){ render(e.target.value); };
  $('#dmc-search',modal).focus();
}
function pickDmc(code, replaceIdx){
  closeModal();
  pushHistory();
  if(typeof replaceIdx==='number'){
    S.pat.palette[replaceIdx].code = code;
  } else {
    var exists = S.pat.palette.findIndex(function(p){return p.code===code;});
    if(exists>=0){ S.curPaletteIdx=exists; }
    else {
      S.pat.palette.push({code:code, sym:pickFreeSymbol()});
      S.curPaletteIdx = S.pat.palette.length-1;
    }
    pushRecentColor(S.curPaletteIdx);
  }
  markDirty(); buildPanel(); buildToolbar(); drawEditor();
}

/* 기호 선택 모달 */
function openSymbolPicker(idx){
  var used = {};
  S.pat.palette.forEach(function(p,i){ if(i!==idx) used[p.sym]=i; });
  var cur = S.pat.palette[idx].sym;
  var modal = openModal({
    title:'기호 바꾸기',
    bodyHTML: '<div class="sym-grid" id="sym-grid">'+SYMBOLS.map(function(s){
      var cls = (s===cur?'cur':'')+(used[s]!=null?' used':'');
      return '<button class="'+cls.trim()+'" data-s="'+s+'">'+s+'</button>';
    }).join('')+'</div>'
  });
  $('#sym-grid',modal).onclick=function(e){
    var b=e.target.closest('[data-s]'); if(!b) return;
    var s=b.dataset.s;
    closeModal();
    pushHistory();
    var otherIdx = used[s];
    if(otherIdx!=null){ S.pat.palette[otherIdx].sym = cur; }
    S.pat.palette[idx].sym = s;
    markDirty(); buildPanel(); buildToolbar(); drawEditor();
  };
}

/* ============================================================
   더보기 / 내보내기 메뉴
   ============================================================ */
function initTopbarMenus(){
  $('#btn-close-editor').onclick = enterLibrary;
  $('#brand-home').onclick = function(){ if(app.classList.contains('mode-editor')) enterLibrary(); };
  $('#btn-undo').onclick = undo;
  $('#btn-redo').onclick = redo;
  $('#btn-panel-toggle').onclick = togglePanel;
  $('#panel-close').onclick = togglePanel;
  $('#title-input').addEventListener('input', function(e){
    S.pat.name = e.target.value; markDirty();
  });
  $('#btn-export-menu').onclick = function(e){
    var r=e.target.getBoundingClientRect();
    openMenu([
      { label:'PDF로 내보내기', action:function(){ exportPDF(); } },
      { label:'PNG로 내보내기', action:function(){ exportPNG(); } },
      { label:'도안 파일(JSON)', action:function(){ var blob=new Blob([JSON.stringify(serialize(S.pat))],{type:'application/json'}); downloadBlob(safeFileName(S.pat.name)+'.json', blob); } }
    ], r.left, r.bottom+6);
  };
  $('#btn-more-menu').onclick = function(e){
    var r=e.target.getBoundingClientRect();
    openMenu([
      { label:'캔버스 크기 변경', action: resizeCanvasModal },
      { label:'사본으로 저장', action: saveAsCopy },
      { label:'모두 진행 해제', action: resetAllDone }
    ], r.left, r.bottom+6);
  };
}
function saveAsCopy(){
  var copy = clonePattern(S.pat);
  copy.id=uid(); copy.name=S.pat.name+' (사본)'; copy.created=Date.now(); copy.updated=Date.now();
  Data.put(copy).then(function(){ toast('사본으로 저장했어요'); });
}
function resetAllDone(){
  confirmModal('진행 해제', '모든 진행 체크를 해제할까요?').then(function(ok){
    if(!ok) return;
    pushHistory();
    S.pat.done.fill(0);
    markDirty(); drawEditor();
  });
}

/* ============================================================
   사진 → 도안 변환
   ============================================================ */
function openImportModal(prefillFile){
  var modal = openModal({
    title:'사진으로 만들기', wide:true,
    bodyHTML:
      '<div class="import">'+
        '<div class="import-prev" id="imp-prev"><div class="drop" id="imp-drop">'+
          '<span>이미지를 끌어다 놓거나</span><button class="btn sm" id="imp-pick">파일 선택</button>'+
        '</div></div>'+
        '<div class="stack">'+
          '<label class="field"><span>이름</span><input id="imp-name" value="새 도안"></label>'+
          '<label class="field"><span>가로 스티치 수: <b id="imp-w-val">80</b></span><div class="range"><input id="imp-w" type="range" min="20" max="300" value="80"></div></label>'+
          '<label class="field"><span>최대 색 수: <b id="imp-k-val">24</b></span><div class="range"><input id="imp-k" type="range" min="2" max="60" value="24"></div></label>'+
          '<label class="check"><input type="checkbox" id="imp-dither">디더링</label>'+
          '<label class="check"><input type="checkbox" id="imp-bgremove">배경 제거</label>'+
          '<label class="check" id="imp-speckle-wrap"><input type="checkbox" id="imp-speckle" checked>외톨이 점 정리</label>'+
          '<label class="field"><span>원단</span><select id="imp-fabric">'+fabricOptions('aida14')+'</select></label>'+
          '<div class="import-sum" id="imp-sum">이미지를 선택하면 미리보기가 보여요.</div>'+
        '</div>'+
      '</div>',
    footerHTML: '<button class="btn ghost" id="imp-cancel">취소</button><button class="btn primary" id="imp-ok" disabled>도안 만들기</button>'
  });
  var srcImage=null, resultData=null, busyTimer=null;
  var dropEl=$('#imp-drop',modal), prevEl=$('#imp-prev',modal);
  function setImage(file){
    if(!file) return;
    var img=new Image();
    var url=URL.createObjectURL(file);
    img.onload=function(){
      srcImage=img;
      $('#imp-name',modal).value = file.name.replace(/\.[^.]+$/,'') || '새 도안';
      URL.revokeObjectURL(url);
      scheduleConvert();
    };
    img.src=url;
  }
  $('#imp-pick',modal).onclick=function(){ var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange=function(){ if(inp.files[0]) setImage(inp.files[0]); }; inp.click(); };
  ['dragenter','dragover'].forEach(function(ev){ dropEl.addEventListener(ev,function(e){ e.preventDefault(); dropEl.classList.add('over'); }); });
  ['dragleave','drop'].forEach(function(ev){ dropEl.addEventListener(ev,function(e){ e.preventDefault(); dropEl.classList.remove('over'); }); });
  dropEl.addEventListener('drop', function(e){ var f=e.dataTransfer.files[0]; if(f) setImage(f); });
  prevEl.addEventListener('dragover', function(e){ e.preventDefault(); });
  prevEl.addEventListener('drop', function(e){ e.preventDefault(); var f=e.dataTransfer.files[0]; if(f) setImage(f); });

  $('#imp-w',modal).oninput=function(){ $('#imp-w-val',modal).textContent=this.value; scheduleConvert(); };
  $('#imp-k',modal).oninput=function(){ $('#imp-k-val',modal).textContent=this.value; scheduleConvert(); };
  $('#imp-dither',modal).onchange=scheduleConvert;
  $('#imp-bgremove',modal).onchange=scheduleConvert;
  $('#imp-speckle',modal).onchange=scheduleConvert;
  $('#imp-fabric',modal).onchange=updateSummary;

  function scheduleConvert(){
    clearTimeout(scheduleConvert._t);
    scheduleConvert._t=setTimeout(doConvert, 250);
  }
  function doConvert(){
    if(!srcImage) return;
    showBusy(true);
    setTimeout(function(){
      try{
        var opts = {
          targetW: parseInt($('#imp-w',modal).value,10),
          maxColors: parseInt($('#imp-k',modal).value,10),
          dither: $('#imp-dither',modal).checked,
          bgRemove: $('#imp-bgremove',modal).checked,
          speckle: $('#imp-speckle',modal).checked
        };
        resultData = photoToPattern(srcImage, opts);
        renderImportPreview(resultData);
        updateSummary();
        $('#imp-ok',modal).disabled=false;
      }catch(err){
        console.error(err);
        toast('변환 중 오류가 발생했어요');
      }
      showBusy(false);
    }, 10);
  }
  function showBusy(v){
    var b=$('.busy',prevEl);
    if(v){ if(!b){ b=document.createElement('div'); b.className='busy'; b.textContent='변환 중…'; prevEl.appendChild(b); } }
    else if(b){ b.remove(); }
  }
  function renderImportPreview(data){
    prevEl.innerHTML='';
    var c=document.createElement('canvas'); c.width=data.w; c.height=data.h;
    var ctx=c.getContext('2d');
    var img=ctx.createImageData(data.w,data.h);
    for(var i=0;i<data.w*data.h;i++){
      var idx=data.cells[i];
      var rgb = idx>=0 ? DMC_BY_CODE[data.palette[idx]].rgb : {r:255,g:255,b:255};
      img.data[i*4]=rgb.r; img.data[i*4+1]=rgb.g; img.data[i*4+2]=rgb.b; img.data[i*4+3]= idx>=0?255:0;
    }
    ctx.putImageData(img,0,0);
    prevEl.appendChild(c);
  }
  function updateSummary(){
    if(!resultData) return;
    var fabric=$('#imp-fabric',modal).value;
    var fab=FABRICS[fabric];
    var wcm=(resultData.w/fab.eff*2.54).toFixed(1), hcm=(resultData.h/fab.eff*2.54).toFixed(1);
    $('#imp-sum',modal).textContent = resultData.w+'×'+resultData.h+' 스티치 · '+resultData.palette.length+'색 · '+fab.label+'에서 '+wcm+'×'+hcm+'cm';
  }
  $('#imp-cancel',modal).onclick=closeModal;
  $('#imp-ok',modal).onclick=function(){
    if(!resultData) return;
    var name=$('#imp-name',modal).value.trim()||'새 도안';
    var fabric=$('#imp-fabric',modal).value;
    var pat=newPattern(resultData.w,resultData.h,name);
    pat.fabric=fabric;
    pat.palette = resultData.palette.map(function(code){ return {code:code, sym:''}; });
    // 기호 배정 (개수 내림차순은 photoToPattern에서 이미 정렬)
    pat.palette.forEach(function(p,i){ p.sym = SYMBOLS[i%SYMBOLS.length]; });
    pat.cells = resultData.cells;
    pat.types = new Uint8Array(resultData.cells.length);
    for(var i=0;i<pat.types.length;i++){ if(pat.cells[i]>=0) pat.types[i]=1; }
    closeModal();
    Data.put(pat).then(function(){ S.pat=pat; enterEditor(); toast('사진에서 도안을 만들었어요'); });
  };
  if(prefillFile) setImage(prefillFile);
}

function photoToPattern(img, opts){
  var targetW = clamp(opts.targetW,4,MAX_DIM);
  var ratio = img.naturalHeight/img.naturalWidth;
  var targetH = clamp(Math.round(targetW*ratio),4,MAX_DIM);
  // 단계적 축소 후 리샘플
  var cw=img.naturalWidth, ch=img.naturalHeight;
  var cur = img;
  while(cw>targetW*2 && ch>targetH*2){
    var nc=document.createElement('canvas');
    nc.width=Math.max(targetW,Math.floor(cw/2)); nc.height=Math.max(targetH,Math.floor(ch/2));
    var nctx=nc.getContext('2d');
    nctx.imageSmoothingEnabled=true; nctx.imageSmoothingQuality='high';
    nctx.drawImage(cur, 0,0,nc.width,nc.height);
    cur=nc; cw=nc.width; ch=nc.height;
  }
  var fc=document.createElement('canvas'); fc.width=targetW; fc.height=targetH;
  var fctx=fc.getContext('2d');
  fctx.imageSmoothingEnabled=true; fctx.imageSmoothingQuality='high';
  fctx.drawImage(cur,0,0,targetW,targetH);
  var imgData = fctx.getImageData(0,0,targetW,targetH);
  var n=targetW*targetH;
  var alpha=new Uint8Array(n);
  var labs=[];
  for(var i=0;i<n;i++){
    var p=i*4;
    var a=imgData.data[p+3];
    alpha[i]= a<128?0:1;
    labs.push(alpha[i]? rgbToLab(imgData.data[p],imgData.data[p+1],imgData.data[p+2]) : null);
  }
  // 배경 제거: 가장자리에서 연결된, 색이 비슷한 영역을 flood fill로 비움
  var bg = new Uint8Array(n);
  if(opts.bgRemove){
    var stack=[];
    for(var x=0;x<targetW;x++){ stack.push(x); stack.push((targetH-1)*targetW+x); }
    for(var y=0;y<targetH;y++){ stack.push(y*targetW); stack.push(y*targetW+targetW-1); }
    var visited=new Uint8Array(n);
    var THRESH=8;
    while(stack.length){
      var idx0=stack.pop();
      if(idx0<0||idx0>=n||visited[idx0]) continue;
      visited[idx0]=1;
      if(!alpha[idx0]) continue;
      var lab0=labs[idx0];
      var x0=idx0%targetW,y0=(idx0/targetW)|0;
      bg[idx0]=1;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){
        var nx=x0+d[0],ny=y0+d[1];
        if(nx<0||ny<0||nx>=targetW||ny>=targetH) return;
        var ni=ny*targetW+nx;
        if(visited[ni]||!alpha[ni]) return;
        var e=deltaE2000(lab0, labs[ni]);
        if(e<THRESH) stack.push(ni);
      });
    }
  }
  var activeIdx=[];
  for(var i2=0;i2<n;i2++){ if(alpha[i2] && !bg[i2]) activeIdx.push(i2); }
  if(!activeIdx.length) activeIdx = Array.from({length:n},function(_,i){return i;}).filter(function(i){return alpha[i];});

  var k = Math.min(opts.maxColors, activeIdx.length||1);
  var centers = kmeansPP(activeIdx.map(function(i){return labs[i];}), k, mulberry32(42));

  // 중심을 CIEDE2000으로 가장 가까운 DMC에 매칭, 중복 제거
  var usedCodes = new Set();
  var centerDmc = centers.map(function(c){
    var d = nearestDMC(c, usedCodes);
    if(!d) d = nearestDMC(c, null);
    usedCodes.add(d.code);
    return d;
  });
  var centerLabs = centerDmc.map(function(d){ return d.lab; });

  var cellsOut = new Int16Array(n).fill(-1);
  var errR=new Float32Array(n), errG=new Float32Array(n), errB=new Float32Array(n);
  for(var y=0;y<targetH;y++){
    for(var x=0;x<targetW;x++){
      var i3=y*targetW+x;
      if(!alpha[i3] || bg[i3]) continue;
      var p3=i3*4;
      var r=imgData.data[p3]+ (opts.dither?errR[i3]:0);
      var g=imgData.data[p3+1]+ (opts.dither?errG[i3]:0);
      var b=imgData.data[p3+2]+ (opts.dither?errB[i3]:0);
      r=clamp(r,0,255);g=clamp(g,0,255);b=clamp(b,0,255);
      var lab=rgbToLab(r,g,b);
      var bestI=0,bestD=Infinity;
      for(var ci=0;ci<centerLabs.length;ci++){
        var dl=lab.L-centerLabs[ci].L, da=lab.a-centerLabs[ci].a, db=lab.b-centerLabs[ci].b;
        var d2=dl*dl+da*da+db*db;
        if(d2<bestD){bestD=d2;bestI=ci;}
      }
      cellsOut[i3]=bestI;
      if(opts.dither){
        var chosen=centerDmc[bestI].rgb;
        var er=(r-chosen.r)*0.75, eg=(g-chosen.g)*0.75, eb=(b-chosen.b)*0.75;
        distributeError(errR,errG,errB,x,y,targetW,targetH,er,eg,eb);
      }
    }
  }
  if(opts.speckle){
    for(var pass=0; pass<2; pass++){
      var next = cellsOut.slice();
      for(var y2=0;y2<targetH;y2++){
        for(var x2=0;x2<targetW;x2++){
          var i4=y2*targetW+x2;
          if(cellsOut[i4]<0) continue;
          var same=0, neighborCounts={};
          for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){
            if(dx===0&&dy===0) continue;
            var nx2=x2+dx, ny2=y2+dy;
            if(nx2<0||ny2<0||nx2>=targetW||ny2>=targetH) continue;
            var v=cellsOut[ny2*targetW+nx2];
            if(v<0) continue;
            if(v===cellsOut[i4]) same++;
            neighborCounts[v]=(neighborCounts[v]||0)+1;
          }
          if(same===0){
            var bestV=-1,bestC=0;
            Object.keys(neighborCounts).forEach(function(k2){ if(neighborCounts[k2]>bestC){bestC=neighborCounts[k2];bestV=parseInt(k2,10);} });
            if(bestV>=0) next[i4]=bestV;
          }
        }
      }
      cellsOut=next;
    }
  }
  // 안 쓰는 색 제거 + 개수 내림차순
  var counts={};
  for(var i5=0;i5<n;i5++){ if(cellsOut[i5]>=0) counts[cellsOut[i5]]=(counts[cellsOut[i5]]||0)+1; }
  var order = Object.keys(counts).map(Number).sort(function(a,b){ return counts[b]-counts[a]; });
  var remap={}; order.forEach(function(o,i){ remap[o]=i; });
  var finalCells = new Int16Array(n).fill(-1);
  for(var i6=0;i6<n;i6++){ if(cellsOut[i6]>=0) finalCells[i6]=remap[cellsOut[i6]]; }
  var finalPalette = order.map(function(o){ return centerDmc[o].code; });
  return { w:targetW, h:targetH, cells:finalCells, palette:finalPalette };
}
function distributeError(errR,errG,errB,x,y,w,h,er,eg,eb){
  addErr(x+1,y,7/16); addErr(x-1,y+1,3/16); addErr(x,y+1,5/16); addErr(x+1,y+1,1/16);
  function addErr(nx,ny,f){
    if(nx<0||ny<0||nx>=w||ny>=h) return;
    var ni=ny*w+nx;
    errR[ni]+=er*f; errG[ni]+=eg*f; errB[ni]+=eb*f;
  }
}
function kmeansPP(points, k, rng){
  if(points.length<=k) return points.slice();
  var centers=[points[Math.floor(rng()*points.length)]];
  var d2 = points.map(function(p){ return labDist2(p,centers[0]); });
  while(centers.length<k){
    var sum=d2.reduce(function(a,b){return a+b;},0);
    if(sum<=0){ centers.push(points[Math.floor(rng()*points.length)]); }
    else {
      var r=rng()*sum, acc=0, chosen=points[points.length-1];
      for(var i=0;i<points.length;i++){ acc+=d2[i]; if(acc>=r){ chosen=points[i]; break; } }
      centers.push(chosen);
    }
    for(var i2=0;i2<points.length;i2++){
      var nd=labDist2(points[i2],centers[centers.length-1]);
      if(nd<d2[i2]) d2[i2]=nd;
    }
  }
  // Lloyd's 반복 8회
  var assign = new Array(points.length);
  for(var iter=0; iter<8; iter++){
    for(var i3=0;i3<points.length;i3++){
      var bestI=0,bestD=Infinity;
      for(var c=0;c<centers.length;c++){ var dd=labDist2(points[i3],centers[c]); if(dd<bestD){bestD=dd;bestI=c;} }
      assign[i3]=bestI;
    }
    var sums=centers.map(function(){return {L:0,a:0,b:0,n:0};});
    for(var i4=0;i4<points.length;i4++){ var s=sums[assign[i4]]; s.L+=points[i4].L; s.a+=points[i4].a; s.b+=points[i4].b; s.n++; }
    centers = sums.map(function(s,ci){ return s.n? {L:s.L/s.n,a:s.a/s.n,b:s.b/s.n} : centers[ci]; });
  }
  return centers;
}
function labDist2(a,b){ var dl=a.L-b.L,da=a.a-b.a,db=a.b-b.b; return dl*dl+da*da+db*db; }

/* ============================================================
   PDF / PNG 출력
   ============================================================ */
var A4W=1240, A4H=1754;
function pageCanvas(scale){
  var c=document.createElement('canvas'); c.width=A4W*scale; c.height=A4H*scale;
  var ctx=c.getContext('2d'); ctx.scale(scale,scale);
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,A4W,A4H);
  return {c:c, ctx:ctx};
}
function exportPDF(){
  if(!window.jspdf){ toast('PDF 라이브러리를 불러오지 못했어요'); return; }
  toast('PDF 만드는 중…');
  setTimeout(function(){
    try{
      var pat=S.pat;
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({unit:'px', format:[A4W,A4H], compress:true});
      var scale=2;
      var pageIdx=0;
      function addPage(drawFn){
        if(pageIdx>0) doc.addPage([A4W,A4H]);
        var pg=pageCanvas(scale);
        drawFn(pg.ctx);
        var jpeg=pg.c.toDataURL('image/jpeg',0.92);
        doc.addImage(jpeg,'JPEG',0,0,A4W,A4H);
        pageIdx++;
      }
      addPage(drawCoverPage);
      var legendPages = Math.max(1, Math.ceil(pat.palette.length/22));
      for(var lp=0; lp<legendPages; lp++){
        (function(lp){ addPage(function(ctx){ drawLegendPage(ctx,lp,legendPages); }); })(lp);
      }
      var perPageW=50, perPageH=70;
      var cols=Math.ceil(pat.w/perPageW), rows=Math.ceil(pat.h/perPageH);
      var total=cols*rows, n2=0;
      for(var ry=0; ry<rows; ry++){
        for(var rx=0; rx<cols; rx++){
          (function(rx,ry){
            n2++;
            var pn=n2;
            addPage(function(ctx){ drawChartPage(ctx, rx, ry, perPageW, perPageH, pn, total); });
          })(rx,ry);
        }
      }
      downloadBlob(safeFileName(pat.name)+'.pdf', doc.output('blob')).then(function(saved){
        if(saved) toast('PDF를 저장했어요');
      });
    }catch(err){ console.error(err); toast('PDF 생성에 실패했어요'); }
  }, 30);
}
function drawCoverPage(ctx){
  var pat=S.pat;
  ctx.fillStyle='#1B232A'; ctx.textAlign='center';
  ctx.font='700 40px sans-serif';
  ctx.fillText(pat.name, A4W/2, 120);
  ctx.font='14px sans-serif'; ctx.fillStyle='#5B676E';
  ctx.fillText('땀땀 십자수 도안 · v'+VERSION, A4W/2, 150);
  var cell = Math.min((A4W-160)/pat.w, 620/pat.h);
  var ox=(A4W-pat.w*cell)/2, oy=200;
  renderRegion(ctx, pat, {sx:0,sy:0,ex:pat.w,ey:pat.h,cell:cell,ox:ox,oy:oy,mode:'color',grid:cell>3,fabric:true});
  ctx.strokeStyle='#D2D9D5'; ctx.strokeRect(ox,oy,pat.w*cell,pat.h*cell);
  var fab=FABRICS[pat.fabric];
  var finished=finishedSizeCm(pat), cut=cutSizeCm(pat, pat._margin!=null?pat._margin:5);
  var y0=oy+pat.h*cell+50;
  ctx.textAlign='left'; ctx.font='15px sans-serif'; ctx.fillStyle='#1B232A';
  var lines=[
    '크기: '+pat.w+' × '+pat.h+' 스티치   원단: '+fab.label,
    '완성 크기: '+finished.w.toFixed(1)+' × '+finished.h.toFixed(1)+' cm   재단 원단: '+cut.w.toFixed(1)+' × '+cut.h.toFixed(1)+' cm',
    '색 수: '+pat.palette.length+'   총 스티치: '+totalStitchCount(pat)
  ];
  lines.forEach(function(l,i){ ctx.fillText(l, 80, y0+i*26); });
  // 페이지 구성 맵
  var perPageW=50, perPageH=70;
  var cols=Math.ceil(pat.w/perPageW), rows=Math.ceil(pat.h/perPageH);
  var mapCell=Math.min(300/(cols*perPageW),300/(rows*perPageH))* Math.max(perPageW,perPageH)/Math.max(perPageW,perPageH);
  var mcell = Math.min(260/pat.w, 200/pat.h);
  var mox=80, moy=y0+90;
  ctx.strokeStyle='#AEB8B3'; ctx.font='11px sans-serif'; ctx.textAlign='center';
  ctx.fillStyle='#5B676E'; ctx.fillText('페이지 구성', mox+ (cols*perPageW*mcell)/2, moy-14);
  var pn=0;
  for(var ry=0;ry<rows;ry++){
    for(var rx=0;rx<cols;rx++){
      pn++;
      var pw=Math.min(perPageW,pat.w-rx*perPageW), ph=Math.min(perPageH,pat.h-ry*perPageH);
      var px=mox+rx*perPageW*mcell, py=moy+ry*perPageH*mcell;
      ctx.strokeRect(px,py,pw*mcell,ph*mcell);
      ctx.fillStyle='#1B232A';
      ctx.fillText(String(pn+legendPagesCountForCover()), px+pw*mcell/2, py+ph*mcell/2+4);
      ctx.fillStyle='#5B676E';
    }
  }
}
function legendPagesCountForCover(){ return 1+Math.max(1, Math.ceil(S.pat.palette.length/22)); }
function drawLegendPage(ctx, lp, totalLp){
  var pat=S.pat;
  ctx.fillStyle='#1B232A'; ctx.textAlign='left'; ctx.font='700 20px sans-serif';
  ctx.fillText(pat.name+' · 범례 ('+(lp+1)+'/'+totalLp+')', 60, 60);
  var skeins=estimateSkeins(pat), counts=stitchCounts(pat), backLen=backLenByColor(pat), knotCount=knotCountByColor(pat);
  var perPage=22, start=lp*perPage, end=Math.min(pat.palette.length,start+perPage);
  var rowH=(A4H-220)/perPage;
  var headerY=110;
  ctx.font='12px sans-serif'; ctx.fillStyle='#5B676E';
  ['기호','색','DMC','이름','스티치','백·노트','타래'].forEach(function(h,i){ ctx.fillText(h, 60+colX(i), headerY-14); });
  function colX(i){ return [0,60,120,190,560,650,760][i]; }
  for(var i=start;i<end;i++){
    var y=headerY+(i-start)*rowH;
    var p=pat.palette[i]; var d=DMC_BY_CODE[p.code];
    ctx.fillStyle='#fff'; ctx.fillRect(60,y-4,A4W-120,rowH-6);
    ctx.strokeStyle='#eee'; ctx.strokeRect(60,y-4,A4W-120,rowH-6);
    ctx.fillStyle='#1B232A'; ctx.font='16px sans-serif'; ctx.textAlign='center';
    ctx.fillText(p.sym, 60+colX(0)+16, y+16);
    ctx.fillStyle=d.hex; ctx.fillRect(60+colX(1),y,34,rowH-14);
    ctx.strokeStyle='#ccc'; ctx.strokeRect(60+colX(1),y,34,rowH-14);
    ctx.fillStyle='#1B232A'; ctx.font='13px monospace'; ctx.textAlign='left';
    ctx.fillText(p.code, 60+colX(2), y+16);
    ctx.font='13px sans-serif';
    ctx.fillText(truncate(d.name,26), 60+colX(3), y+16);
    var c=counts[i]||{full:0,half:0,quarter:0,three:0};
    ctx.fillText(''+(c.full+c.half+c.quarter+c.three), 60+colX(4), y+16);
    ctx.fillText((backLen[i]?Math.round(backLen[i])+'칸 ':'')+(knotCount[i]?knotCount[i]+'점':'')||'-', 60+colX(5), y+16);
    ctx.fillText((skeins[i]||0).toFixed(1), 60+colX(6), y+16);
  }
  ctx.fillStyle='#5B676E'; ctx.font='12px sans-serif'; ctx.textAlign='left';
  ctx.fillText('가닥 수: '+pat.strands+'가닥 (풀 스티치 기준, 백스티치는 1가닥)', 60, A4H-40);
}
function truncate(s,n){ return s.length>n? s.slice(0,n-1)+'…' : s; }
function drawChartPage(ctx, rx, ry, pw0, ph0, pn, total){
  var pat=S.pat;
  var sx=rx*pw0, sy=ry*ph0, ex=Math.min(pat.w,sx+pw0), ey=Math.min(pat.h,sy+ph0);
  var cell=21;
  ctx.fillStyle='#1B232A'; ctx.font='700 15px sans-serif'; ctx.textAlign='left';
  ctx.fillText(pat.name+' · 페이지 '+pn+'/'+total+' · 열 '+sx+'–'+(ex-1)+', 행 '+sy+'–'+(ey-1), 40, 36);
  var ox=48, oy=64;
  renderRegion(ctx, pat, {sx:sx,sy:sy,ex:ex,ey:ey,cell:cell,ox:ox,oy:oy,mode:S._pdfMode||'symbol',grid:true,fabric:true,done:false});
  ctx.strokeStyle='#8a938e'; ctx.strokeRect(ox,oy,(ex-sx)*cell,(ey-sy)*cell);
  ctx.fillStyle='#5B676E'; ctx.font='10px monospace'; ctx.textAlign='center';
  for(var gx=sx;gx<=ex;gx++){ if(gx%10!==0) continue; ctx.fillText(String(gx), ox+(gx-sx)*cell, oy-6); }
  ctx.textAlign='right';
  for(var gy=sy;gy<=ey;gy++){ if(gy%10!==0) continue; ctx.fillText(String(gy), ox-6, oy+(gy-sy)*cell+3); }
}
function exportPNG(){
  var pat=S.pat;
  var cell = clamp(Math.floor(4000/Math.max(pat.w,pat.h)),8,24);
  var c=document.createElement('canvas'); c.width=pat.w*cell+40; c.height=pat.h*cell+40;
  var ctx=c.getContext('2d');
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height);
  renderRegion(ctx, pat, {sx:0,sy:0,ex:pat.w,ey:pat.h,cell:cell,ox:20,oy:20,mode:S.view.colorSym,grid:true,fabric:true,done:S.showDone});
  c.toBlob(function(blob){ downloadBlob(safeFileName(pat.name)+'.png', blob); }, 'image/png');
}

/* ============================================================
   PWA: 서비스워커 / 업데이트 배너
   ============================================================ */
function registerSW(){
  if(!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then(function(reg){
    if(reg.waiting) showUpdateBanner(reg);
    reg.addEventListener('updatefound', function(){
      var nw=reg.installing;
      nw && nw.addEventListener('statechange', function(){
        if(nw.state==='installed' && navigator.serviceWorker.controller) showUpdateBanner(reg);
      });
    });
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) reg.update(); });
    setInterval(function(){ reg.update(); }, 60*60*1000);
  }).catch(function(){});
  var refreshing=false;
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    if(refreshing) return; refreshing=true; location.reload();
  });
}
function showUpdateBanner(reg){
  var root=$('#update-banner-root');
  if(root.querySelector('.update-banner')) return;
  var el=document.createElement('div'); el.className='update-banner';
  el.innerHTML = '<span>새 버전이 있어요</span><button class="btn primary sm" id="ub-apply">지금 적용</button><button class="icon-btn" id="ub-close">'+iconClose()+'</button>';
  root.appendChild(el);
  $('#ub-apply',el).onclick=function(){
    var w = reg.waiting || (reg.installing);
    if(w) w.postMessage('SKIP_WAITING');
  };
  $('#ub-close',el).onclick=function(){ el.remove(); };
}

/* ============================================================
   계정 / 클라우드 동기화 UI
   ============================================================ */
function iconGoogle(){
  return '<svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.08-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33C2.44 15.98 5.48 18 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>';
}
function updateStoreNote(){
  var el = $('#store-note-text');
  if(!el) return;
  var user = Auth.isEnabled() ? Auth.currentUser() : null;
  el.textContent = user
    ? ('Google 계정('+(user.email||user.displayName||'')+')에 저장됨 · 다른 기기에서도 로그인하면 보여요')
    : '이 기기 브라우저에 저장됨 · 기기 변경 전 전체 백업 권장';
}
function renderAccountBox(){
  updateStoreNote();
  var box = $('#account-box');
  if(!box) return;
  if(!Auth.isEnabled()){ box.innerHTML=''; return; }
  var user = Auth.currentUser();
  if(user){
    box.innerHTML =
      '<span class="small muted sync-status" id="sync-status" style="white-space:nowrap"></span>'+
      (user.photoURL? '<img src="'+user.photoURL+'" alt="" style="width:26px;height:26px;border-radius:50%">' : '')+
      '<button class="btn ghost sm" id="btn-sign-out">로그아웃</button>';
    $('#btn-sign-out',box).onclick = function(){ Auth.signOut(); };
    setSyncStatusText(S.lastSyncFromCache?'오프라인 · 재연결 시 동기화':'동기화됨');
  } else {
    box.innerHTML = '<button class="btn ghost sm" id="btn-sign-in">'+iconGoogle()+' Google로 로그인</button>';
    $('#btn-sign-in',box).onclick = function(){
      Auth.signIn().catch(function(err){ console.error(err); toast('로그인에 실패했어요'); });
    };
  }
}
function setSyncStatusText(t){
  var el = $('#sync-status');
  if(el) el.textContent = t;
}
function startCloudWatch(){
  CloudStore.watch(function(list, meta){
    S.lastSyncFromCache = meta.fromCache;
    setSyncStatusText(meta.fromCache? '오프라인 · 재연결 시 동기화' : '동기화됨');
    if(!S.pat){ applyLibraryList(list); renderLibrary(); }
  });
}
function mergeLocalIntoCloud(){
  return Promise.all([LocalStore.listAll(), CloudStore.listAll()]).then(function(res){
    var local = res[0], cloudIds = new Set(res[1].map(function(p){return p.id;}));
    var orphans = local.filter(function(p){ return !cloudIds.has(p.id); });
    if(!orphans.length) return;
    return confirmModal('도안 업로드', '이 기기에만 있는 도안 '+orphans.length+'개를 계정으로 업로드해서 다른 기기에서도 볼 수 있게 할까요?', {okLabel:'업로드'}).then(function(ok){
      if(!ok) return;
      return Promise.all(orphans.map(function(p){ return CloudStore.put(p).then(function(){ return LocalStore.del(p.id); }); }))
        .then(function(){ toast(orphans.length+'개 도안을 업로드했어요'); });
    });
  });
}
function handleAuthChange(user){
  renderAccountBox();
  if(user){
    mergeLocalIntoCloud().then(function(){
      startCloudWatch();
      if(!S.pat) refreshLibraryMeta().then(renderLibrary);
    });
  } else {
    CloudStore.unwatch();
    if(!S.pat) refreshLibraryMeta().then(renderLibrary);
  }
}

/* ============================================================
   초기화
   ============================================================ */
function renderAutoBackupUI(){
  var box = $('#autobackup-box'), note = $('#autobackup-note');
  if(!box || !AutoBackup.supported()){ if(box) box.innerHTML=''; if(note) note.hidden=true; return; }
  if(AutoBackup.isEnabled()){
    box.innerHTML = '<button class="btn ghost" id="btn-autobackup-off">자동 백업 끄기</button>';
    $('#btn-autobackup-off',box).onclick = function(){
      AutoBackup.turnOff().then(renderAutoBackupUI);
      toast('자동 백업을 껐어요');
    };
    note.hidden = false;
    note.innerHTML = '<span class="dot"></span>자동 백업 폴더: "'+escapeHtml(AutoBackup.folderName()||'')+'" (구글드라이브 등 동기화 폴더면 자동으로 클라우드에도 저장돼요)';
  } else {
    box.innerHTML = '<button class="btn ghost" id="btn-autobackup-on">자동 백업 폴더 설정</button>';
    $('#btn-autobackup-on',box).onclick = function(){
      AutoBackup.choose().then(function(){
        renderAutoBackupUI();
        toast('자동 백업을 시작했어요');
      }).catch(function(err){
        if(err && err.name!=='AbortError') toast('폴더를 선택하지 못했어요');
      });
    };
    note.hidden = true;
  }
}
function initLibraryButtons(){
  $('#btn-new-pattern').onclick = createNewPattern;
  $('#btn-import-photo').onclick = function(){ openImportModal(); };
  $('#btn-open-file').onclick = function(){ $('#file-open-input').click(); };
  $('#file-open-input').onchange = function(e){ if(e.target.files[0]) openSingleFile(e.target.files[0]); e.target.value=''; };
  $('#btn-backup').onclick = backupAll;
  var backupInput = $('#file-backup-input');
  document.addEventListener('dragover', function(e){ e.preventDefault(); });
}

function init(){
  initLibraryButtons();
  initTopbarMenus();
  setupPointerEvents();
  window.addEventListener('resize', function(){ if(S.pat) drawEditor(); });

  Auth.init().then(function(initialUser){
    renderAccountBox();
    return Data.init().then(function(){
      return initialUser ? mergeLocalIntoCloud() : null;
    });
  }).then(function(){
    return refreshLibraryMeta();
  }).then(function(list){
    if(list.length===0){
      var sample = makeSampleHeart();
      return Data.put(sample).then(refreshLibraryMeta);
    }
  }).then(function(){
    renderLibrary();
    if(Auth.currentUser()) startCloudWatch();
    Auth.onChange(handleAuthChange);
    return AutoBackup.load();
  }).then(function(){
    renderAutoBackupUI();
  });

  registerSW();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
