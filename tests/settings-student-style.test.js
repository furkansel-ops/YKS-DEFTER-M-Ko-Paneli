const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('koç ayarları YKS Defterim ayarları gibi genel görünüm ve detay akışı kullanır',()=>{
  const html=read('index.html'),js=read('app-reset.js'),css=read('settings-v21.css');

  for(const id of [
    'coachSettingsOverview','coachSettingsSearch','settingsMiniAvatar','settingsMiniName',
    'coachSettingsDetail','coachSettingsBack','coachSettingsDetailTitle',
    'settingsDefaultPage','settingsCompactMode','coachSettingsForm',
    'settingsCtrlEnter','settingsQuickMessages','settingsReduceMotion','settingsSignOutBtn'
  ])assert.match(html,new RegExp('id="'+id+'"'));

  assert.match(html,/settings-v21\.css\?v=3\.0\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.51/);
  assert.doesNotMatch(html,/class="settings-sidebar"/);
  assert.doesNotMatch(html,/class="settings-nav"/);

  assert.match(js,/const COACH_SETTINGS_META=/);
  assert.match(js,/function openCoachSettingsOverview/);
  assert.match(js,/function openCoachSettingsTab/);
  assert.match(js,/coachSettingsSearch/);
  assert.match(js,/data-settings-search/);
  assert.match(js,/if\(page==="settings"\).*openCoachSettingsOverview/s);

  assert.match(css,/\.coach-settings-search/);
  assert.match(css,/\.coach-settings-profile/);
  assert.match(css,/\.coach-settings-category-list/);
  assert.match(css,/\.coach-settings-detail-heading/);
  assert.match(css,/Settings v3 — YKS Defterim ile aynı bilgi mimarisi/);
});
