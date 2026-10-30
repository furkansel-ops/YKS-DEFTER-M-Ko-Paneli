const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("coach-layout-v40.css");
const block=query=>{const at=css.indexOf("@media("+query+"){");assert.ok(at>=0,query);let depth=0,i=css.indexOf("{",at);for(;i<css.length;i++){if(css[i]==="{")depth++;else if(css[i]==="}"&&--depth===0)break}return css.slice(at,i+1)};

test("v40 yerleşim dosyası temalardan sonra yüklenir",()=>{
  const html=read("index.html");
  assert.ok(html.indexOf("coach-layout-v40.css")>html.indexOf("coach-themes-v36.css"),"temalardan sonra");
  assert.ok(html.indexOf("coach-layout-v40.css")<html.indexOf("</head>"));
});

test("v40 sayfa geçişinde başlık aynı yerde: aynı kenar boşluğu ve aynı boy, Programlar ve Ayarlar dahil",()=>{
  const pc=block("min-width:1180px"),tablet=block("min-width:760px) and (max-width:1179px");
  assert.match(pc,/padding:34px clamp\(24px,4vw,54px\) 48px/);
  assert.match(pc,/\.settings-page\) h1\{font-size:36px\}/);
  assert.match(pc,/#programsPage \.coach-v15-title-group h1\{font-size:36px\}/);
  assert.match(pc,/\.settings-page>\.settings-head\{margin-left:0\}/);
  assert.match(tablet,/h1\{font-size:28px\}[\s\S]*#programsPage \.coach-v15-title-group h1\{font-size:28px\}/);
  // Programlar'ın ikonu yol satırına geçer; başlık soldan başlar ve yukarı hizalanır.
  assert.match(css,/#programsPage \.programs-head \.coach-v15-title-icon\{position:absolute;left:0;top:0;width:24px;height:24px/);
  assert.match(css,/#programsPage \.programs-head \.coach-v15-header-main\{align-items:flex-start/);
});

test("v40 açılır listeler kutularının tamamını kaplar",()=>{
  for(const id of ["reportStudentSelect","examStudentSelect","examTypeSelect","errorStudentSelect","errorSubjectSelect","topicStudentSelect","topicExamSelect","topicSubjectSelect","topicStatusSelect","topicSearchInput","programStudentSelect"])
    assert.match(css,new RegExp("#"+id+"[^{]*\\{position:absolute;inset:0;width:100%;height:100%"),id);
});

test("v40 telefonda 16px kenar ve en az 40px dokunma alanı",()=>{
  const phone=block("max-width:759px");
  assert.match(phone,/padding-left:16px;padding-right:16px/);
  assert.match(phone,/#programsPage\.programs-page\{padding-left:16px;padding-right:16px\}/);
  assert.match(phone,/\.message-list-filters button,\[data-message-template\],#topicQuickFilters button,\.coach-v6-add-day,\.student-actions button\)\{min-height:40px\}/);
  assert.match(phone,/#messageSendBtn\{min-height:44px\}/);
  assert.match(phone,/:not\(\[data-layout="list"\]\) \.coach-v6-add-day\{height:auto;min-height:40px\}/);
  assert.match(phone,/label\.report-search\)\{min-height:44px/);
});

test("v40 kart köşeleri iki ölçüde: büyük kart 16px, kart içi kutu 12px",()=>{
  assert.match(css,/\.dash-panel,\.students-card,\.messages-shell,\.coach-settings-category-list,\.coach-settings-profile,\.pp-coach-state,\.coach-v15-stat\)\{border-radius:16px\}/);
  assert.match(css,/\.dashboard-day-review-empty,\.message-compose-box\)\{border-radius:12px\}/);
});

test("v40 alçak pencerede yan menü kaydırmadan sığar; normal yükseklikte değişmez",()=>{
  const pc=block("min-width:1180px) and (max-height:760px"),rail=block("min-width:760px) and (max-width:1179px) and (max-height:760px");
  assert.match(pc,/\.coach-nav-item\{min-height:32px\}/);
  assert.match(pc,/\.coach-nav-group\{padding:7px 12px 2px\}/);
  assert.match(pc,/\.coach-signout-v20\{height:34px\}/);
  assert.match(rail,/\.coach-nav-item\{padding:5px 2px;gap:1px\}/);
  assert.doesNotMatch(block("min-width:1180px"),/min-height:32px/,"yüksek pencerede menü aynı kalır");
});
