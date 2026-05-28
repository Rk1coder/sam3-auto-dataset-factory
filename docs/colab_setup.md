# Colab GPU Server — Kurulum Rehberi

Birkaç dakika içinde Google Colab üzerinde bir GPU sunucusu başlatıp web uygulamasına bağlayabilirsiniz. **GitHub veya dosya indirmeye gerek yok** — notebook tamamen bağımsız çalışır.

---

## Hızlı Başlangıç (5 adım)

### Adım 1 — Notebook'u Colab'da aç

1. [Google Colab](https://colab.research.google.com)'a git
2. **File → Upload notebook** → `apps/server/notebooks/colab_sam3_server.ipynb` dosyasını yükle
3. **Runtime → Change runtime type → T4 GPU** seç (ücretsiz kota dahilinde)

### Adım 2 — ngrok token al (tek seferlik)

1. [ngrok.com](https://ngrok.com) → ücretsiz hesap aç
2. [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken) adresinden token kopyala
3. Notebook'ta **Hücre 6**'daki `NGROK_TOKEN = ''` satırına token'ı yapıştır

### Adım 3 — Hücreleri sırayla çalıştır

```
Hücre 1 → GPU kontrolü
Hücre 2 → Paket kurulumu (~1 dakika)
Hücre 3 → Mock mı gerçek mi? (USE_REAL_MODEL = False ile başla)
Hücre 4 → API key ayarla
Hücre 5 → Sunucu kodunu oluştur
Hücre 6 → ngrok token gir
Hücre 7 → Sunucuyu başlat ve URL al ← SON ÇIKTI BURADAN
```

**Hücre 7 çıktısı şu şekilde görünür:**
```
============================================================
SUNUCU HAZIR!
============================================================
Public URL: https://xxxx-xx-xx-xxx-xx.ngrok-free.app
API Key:    sam3-test-2024
API Docs:   https://xxxx.ngrok-free.app/api/docs
============================================================
```

### Adım 4 — Web uygulamasına bağlan

1. Web uygulamasında **Settings** sayfasına git
2. **API Server URL** → ngrok URL'yi yapıştır (örn: `https://xxxx.ngrok-free.app`)
3. **API Key** → Hücre 4'te belirlediğin key'i gir (varsayılan: `sam3-test-2024`)
4. **Save & Reload** butonuna bas

### Adım 5 — Bağlantıyı doğrula

Settings sayfasında **Model Status** bölümünde şunu görmelisin:

| Alan | Mock Mode | Gerçek GPU |
|------|-----------|------------|
| Status | ok | ok |
| Device | cpu | cuda:0 |
| Mock Mode | true | false |
| Model Loaded | true | true |

---

## Mock vs Gerçek Model

### Mock Mode (varsayılan, GPU gerekmez)

```python
USE_REAL_MODEL = False  # Hücre 3'te
```

- T4 GPU bile gerekmez, CPU runtime'da çalışır
- Rastgele bounding box üretir (gerçekçi dağılım)
- Annotation pipeline'ını test etmek için idealdir
- Saniyeler içinde hazır

### Gerçek Model (Grounding DINO)

```python
USE_REAL_MODEL = True  # Hücre 3'te
```

- T4 GPU gerekir (ücretsiz Colab kotası dahilinde)
- `IDEA-Research/grounding-dino-base` modeli HuggingFace'den indirilir (~1 GB)
- Text prompt ile zero-shot object detection yapar
- İlk yüklemede ~2-3 dakika bekle

---

## Kullanım Akışı

```
Colab Notebook
      │
      │ ngrok tunnel
      ▼
https://xxxx.ngrok-free.app
      │
      │ X-API-Key header
      ▼
Web Uygulaması (Settings → API Server URL)
      │
      ├── Datasets → görsel yükle
      ├── Auto-Label → job başlat
      ├── Review → annotation'ları kabul/red
      └── Export → YOLO format .zip indir
```

---

## Sık Karşılaşılan Sorunlar

### "403 Forbidden" hatası
→ API Key yanlış girilmiş. Settings sayfasında key'i kontrol et.

### "Cannot reach server"
→ ngrok URL değişmiş. Colab'da Hücre 7'yi tekrar çalıştır, yeni URL'yi Settings'e yapıştır.

### ngrok tunnel açılmıyor
→ Token girilmemiş. Hücre 6'da `NGROK_TOKEN` değişkenini doldur.

### Model yüklenmiyor (gerçek mod)
→ T4 GPU seçilmemiş. Runtime → Change runtime type → T4 GPU.

### Colab bağlantısı kopuyor
→ Veri kaybolur (in-memory store). Colab Pro ile daha uzun oturum veya notebook'a kaydetme kodu ekle.

---

## Yerel GPU (A5000/H100)

Kendi GPU sunucun varsa Colab gerekmez:

```bash
cd apps/server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export API_KEY=my-secret-key
export DEVICE=cuda:0
export USE_MOCK=false
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Sunucu `0.0.0.0:8000`'de dinliyor. Local ağda `http://192.168.x.x:8000` veya internet üzerinden port forwarding ile bağlanabilirsin.

---

## Veri Yedekleme (Colab kapanmadan önce)

Colab oturumu kapandığında tüm yüklenen görseller ve annotation'lar silinir. Kapatmadan önce export yap:

1. Web uygulamasında **Export** sayfasına git
2. **Generate YOLO Export** butonu
3. Zip dosyasını indir

Görselleri de kaydetmek için Colab'da:
```python
import shutil
shutil.make_archive('/content/my_dataset', 'zip', '/content/data')
# Sonra Files panelinden indir
```
