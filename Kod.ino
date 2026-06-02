#include <WiFi.h>
#include <FirebaseESP32.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <I2CKeyPad.h>
#include <time.h> 

#define WIFI_SSID "KMLAKGN"
#define WIFI_PASSWORD "qazxsw123456"
#define FIREBASE_HOST "https://zaman-sinirlamali-kilit-default-rtdb.europe-west1.firebasedatabase.app"
#define FIREBASE_AUTH "T2pbamDajELkBpqCdFtBfdqHWopxlrCVgN9s7lzh"

const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 0; 
const int   daylightOffset_sec = 0;

#define RGB_RED   25
#define RGB_GREEN 26
#define RGB_BLUE  27
#define BUZZER    33
#define EXIT_BUTTON 4 

Adafruit_SSD1306 display(128, 64, &Wire, -1);
I2CKeyPad keyPad(0x20);
char keymap[16] = "123?456?789?*0#"; 

FirebaseData fbdo;       
FirebaseData fbdoDurum;  
FirebaseConfig config;
FirebaseAuth auth;

String inputCode = ""; 
unsigned long sonDurumKontrol = 0;

// BAKIM MODU GLOBAL DEĞİŞKENLERİ
bool bakimModuAktif = false;
bool zamanliBakimGlobal = false;
String bakimMesaji = ""; 
unsigned long bakimBasGlobal = 0;
unsigned long bakimBitGlobal = 0;

int iceridekiKisiSayisi = 0;

void renkKapat() {
  digitalWrite(RGB_RED, LOW); digitalWrite(RGB_GREEN, LOW); digitalWrite(RGB_BLUE, LOW);
}

void renkAyarla(int r, int g, int b) {
  renkKapat(); 
  if(r) digitalWrite(RGB_RED, HIGH);
  if(g) digitalWrite(RGB_GREEN, HIGH);
  if(b) digitalWrite(RGB_BLUE, HIGH);
}

void bip(int sure) {
  digitalWrite(BUZZER, HIGH); delay(sure); digitalWrite(BUZZER, LOW);
}

unsigned long anlikZamaniAl() {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return 0;
  time(&now);
  return (unsigned long)now; 
}

// YENİ: OLED Ekrana Yansıtmak İçin Türkiye Saati (GMT+3) Formatlayıcı
String formatTarihOled(unsigned long unixT) {
  if(unixT == 0) return "";
  // UTC zamanına 10800 saniye (3 saat) ekleyerek yerel saati buluyoruz
  time_t t = (time_t)(unixT + 10800);
  struct tm *tm_info = gmtime(&t);
  char buffer[20];
  // Çıktı Formatı: "12/05 14:00"
  sprintf(buffer, "%02d/%02d %02d:%02d", tm_info->tm_mday, tm_info->tm_mon + 1, tm_info->tm_hour, tm_info->tm_min);
  return String(buffer);
}

void ekraniGuncelle() {
  display.clearDisplay();
  display.setTextColor(WHITE);
  display.setTextSize(1);
  display.setCursor(15, 5); 
  display.println("SIFRENIZI GIRINIZ");
  display.drawFastHLine(0, 15, 128, WHITE);
  
  display.setTextSize(2);
  int startX = 22;
  int spacing = 24;
  for (int i = 0; i < 4; i++) {
    display.drawFastHLine(startX + (i * spacing), 50, 15, WHITE); 
    display.setCursor(startX + (i * spacing), 32);
    if (i < inputCode.length()) display.print(inputCode[i]);
  }

  display.display();
}

void sonucGoster(bool basarili, String hataMesaji = "") {
  display.clearDisplay();
  display.fillRect(0, 0, 128, 64, WHITE); 
  display.setTextColor(BLACK);
  
  if (basarili) {
    display.setTextSize(2);
    display.setCursor(40, 15); display.print("IZIN");
    display.setCursor(20, 38); display.print("VERILDI");
    renkAyarla(0, 1, 0); bip(500); 
  } else {
    display.setTextSize(1);
    display.setCursor(35, 15); display.print("REDDEDILDI");
    int xPos = 64 - (hataMesaji.length() * 3);
    if(xPos < 0) xPos = 5;
    display.setCursor(xPos, 40); 
    display.print(hataMesaji);
    renkAyarla(1, 0, 0); bip(100); delay(80); bip(100); 
  }
  display.display();
  delay(2500);
  display.setTextColor(WHITE); renkKapat();
  inputCode = ""; ekraniGuncelle();
}

