# YKS Defterim · Koç Paneli

YKS Defterim öğrenci uygulamasından ayrı çalışan bağımsız koç paneli.

- Aynı Firebase projesini (`yks-uygulamam`) kullanır.
- Koç hesabı Google ile açılır/giriş yapar.
- Öğrenciler, YKS Defterim içindeki **Koç Kodum** koduyla eklenir.
- Koç yalnızca `coachingShares` üzerinden paylaşılan öğrenci verilerini görür.
- **Program** sekmesi öğrencinin YKS Defterim → Programım verisini canlı ve salt okunur olarak aynalar; rutinler, ders programı, tamamlanan/taşınan görevler, gün durumu ve haftalar birlikte görünür.
- Koç görevleri `coachingActions` üzerinden öğrenciye gönderilir.
- **Konular v1.8** paylaşılan konuların sayısını, tamamlanan/devam eden/geciken kayıtları ve TYT/AYT ayrımıyla ders dağılımını gösterir. Arama, ders ve durum filtreleri tüm paylaşılan kayıtlar üzerinde çalışır.
- Konu aşamaları öğrenciyle aynıdır: **Başlanmadı → İşledim → Soru çözdüm → Pekiştirdim**. Sayılar tüm müfredatı değil, paylaşılan kayıtları kapsar. Son çalışma ve tekrar ihtiyacı paylaşılmadığı için hesaplanmaz.
- Konuya son tarih `{key,date}` ile `topic_deadline`; çalışma ve tekrar görevleri `{text,date}` ile `program_task` olarak mevcut kuyruğa gönderilir. Başarılı gönderim, öğrencide uygulanmış olduğu anlamına gelmez.
- Canlı güncellemelerde Konular filtreleri ve görev taslağı korunur. Öğrenci değiştiğinde sıfırlanır; bekleyen gönderim yeni öğrenciye taşınmaz.

Geliştirme denetimi: `npm ci --ignore-scripts` ardından `npm test`. CI, Node 22 ve 24 üzerinde veri hesapları, DOM etkileşimleri, tekrar render ve action sözleşmesi regresyonlarını çalıştırır. Üretim paneli ek çalışma zamanı bağımlılığı kullanmaz; jsdom yalnız test içindir.

Bu repo koç tarafını YKS Defterim ana uygulamasından ayırmak için oluşturulmuştur.
