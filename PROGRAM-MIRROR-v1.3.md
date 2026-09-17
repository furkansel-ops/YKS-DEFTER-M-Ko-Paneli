# Programım canlı ayna · v1.3

Bu sürüm yalnızca bağımsız YKS Koç Paneli deposunu değiştirir. YKS Defterim öğrenci deposunda hiçbir dosya değiştirilmez.

Koç panelinin Program sekmesi, öğrencinin `coachingShares/{studentUid}.program` verisini kullanır ve YKS Defterim Programım görünümünü salt okunur olarak aynalar:

- Pazartesi–Pazar haftalık yapı ve hafta gezinmesi
- Haftalık ilerleme özeti ve günlük görev sayaçları
- Rutinler alanı
- Ders Programım satır adları
- Görev tamamlandı işaretleri (`dn`)
- Önceki günden taşınan görevler (`mv`)
- Gün tamamlandı durumu (`done`)
- Canlı Firestore snapshot yenilemesi

Koçtan öğrenciye görev gönderme mevcut `coachingActions` kuyruğunu kullanmaya devam eder. Ayna katmanı Firestore'a doğrudan yazmaz ve öğrenci Programım verisini kendi başına değiştirmez.