bool sifreyiKontrolEt(String girilenPin, String &hata, String &atananKullanici) {
  hata = "HATALI PIN"; 
  atananKullanici = "Bilinmiyor";

  if (Firebase.ready()) {
    if (Firebase.get(fbdo, "/aktif_sifreler")) {
      
      if (fbdo.dataType() == "null") {
         hata = "SIFRE YOK"; 
         return false;
      }

      FirebaseJson &json = fbdo.jsonObject();
      size_t len = json.iteratorBegin();
      String key, value;
      int type = 0;
      unsigned long suAn = anlikZamaniAl();

      for (size_t i = 0; i < len; i++) {
        json.iteratorGet(i, type, key, value);
        FirebaseJsonData jsonData;
        FirebaseJson obj;
        obj.setJsonData(value);
        
        String p = "";
        if (obj.get(jsonData, "kapi_pini")) {
            p = jsonData.stringValue;
            if (p == "" || p == "null") p = String(jsonData.intValue); 
        }
        p.trim(); girilenPin.trim(); 
        
        if (girilenPin == p && p != "") {
            bool iptalEdildi = false;
            if (obj.get(jsonData, "iptal_edildi")) iptalEdildi = jsonData.boolValue;

            if (obj.get(jsonData, "atandigi_id")) {
                atananKullanici = jsonData.stringValue;
                if(atananKullanici == "" || atananKullanici == "null") atananKullanici = "Bilinmiyor";
            }

            unsigned long bas = 0, bit = 0;
            if (obj.get(jsonData, "baslangic")) {
                bas = jsonData.intValue > 0 ? jsonData.intValue : (unsigned long)jsonData.doubleValue;
            }
            if (obj.get(jsonData, "bitis")) {
                bit = jsonData.intValue > 0 ? jsonData.intValue : (unsigned long)jsonData.doubleValue;
            }

            if (!iptalEdildi && suAn >= bas && suAn <= bit) { 
                json.iteratorEnd(); 
                return true; 
            } 
            else if (iptalEdildi) hata = "IPTAL EDILMIS";
            else if (suAn < bas) hata = "HENUZ AKTIF DEGIL";
            else hata = "SURESI DOLMUS";
        }
      }
      json.iteratorEnd(); 
      return false; 
    } else {
      String err = fbdo.errorReason();
      err.toUpperCase();
      if(err.length() > 10) err = err.substring(0, 10);
      hata = err; 
      return false;
    }
  }
  hata = "BAGLANTI YOK";
  return false;
}

void setup() {
  Serial.begin(115200);
  pinMode(RGB_RED, OUTPUT); pinMode(RGB_GREEN, OUTPUT); pinMode(RGB_BLUE, OUTPUT); pinMode(BUZZER, OUTPUT);
  pinMode(EXIT_BUTTON, INPUT_PULLUP); 
  
  renkKapat(); 
  Wire.begin(21, 22);
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  display.clearDisplay(); display.setTextColor(WHITE); display.setCursor(15, 25);
  display.println("SISTEM YUKLENIYOR"); display.display();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  struct tm timeinfo;
  while(!getLocalTime(&timeinfo)){ delay(500); } 
  
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;

  fbdo.setBSSLBufferSize(4096, 1024);
  fbdoDurum.setBSSLBufferSize(2048, 1024);

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  fbdo.setResponseSize(4096);
  fbdoDurum.setResponseSize(1024);

  display.clearDisplay(); display.setCursor(15, 25);
  display.println("SISTEM YUKLENDI!"); display.display();
  bip(100); delay(1000);
  keyPad.begin(); ekraniGuncelle(); 
}

