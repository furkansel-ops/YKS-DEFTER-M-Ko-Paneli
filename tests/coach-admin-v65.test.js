"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");

test("v65 yan menü ve hızlı işlemler karakter yerine çizgi simge kullanır; sayfa bağlantıları aynı",()=>{
  const html=read("index.html");
  const nav=html.slice(html.indexOf('id="coachNav"'),html.indexOf("</nav>",html.indexOf('id="coachNav"')));
  const pages=[...nav.matchAll(/data-coach-page="(\w+)"/g)].map(m=>m[1]);
  assert.deepEqual(pages,["home","students","programs","reports","paragraphProblem","exams","topics","errors","messages","appointments","settings"]);
  assert.equal((nav.match(/<span aria-hidden="true"><svg class="coach-v65-ic"/g)||[]).length,11,"her menü öğesinde simge");
  assert.doesNotMatch(nav,/<span>[^<]{1,2}<\/span>/,"eski karakter simge kalmadı");
  assert.equal((html.match(/data-go-page="\w+"><span aria-hidden="true"><svg/g)||[]).length,4,"hızlı işlemler");
});

test("v65 yazı tipi ve Admin V2 en son yüklenir; renkler yalnız Sade Mavi'de",()=>{
  const html=read("index.html"),theme=read("coach-themes-v36.css"),css=read("admin-v65.css");
  assert.ok(html.indexOf("admin-v65.css")>html.indexOf("books-v59.css"));
  assert.match(html,/fonts\.googleapis\.com\/css2\?family=Plus\+Jakarta\+Sans[^"]*display=swap/);
  assert.match(css,/font-family:"Plus Jakarta Sans"/);
  const block=theme.slice(theme.indexOf("/* v65"));
  for(const rule of block.replace(/\/\*[\s\S]*?\*\//g,"").match(/[^{}]+(?=\{)/g))assert.match(rule.trim(),/^:root:not\(\[data-theme\]\)/,"Gece/Canlı'ya sızmaz: "+rule.trim());
});
