const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Hocalar ve Videolar konu bazlı eşleşme ve öneri bilgisini korur',()=>{
  const html=read('index.html');
  const videos=read('program-videos-v1.js');
  const app=read('app-reset.js');
  const css=read('program-videos-v1.css');

  assert.match(html,/program-videos-v1\.js\?v=1\.8\.0/);
  assert.match(html,/program-videos-v1\.css\?v=1\.4\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.53/);

  assert.match(videos,/const TOPICS=/);
  assert.match(videos,/const TOPIC_ALIASES=/);
  assert.match(videos,/id="coachVideoTopic"/);
  assert.match(videos,/function rebuildTopics\(\)/);
  assert.match(videos,/function topicTerms\(topic\)/);
  assert.match(videos,/function topicMatches\(title\)/);
  assert.match(videos,/if\(!topicMatches\(title\)\)return false/);
  assert.match(videos,/state\.mode,state\.scope,state\.subject,state\.topic,state\.teacher/);
  assert.match(videos,/topic:compact\(state\.topic\)\.slice\(0,120\)/);
  assert.match(videos,/const topicPart=state\.topic\?/);

  assert.match(app,/topic=String\(detail\.topic\|\|""\)/);
  assert.match(app,/subject,topic,scope,thumb/);
  assert.match(css,/\.coach-video-topic-field/);
});