void loop() {
  // === BAKIM MODU KONTROLÜ ===
  if (millis() - sonDurumKontrol > 3000) {
    sonDurumKontrol = millis();
    if (Firebase.ready()) {
      if (Firebase.get(fbdoDurum, "/sistem_durumu")) {
        if (fbdoDurum.dataType() != "null") {
          FirebaseJson &json = fbdoDurum.jsonObject();
          FirebaseJsonData jsonData;
          
          bool mBakim = false;
          if (json.get(jsonData, "manuel_bakim")) mBakim = jsonData.boolValue;
          
          bool zBakim = false;
          if (json.get(jsonData, "zamanli_bakim")) zBakim = jsonData.boolValue;
          
          unsigned long bas = 0, bit = 0;
          if (json.get(jsonData, "baslangic")) bas = jsonData.intValue > 0 ? jsonData.intValue : (unsigned long)jsonData.doubleValue;
          if (json.get(jsonData, "bitis")) bit = jsonData.intValue > 0 ? jsonData.intValue : (unsigned long)jsonData.doubleValue;
          
          if (json.get(jsonData, "mesaj")) bakimMesaji = jsonData.stringValue;
          else bakimMesaji = "SISTEM BAKIMDA";

          unsigned long suAn = anlikZamaniAl();
          bool yeniDurum = mBakim || (zBakim && suAn >= bas && suAn <= bit);
          
          if (yeniDurum != bakimModuAktif) {
            bakimModuAktif = yeniDurum;
            zamanliBakimGlobal = zBakim && !mBakim; // Eğer manuel öncelikliyse zamanlı sayılmaz
            bakimBasGlobal = bas;
            bakimBitGlobal = bit;

            if (bakimModuAktif) {
              renkAyarla(1, 1, 0); 
              display.clearDisplay();
              display.fillRect(0, 0, 128, 64, BLACK); 
              display.setTextColor(WHITE);
              display.setTextSize(1);
              
              int xPos = 64 - (bakimMesaji.length() * 3);
              if(xPos < 0) xPos = 0;

              // GÜNCELLEME: Eğer Zamanlı Bakım ise Ekrana Tarihleri Bas!
              if (zamanliBakimGlobal && bakimBasGlobal > 0 && bakimBitGlobal > 0) {
                  display.setCursor(xPos, 5); 
                  display.print(bakimMesaji);
                  
                  display.drawFastHLine(0, 16, 128, WHITE);
                  
                  display.setCursor(0, 25);
                  display.print("BAS: " + formatTarihOled(bakimBasGlobal));
                  
                  display.setCursor(0, 45);
                  display.print("BIT: " + formatTarihOled(bakimBitGlobal));
              } else {
                  // Anında bakımsa sadece mesaj yazsın
                  display.setCursor(xPos, 28); 
                  display.print(bakimMesaji);
              }
              
              display.display();
            } else {
              renkKapat();
              inputCode = "";
              ekraniGuncelle();
            }
          }
        }
      }
    }
  }

  if (bakimModuAktif) return;

  // === İÇERİDEN ÇIKIŞ BUTONU ===
  if (digitalRead(EXIT_BUTTON) == LOW) {
    if (iceridekiKisiSayisi > 0) {
        iceridekiKisiSayisi--; 

        renkAyarla(0, 0, 1); 
        bip(500); 
        
        display.clearDisplay(); display.fillRect(0, 0, 128, 64, WHITE);
        display.setTextColor(BLACK); display.setTextSize(2);
        display.setCursor(15, 15); display.print("ICERIDEN");
        display.setCursor(35, 38); display.print("CIKIS"); display.display();

        FirebaseJson log;
        log.add("denenen_pin", "BUTON"); log.add("durum", "Basarili");
        log.add("tip", "Iceriden Cikis"); log.add("zaman", anlikZamaniAl());
        log.add("kullanici_id", "Manuel Cikis"); 
        Firebase.pushJSON(fbdo, "/sistem_loglari", log);

        delay(2500); 
        display.setTextColor(WHITE); renkKapat(); inputCode = ""; ekraniGuncelle();
    } else {
        delay(200); 
    }
  }

  // === TUŞ TAKIMI ===
  if (keyPad.isPressed()) {
    uint8_t index = keyPad.getKey();
    if (index < 16) {
      char key = keymap[index];
      
      if (key >= '0' && key <= '9' && inputCode.length() < 4) {
        renkAyarla(0, 0, 1); bip(50); renkKapat();         
        inputCode += key; ekraniGuncelle();
      }
      else if (key == '#' && inputCode.length() == 4) {
        renkAyarla(0, 1, 1); bip(150); renkKapat();         
        
        display.clearDisplay(); display.setTextSize(1); display.setCursor(35, 28); 
        display.println("KONTROL..."); display.display();
        
        String hataMesaji = ""; String sahipId = "Bilinmiyor";
        bool sonuc = sifreyiKontrolEt(inputCode, hataMesaji, sahipId);
        
        if (sonuc) {
            iceridekiKisiSayisi++;
        }

        FirebaseJson log;
        log.add("denenen_pin", inputCode); log.add("durum", sonuc ? "Basarili" : hataMesaji); 
        log.add("tip", sonuc ? "Basarili Giris" : "Hatali Giris"); 
        log.add("zaman", anlikZamaniAl()); log.add("kullanici_id", sahipId); 
        Firebase.pushJSON(fbdo, "/sistem_loglari", log);
        
        sonucGoster(sonuc, hataMesaji);
      }
      else if (key == '*') {
        if (inputCode.length() > 0) {
          renkAyarla(1, 0, 1); bip(40); renkKapat();         
          inputCode.remove(inputCode.length() - 1); ekraniGuncelle();
        }
      }
    }
    delay(250);
  }
}